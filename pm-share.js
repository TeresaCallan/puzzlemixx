// Share your win: +5, once per win. Phones open their own Share menu; computers get WhatsApp, X, Facebook, email and Copy.
(function () {
  const SITE = 'www.puzzlemixx.com';
  const game = () => window.PM_GAME || {};
  const sharePts = () => (game().puzzle === 'tee' ? 10 : 5);   // Tee’s DBL PTS puzzle doubles it

  function message(win) {
    const g = game();
    if (win.what === 'mental') {
      const link = g.mentalLink || `https://${SITE}`;
      return `I conquered The Mental Workout! ${link}\nJoin the game! @PuzzleMixx ${SITE}`;
    }
    const title = (g.titles || [])[win.songId - 1] || `Song ${win.songId}`;
    const id = (g.completeIds || [])[win.songId - 1];
    return `Here is my complete PEACE: ${title}${id ? ` https://youtu.be/${id}` : ''}\nJoin the game! @PuzzleMixx ${SITE}`;
  }

  function setStatus(el, text, kind) { el.textContent = text; el.className = `pm-share-status ${kind || ''}`; }

  async function award(win, statusEl, button) {
    if (!window.PM) { setStatus(statusEl, 'Thanks for sharing! Sign in on the Leaderboard to earn points.', ''); return; }
    try {
      const g = game();
      const result = await window.PM.record('share', { puzzle: g.puzzle, songId: win.songId, what: win.what, label: win.what === 'mental' ? 'Shared The Mental Workout' : `Shared ${(g.titles || [])[win.songId - 1] || 'a Complete Peace'}` });
      if (result?.added) { setStatus(statusEl, `+${sharePts()} added. Thanks for sharing!`, 'yes'); markShared(win, button); }
      else if (result?.queued) { setStatus(statusEl, `Thanks! Sign in on the Leaderboard to keep your +${sharePts()}.`, 'yes'); markShared(win, button); }
      else if (result?.reason === 'already') { setStatus(statusEl, `Thanks! You’ve already had +${sharePts()} for sharing this win.`, ''); markShared(win, button); }
      else setStatus(statusEl, 'Thanks for sharing!', '');
    } catch (error) {
      console.warn('PuzzleMixx share', error);
      setStatus(statusEl, 'Thanks for sharing! Points are only for wins in this round.', '');
    }
  }

  const sharedKey = (win) => `pmShared-${game().puzzle}-${win.what === 'mental' ? 'mental' : win.songId}`;
  function markShared(win, button) { try { sessionStorage.setItem(sharedKey(win), '1'); } catch { /* ignore */ } refreshButton(win, button); }
  function refreshButton(win, button) {
    let done = false;
    try { done = sessionStorage.getItem(sharedKey(win)) === '1'; } catch { /* ignore */ }
    button.querySelector('.pm-share-label').textContent = done ? 'Shared ✓ Share again' : 'Share your win';
    button.querySelector('.pm-share-points').hidden = done;
    button.querySelector('.pm-share-points').textContent = `+${sharePts()}`;
  }

  function closeMenus(except) { document.querySelectorAll('.pm-share-menu').forEach((m) => { if (m !== except) m.hidden = true; }); }

  function makeShare(getWin) {
    const wrap = document.createElement('div');
    wrap.className = 'pm-share';
    wrap.innerHTML = `<button class="pm-share-button" type="button"><span class="pm-share-label">Share your win</span> <span class="pm-share-points">+5</span></button>
      <div class="pm-share-menu" role="menu" hidden>
        <a role="menuitem" data-via="whatsapp" target="_blank" rel="noopener">WhatsApp</a>
        <a role="menuitem" data-via="x" target="_blank" rel="noopener">X</a>
        <a role="menuitem" data-via="facebook" target="_blank" rel="noopener">Facebook</a>
        <a role="menuitem" data-via="email">Email</a>
        <button role="menuitem" type="button" data-via="copy">Copy message</button>
      </div>
      <p class="pm-share-status" aria-live="polite"></p>`;
    const button = wrap.querySelector('.pm-share-button');
    const menu = wrap.querySelector('.pm-share-menu');
    const status = wrap.querySelector('.pm-share-status');

    button.addEventListener('click', async () => {
      const win = getWin();
      if (!win) return;
      const text = message(win);
      setStatus(status, '');
      const phone = window.matchMedia('(pointer: coarse)').matches;
      if (navigator.share && phone) {
        try { await navigator.share({ text }); award(win, status, button); }
        catch (error) { if (error?.name !== 'AbortError') setStatus(status, 'Sharing didn’t work here. Try again.', 'no'); }
        return;
      }
      const enc = encodeURIComponent(text);
      menu.querySelector('[data-via="whatsapp"]').href = `https://wa.me/?text=${enc}`;
      menu.querySelector('[data-via="x"]').href = `https://twitter.com/intent/tweet?text=${enc}`;
      menu.querySelector('[data-via="facebook"]').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://' + SITE)}`;
      menu.querySelector('[data-via="email"]').href = `mailto:?subject=${encodeURIComponent(win.what === 'mental' ? 'I conquered The Mental Workout!' : 'Here is my complete PEACE')}&body=${enc}`;
      closeMenus(menu);
      menu.hidden = !menu.hidden;
    });

    menu.addEventListener('click', async (event) => {
      const item = event.target.closest('[data-via]');
      if (!item) return;
      const win = getWin();
      if (!win) return;
      if (item.dataset.via === 'copy') {
        try { await navigator.clipboard.writeText(message(win)); } catch { /* ignore */ }
        setStatus(status, 'Message copied. Paste it into any app.', 'yes');
      }
      menu.hidden = true;
      award(win, status, button);
    });

    wrap.refresh = () => { const win = getWin(); setStatus(status, ''); menu.hidden = true; if (win) refreshButton(win, button); };
    return wrap;
  }

  document.addEventListener('click', (event) => { if (!event.target.closest('.pm-share')) closeMenus(null); });

  // Song pop-up and the "Won workouts" player (current song is set by the puzzle).
  const slots = [];
  const songActions = document.querySelector('#song-reward-actions');
  if (songActions) { const s = makeShare(() => (game().currentSong ? { songId: game().currentSong } : null)); songActions.after(s); slots.push(s); }
  const wonTitle = document.querySelector('#won-workout-title');
  if (wonTitle) { const s = makeShare(() => (game().currentSong ? { songId: game().currentSong } : null)); wonTitle.after(s); slots.push(s); }
  // The Mental Workout: the full-workout pop-up.
  const finishActions = document.querySelector('#finish-dialog .finish-actions');
  if (finishActions) { const s = makeShare(() => ({ what: 'mental' })); finishActions.before(s); slots.push(s); }

  window.PMShare = { refresh: () => slots.forEach((s) => s.refresh()) };
})();
