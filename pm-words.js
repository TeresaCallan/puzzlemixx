// Shows "Complete Peace" in the same style as the WORKOUTS label beside the
// PuzzleMixx logo: "complete" in lower case in the surrounding font, PEACE in DM Mono capitals. ("Workout" keeps its normal font.)
(function () {
  const WORD = /\bcomplete peace\b/gi;
  const SKIP = 'script,style,textarea,input,select,option,title,svg,noscript,[contenteditable],.brand-workouts,.title-workout-word,.pm-word';
  const style = document.createElement('style');
  style.textContent = `
    /* "complete" keeps the font of the sentence it sits in; only PEACE is in DM Mono capitals. */
    .pm-word { white-space:nowrap; }
    .pm-word .pm-complete { text-transform:lowercase; }
    .pm-word .pm-peace { margin-left:.25em; color:#6B2FA3; font-family:"DM Mono",ui-monospace,monospace; font-style:normal; font-weight:500; letter-spacing:.13em; text-transform:uppercase; font-size:.84em; }
    h1 .pm-word .pm-peace { font-size:.62em; letter-spacing:.11em; }
    h2 .pm-word .pm-peace,h3 .pm-word .pm-peace { font-size:.6em; letter-spacing:.1em; }
    .pm-word .pm-peace > span { display:inline-block; color:#6B2FA3; animation:pmPeaceGlint 60s ease-in-out infinite; }
    @keyframes pmPeaceGlint { 0%,2.6%,4.2%,100% { color:#6B2FA3; text-shadow:none; } 3.4% { color:#E2B33C; text-shadow:0 0 6px #FFE9A8, 0 0 12px #F2C94C99; } }
    @media (prefers-reduced-motion:reduce) { .pm-word .pm-peace > span { animation:none; } }
    .song-reward-thumbnail .pm-word,.reward-exercise-title .pm-word { color:inherit; }
    /* Every PuzzleMixx icon glints gold once a minute, in step with PEACE */
    img[src*="puzzlemixx-brand-mark"] { animation:pmIconGlint 60s ease-in-out infinite; }
    .pm-shimmer-icon img[src*="puzzlemixx-brand-mark"] { animation:none; }
    @keyframes pmIconGlint { 0%,2.6%,4.2%,100% { filter:none; } 3.4% { filter:brightness(1.3) saturate(1.25) drop-shadow(0 0 6px #F2C94Cdd); } }
    @media (prefers-reduced-motion:reduce) { img[src*="puzzlemixx-brand-mark"] { animation:none; } }`;
  document.head.append(style);

  function wrap(textNode) {
    const text = textNode.nodeValue;
    WORD.lastIndex = 0;
    if (!WORD.test(text)) return;
    const parent = textNode.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    WORD.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = WORD.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const span = document.createElement('span');
      span.className = 'pm-word';
      const [first, ...rest] = m[0].split(' ');
      const peace = document.createElement('span');
      peace.className = 'pm-peace';
      peace.setAttribute('aria-label', rest.join(' '));
      [...rest.join(' ')].forEach((letter, n) => {   // one span per letter, so the glint can sweep across
        const l = document.createElement('span');
        l.setAttribute('aria-hidden', 'true');
        l.style.animationDelay = `${n * 0.09}s`;
        l.textContent = letter;
        peace.append(l);
      });
      const complete = document.createElement('span');
      complete.className = 'pm-complete';
      complete.textContent = first.toLowerCase();
      span.append(complete, peace);   // gap set in CSS: tighter than a full monospace space
      frag.append(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    textNode.replaceWith(frag);
  }

  function scan(root) {
    if (root.nodeType === 3) return wrap(root);
    if (root.nodeType !== 1 || root.closest?.(SKIP)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const found = [];
    while (walker.nextNode()) found.push(walker.currentNode);
    found.forEach(wrap);
  }

  let pending = new Set(), queued = false;
  function queue(node) {
    pending.add(node);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const nodes = pending; pending = new Set();
      nodes.forEach((n) => { if (n.isConnected) scan(n); });
    });
  }

  function start() {
    scan(document.body);
    new MutationObserver((records) => {
      records.forEach((r) => {
        if (r.type === 'characterData') queue(r.target);
        else r.addedNodes.forEach(queue);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
