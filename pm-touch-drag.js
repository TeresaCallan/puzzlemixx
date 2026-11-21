// Touch drag and drop for phones and iPads.
// Browsers don't fire drag-and-drop events for fingers, so a tap was the only way to move a piece (select,
// then tap a slot). Here: press and hold a piece briefly to pick it up, drag it, and let go over a slot
// (Mental Workout), a song pile (Sort by song) or anywhere on the pile to move it. A quick tap still
// selects and plays the clip as before; a quick swipe still scrolls the page.
// Uses the puzzle page's own functions: attemptPlace, attemptSort, saveMessyPosition, render.
(function () {
  const HOLD_MS = 180;     // how long to hold before the piece lifts
  const SLOP = 10;         // finger movement allowed while holding (px)
  let pending = null;      // { reel, clip, x, y, timer, metrics }
  let drag = null;         // { clip, ghost, metrics, over }

  const style = document.createElement('style');
  style.textContent = `
  @media (pointer:coarse) { .reel { -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; -webkit-user-drag:none; } }
  .pm-touch-ghost { position:fixed; z-index:10000; pointer-events:none; border-radius:8px; overflow:hidden; opacity:.92; transform:translate(-50%,-50%) scale(1.08) rotate(-2deg); box-shadow:0 18px 40px #1e1f1c55, 0 0 0 3px #b8e05aaa; transition:transform .12s; }
  .pm-touch-ghost img { display:block; width:100%; height:100%; object-fit:cover; }
  .reel.pm-touch-lifted { opacity:.35; }
  body.pm-touch-dragging, body.pm-touch-dragging * { cursor:grabbing !important; }`;
  document.head.append(style);

  const reelFrom = (el) => el?.closest?.('.reel[data-clip]');
  const pickable = (reel) => reel && !reel.closest('.slot.correct') && !reel.classList.contains('placed-reel') && !reel.closest('.sort-pile-thumbs');

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || drag) return;
    const reel = reelFrom(event.target);
    if (!pickable(reel)) return;
    reel.draggable = false;          // no native iPad drag (it fights with ours)
    event.stopPropagation();         // the page's own mouse-repositioning doesn't run for fingers
    const rect = reel.getBoundingClientRect();
    pending = {
      reel, clip: Number(reel.dataset.clip), x: event.clientX, y: event.clientY, id: event.pointerId,
      metrics: { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height }
    };
    pending.timer = setTimeout(() => lift(event.clientX, event.clientY), HOLD_MS);
  }, true);

  function lift(x, y) {
    if (!pending) return;
    const { reel, clip, metrics } = pending;
    pending = null;
    const ghost = document.createElement('div');
    ghost.className = 'pm-touch-ghost';
    ghost.style.width = `${metrics.width}px`;
    ghost.style.height = `${metrics.height}px`;
    const poster = reel.querySelector('.reel-poster');
    ghost.innerHTML = poster ? `<img src="${poster.getAttribute('src')}" alt="" />` : '';
    document.body.append(ghost);
    reel.classList.add('pm-touch-lifted');
    document.body.classList.add('pm-touch-dragging');
    try { navigator.vibrate?.(12); } catch { /* optional */ }
    drag = { clip, reel, ghost, metrics, over: null };
    try { dragging = clip; dragMetrics = metrics; } catch { /* page variables */ }
    move(x, y);
  }

  function targetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const slot = el.closest('.slot[data-slot]:not(.correct)');
    if (slot) return { kind: 'slot', el: slot, n: Number(slot.dataset.slot) };
    const pile = el.closest('[data-pile]');
    if (pile && !pile.classList.contains('complete')) return { kind: 'pile', el: pile, n: Number(pile.dataset.pile) };
    if (el.closest('#reels')) return { kind: 'reels', el: document.querySelector('#reels') };
    return null;
  }

  // Near the top or bottom of the screen, the page scrolls so far-away slots and piles can be reached.
  function autoScroll() {
    if (!drag) return;
    const edge = 70;
    const h = window.innerHeight;
    let dy = 0;
    if (drag.y < edge) dy = -Math.ceil((edge - drag.y) / 5);
    else if (drag.y > h - edge) dy = Math.ceil((drag.y - (h - edge)) / 5);
    if (dy) { window.scrollBy(0, dy); move(drag.x, drag.y); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function move(x, y) {
    if (!drag) return;
    drag.x = x; drag.y = y;
    if (!drag.raf) drag.raf = requestAnimationFrame(autoScroll);
    drag.ghost.style.left = `${x}px`;
    drag.ghost.style.top = `${y}px`;
    const t = targetAt(x, y);
    if (drag.over?.el !== t?.el) {
      drag.over?.el?.classList.remove('drop-ready');
      if (t && t.kind !== 'reels') t.el.classList.add('drop-ready');
      drag.over = t;
    }
  }

  function finish(x, y, cancelled) {
    if (!drag) return;
    const { clip, reel, ghost, metrics } = drag;
    cancelAnimationFrame(drag.raf);
    const t = cancelled ? null : targetAt(x, y);
    drag.over?.el?.classList.remove('drop-ready');
    ghost.remove();
    reel.classList.remove('pm-touch-lifted');
    document.body.classList.remove('pm-touch-dragging');
    drag = null;
    try { draggedRecently = true; setTimeout(() => { draggedRecently = false; }, 350); } catch { /* ignore */ }
    try { dragging = null; dragMetrics = null; } catch { /* ignore */ }
    if (!t) return;
    if (t.kind === 'slot' && typeof attemptPlace === 'function') attemptPlace(clip, t.n);
    else if (t.kind === 'pile' && typeof attemptSort === 'function') attemptSort(clip, t.n);
    else if (t.kind === 'reels' && typeof viewMode !== 'undefined' && viewMode === 'sort' && typeof saveMessyPosition === 'function') {
      if (saveMessyPosition(clip, x, y, metrics)) render();
    }
  }

  document.addEventListener('pointermove', (event) => {
    if (pending && event.pointerId === pending.id && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > SLOP) {
      clearTimeout(pending.timer);   // moved before the hold: it's a scroll, not a drag
      pending = null;
    }
    if (drag) move(event.clientX, event.clientY);
  }, true);
  // While a piece is lifted, the page must not scroll under the finger.
  document.addEventListener('touchmove', (event) => {
    if (drag) {
      event.preventDefault();
      const t = event.touches[0];
      if (t) move(t.clientX, t.clientY);
    }
  }, { passive: false, capture: true });
  document.addEventListener('pointerup', (event) => {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    if (drag) finish(event.clientX, event.clientY, false);
  }, true);
  document.addEventListener('touchend', (event) => {
    if (drag) { const t = event.changedTouches[0]; finish(t.clientX, t.clientY, false); }
  }, true);
  document.addEventListener('pointercancel', () => { if (pending) { clearTimeout(pending.timer); pending = null; } }, true);
  document.addEventListener('touchcancel', () => { if (drag) finish(0, 0, true); }, true);
  // No long-press menu or image callout on pieces.
  document.addEventListener('contextmenu', (event) => { if (reelFrom(event.target) && (pending || drag)) event.preventDefault(); }, true);
  // After a drag, swallow the click so the piece doesn't also open.
  document.addEventListener('click', (event) => {
    try { if (draggedRecently && reelFrom(event.target)) { event.stopPropagation(); event.preventDefault(); } } catch { /* ignore */ }
  }, true);
})();
