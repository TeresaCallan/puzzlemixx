const PM = window.PM;
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const when = (d) => d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

async function load() {
  try {
    const [pending, decided] = await Promise.all([PM.pendingClaims(), PM.recentDecisions()]);
    $('#pending-count').textContent = pending.length ? `(${pending.length})` : '';
    $('#pending-list').innerHTML = pending.map((c) => `
      <article class="claim" data-id="${esc(c.id)}">
        <div><p class="claim-kind">${c.isPrivate ? '+100 stretch bonus · PRIVATE video, emailed to puzzlemixx@gmail.com' : '+100 stretch bonus · check it’s 90 s of a PuzzleMixx exercise, singing, tagged @puzzlemixx, and a different video from their earlier ones'}</p><h3>${esc(c.name)}</h3><p>${esc(c.email)} · sent ${when(c.at)}</p><p>${c.isPrivate ? `Find the email from ${esc(c.email)} in the puzzlemixx inbox. <strong>Delete it after deciding.</strong>` : `<a href="${esc(c.link)}" target="_blank" rel="noopener">Open their post ↗</a>`}</p></div>
        <div class="pm-row"><button class="leader-action" data-approve>Approve +100</button><button class="reject" data-reject>Reject</button></div>
      </article>`).join('');
    $('#pending-empty').hidden = pending.length > 0;
    $('#pending-list').querySelectorAll('.claim').forEach((el) => {
      const claim = pending.find((c) => c.id === el.dataset.id);
      el.querySelector('[data-approve]').addEventListener('click', () => decide(el, claim, true));
      el.querySelector('[data-reject]').addEventListener('click', () => decide(el, claim, false));
    });
    $('#decided-list').innerHTML = decided.map((c) => `
      <article class="claim"><div><p class="claim-kind">${c.isPrivate ? '+100 stretch bonus · private video' : '+100 stretch bonus'}</p><h3>${esc(c.name)} — ${c.status === 'approved' ? '<span style="color:var(--pm-green)">approved</span>' : '<span style="color:var(--pm-red)">rejected</span>'}</h3>
      <p>${esc(c.email)} · ${when(c.decided)}</p><p>${c.isPrivate ? 'Private video (emailed)' : `<a href="${esc(c.link)}" target="_blank" rel="noopener">Their post ↗</a>`}</p></div></article>`).join('');
    $('#decided-empty').hidden = decided.length > 0;
  } catch (error) {
    $('#notice').hidden = false;
    $('#notice').textContent = `Couldn’t load claims: ${error.message}`;
  }
}

async function loadRounds() {
  try {
    const k = PM.roundAt();
    const [board, prizes] = await Promise.all([PM.leaderboard(), PM.prizeClaims()]);
    const fmt = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const place = ['', '1st', '2nd', '3rd'];
    const rounds = [];
    for (let r = k - 1; r >= 1; r -= 1) rounds.push(PM.roundResults(board, r));   // Round 0 is practice
    $('#rounds-list').innerHTML = rounds.map((res) => `
      <article class="claim"><div>
        <p class="claim-kind">Round ${res.round} · ${fmt(res.start)} – ${fmt(res.end - 1)} · ${res.done ? 'winners confirmed' : 'sudden death in progress'}</p>
        ${res.places.map((w) => {
          const sent = prizes.find((p) => p.round === res.round && p.uid === w.uid);
          return `<p><strong>${place[w.place]}: ${esc(w.name)}</strong> · ${w.points} pts${w.how === 'sudden death' ? ' · won sudden death' : w.how === 'reached score first' ? ' · tie settled by backstop (reached score first)' : ''} · ${sent ? '<span style="color:var(--pm-green)">details received</span>' : 'waiting for details'}</p>`;
        }).join('')}
        ${res.pending.map((g) => `<p><strong>${g.places.map((n) => place[n]).join(' & ')}: sudden death</strong> between ${g.players.map((x) => esc(x.name)).join(', ')} (${g.players[0].points} pts each)</p>`).join('')}
        ${!res.places.length && !res.pending.length ? '<p>No points were scored this round.</p>' : ''}
      </div></article>`).join('');
    $('#rounds-empty').hidden = rounds.length > 0;
    $('#prize-list').innerHTML = prizes.map((p) => `
      <article class="claim"><div>
        <p class="claim-kind">Round ${p.round} · ${place[p.place]} place · sent ${when(p.at)}</p>
        <h3>${esc(p.fullName)} <span style="font-weight:500;color:var(--pm-muted)">(${esc(p.name)})</span></h3>
        <p style="white-space:pre-line">${esc(p.address)}</p>
        <p>${esc(p.email)}</p>
        <p>Country: ${esc(p.country || '—')}</p>
        ${p.place === 1 ? `<p>Gym / studio / sport association: ${p.gym ? esc(p.gym) : '<em>none nominated</em>'}</p><p>Back-up registered charity: ${p.charity ? esc(p.charity) : '<em>none given</em>'}</p>` : ''}
      </div></article>`).join('');
    $('#prize-empty').hidden = prizes.length > 0;
  } catch (error) {
    $('#notice').hidden = false;
    $('#notice').textContent = `Couldn’t load round results: ${error.message}`;
  }
}

// ---------- Possible fake wins ----------
// A real player needs several minutes to complete a whole puzzle, and can only finish songs so fast.
// These checks flag wins that come faster or more often than that. They are warning signs, not proof.
const FAIR = {
  mentalGapMin: 3,        // two Mental Workouts on the same puzzle less than 3 minutes apart
  songsPerMinute: 6,      // 6 or more songs completed within one minute
  winsPer10Min: 25,       // 25 or more songs + Mental Workouts within 10 minutes
  mentalPerDay: 8,        // 8 or more Mental Workouts in one day
  pointsPerHour: 100      // 100 or more points gained within one hour
};
const PUZZLE_NAME = { nieve: 'Nieve’s', hannah: 'Hannah’s', tee: 'Tee’s' };
const clock = (d) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function maxInWindow(times, ms) {
  let best = 0, at = null;
  for (let i = 0, j = 0; j < times.length; j += 1) {
    while (times[j] - times[i] > ms) i += 1;
    if (j - i + 1 > best) { best = j - i + 1; at = times[i]; }
  }
  return { count: best, at };
}

function fairPlayFlags(events) {
  const flags = [];
  const wins = events.filter((e) => e.type === 'song' || e.type === 'mental');
  const mental = wins.filter((e) => e.type === 'mental');
  Object.keys(PUZZLE_NAME).forEach((puzzle) => {
    const m = mental.filter((e) => e.puzzle === puzzle);
    const quick = [];
    for (let i = 1; i < m.length; i += 1) {
      const gap = (m[i].at - m[i - 1].at) / 60000;
      if (gap < FAIR.mentalGapMin) quick.push({ gap, at: m[i].at });
    }
    if (quick.length) {
      const fastest = quick.reduce((x, y) => (y.gap < x.gap ? y : x));
      const t = fastest.gap < 1 ? `${Math.round(fastest.gap * 60)} seconds` : `${fastest.gap.toFixed(1)} minutes`;
      flags.push(`${PUZZLE_NAME[puzzle]} Mental Workout won again under ${FAIR.mentalGapMin} minutes after the last one ${quick.length === 1 ? 'once' : `${quick.length} times`} (fastest: ${t}, ${clock(fastest.at)})`);
    }
  });
  const songTimes = wins.filter((e) => e.type === 'song').map((e) => e.at.getTime());
  const fastSongs = maxInWindow(songTimes, 60000);
  if (fastSongs.count >= FAIR.songsPerMinute) flags.push(`${fastSongs.count} songs completed within one minute (from ${clock(new Date(fastSongs.at))})`);
  const burst = maxInWindow(wins.map((e) => e.at.getTime()), 600000);
  if (burst.count >= FAIR.winsPer10Min) flags.push(`${burst.count} wins within 10 minutes (from ${clock(new Date(burst.at))})`);
  const perDay = {};
  mental.forEach((e) => { const day = e.at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); perDay[day] = (perDay[day] || 0) + 1; });
  Object.entries(perDay).forEach(([day, n]) => { if (n >= FAIR.mentalPerDay) flags.push(`${n} Mental Workouts on ${day}`); });
  const gains = events.filter((e) => e.points > 0);
  let bestHour = 0, hourAt = null;
  for (let i = 0, j = 0, sum = 0; j < gains.length; j += 1) {
    sum += gains[j].points;
    while (gains[j].at - gains[i].at > 3600000) { sum -= gains[i].points; i += 1; }
    if (sum > bestHour) { bestHour = sum; hourAt = gains[i].at; }
  }
  if (bestHour >= FAIR.pointsPerHour) flags.push(`${bestHour} points gained within one hour (from ${clock(hourAt)})`);
  return flags;
}

async function loadFairPlay() {
  try {
    const k = PM.roundAt();
    const since = PM.roundStart(k);
    const board = (await PM.leaderboard()).map((p) => ({ ...p, pts: PM.roundPointsOf(p, k) }))
      .filter((p) => p.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 50);
    const flagged = [];
    for (const p of board) {
      const events = (await PM.eventsOf(p.id)).filter((e) => e.at.getTime() >= since);
      const flags = fairPlayFlags(events);
      if (flags.length) flagged.push({ p, flags, wins: events.filter((e) => e.type === 'song' || e.type === 'mental').length });
    }
    $('#fake-count').textContent = flagged.length ? `(${flagged.length})` : '';
    $('#fake-list').innerHTML = flagged.map(({ p, flags, wins }) => `
      <article class="claim"><div>
        <p class="claim-kind">${p.pts} pts this round · ${wins} wins</p>
        <h3>${esc(p.name)}</h3>
        <ul>${flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      </div></article>`).join('');
    $('#fake-empty').hidden = flagged.length > 0;
  } catch (error) {
    $('#fake-empty').hidden = false;
    $('#fake-empty').textContent = `Couldn’t check for fake wins: ${error.message}`;
  }
}

async function decide(el, claim, approve) {
  el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    await PM.decideClaim(claim, approve);
    if (claim.isPrivate) alert(`Done. Now delete ${claim.name}’s private video email from the puzzlemixx@gmail.com inbox (and from Bin).`);
    await load();
  }
  catch (error) { el.querySelectorAll('button').forEach((b) => { b.disabled = false; }); alert(`That didn’t work: ${error.message}`); }
}

PM.onChange((s) => {
  if (!s.ready) return;
  const notice = $('#notice');
  if (!s.configured) { notice.hidden = false; notice.textContent = 'Firebase isn’t set up yet: add your settings to firebase-config.js.'; return; }
  $('#signin').hidden = Boolean(s.user);
  $('#pending').hidden = !s.isAdmin;
  $('#decided').hidden = !s.isAdmin;
  if (s.user && !s.isAdmin) { notice.hidden = false; notice.textContent = `You’re signed in as ${s.user.email}. Only puzzlemixx@gmail.com can approve bonuses.`; }
  else notice.hidden = true;
  $('#rounds-card').hidden = !s.isAdmin;
  $('#prize-details').hidden = !s.isAdmin;
  $('#fake-card').hidden = !s.isAdmin;
  if (s.isAdmin && !load.started) { load.started = true; load(); loadRounds(); loadFairPlay(); setInterval(() => { load(); loadRounds(); }, 60000); setInterval(loadFairPlay, 600000); }
});

$('#signin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await PM.signUp('PuzzleMixx', $('#signin-email').value); $('#signin-status').textContent = 'Check the inbox (and spam folder) for a sign-in link and open it on this device.'; $('#signin-resend').hidden = false; }
  catch (error) { $('#signin-status').textContent = error.message; }
});
$('#signin-resend').addEventListener('click', async () => {
  $('#signin-resend').disabled = true;
  try { await PM.signUp('PuzzleMixx', $('#signin-email').value); $('#signin-status').textContent = `New link sent at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Use the newest email.`; }
  catch (error) { $('#signin-status').textContent = error.message; }
  setTimeout(() => { $('#signin-resend').disabled = false; }, 30000);
});
$('#admin-sign-out').addEventListener('click', () => PM.signOut());
$('#admin-google').addEventListener('click', async () => {
  try { await PM.signInWithGoogle('PuzzleMixx'); }
  catch (error) { $('#signin-status').textContent = error.message; }
});
