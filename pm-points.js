// PuzzleMixx points: one online profile per player, shared by every puzzle.
// Exposes window.PM. Works in a reduced "not set up yet" mode until
// window.PM_FIREBASE_CONFIG (firebase-config.js) is filled in.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink,
  signInWithEmailLink, signOut as fbSignOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, writeBatch, collection, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, increment, addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const ADMIN_EMAIL = (window.PM_ADMIN_EMAIL || 'puzzlemixx@gmail.com').toLowerCase();
// Rolling 90-day rounds. Round 0 runs 16 Nov 2026 – 14 Feb 2027 (ends 15 Feb 00:00 UTC);
// every later round is exactly 90 days and starts the moment the previous one ends.
const CONTEST_START = window.PM_CONTEST_START || Date.UTC(2026, 10, 16);
const ROUND_ONE_END = window.PM_ROUND_ONE_END || Date.UTC(2027, 1, 15);
const ROUND_MS = (window.PM_ROUND_DAYS || 90) * 86400000;
function roundAt(t = Date.now()) { return t < ROUND_ONE_END ? 0 : Math.floor((t - ROUND_ONE_END) / ROUND_MS) + 1; }
function roundStart(k) { return k === 0 ? CONTEST_START : ROUND_ONE_END + (k - 1) * ROUND_MS; }
function roundEnd(k) { return ROUND_ONE_END + k * ROUND_MS; }
// A player's points in round k (players from before rounds existed keep their total as round 0).
function roundPointsOf(p, k = roundAt()) {
  const v = p?.roundPts?.[String(k)];
  if (typeof v === 'number') return v;
  return k === 0 ? (p?.points || 0) : 0;
}
const toMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : null);

// Final places for an ended round. Ties go to sudden death: among tied players, whoever is first to
// gain points in the next round takes the higher place, then the next, until all three are given.
function roundResults(board, k) {
  // Backstop: 30 days after a round ends, ties still open go to whoever reached their final score first.
  const backstop = Date.now() > roundEnd(k) + 30 * 86400000;
  const scored = board.map((p) => ({ uid: p.id, name: p.name, points: roundPointsOf(p, k), gainAt: toMs(p.firstGain?.[String(k + 1)]), reachedAt: toMs(p.lastAt?.[String(k)]), canWin: p.canWin !== false }))
    .filter((p) => p.points > 0 && p.canWin)   // players outside the prize countries play for fun
    .sort((a, b) => b.points - a.points);
  const places = [];
  const pending = [];
  let place = 1;
  for (let i = 0; i < scored.length && place <= 3;) {
    const group = scored.filter((p) => p.points === scored[i].points);
    i += group.length;
    if (group.length === 1) { places.push({ place, ...group[0], how: 'outright' }); place += 1; continue; }
    const slots = Math.min(group.length, 4 - place);
    const ahead = group.filter((p) => p.gainAt !== null).sort((a, b) => a.gainAt - b.gainAt);
    let settled = ahead.slice(0, slots);
    settled.forEach((p, n) => places.push({ place: place + n, ...p, how: 'sudden death' }));
    if (settled.length < slots && backstop) {
      const rest = group.filter((p) => !settled.includes(p)).sort((a, b) => (a.reachedAt ?? Infinity) - (b.reachedAt ?? Infinity));
      rest.slice(0, slots - settled.length).forEach((p, n) => places.push({ place: place + settled.length + n, ...p, how: 'reached score first' }));
      settled = settled.concat(rest.slice(0, slots - settled.length));
    }
    if (settled.length < slots) {
      const waiting = group.filter((p) => !settled.includes(p));
      pending.push({ places: Array.from({ length: slots - settled.length }, (_, n) => place + settled.length + n), players: waiting });
    }
    place += slots;
  }
  return { round: k, start: roundStart(k), end: roundEnd(k), places, pending, done: pending.length === 0 };
}
const PUZZLES = ['nieve', 'hannah', 'tee'];
const SHARE_LIMIT = 3;
const POINTS = { song: 1, mental: 10, share: 5, hint: -5, bonus: 100 };
const QUEUE_KEY = 'pmPendingEvents';
const EMAIL_KEY = 'pmSignInEmail';
const NAME_KEY = 'pmSignInName';

const listeners = new Set();
const state = { configured: false, ready: false, user: null, player: null, isAdmin: false, error: '' };
let auth = null;
let db = null;
let unsubscribePlayer = null;

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } }
};

function emit() { listeners.forEach((fn) => { try { fn(state); } catch (error) { console.error(error); } }); }
function contestOpen() { return true; }   // rounds roll on forever
function cleanName(name) { return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 30); }

async function emailAdmin(subject, fields) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);   // never leave the player waiting
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ADMIN_EMAIL)}`, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ _subject: subject, _template: 'table', _captcha: 'false', ...fields })
  });
  clearTimeout(timer);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false || data.success === 'false') {
    throw new Error('Sorry, the report could not be sent right now. Please email puzzlemixx@gmail.com instead.');
  }
  return data;
}

// Songs and the Mental Workout can be won once per round, so later rounds add -r1, -r2… to the event name.
function roundSuffix() { const k = roundAt(); return k === 0 ? '' : `-r${k}`; }

// Tee’s DBL PTS PuzzleMixx scores double (songs, Mental Workout and shared wins; hints still cost 5).
const pointsFor = (base, puzzle) => base * (puzzle === 'tee' ? 2 : 1);

function eventSpec(type, info = {}) {
  const puzzle = PUZZLES.includes(info.puzzle) ? info.puzzle : null;
  if (type === 'song') {
    const songId = Number(info.songId);
    if (!puzzle || !Number.isInteger(songId) || songId < 1 || songId > 10) return null;
    return { id: `song-${puzzle}-${songId}${roundSuffix()}`, data: { type, points: pointsFor(POINTS.song, puzzle), puzzle, songId, label: info.label || `Song ${songId}` } };
  }
  if (type === 'mental') {
    if (!puzzle) return null;
    return { id: `mental-${puzzle}${roundSuffix()}`, data: { type, points: pointsFor(POINTS.mental, puzzle), puzzle, label: info.label || 'The Mental Workout' } };
  }
  if (type === 'share') {
    // Share your win: +5, once per Complete Peace (or Mental Workout) per round, only for wins this round.
    if (!puzzle) return null;
    if (info.what === 'mental') return { id: `share-${puzzle}-mental${roundSuffix()}`, data: { type, points: pointsFor(POINTS.share, puzzle), puzzle, label: 'Shared The Mental Workout' } };
    const songId = Number(info.songId);
    if (!Number.isInteger(songId) || songId < 1 || songId > 10) return null;
    return { id: `share-${puzzle}-${songId}${roundSuffix()}`, data: { type, points: pointsFor(POINTS.share, puzzle), puzzle, songId, label: info.label || `Shared song ${songId}` } };
  }
  if (type === 'hint') {
    const id = `hint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return { id, data: { type, points: POINTS.hint, puzzle: puzzle || 'nieve', label: 'Hint used' } };
  }
  return null;
}

async function writeEvent(uid, id, data) {
  const playerRef = doc(db, 'players', uid);
  const eventRef = doc(db, 'players', uid, 'events', id);
  if ((await getDoc(eventRef)).exists()) return { added: false, reason: 'already' };
  const player = uid === state.user?.uid && state.player ? state.player : (await getDoc(playerRef)).data();
  const batch = writeBatch(db);
  batch.set(eventRef, { ...data, createdAt: serverTimestamp() });
  batch.update(playerRef, playerPointsUpdate(player, id, data.points));
  await batch.commit();
  return { added: true, points: data.points };
}

// Total points, this round's points, and (for sudden death) when the player first gained points this round.
function playerPointsUpdate(player, eventId, delta) {
  const k = String(roundAt());
  const update = { points: increment(delta), lastEvent: eventId, updatedAt: serverTimestamp() };
  if (k === '0' && typeof player?.roundPts?.['0'] !== 'number') update['roundPts.0'] = (player?.points || 0) + delta;
  else update[`roundPts.${k}`] = increment(delta);
  if (delta > 0 && !player?.firstGain?.[k]) update[`firstGain.${k}`] = serverTimestamp();
  update[`lastAt.${k}`] = serverTimestamp();   // when this round's score last changed (sudden-death backstop)
  return update;
}

async function flushQueue() {
  if (!state.user || !state.player) return;
  const queue = store.get(QUEUE_KEY, []);
  if (!queue.length) return;
  store.remove(QUEUE_KEY);
  for (const item of queue) {
    const spec = eventSpec(item.type, item.info);
    if (spec) await writeEvent(state.user.uid, spec.id, spec.data).catch((error) => console.warn('PuzzleMixx: could not save a queued point', error));
  }
}

// ---------- PuzzleMixxer Player IDs: 3–20 characters, unique ignoring capitals ----------
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,18}[A-Za-z0-9_]$/;
const BLOCKED = ['fuck', 'fuk', 'shit', 'cunt', 'bitch', 'bastard', 'wank', 'twat', 'dick', 'cock', 'pussy', 'slut', 'whore', 'fag', 'nigg', 'nigga', 'retard', 'spastic', 'paki', 'rape', 'nazi', 'hitler', 'porn', 'sex', 'penis', 'vagina', 'arse', 'asshole', 'bollock', 'prick', 'tosser', 'kike', 'chink', 'tranny', 'dyke', 'coon'];
function idKey(id) { return cleanName(id).toLowerCase(); }
function playerIdProblem(id) {
  const clean = cleanName(id);
  if (clean.length < 3 || clean.length > 20) return 'Your Player ID needs 3 to 20 characters.';
  if (!ID_PATTERN.test(clean)) return 'Use letters, numbers, spaces, - or _ (starting and ending with a letter or number).';
  const squashed = clean.toLowerCase().replace(/[\s_-]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/\$/g, 's');
  if (BLOCKED.some((w) => squashed.includes(w))) return 'Please choose a different Player ID.';
  return '';
}
function fallbackId() { return `Player ${Math.floor(1000 + Math.random() * 9000)}`; }

async function ensurePlayer(user) {
  const ref = doc(db, 'players', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    let wanted = cleanName(store.get(NAME_KEY, ''));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const id = wanted && !playerIdProblem(wanted) ? wanted : fallbackId();
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'playerIds', idKey(id)), { uid: user.uid, at: serverTimestamp() });
        batch.set(ref, { name: id, points: 0, lastEvent: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await batch.commit();
        break;
      } catch (error) { wanted = ''; }   // taken in the meantime: fall back to "Player 1234", which can be changed later
    }
  }
  store.remove(NAME_KEY);
}

function watchPlayer(user) {
  if (unsubscribePlayer) unsubscribePlayer();
  unsubscribePlayer = onSnapshot(doc(db, 'players', user.uid), (snap) => {
    state.player = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    emit();
  }, (error) => { state.error = error.message; emit(); });
}

function googleErrorMessage(error) {
  const code = error?.code || '';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in isn’t switched on yet. Please use the email link for now.';
  if (code === 'auth/unauthorized-domain') return 'Google sign-in isn’t allowed on this web address yet.';
  if (code === 'auth/network-request-failed') return 'No connection. Please check your internet and try again.';
  return 'Google sign-in didn’t finish. Please try again.';
}

async function completeEmailLinkSignIn() {
  if (!isSignInWithEmailLink(auth, location.href)) return;
  let email = store.get(EMAIL_KEY, '');
  if (!email) email = window.prompt('Please confirm the email address you used to sign in to PuzzleMixx:') || '';
  if (!email) return;
  try {
    await signInWithEmailLink(auth, email.trim(), location.href);
    store.remove(EMAIL_KEY);
  } catch (error) {
    state.error = 'That sign-in link has expired or was already used. Please ask for a new one.';
  }
  const url = new URL(location.href);
  ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl', 'tenantId'].forEach((key) => url.searchParams.delete(key));
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

const PM = {
  state,
  SHARE_LIMIT,
  POINTS,
  onChange(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
  contestOpen,
  roundAt, roundStart, roundEnd, roundPointsOf, roundResults,
  roundPoints(player = state.player) { return roundPointsOf(player, roundAt()); },

  // Terms agreement, kept privately with the account (only the player and the admin can read it).
  TERMS_VERSION: 3,
  async myConsent() {
    if (!state.user || !db) return null;
    try { const snap = await getDoc(doc(db, 'players', state.user.uid, 'private', 'consent')); return snap.exists() ? snap.data() : null; }
    catch { return null; }
  },
  async saveConsent({ age, country }) {
    if (!state.user || !state.player) throw new Error('Please sign in first.');
    if (age !== 'adult') throw new Error('PuzzleMixx accounts are for players aged 18 or over.');
    const code = String(country || '').toUpperCase().slice(0, 6);
    if (!code) throw new Error('Please choose where you live.');
    const canWin = (window.PM_COUNTRIES?.prize || ['GB', 'IE', 'AU', 'NZ']).includes(code);
    const batch = writeBatch(db);
    batch.set(doc(db, 'players', state.user.uid, 'private', 'consent'), { v: PM.TERMS_VERSION, at: serverTimestamp(), age, country: code });
    batch.update(doc(db, 'players', state.user.uid), { canWin, updatedAt: serverTimestamp() });
    await batch.commit();
    return { canWin };
  },

  // Prize winners send their delivery details once per round.
  async myPrize(round) {
    if (!state.user) return null;
    try { const snap = await getDoc(doc(db, 'prizes', `${round}_${state.user.uid}`)); return snap.exists() ? snap.data() : null; }
    catch { return null; }
  },
  async claimPrize(round, place, form) {
    if (!state.user || !state.player) throw new Error('Please sign in first.');
    const clean = (v, n) => String(v || '').trim().slice(0, n);
    const data = {
      uid: state.user.uid, name: state.player.name, round, place,
      fullName: clean(form.fullName, 80), address: clean(form.address, 400), country: clean(form.country, 6),
      email: clean(form.email, 120), gym: clean(form.gym, 160), charity: clean(form.charity, 160), createdAt: serverTimestamp()
    };
    if (!(window.PM_COUNTRIES?.prize || ['GB', 'IE', 'AU', 'NZ']).includes(data.country)) throw new Error('Prizes can only be sent to the United Kingdom, Ireland, Australia or New Zealand.');
    if (!data.fullName || !data.address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new Error('Please add your name, postal address and email address.');
    await setDoc(doc(db, 'prizes', `${round}_${state.user.uid}`), data);
    await emailAdmin(`PuzzleMixx: prize details from round ${round + 1} winner (${['', '1st', '2nd', '3rd'][place]} place)`, {
      Player: data.name, Place: ['', '1st', '2nd', '3rd'][place], Round: String(round + 1),
      'Full name': data.fullName, 'Postal address': data.address, Country: data.country, Email: data.email,
      'Gym / studio / sport association': data.gym || '(none nominated)', 'Back-up registered charity': data.charity || '(none given)', _replyto: data.email
    }).catch((error) => console.warn('PuzzleMixx: prize details saved, but the email failed', error));
  },
  // The first visitor after a round ends tells puzzlemixx@gmail.com the results (once, and again once ties are settled).
  async announceRound(results) {
    if (!state.user || !db) return;
    const id = results.done ? `${results.round}-final` : String(results.round);
    const line = (r) => `${['', '1st', '2nd', '3rd'][r.place]}: ${r.name} (${r.points} pts${r.how === 'sudden death' ? ', won sudden death' : ''})`;
    const summary = [...results.places.map(line), ...results.pending.map((g) => `Sudden death for ${g.places.map((n) => ['', '1st', '2nd', '3rd'][n]).join(' & ')}: ${g.players.map((x) => x.name).join(', ')}`)].join(' · ') || 'No points scored';
    try { await setDoc(doc(db, 'rounds', id), { announcedAt: serverTimestamp(), summary: summary.slice(0, 900) }); }
    catch { return; }   // already announced by someone else
    await emailAdmin(results.done ? `PuzzleMixx: round ${results.round + 1} winners confirmed` : `PuzzleMixx: round ${results.round + 1} has ended`, {
      Round: `${results.round + 1} (${new Date(results.start).toDateString()} – ${new Date(results.end - 1).toDateString()})`,
      Results: summary, 'Next step': 'Winners are asked for their delivery details in their profile; you’ll get an email when each one replies.'
    }).catch(() => {});
  },
  // Admin: delivery details sent by winners.
  async prizeClaims() {
    const snap = await getDocs(query(collection(db, 'prizes'), limit(300)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().createdAt?.toDate?.() || new Date() })).sort((a, b) => b.round - a.round || a.place - b.place);
  },

  async signUp(name, email) {
    if (!state.configured) throw new Error('Sign-in opens soon.');
    const cleanEmail = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('Please enter a valid email address.');
    store.set(EMAIL_KEY, cleanEmail);
    if (name) store.set(NAME_KEY, cleanName(name));
    const back = new URL(location.href);
    back.hash = '';
    await sendSignInLinkToEmail(auth, cleanEmail, { url: back.href, handleCodeInApp: true });
  },

  // Backup for when the email link opens in a different browser or device:
  // the player copies the link from the email and pastes it here.
  async completeWithLink(link, email) {
    if (!state.configured) throw new Error('Sign-in opens soon.');
    let clean = String(link || '').trim();
    try {
      const wrapped = new URL(clean);
      if (/safelinks\.protection\.outlook\.com$/i.test(wrapped.hostname) && wrapped.searchParams.get('url')) clean = wrapped.searchParams.get('url');
    } catch { /* not a URL; checked below */ }
    if (!isSignInWithEmailLink(auth, clean)) throw new Error('That doesn’t look like the PuzzleMixx sign-in link. Copy the whole link from the newest email and try again.');
    const address = String(email || store.get(EMAIL_KEY, '') || '').trim();
    if (!address) throw new Error('Please enter your email address first.');
    try { await signInWithEmailLink(auth, address, clean); }
    catch { throw new Error('That link has expired or was already used. Press “Resend the link” and paste the newest one.'); }
    store.remove(EMAIL_KEY);
  },

  // One tap, no email sent, so no daily email limit.
  async signInWithGoogle(name) {
    if (!state.configured) throw new Error('Sign-in opens soon.');
    if (name) store.set(NAME_KEY, cleanName(name));
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') { await signInWithRedirect(auth, provider); return false; }
      throw new Error(googleErrorMessage(error));
    }
    return true;
  },

  async signOut() { if (auth) await fbSignOut(auth); },

  // Player IDs
  playerIdProblem,
  async checkPlayerId(id) {
    const problem = playerIdProblem(id);
    if (problem) return { ok: false, message: problem };
    if (!db) return { ok: true, message: '' };
    try {
      const snap = await getDoc(doc(db, 'playerIds', idKey(id)));
      if (snap.exists() && snap.data().uid !== state.user?.uid) return { ok: false, message: 'That Player ID is taken. Try another.' };
    } catch { /* offline: checked again when saving */ }
    return { ok: true, message: '✓ That Player ID is free.' };
  },
  async hasOwnId() {
    if (!state.user || !state.player) return false;
    if (playerIdProblem(state.player.name)) return false;
    try { const snap = await getDoc(doc(db, 'playerIds', idKey(state.player.name))); return snap.exists() && snap.data().uid === state.user.uid; }
    catch { return false; }
  },
  async rename(name) {
    const clean = cleanName(name);
    const problem = playerIdProblem(clean);
    if (problem) throw new Error(problem);
    const uid = state.user.uid;
    const oldKey = state.player ? idKey(state.player.name) : '';
    const newKey = idKey(clean);
    const batch = writeBatch(db);
    if (newKey !== oldKey || !(await PM.hasOwnId())) batch.set(doc(db, 'playerIds', newKey), { uid, at: serverTimestamp() });
    batch.update(doc(db, 'players', uid), { name: clean, updatedAt: serverTimestamp() });
    if (oldKey && oldKey !== newKey) {
      try { const old = await getDoc(doc(db, 'playerIds', oldKey)); if (old.exists() && old.data().uid === uid) batch.delete(doc(db, 'playerIds', oldKey)); } catch { /* ignore */ }
    }
    try { await batch.commit(); }
    catch { throw new Error('That Player ID is taken. Try another.'); }
  },

  // Called by the puzzles. Saves straight away when signed in, otherwise keeps it until sign-in.
  async record(type, info = {}) {
    if (!['song', 'mental', 'hint', 'share'].includes(type) || !contestOpen()) return { added: false };
    const spec = eventSpec(type, info);
    if (!spec) return { added: false };
    if (!state.configured || !state.user || !state.player) {
      const queue = store.get(QUEUE_KEY, []);
      if (type === 'hint' || !queue.some((q) => q.type === type && eventSpec(q.type, q.info)?.id === spec.id)) {
        queue.push({ type, info });
        store.set(QUEUE_KEY, queue.slice(-200));
      }
      return { added: false, queued: true };
    }
    return writeEvent(state.user.uid, spec.id, spec.data);
  },

  async myEvents() {
    if (!state.user) return [];
    const snap = await getDocs(query(collection(db, 'players', state.user.uid, 'events'), orderBy('createdAt', 'desc'), limit(500)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().createdAt?.toDate?.() || new Date() }));
  },

  // Share a win: the player posts the link, tags @puzzlemixx, then sends us the post link.
  // +10 is added when puzzlemixx@gmail.com approves it (max 3 per success).
  async claimShare(successKey, label, link) {
    if (!state.user || !state.player) throw new Error('Please sign in first.');
    if (!contestOpen()) throw new Error('The contest has ended.');
    if (!/^(nieve|hannah|tee)-(song-([1-9]|10)|mental)$/.test(successKey)) throw new Error('Please choose which win you shared.');
    const clean = String(link || '').trim();
    if (!/^https?:\/\/\S{4,}$/i.test(clean) || clean.length > 500) throw new Error('Please paste the full link to your post (starting with https://).');
    const ref = await addDoc(collection(db, 'claims'), {
      uid: state.user.uid, name: state.player.name, email: state.user.email, link: clean, status: 'pending',
      kind: 'share', successKey, label: String(label || '').slice(0, 120), createdAt: serverTimestamp()
    });
    await emailAdmin('PuzzleMixx: new +10 share claim', {
      Player: state.player.name, Email: state.user.email, 'Win shared': label, 'Link to post': clean,
      'Approve at': new URL('admin.html', location.href).href, 'Claim ID': ref.id
    }).catch((error) => console.warn('PuzzleMixx: claim saved, but the email notification failed', error));
    return ref.id;
  },

  // +100 stretch bonus. Public: an Instagram post tagging @puzzlemixx.
  // Private ("too shy to post"): the video is emailed to puzzlemixx@gmail.com and deleted once checked.
  async claimBonus(link, { private: isPrivate = false } = {}) {
    if (!state.user || !state.player) throw new Error('Please sign in first.');
    if (!contestOpen()) throw new Error('The contest has ended.');
    let clean = 'PRIVATE';
    if (!isPrivate) {
      clean = String(link || '').trim();
      let host = '';
      try { host = new URL(clean).hostname.replace(/^www\./, ''); } catch { host = ''; }
      if (!/^https?:\/\//i.test(clean) || clean.length > 500 || !/(^|\.)instagram\.com$/i.test(host)) {
        throw new Error('Please paste the link to your Instagram post (it starts with https://www.instagram.com/).');
      }
    } else clean = 'private-video:emailed';
    if (!isPrivate) {
      // One bonus per video: the same post link can't be sent twice.
      const same = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
      const mine = await PM.myClaims();
      if (mine.some((c) => c.status !== 'rejected' && same(c.link) === same(clean))) {
        throw new Error('You’ve already sent this video. Each video earns one bonus, so post a different exercise for another +100.');
      }
    }
    const ref = await addDoc(collection(db, 'claims'), {
      uid: state.user.uid, name: state.player.name, email: state.user.email, link: clean, status: 'pending', createdAt: serverTimestamp()
    });
    await emailAdmin(isPrivate ? 'PuzzleMixx: +100 stretch bonus, private video emailed' : 'PuzzleMixx: new +100 stretch bonus claim', {
      Player: state.player.name, Email: state.user.email,
      [isPrivate ? 'Video' : 'Link to post']: isPrivate ? `Emailed privately from ${state.user.email}. Delete it after checking.` : clean,
      'Approve at': new URL('admin.html', location.href).href, 'Claim ID': ref.id
    }).catch((error) => console.warn('PuzzleMixx: claim saved, but the email notification failed', error));
    return ref.id;
  },

  async myClaims() {
    if (!state.user) return [];
    const snap = await getDocs(query(collection(db, 'claims'), where('uid', '==', state.user.uid), limit(100)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), isPrivate: d.data().link === 'private-video:emailed', at: d.data().createdAt?.toDate?.() || new Date() })).sort((a, b) => b.at - a.at);
  },

  async report({ date, points, note }) {
    const fields = {
      'Date of the win': date || '(not given)',
      'Points won': String(points ?? '(not given)'),
      Note: note || '',
      Player: state.player?.name || '(not signed in)',
      Email: state.user?.email || '(not signed in)',
      'Points shown on profile': state.player ? String(state.player.points) : '(not signed in)',
      'Player ID': state.user?.uid || ''
    };
    if (state.user?.email) fields._replyto = state.user.email;
    return emailAdmin('PuzzleMixx: points report', fields);
  },

  // Every player, highest first (new players start on 0 and still appear).
  async leaderboard(count = 5000) {
    if (!state.configured) return [];
    const snap = await getDocs(query(collection(db, 'players'), orderBy('points', 'desc'), limit(count)));
    return snap.docs.map((d) => ({ id: d.id, name: d.data().name, points: d.data().points, roundPts: d.data().roundPts || {}, firstGain: d.data().firstGain || {}, lastAt: d.data().lastAt || {}, canWin: d.data().canWin }));
  },

  // ----- Admin (puzzlemixx@gmail.com only; enforced by the security rules) -----
  async pendingClaims() {
    const snap = await getDocs(query(collection(db, 'claims'), where('status', '==', 'pending'), limit(300)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), isPrivate: d.data().link === 'private-video:emailed', at: d.data().createdAt?.toDate?.() || new Date() })).sort((a, b) => a.at - b.at);
  },
  async recentDecisions() {
    const snap = await getDocs(query(collection(db, 'claims'), where('status', 'in', ['approved', 'rejected']), limit(300)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), isPrivate: d.data().link === 'private-video:emailed', at: d.data().createdAt?.toDate?.() || new Date(), decided: d.data().decidedAt?.toDate?.() || null }))
      .sort((a, b) => (b.decided || 0) - (a.decided || 0)).slice(0, 50);
  },
  async decideClaim(claim, approve) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'claims', claim.id), { status: approve ? 'approved' : 'rejected', decidedAt: serverTimestamp() });
    if (approve && claim.kind === 'share') {
      const done = await getDocs(collection(db, 'players', claim.uid, 'events'));
      const used = done.docs.filter((d) => d.data().type === 'share' && d.data().successKey === claim.successKey).length;
      if (used >= SHARE_LIMIT) throw new Error(`This player already has +10 for ${SHARE_LIMIT} shares of this win. Please reject this one.`);
      const n = used + 1;
      const id = `share-${claim.successKey}-${n}`;
      batch.set(doc(db, 'players', claim.uid, 'events', id), { type: 'share', points: POINTS.share, successKey: claim.successKey, n, claimId: claim.id, label: `Shared: ${claim.label || claim.successKey}`, createdAt: serverTimestamp() });
      batch.update(doc(db, 'players', claim.uid), { points: increment(POINTS.share), lastEvent: id, updatedAt: serverTimestamp() });
    } else if (approve) {
      const id = `bonus-${claim.id}`;
      batch.set(doc(db, 'players', claim.uid, 'events', id), { type: 'bonus', points: POINTS.bonus, claimId: claim.id, label: 'Stretch video bonus (approved)', createdAt: serverTimestamp() });
      const player = (await getDoc(doc(db, 'players', claim.uid))).data();
      batch.update(doc(db, 'players', claim.uid), playerPointsUpdate(player, id, POINTS.bonus));
    }
    await batch.commit();
  }
};

window.PM = PM;

(async function start() {
  const config = window.PM_FIREBASE_CONFIG;
  if (!config || !config.apiKey || !config.projectId) {
    state.ready = true;
    emit();
    window.dispatchEvent(new Event('pm-ready'));
    return;
  }
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    state.configured = true;
    await completeEmailLinkSignIn();
    getRedirectResult(auth).catch((error) => { state.error = googleErrorMessage(error); emit(); });
    onAuthStateChanged(auth, async (user) => {
      state.user = user;
      state.isAdmin = Boolean(user && user.emailVerified && (user.email || '').toLowerCase() === ADMIN_EMAIL);
      state.player = null;
      if (user) {
        try { await ensurePlayer(user); watchPlayer(user); setTimeout(flushQueue, 600); }
        catch (error) { state.error = error.message; }
      } else if (unsubscribePlayer) { unsubscribePlayer(); unsubscribePlayer = null; }
      state.ready = true;
      emit();
      window.dispatchEvent(new Event('pm-ready'));
    });
  } catch (error) {
    console.error('PuzzleMixx: online points unavailable', error);
    state.error = 'Online points are unavailable right now.';
    state.ready = true;
    emit();
    window.dispatchEvent(new Event('pm-ready'));
  }
})();
