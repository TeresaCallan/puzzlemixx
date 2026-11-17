// PuzzleMixx leaderboard + "My points" profile page.
const PM = window.PM;
const CONTEST_START = window.PM_CONTEST_START || Date.UTC(2026, 10, 16);
// Rolling 90-day rounds (see pm-points.js). Shown to players as Round 1, 2, 3…
const roundNow = () => PM.roundAt();
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const roundLabel = (k) => `${fmtDay(PM.roundStart(k))} – ${fmtDay(PM.roundEnd(k) - 1)}`;
const PLACE = ['', '1st', '2nd', '3rd'];
const JOIN_URL = window.PM_JOIN_URL || 'https://www.puzzlemixx.com';

const PUZZLES = {
  nieve: { owner: 'Nieve’s', page: 'index.html', titles: ['Mobility', 'Mobility & Core Prep', 'Cardio', 'Mobility & Core', 'Flexibility & Core', 'Legs, Core & Coordination', 'Legs, Core & Coordination 2nd Side', 'Combination Exercises', 'Adage', 'Stretch'] },
  hannah: { owner: 'Hannah’s', page: 'hannah.html', titles: ['Mobility', 'Mobility & Core Prep', 'Cardio', 'Core', 'Flexibility & Core', 'Legs, Core & Coordination', 'Legs, Core & Coordination 2nd Side', 'Combination Exercises', 'Adage & Stretch', 'Aerial Dance Therapy'] },
  tee: { owner: 'Tee’s', page: 'tee.html', titles: ['Mobility','Mobility & Core Prep','Cardio','Core','Flexibility & Core','Legs, Core & Coordination','Legs, Core & Coordination 2nd Side','Combination Exercises','Stretch','Aerial Dance Therapy'] }
};

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const fromPuzzle = PUZZLES[params.get('puzzle')] ? params.get('puzzle') : 'nieve';
let events = [];
let claims = [];
let board = [];
let selectedSuccess = null;
let lastUid = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function fmtDate(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtPts(p) { return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}`; }
function setStatus(el, text, tone = '') { el.textContent = text; el.dataset.tone = tone; }

function songTitle(puzzle, songId) {
  const p = PUZZLES[puzzle];
  return (p && p.titles[songId - 1]) || `Song ${songId}`;
}
function describe(e) {
  const owner = PUZZLES[e.puzzle]?.owner || '';
  if (e.type === 'song') return `Completed ${owner} ${songTitle(e.puzzle, e.songId)} workout`;
  if (e.type === 'mental') return `Completed ${owner} Mental Workout`;
  if (e.type === 'hint') return 'Paid hint';
  if (e.type === 'share') return e.label || 'Shared a success';
  if (e.type === 'bonus') return 'Stretch video bonus (approved)';
  return e.label || 'Points';
}
function successKeyFor(e) { return e.type === 'song' ? `${e.puzzle}-song-${e.songId}` : `${e.puzzle}-mental`; }
function successLabel(e) {
  const owner = PUZZLES[e.puzzle]?.owner || '';
  return e.type === 'song' ? `${owner} ${songTitle(e.puzzle, e.songId)}` : `${owner} Mental Workout`;
}
function shareText(e) {
  const what = e.type === 'song'
    ? `the ${songTitle(e.puzzle, e.songId)} workout in ${PUZZLES[e.puzzle]?.owner || ''} PuzzleMixx`
    : `${PUZZLES[e.puzzle]?.owner || ''} Mental Workout on PuzzleMixx`;
  return `I just completed ${what.replace(/\s+/g, ' ')}! 🧩 Work out the puzzle to reveal your workout, and join the game: ${JOIN_URL}`;
}

// ---------- Back links ----------
document.querySelectorAll('[data-back-link]').forEach((a) => { a.href = PUZZLES[fromPuzzle].page; });
document.querySelectorAll('[data-back-text]').forEach((el) => { el.textContent = `Back to ${PUZZLES[fromPuzzle].owner} playlist`; });

// ---------- Rendering ----------
// ---------- Collapsible boxes on the right (× to hide, a button to bring back) ----------
// The +100 Instagram video bonus is paused. Set to true (and un-hide #bonus-tile in leaderboard.html) to bring it back.
const BONUS_ON = false;
const COLLAPSE_KEY = 'pmCollapsedCards';
const readCollapsed = () => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch { return {}; } };
function applyCollapsed(signedIn = Boolean(PM.state.user && PM.state.player)) {
  const collapsed = readCollapsed();
  // Signed out, the sign-in box always shows; the other boxes only exist for signed-in players.
  const cards = { 'account-card': true, 'my-points': signedIn, 'bonus-card': signedIn && BONUS_ON };
  Object.entries(cards).forEach(([id, available]) => {
    const canCollapse = id !== 'account-card' || signedIn;
    const isCollapsed = canCollapse && Boolean(collapsed[id]);
    document.getElementById(id).hidden = !available || isCollapsed;
    document.querySelector(`[data-reopen="${id}"]`).hidden = !available || !isCollapsed;
    document.querySelector(`[data-collapse="${id}"]`).hidden = !canCollapse;
  });
  // With every box on the right hidden, the leaderboard takes the full width.
  const anyShowing = Object.keys(cards).some((id) => !document.getElementById(id).hidden);
  document.querySelector('.pm-grid').classList.toggle('pm-side-empty', !anyShowing);
}
function setCollapsed(id, value) {
  const collapsed = readCollapsed();
  collapsed[id] = value;
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); } catch { /* ignore */ }
  applyCollapsed();
}
document.querySelectorAll('[data-collapse]').forEach((b) => b.addEventListener('click', () => setCollapsed(b.dataset.collapse, true)));
document.querySelectorAll('[data-reopen]').forEach((b) => b.addEventListener('click', () => {
  setCollapsed(b.dataset.reopen, false);
  document.getElementById(b.dataset.reopen).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}));

function renderAccount(s) {
  const signedIn = Boolean(s.user && s.player);
  $('#signup-form').hidden = signedIn || $('#signup-sent').hidden === false;
  $('#profile-summary').hidden = !signedIn;
  $('#account-title').textContent = signedIn ? 'Your PuzzleMixx profile' : 'Join the leaderboard';
  if (signedIn) {
    $('#signup-sent').hidden = true;
    $('#profile-name').textContent = s.player.name;
    $('#profile-email').textContent = s.user.email || '';
    $('#profile-avatar').textContent = (s.player.name.trim().charAt(0) || 'P').toUpperCase();
  }
  applyCollapsed(signedIn);
  $('#sticky-my-points').textContent = signedIn ? `${PM.roundPoints(s.player)} pts` : '— pts';
  $('#my-points-total').textContent = signedIn ? PM.roundPoints(s.player) : '0';
}

function renderHistory() {
  const inContest = events.filter((e) => e.at.getTime() >= PM.roundStart(roundNow()));
  const pending = claims.filter((c) => c.status === 'pending');
  const rows = [
    ...pending.map((c) => `<li class="pm-pending"><span class="pm-h-date">${fmtDate(c.at)}</span><span class="pm-h-what">${c.isPrivate ? 'Stretch video bonus (private video)' : 'Stretch video bonus'} <em>waiting for approval</em></span><span class="pm-h-pts">+100?</span></li>`),
    ...inContest.map((e) => `<li class="${e.points < 0 ? 'pm-minus' : ''}"><span class="pm-h-date">${fmtDate(e.at)}</span><span class="pm-h-what">${escapeHtml(describe(e))}</span><span class="pm-h-pts">${fmtPts(e.points)}</span></li>`)
  ];
  $('#points-history').innerHTML = rows.join('');
  $('#history-empty').hidden = rows.length > 0;
}

function renderClaims() {
  $('#bonus-claims').innerHTML = claims.filter((c) => c.kind !== 'share').map((c) => `<li class="pm-claim pm-claim-${c.status}"><span>${fmtDate(c.at)}</span>${c.isPrivate ? '<span>Private video</span>' : `<a href="${escapeHtml(c.link)}" target="_blank" rel="noopener">Your post</a>`}<strong>${c.status === 'pending' ? 'Waiting for approval' : c.status === 'approved' ? '+100 added' : 'Not approved'}</strong></li>`).join('');
}

function renderBoard() {
  const me = PM.state.user?.uid;
  const k = roundNow();
  board = board.map((p) => ({ ...p, total: p.total ?? p.points, points: PM.roundPointsOf(p, k) })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  let rank = 0;
  $('#standings').innerHTML = board.map((p, i) => {
    if (i === 0 || p.points !== board[i - 1].points) rank = i + 1;   // equal points share a place
    const medal = rank <= 3 && p.points > 0 ? `<span class="winner-ribbon winner-${['first', 'second', 'third'][rank - 1]}" aria-label="${['First', 'Second', 'Third'][rank - 1]} place">${rank}</span>` : `<span class="pm-rank">${rank}</span>`;
    return `<li class="standing-row${p.id === me ? ' current' : ''}" data-uid="${p.id}"><span class="standing-name"><span class="standing-person">${medal}${escapeHtml(p.name)}</span>${p.id === me ? '<small>You</small>' : ''}</span><span class="standing-points">${p.points} pts</span></li>`;
  }).join('');
  // Honest invitations for any top-3 place nobody has claimed yet this round
  const scoring = board.filter((p) => p.points > 0).length;
  for (let place = scoring + 1; place <= 3; place += 1) {
    $('#standings').insertAdjacentHTML('beforeend', `<li class="standing-row pm-open-spot"><span class="standing-name"><span class="standing-person">${place === 1 ? 'Be the first to claim the top spot' : `${PLACE[place]} place is up for grabs`}</span></span><span class="standing-points">— pts</span></li>`);
  }
  $('#standings-empty').hidden = true;
  const top = board[0];
  $('#top-scorer-points').textContent = top ? top.points : '—';
  $('#top-scorer-name').textContent = top ? top.name : '—';
  $('#leader-celebration-name').textContent = top ? top.name : '';
  renderRounds();
}

// ---------- Rounds: past winners, prize claims, sudden death, round-end email ----------
let rawBoard = [];
const announced = new Set();
const seen = (key) => { try { if (sessionStorage.getItem(key)) return true; sessionStorage.setItem(key, '1'); } catch { /* ignore */ } return false; };
let prizeToClaim = null;

async function renderRounds() {
  const k = roundNow();
  $('#round-kicker').textContent = `PuzzleMixx rewards · Round ${k + 1} · ${roundLabel(k)}`;
  $('#my-points-range').textContent = `Everything you’ve won and spent in Round ${k + 1} (${roundLabel(k)}). Points start again from 0 each round.`;
  const ended = [];
  for (let r = k - 1; r >= Math.max(0, k - 3); r -= 1) ended.push(PM.roundResults(rawBoard, r));

  // Past winners strip
  const strip = $('#past-winners');
  strip.hidden = ended.length === 0;
  strip.innerHTML = ended.length ? `<p class="card-kicker">Past winners</p>` + ended.map((res) => {
    const names = [1, 2, 3].map((n) => {
      const w = res.places.find((x) => x.place === n);
      if (w) return `<span class="pm-pw-place pm-pw-${n}"><b>${n}</b>${escapeHtml(w.name)}</span>`;
      const tie = res.pending.find((g) => g.places.includes(n));
      return tie ? `<span class="pm-pw-place pm-pw-tie"><b>${n}</b>Sudden death</span>` : '';
    }).join('');
    return `<div class="pm-pw-row"><span class="pm-pw-round">Round ${res.round + 1}</span>${names || '<span class="pm-pw-place">No winners</span>'}</div>`;
  }).join('') : '';

  // Tell puzzlemixx@gmail.com once a round ends (and again once ties are settled)
  const me = PM.state.user;
  if (me && ended[0]) {
    const id = `${ended[0].round}-${ended[0].done}`;
    if (!announced.has(id)) { announced.add(id); PM.announceRound(ended[0]); }
  }

  // Winners: claim your prize. Tied players: sudden death notice.
  prizeToClaim = null;
  $('#open-prize').hidden = true;
  if (!me || !PM.state.player) return;
  for (const res of ended) {
    const win = res.places.find((x) => x.uid === me.uid);
    if (win) {
      const sent = await PM.myPrize(res.round);
      if (!sent) {
        prizeToClaim = { round: res.round, place: win.place };
        $('#open-prize').hidden = false;
        if (!seen(`pmPrizeShown-${res.round}`)) openPrizeClaim();
        break;
      }
    }
    const tie = res.pending.find((g) => g.players.some((x) => x.uid === me.uid));
    if (tie && !seen(`pmTieShown-${res.round}`)) {
      $('#sudden-death-kicker').textContent = `Round ${res.round + 1} · sudden death`;
      $('#sudden-death-title').textContent = `You’re tied for ${tie.places.map((n) => PLACE[n]).join(' / ')} place!`;
      $('#sudden-death-copy').textContent = `${tie.players.length} players finished Round ${res.round + 1} on ${tie.players[0].points} points. The first of you to gain points in the new round takes ${PLACE[tie.places[0]]} place, the next takes the place after, until every prize is won.`;
      const d = $('#sudden-death-dialog'); if (!d.open) d.showModal();
      break;
    }
  }
}

function openPrizeClaim() {
  if (!prizeToClaim) return;
  const { round, place } = prizeToClaim;
  $('#prize-claim-medal').textContent = place;
  $('#prize-claim-medal').dataset.place = place;
  $('#prize-claim-kicker').textContent = `Round ${round + 1} · ${PLACE[place]} place`;
  $('#prize-claim-title').textContent = `Congratulations, ${PM.state.player?.name || 'winner'}!`;
  $('#prize-claim-copy').textContent = `You finished Round ${round + 1} in ${PLACE[place]} place. Tell us where to send your prize.`;
  $('#prize-gym-label').hidden = place !== 1;
  $('#prize-charity-label').hidden = place !== 1;
  try { const c = localStorage.getItem(COUNTRY_KEY); if (c && window.PM_COUNTRIES.canWin(c)) $('#prize-country').value = c; } catch { /* ignore */ }
  $('#prize-claim-form').hidden = false;
  $('#prize-claim-sent').hidden = true;
  setStatus($('#prize-claim-status'), '');
  if (!$('#prize-email').value) $('#prize-email').value = PM.state.user?.email || '';
  const d = $('#prize-claim-dialog'); if (!d.open) d.showModal();
}
$('#open-prize').addEventListener('click', openPrizeClaim);
$('#prize-claim-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!prizeToClaim) return;
  try {
    setStatus($('#prize-claim-status'), 'Sending…');
    await PM.claimPrize(prizeToClaim.round, prizeToClaim.place, {
      fullName: $('#prize-name').value, address: $('#prize-address').value, country: $('#prize-country').value, email: $('#prize-email').value, gym: $('#prize-gym').value, charity: $('#prize-charity').value
    });
    $('#prize-claim-form').hidden = true;
    $('#prize-claim-sent').hidden = false;
    setStatus($('#prize-claim-status'), '');
    $('#open-prize').hidden = true;
    prizeToClaim = null;
  } catch (error) { setStatus($('#prize-claim-status'), error.message, 'error'); }
});
['#prize-claim-dialog', '#sudden-death-dialog'].forEach((sel) => $(sel).addEventListener('click', (e) => { if (e.target === $(sel)) $(sel).close(); }));

async function refreshData() {
  const s = PM.state;
  try { rawBoard = await PM.leaderboard(); board = rawBoard; } catch (error) { console.warn(error); rawBoard = []; board = []; }
  if (s.user && s.player) {
    try { [events, claims] = await Promise.all([PM.myEvents(), PM.myClaims()]); }
    catch (error) { console.warn(error); }
  } else { events = []; claims = []; }
  renderBoard();
  renderHistory();
  renderClaims();
}

function renderNotice(s) {
  const n = $('#pm-notice');
  if (!s.configured) { n.hidden = false; n.textContent = 'Profiles and the live leaderboard open very soon. You can still play every puzzle in the meantime.'; }
  else if (s.error) { n.hidden = false; n.textContent = s.error; }
  else n.hidden = true;
  $('#signup-form').querySelectorAll('input,button').forEach((el) => { el.disabled = !s.configured; });
}

// ---------- Terms agreement recorded with the account ----------
let consentChecked = null;
async function checkConsent(s) {
  if (!s.user || !s.player || consentChecked === s.user.uid) return;
  consentChecked = s.user.uid;
  const [current, ownId] = await Promise.all([PM.myConsent(), PM.hasOwnId()]);
  if (current && current.v >= PM.TERMS_VERSION && ownId) return;
  let local = {};
  try { local = { terms: localStorage.getItem(TERMS_KEY), country: localStorage.getItem(COUNTRY_KEY) }; } catch { /* ignore */ }
  if (ownId && local.terms === `v${PM.TERMS_VERSION}` && local.country) {
    try { await PM.saveConsent({ age: 'adult', country: local.country }); return; } catch (error) { console.warn(error); }
  }
  openConsent(current);
}
function openConsent(current) {
  $('#consent-id').value = PM.state.player?.name || '';
  checkConsentId();
  if (current?.country) $('#consent-country').value = current.country;
  showCountryResult($('#consent-country'), $('#consent-country-result'));
  setStatus($('#consent-status'), '');
  const d = $('#consent-dialog'); if (!d.open) d.showModal();
}
fillCountries($('#consent-country'));
$('#consent-country').addEventListener('change', () => showCountryResult($('#consent-country'), $('#consent-country-result')));
$('#consent-dialog').addEventListener('cancel', (e) => e.preventDefault());   // must be answered to keep playing for prizes
$('#consent-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const country = $('#consent-country').value;
  const id = $('#consent-id').value.trim();
  if (!idReady($('#consent-id'))) { checkConsentId(); return setStatus($('#consent-status'), 'Please choose a Player ID that’s free (3–20 characters).', 'error'); }
  if (!country) return setStatus($('#consent-status'), 'Please choose where you live.', 'error');
  if (!$('#consent-terms').checked) return setStatus($('#consent-status'), 'Please tick the box to confirm you’re 18 or over and agree to the Terms & Conditions.', 'error');
  try {
    setStatus($('#consent-status'), 'Saving…');
    if (id !== PM.state.player?.name || !(await PM.hasOwnId())) await PM.rename(id);
    await PM.saveConsent({ age: 'adult', country });
    try { localStorage.setItem(TERMS_KEY, `v${PM.TERMS_VERSION}`); localStorage.setItem(COUNTRY_KEY, country); } catch { /* ignore */ }
    refreshData();
    $('#consent-dialog').close();
  } catch (error) { setStatus($('#consent-status'), error.message, 'error'); }
});

let lastPoints = null;
PM.onChange((s) => {
  renderNotice(s);
  renderAccount(s);
  if (s.ready) checkConsent(s);
  if (!s.ready) return;
  const key = `${s.user?.uid || ''}|${s.player ? 'player' : ''}`;
  const points = s.player ? s.player.points : null;
  if (key !== lastUid || points !== lastPoints) {   // refresh on sign-in/out and whenever the total changes
    lastUid = key;
    lastPoints = points;
    refreshData();
  }
});
setInterval(() => { if (PM.state.configured) refreshData(); }, 60000);

// ---------- Account ----------
// Terms & Conditions must be accepted before signing in (remembered on this device).
// Sign-in is for players aged 18 or over (one combined tick). Remembered on this device.
const TERMS_KEY = 'pmTermsAccepted';
try { if (localStorage.getItem(TERMS_KEY) === `v${PM.TERMS_VERSION}`) $('#signup-terms').checked = true; } catch { /* ignore */ }

// PuzzleMixxer Player ID: checked as you type (3–20 characters, unique, no rude words).
const idChecks = new Map();   // input → { value, ok }
function watchPlayerId(input, out) {
  let timer;
  const run = async () => {
    const value = input.value.trim();
    if (!value) { out.textContent = ''; out.className = 'pm-id-result'; idChecks.set(input, { value, ok: false }); return; }
    if (value === PM.state.player?.name && await PM.hasOwnId()) { out.textContent = '✓ This is your Player ID.'; out.className = 'pm-id-result yes'; idChecks.set(input, { value, ok: true }); return; }
    const result = await PM.checkPlayerId(value);
    if (input.value.trim() !== value) return;   // typed on since
    idChecks.set(input, { value, ok: result.ok });
    out.textContent = result.message;
    out.className = `pm-id-result ${result.ok ? 'yes' : 'no'}`;
  };
  input.addEventListener('input', () => { clearTimeout(timer); idChecks.set(input, { value: '', ok: false }); out.textContent = ''; timer = setTimeout(run, 350); });
  return run;
}
function idReady(input) { const c = idChecks.get(input); return Boolean(c && c.ok && c.value === input.value.trim()); }
const checkSignupId = watchPlayerId($('#signup-name'), $('#signup-id-result'));
const checkRenameId = watchPlayerId($('#rename-input'), $('#rename-id-result'));
const checkConsentId = watchPlayerId($('#consent-id'), $('#consent-id-result'));
// Country: anyone can play, prizes go to the UK, Ireland, Australia and New Zealand.
const COUNTRY_KEY = 'pmCountry';
function fillCountries(select) {
  window.PM_COUNTRIES.all.forEach((c) => { const o = document.createElement('option'); o.value = c.code; o.textContent = c.name; select.append(o); });
}
function showCountryResult(select, out) {
  const c = window.PM_COUNTRIES.find(select.value);
  if (!c) { out.textContent = ''; out.className = 'pm-country-result'; return; }
  const yes = window.PM_COUNTRIES.canWin(c.code);
  out.className = `pm-country-result ${yes ? 'yes' : 'no'}`;
  const where = window.PM_COUNTRIES.inSentence(c.code);
  out.textContent = yes ? `✓ Great: players in ${where} can win prizes.` : `You can play and climb the leaderboard for fun. Prizes can’t be sent to ${where} yet.`;
}
fillCountries($('#signup-country'));
try { const saved = localStorage.getItem(COUNTRY_KEY); if (saved) $('#signup-country').value = saved; } catch { /* ignore */ }
showCountryResult($('#signup-country'), $('#signup-country-result'));
$('#signup-country').addEventListener('change', () => { $('#signup-country').classList.remove('pm-terms-needed'); showCountryResult($('#signup-country'), $('#signup-country-result')); setStatus($('#account-status'), ''); });

function termsAccepted() {
  if (!idReady($('#signup-name'))) {
    checkSignupId();
    setStatus($('#account-status'), $('#signup-name').value.trim() ? 'Please choose a Player ID that’s free (see the note under it).' : 'Please choose your PuzzleMixxer Player ID.', 'error');
    $('#signup-name').focus();
    return false;
  }
  if (!$('#signup-country').value) {
    setStatus($('#account-status'), 'Please choose where you live.', 'error');
    $('#signup-country').classList.add('pm-terms-needed');
    $('#signup-country').focus();
    return false;
  }
  if (!$('#signup-terms').checked) {
    setStatus($('#account-status'), 'Please tick the box to confirm you’re 18 or over and agree to the Terms & Conditions.', 'error');
    $('#signup-terms').closest('label').classList.add('pm-terms-needed');
    $('#signup-terms').focus();
    return false;
  }
  try { localStorage.setItem(TERMS_KEY, `v${PM.TERMS_VERSION}`); localStorage.setItem(COUNTRY_KEY, $('#signup-country').value); } catch { /* ignore */ }
  return true;
}
$('#signup-terms').addEventListener('change', () => { $('#signup-terms').closest('label').classList.remove('pm-terms-needed'); setStatus($('#account-status'), ''); });

$('#signup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!termsAccepted()) return;
  const name = $('#signup-name').value.trim();
  const email = $('#signup-email').value.trim();
  try {
    setStatus($('#account-status'), 'Sending…');
    await PM.signUp(name, email);
    $('#signup-sent-to').textContent = email;
    $('#signup-form').hidden = true;
    $('#signup-sent').hidden = false;
    setStatus($('#account-status'), '');
  } catch (error) { setStatus($('#account-status'), error.message || 'Something went wrong. Please try again.', 'error'); }
});
$('#signup-google').addEventListener('click', async () => {
  if (!termsAccepted()) return;
  const button = $('#signup-google');
  button.disabled = true;
  setStatus($('#account-status'), 'Opening Google…');
  try {
    const done = await PM.signInWithGoogle($('#signup-name').value.trim());
    setStatus($('#account-status'), done ? 'You’re signed in. Welcome to the leaderboard!' : '', done ? 'ok' : undefined);
  } catch (error) { setStatus($('#account-status'), error.message, 'error'); }
  finally { button.disabled = !PM.state.configured; }
});
$('#signup-again').addEventListener('click', () => { $('#signup-sent').hidden = true; $('#signup-form').hidden = false; setStatus($('#account-status'), ''); });
$('#signup-paste-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter || $('#signup-paste-form button');
  button.disabled = true;
  setStatus($('#account-status'), 'Signing you in…');
  try {
    await PM.completeWithLink($('#signup-paste-link').value, $('#signup-sent-to').textContent);
    $('#signup-paste-link').value = '';
    $('#signup-sent').hidden = true;
    setStatus($('#account-status'), 'You’re signed in. Welcome to the leaderboard!', 'ok');
  } catch (error) { setStatus($('#account-status'), error.message, 'error'); }
  finally { button.disabled = false; }
});
$('#signup-resend').addEventListener('click', async () => {
  const button = $('#signup-resend');
  button.disabled = true;
  try {
    await PM.signUp($('#signup-name').value.trim(), $('#signup-email').value.trim());
    setStatus($('#account-status'), `New link sent at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Use the newest email.`, 'ok');
  } catch (error) { setStatus($('#account-status'), error.message || 'The link could not be sent. Please try again.', 'error'); }
  setTimeout(() => { button.disabled = false; }, 30000);   // stop accidental repeat sends
});
$('#sign-out').addEventListener('click', () => PM.signOut());
$('#edit-name').addEventListener('click', () => { $('#rename-input').value = PM.state.player?.name || ''; $('#rename-form').hidden = false; checkRenameId(); $('#rename-input').focus(); });
$('#rename-cancel').addEventListener('click', () => { $('#rename-form').hidden = true; });
$('#rename-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!idReady($('#rename-input'))) { checkRenameId(); return setStatus($('#account-status'), 'Please choose a Player ID that’s free (3–20 characters).', 'error'); }
  try { await PM.rename($('#rename-input').value); $('#rename-form').hidden = true; setStatus($('#account-status'), 'Player ID updated.', 'ok'); refreshData(); }
  catch (error) { setStatus($('#account-status'), error.message, 'error'); }
});
$('#jump-to-me').addEventListener('click', async () => {
  const status = $('#jump-status');
  if (!PM.state.user) {
    setStatus(status, 'Sign in to find your place on the board.', '');
    $('#account-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  let row = document.querySelector(`.standing-row[data-uid="${PM.state.user.uid}"]`);
  if (!row) { await refreshData(); row = document.querySelector(`.standing-row[data-uid="${PM.state.user.uid}"]`); }
  if (!row) return setStatus(status, 'Your profile is still being set up. Try again in a moment.', '');
  const place = [...$('#standings').children].indexOf(row) + 1;
  setStatus(status, `You’re number ${row.querySelector('.pm-rank,.winner-ribbon')?.textContent || place} of ${board.length} players.`, 'ok');
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.add('pm-flash');
  setTimeout(() => row.classList.remove('pm-flash'), 1600);
});

// ---------- Stretch bonus ----------
$('#bonus-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    setStatus($('#bonus-status'), 'Sending…');
    const link = $('#bonus-link').value.trim();
    const same = (u) => u.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
    if (claims.some((c) => c.kind !== 'share' && c.status !== 'rejected' && same(c.link || '') === same(link))) {
      return setStatus($('#bonus-status'), 'You’ve already sent this video. Each video earns one bonus, so post a different exercise for another +100.', 'error');
    }
    await PM.claimBonus(link);
    $('#bonus-link').value = '';
    setStatus($('#bonus-status'), 'Sent! We’ll check your video and add +100 once it’s approved.', 'ok');
    await refreshData();
  } catch (error) { setStatus($('#bonus-status'), error.message, 'error'); }
});
// ---------- Bonus rules sheet: hover on computers, tap on phones ----------
(() => {
  const anchor = document.querySelector('.pm-rules-anchor');
  const sheet = $('#bonus-rules');
  const trigger = $('#bonus-rules-trigger');
  let pinned = false, hideTimer = null;
  const place = () => {
    const r = trigger.getBoundingClientRect();
    const half = Math.min(380, innerWidth - 32) / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 16), innerWidth - half - 16);
    sheet.style.setProperty('--rules-left', `${left}px`);
    sheet.style.setProperty('--rules-top', `${Math.min(r.bottom + 8, innerHeight - 120)}px`);
  };
  const show = () => { clearTimeout(hideTimer); place(); sheet.hidden = false; trigger.setAttribute('aria-expanded', 'true'); };
  addEventListener('scroll', () => { if (!sheet.hidden) { if (pinned) place(); else hide(); } }, { passive: true });
  const hide = () => { pinned = false; sheet.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  const canHover = matchMedia('(hover:hover)').matches;
  if (canHover) {
    anchor.addEventListener('mouseenter', show);
    anchor.addEventListener('mouseleave', () => { if (!pinned) hideTimer = setTimeout(hide, 200); });
    sheet.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    sheet.addEventListener('mouseleave', () => { if (!pinned) hideTimer = setTimeout(hide, 200); });
  }
  trigger.addEventListener('click', () => { if (pinned) return hide(); pinned = true; show(); });
  trigger.addEventListener('focus', show);
  anchor.addEventListener('focusout', (e) => { if (!anchor.contains(e.relatedTarget) && !pinned) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { hide(); trigger.focus(); } });
  document.addEventListener('click', (e) => { if (!anchor.contains(e.target) && e.target !== $('#bonus-rules-link')) hide(); });
  $('#bonus-rules-link').addEventListener('click', () => {
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pinned = true; show();
  });
})();

// ---------- Report a problem ----------
const reportDialog = $('#report-dialog');
$('#open-report').addEventListener('click', () => {
  $('#report-form').hidden = false;
  $('#report-sent').hidden = true;
  setStatus($('#report-status'), '');
  $('#report-date').max = new Date().toISOString().slice(0, 10);
  $('#report-date').min = new Date(PM.roundStart(roundNow())).toISOString().slice(0, 10);
  reportDialog.showModal();
});
$('#report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const date = $('#report-date').value;
  const points = $('#report-points').value;
  if (!date || points === '') return setStatus($('#report-status'), 'Please add the date and the number of points you won.', 'error');
  try {
    setStatus($('#report-status'), 'Sending…');
    await PM.report({ date, points: Number(points), note: $('#report-note').value.trim() });
    $('#report-form').reset();
    $('#report-form').hidden = true;
    $('#report-sent').hidden = false;
    setStatus($('#report-status'), '');
  } catch (error) { setStatus($('#report-status'), error.message || 'The report could not be sent. Please try again.', 'error'); }
});
document.querySelectorAll('[data-close-dialog]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// ---------- Prizes ----------
const prizeDialogs = { first: $('#prize-first'), second: $('#prize-second'), third: $('#prize-third') };
const secondPrizeVideo = $('#second-prize-video');
const prizeShirtZoom = $('#prize-shirt-zoom');
const prizeShirtZoomHint = $('#prize-shirt-zoom-hint');
prizeShirtZoom.addEventListener('click', () => {
  const zoomed = prizeShirtZoom.classList.toggle('zoomed');
  prizeShirtZoom.setAttribute('aria-pressed', String(zoomed));
  prizeShirtZoomHint.textContent = zoomed ? 'Click to return to the full T-shirt' : 'Click to zoom into the neck embroidery';
  if (zoomed) setTimeout(() => { if (prizeShirtZoom.classList.contains('zoomed')) { prizeShirtZoom.scrollLeft = (prizeShirtZoom.scrollWidth - prizeShirtZoom.clientWidth) / 2; prizeShirtZoom.scrollTop = 0; } }, 320);
});
document.querySelectorAll('[data-prize]').forEach((button) => button.addEventListener('click', () => {
  prizeDialogs[button.dataset.prize].showModal();
  if (button.dataset.prize === 'second') secondPrizeVideo.play().catch(() => {});
}));
document.querySelectorAll('[data-close-prize]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
[...Object.values(prizeDialogs), reportDialog].forEach((dialog) => {
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
});
prizeDialogs.second.addEventListener('close', () => secondPrizeVideo.pause());
prizeDialogs.third.addEventListener('close', () => { prizeShirtZoom.classList.remove('zoomed'); prizeShirtZoom.setAttribute('aria-pressed', 'false'); prizeShirtZoomHint.textContent = 'Click to zoom into the neck embroidery'; });
document.querySelectorAll('.association-choice').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.association-choice').forEach((c) => c.classList.toggle('active', c === button));
  $('#cheque-payee').textContent = button.dataset.payee;
}));

// ---------- Leader sparkle, countdown, sticky header ----------
const leaderCelebration = $('#leader-celebration');
let leaderTimer;
function celebrateLeader() {
  if (!board.length) return;
  leaderCelebration.classList.remove('active'); void leaderCelebration.offsetWidth; leaderCelebration.classList.add('active');
  clearTimeout(leaderTimer); leaderTimer = setTimeout(() => leaderCelebration.classList.remove('active'), 2150);
}
// Points boxes: little pop-ups (+1, −5) and a celebration over the +10 bonus.
document.querySelectorAll('.pm-tip-tile').forEach((tile) => {
  const celebration = tile.querySelector('.pm-tile-celebration');
  let timer;
  const celebrate = () => {
    if (!celebration) return;
    celebration.classList.remove('active'); void celebration.offsetWidth; celebration.classList.add('active');
    clearTimeout(timer); timer = setTimeout(() => celebration.classList.remove('active'), 2150);
  };
  tile.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { tile.classList.add('show-tip'); celebrate(); } });
  tile.addEventListener('pointerleave', () => tile.classList.remove('show-tip'));
  tile.addEventListener('focus', () => { tile.classList.add('show-tip'); celebrate(); });
  tile.addEventListener('blur', () => tile.classList.remove('show-tip'));
  tile.addEventListener('click', () => {   // phones: tap to show
    const showing = tile.classList.toggle('show-tip');
    if (showing) celebrate();
    document.querySelectorAll('.pm-tip-tile.show-tip').forEach((t) => { if (t !== tile) t.classList.remove('show-tip'); });
  });
});

const leaderWord = $('#leader-word');
leaderWord.addEventListener('pointerenter', celebrateLeader);
leaderWord.addEventListener('click', celebrateLeader);
leaderWord.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); celebrateLeader(); } });

let countdownRound = null;
function updateCountdown() {
  const k = roundNow();
  if (countdownRound !== null && k !== countdownRound && PM.state.configured) refreshData();   // a new round has begun
  countdownRound = k;
  const remaining = Math.max(PM.roundEnd(k) - Date.now(), 0);
  const el = $('#contest-countdown');
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  el.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
const sticky = $('#leaderboard-sticky');
function updateSticky() {
  const show = window.matchMedia('(min-width:761px)').matches || document.querySelector('.leaderboard-nav').getBoundingClientRect().bottom <= 0;
  sticky.classList.toggle('visible', show);
  sticky.setAttribute('aria-hidden', String(!show));
  sticky.inert = !show;
}
window.addEventListener('scroll', updateSticky, { passive: true });
window.addEventListener('resize', updateSticky);
updateSticky();
updateCountdown();
setInterval(updateCountdown, 1000);
