// Puzzle menu switches.
// Tee’s DBL PTS PuzzleMixx is built but not open yet: it shows in the menu, golden but greyed out.
// To open it: set TEE_OPEN to true (and fill in Tee’s YouTube IDs in tee.js).
(function () {
  const TEE_OPEN = true;
  const locked = !TEE_OPEN;
  document.documentElement.classList.toggle('pm-tee-locked', locked);
  if (!locked) return;
  document.querySelectorAll('.playlist-menu a[data-playlist-id="tee"]').forEach((a) => {
    a.classList.add('is-locked');
    a.removeAttribute('href');
    a.removeAttribute('aria-current');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('tabindex', '-1');
    a.title = 'Coming soon';
    if (!a.querySelector('.pm-soon')) a.insertAdjacentHTML('beforeend', '<span class="pm-soon">Coming soon</span>');
    a.addEventListener('click', (e) => e.preventDefault());
  });
  // Visiting tee.html directly while it is closed goes back to the first puzzle (add ?preview to look at it anyway).
  if (/\/tee\.html$/.test(location.pathname) && !/[?&]preview\b/.test(location.search)) location.replace('index.html');
})();
