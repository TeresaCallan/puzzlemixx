// Puzzle menu switches and Tee’s DBL PTS PuzzleMixx “live” windows.
// Tee’s puzzle opens 4 times a day at random, for 5–15 minutes each time, between 8am and 10pm UK time.
// Every visitor works out the same windows from the date, using the web server’s clock. The daily email job
// (tools/tee-alerts.mjs) uses this same file, so emails go out at exactly these times.
// Set TEE_ALWAYS_OPEN to true to open it all the time, or TEE_LIVE_WINDOWS to false to keep it closed.
(function () {
  const TEE_ALWAYS_OPEN = false;
  const TEE_LIVE_WINDOWS = true;
  const EMAIL_ALERTS_READY = false;   // shows the “Notify me” button once the email alerts are set up
  const WINDOWS_PER_DAY = 4;
  const DAY_START_MIN = 8 * 60;    // 08:00 UK time
  const DAY_END_MIN = 22 * 60;     // 22:00 UK time
  const MIN_LEN = 5;
  const MAX_LEN = 15;
  const onTeePage = /\/tee\.html$/.test(location.pathname);
  const preview = /[?&]preview\b/.test(location.search);

  // ---------- Time: the web server’s clock (from its Date header), so devices with a wrong clock still agree ----------
  let offset = 0;
  const now = () => Date.now() + offset;
  const clockReady = fetch(`${location.origin}/?clock=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
    .then((res) => { const d = Date.parse(res.headers.get('date') || ''); if (!Number.isNaN(d)) offset = d + 500 - Date.now(); })
    .catch(() => {});

  // ---------- The day’s windows (same for everyone) ----------
  const ukParts = (t) => {
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
    return p;
  };
  const ukDate = (t) => { const p = ukParts(t); return `${p.year}-${p.month}-${p.day}`; };
  // UTC time of a UK wall-clock minute on a UK date.
  function ukToUtc(dateStr, minute) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d, 0, minute);
    const p = ukParts(guess);
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    return guess - (shown - guess);
  }
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const cache = {};
  function windowsFor(dateStr) {
    if (cache[dateStr]) return cache[dateStr];
    const rand = seeded(`puzzlemixx-tee-dbl-pts-${dateStr}`);
    const slot = (DAY_END_MIN - DAY_START_MIN) / WINDOWS_PER_DAY;   // one window somewhere in each part of the day
    const list = [];
    for (let i = 0; i < WINDOWS_PER_DAY; i += 1) {
      const len = MIN_LEN + Math.floor(rand() * (MAX_LEN - MIN_LEN + 1));
      const start = Math.floor(DAY_START_MIN + i * slot + rand() * (slot - len));
      list.push({ start: ukToUtc(dateStr, start), end: ukToUtc(dateStr, start) + len * 60000 });
    }
    cache[dateStr] = list;
    return list;
  }
  function liveWindow(t = now()) {
    if (TEE_ALWAYS_OPEN) return { start: 0, end: Infinity };
    if (!TEE_LIVE_WINDOWS) return null;
    return windowsFor(ukDate(t)).find((w) => t >= w.start && t < w.end) || null;
  }
  const isLive = () => Boolean(liveWindow());
  window.PMTee = { isLive, liveWindow, now };

  // ---------- Styles (shared by every page) ----------
  const css = `
  .pm-tee-banner { position:fixed; left:50%; top:max(12px,env(safe-area-inset-top)); transform:translate(-50%,-160%); z-index:9998; display:flex; align-items:center; gap:12px; width:max-content; max-width:min(94vw,560px); padding:10px 10px 10px 16px; border:1px solid #e9cf86; border-radius:999px; background:linear-gradient(105deg,#fffaf0,#fbecc0); color:#4a3410; box-shadow:0 14px 40px #b0861f40,0 0 0 4px #fff6; font:600 14px/1.3 Manrope,system-ui,sans-serif; transition:transform .5s cubic-bezier(.2,.9,.2,1.2); }
  .pm-tee-banner.show { transform:translate(-50%,0); }
  .pm-tee-banner .pm-tee-spark { font-size:18px; animation:pmTeeTwinkle 1.6s ease-in-out infinite; }
  .pm-tee-banner b { font-family:"DM Serif Display",Georgia,serif; font-weight:400; font-size:16px; letter-spacing:-.01em; }
  .pm-tee-banner .pm-tee-left { font:500 11px/1 "DM Mono",ui-monospace,monospace; letter-spacing:.06em; text-transform:uppercase; color:#8a6417; white-space:nowrap; }
  .pm-tee-banner a, .pm-tee-banner button { border:0; border-radius:999px; padding:8px 14px; font:700 13px/1 Manrope,system-ui,sans-serif; cursor:pointer; text-decoration:none; white-space:nowrap; }
  .pm-tee-banner a { background:linear-gradient(135deg,#c99a2e,#e8be52); color:#fff; box-shadow:0 4px 14px #c99a2e66; }
  .pm-tee-banner button { background:transparent; color:#8a6417; padding:8px 10px; font-size:18px; line-height:.8; }
  .pm-tee-notify { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:6px 2px 2px; padding:8px 10px 8px 12px; border:1px dashed #e4c77a; border-radius:14px; background:#fffaf0; color:#6b5120; font:500 11.5px/1.35 Manrope,system-ui,sans-serif; }
  .pm-tee-notify button { flex:none; display:inline-flex; align-items:center; gap:6px; border:1px solid #d9b45a; border-radius:999px; padding:6px 12px; background:#fff; color:#7a5512; font:700 12px/1 Manrope,system-ui,sans-serif; cursor:pointer; transition:background .2s, box-shadow .2s; }
  .pm-tee-notify button:hover, .pm-tee-notify button:focus-visible { background:#fff4d6; box-shadow:0 0 0 3px #f2d98a66; outline:none; }
  .pm-tee-notify button[aria-pressed="true"] { background:linear-gradient(135deg,#c99a2e,#e8be52); border-color:transparent; color:#fff; }
  .pm-tee-notify .pm-bell { display:inline-block; transform-origin:50% 10%; }
  .pm-tee-notify button[aria-pressed="true"] .pm-bell { animation:pmTeeRing 2.4s ease-in-out infinite; }
  .playlist-menu a.golden-puzzle-option .pm-live { margin-left:auto; padding:2px 8px; border-radius:999px; background:linear-gradient(135deg,#c99a2e,#e8be52); color:#fff; font:600 9px/1.4 "DM Mono",ui-monospace,monospace; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; box-shadow:0 0 12px #e8be5299; }
  @keyframes pmTeeTwinkle { 50% { transform:scale(1.25) rotate(12deg); opacity:.75; } }
  @keyframes pmTeeRing { 0%,70%,100% { transform:rotate(0); } 75% { transform:rotate(14deg); } 82% { transform:rotate(-12deg); } 89% { transform:rotate(8deg); } }
  @media (max-width:520px) { .pm-tee-banner { border-radius:20px; flex-wrap:wrap; justify-content:center; text-align:center; } }
  @media (prefers-reduced-motion:reduce) { .pm-tee-banner { transition:none; } .pm-tee-banner .pm-tee-spark, .pm-tee-notify .pm-bell { animation:none !important; } }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  // ---------- Notify me (by email, only for signed-in players who ask) ----------
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
  const wantsNotify = () => Boolean(window.PM?.state?.teeNotify);
  function paintNotifyButtons() {
    document.querySelectorAll('.pm-tee-notify button').forEach((b) => {
      const on = wantsNotify();
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `<span class="pm-bell" aria-hidden="true">🔔</span>${on ? 'We’ll email you' : 'Notify me'}`;
    });
  }
  async function toggleNotify(event) {
    event.preventDefault();
    event.stopPropagation();
    const PM = window.PM;
    if (!PM?.state?.user || !PM.state.player) {
      hint('Sign in on the Leaderboard first, then tap “Notify me” — we’ll email you when Double Points goes live.');
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const on = !wantsNotify();
      await PM.setTeeNotify(on);
      hint(on ? `Done — we’ll email ${PM.state.user.email} each time Double Points goes live. Tap again to stop.` : 'Email alerts are off. Tap “Notify me” any time to turn them back on.');
    } catch (error) {
      hint('That didn’t work. Please try again.');
    }
    button.disabled = false;
    paintNotifyButtons();
  }
  window.addEventListener('pm-ready', () => window.PM?.onChange?.(paintNotifyButtons), { once: true });
  if (window.PM?.onChange) window.PM.onChange(paintNotifyButtons);
  function hint(text) {
    let el = document.querySelector('#pm-tee-hint');
    if (!el) {
      el = document.createElement('p');
      el.id = 'pm-tee-hint';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;max-width:min(92vw,440px);margin:0;padding:12px 16px;border-radius:14px;background:#1B1626;color:#fff;font:600 13.5px/1.4 Manrope,system-ui,sans-serif;box-shadow:0 10px 30px #0004;text-align:center';
      document.body.append(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(hint.t);
    hint.t = setTimeout(() => { el.hidden = true; }, 6000);
  }

  // ---------- Menu: the golden option ----------
  const teeLinks = () => document.querySelectorAll('.playlist-menu a[data-playlist-id="tee"]');
  function paintMenu(live, minsLeft) {
    document.documentElement.classList.toggle('pm-tee-locked', !live);
    teeLinks().forEach((a) => {
      a.querySelector('.pm-soon')?.remove();
      a.querySelector('.pm-live')?.remove();
      if (live) {
        a.classList.remove('is-locked');
        a.setAttribute('href', 'tee.html');
        a.removeAttribute('aria-disabled');
        a.removeAttribute('tabindex');
        a.title = 'Double Points is live now';
        a.insertAdjacentHTML('beforeend', `<span class="pm-live">Live · ${minsLeft} min</span>`);
      } else {
        a.classList.add('is-locked');
        a.removeAttribute('href');
        a.removeAttribute('aria-current');
        a.setAttribute('aria-disabled', 'true');
        a.setAttribute('tabindex', '-1');
        a.title = 'Opens 4 times a day at random';
        a.insertAdjacentHTML('beforeend', `<span class="pm-soon">${TEE_LIVE_WINDOWS ? 'Opens soon' : 'Coming soon'}</span>`);
      }
      const inner = a.parentElement;
      if (EMAIL_ALERTS_READY && TEE_LIVE_WINDOWS && !TEE_ALWAYS_OPEN && inner && !inner.querySelector('.pm-tee-notify')) {
        a.insertAdjacentHTML('afterend', '<div class="pm-tee-notify"><span>Double Points opens 4× a day, at random, for 5–15 min.</span><button type="button" aria-pressed="false"></button></div>');
        inner.querySelector('.pm-tee-notify button').addEventListener('click', toggleNotify);
      }
    });
    paintNotifyButtons();
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('.playlist-menu a.golden-puzzle-option.is-locked');
    if (a) { e.preventDefault(); hint(EMAIL_ALERTS_READY ? 'Tee’s DBL PTS PuzzleMixx opens 4 times a day at random. Tap “Notify me” and we’ll email you when it’s live.' : 'Tee’s DBL PTS PuzzleMixx opens 4 times a day at random, for 5–15 minutes. Keep an eye out!'); }
  }, true);

  // ---------- Live banner and alert ----------
  let banner;
  function showBanner(minsLeft) {
    if (onTeePage) return;
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'pm-tee-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = '<span class="pm-tee-spark" aria-hidden="true">✦</span><span><b>Double Points is live!</b><br /><span class="pm-tee-left"></span></span><a href="tee.html">Play now</a><button type="button" aria-label="Close">×</button>';
      banner.querySelector('button').addEventListener('click', () => { banner.classList.remove('show'); banner.dataset.closed = '1'; });
      document.body.append(banner);
    }
    banner.querySelector('.pm-tee-left').textContent = `Tee’s DBL PTS PuzzleMixx · ${minsLeft} min left`;
    if (banner.dataset.closed !== '1') requestAnimationFrame(() => banner.classList.add('show'));
  }
  function hideBanner() { if (banner) { banner.classList.remove('show'); delete banner.dataset.closed; } }
  // ---------- Tee page: closed outside the windows ----------
  let teeEndedShown = false;
  function teePageGate(live) {
    if (!onTeePage || preview) return;
    if (!live && !document.documentElement.classList.contains('pm-tee-was-live')) { location.replace('index.html'); return; }
    if (live) document.documentElement.classList.add('pm-tee-was-live');
    if (!live && !teeEndedShown) {
      teeEndedShown = true;
      hint('Double Points has finished for now — your puzzle is saved for next time.');
      setTimeout(() => location.replace('index.html'), 6000);
    }
  }

  function tick() {
    const w = liveWindow();
    const live = Boolean(w);
    const minsLeft = live ? Math.max(1, Math.ceil((w.end - now()) / 60000)) : 0;
    paintMenu(live, w && w.end === Infinity ? '∞' : minsLeft);
    if (live && w.end !== Infinity) showBanner(minsLeft); else hideBanner();
    teePageGate(live);
  }
  tick();                       // straight away with this device’s clock…
  clockReady.then(tick);        // …then again with the server’s
  setInterval(tick, 15000);
})();
