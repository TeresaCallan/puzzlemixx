const TOTAL = 35;
const MEDIA_VERSION = 'nieve-35-2';
const REWARD_MEDIA_VERSION = 'nieve-song-rewards-4';
const FULL_WORKOUT_VERSION = 'nieve-full-workout-1';
const HINT_DURATION_MS = 6000;
const HINT_COST = 5;
const PLAYLIST_NAME = 'Nieve’s Playlist';
// Puzzle pieces play WITH SOUND (17 Nov 2026). The hover previews stored with the site stay silent.
// Set PIECE_SOUND back to false to mute the pieces again.
const PIECE_SOUND = true;
// YouTube IDs from “Nieve's Puzzle Links” (T-time workouts › Puzzles › Nieve's › links), in puzzle order.
const PIECE_YOUTUBE_IDS = ["5KEuFHo6B38", "enzrOuKQdgs", "uql0Z7RUkVE", "QFbuQYlYXJc", "Lqb3Dv6uM7Y", "zGNQwpqZ5Jo", "PJpO2Ocbk8Q", "AHELeEvUH4o", "VzKsr4VSHI0", "71MXcF3ycMc", "xcy3THFpqNI", "bMV0G1iTABM", "VeTyCLhNLI0", "oBZJSgBIv1I", "Gyme3e05W7s", "MRHWy9sWB8s", "aCYI8TIxxzE", "-TwmwIn_s24", "KlLV6wvjAN4", "3PtzKJ5ziCw", "jJDrmOWtnA4", "y9hQEZF-E9M", "MpgjSL4UPT0", "Bx1rGeuG_9E", "QQ8IsdzdoOQ", "zWyV75cB954", "MEvD1zoyDwQ", "vyUNZYc_39k", "gNZat8mCzG4", "Re2kgwMLwqY", "VvtBFGvWeng", "h_XRpAO63TI", "W0QxIhmzW0k", "VPLNRS_7Qrc", "LgluDCEQtfU"];
const COMPLETE_PEACE_YOUTUBE_IDS = ["CVTKAhU-ju0", "-YFCo6_jxsw", "QBT2_4PN4g8", "zuc8LaXXOA0", "MB9z09BXFlA", "Kb7HBmYsAc4", "uVVbFYGaDPo", "bbPT8P9768k", "dK0FLLlcDjo", "6QnCBeClIgE"];
const clips = Array.from({ length: TOTAL }, (_, i) => i + 1);
const SONG_PILES = [
  [1, 2, 3, 4],
  [5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14],
  [15, 16, 17],
  [18, 19, 20, 21],
  [22, 23, 24, 25, 26],
  [27, 28, 29],
  [30, 31],
  [32, 33, 34, 35]
].map((pileClips, index) => ({ id: index + 1, clips: pileClips }));

const SONG_REWARD_MOVIE_CLIPS = new Map(SONG_PILES.map((pile) => [pile.id, [pile.id]]));

// Demo videos shown in the “Won workouts” section (Nieve only). The pop-up reward is always the CompletePeace.
// Songs 7 and 10 have no Demo yet, so they show the CompletePeace until one is added.
const DEMO_YOUTUBE_IDS = ["G3b6Um9EDG8", "wvfVoCawaHc", "z2rbMuG6apc", "Di3QLww-0hE", "h-LxT37fA3c", "j679cxZ6aqo", null, "jIVsAxK-0FQ", "QMwFLVSTkCQ", null];
const SONG_REWARDS = COMPLETE_PEACE_YOUTUBE_IDS.map((completeId, index) => {
  const videoId = DEMO_YOUTUBE_IDS[index] || completeId;
  return { url: `https://youtu.be/${videoId}`, videoId, id: index + 1 };
});

const EXERCISE_TITLES = [
  'Mobility',
  'Mobility & Core Prep',
  'Cardio',
  'Mobility & Core',
  'Flexibility & Core',
  'Legs, Core & Coordination',
  'Legs, Core & Coordination 2nd Side',
  'Combination Exercises',
  'Adage',
  'Stretch'
];

const game = document.querySelector('.game');
const reels = document.querySelector('#reels');
const timeline = document.querySelector('#timeline');
const template = document.querySelector('#reel-template');
const progress = document.querySelector('#progress');
const reelsHeading = document.querySelector('#reels-heading');
const reelsInstructions = document.querySelector('#reels-instructions');
const timelineHeading = document.querySelector('#timeline-heading');
const timelineInstructions = document.querySelector('#timeline-instructions');
const puzzleViewButton = document.querySelector('#puzzle-view-button');
const sortViewButton = document.querySelector('#sort-view-button');
const sortStatus = document.querySelector('#sort-status');
const clipDialog = document.querySelector('#clip-dialog');
const clipPlayer = document.querySelector('#clip-player');
const clipLabel = document.querySelector('#clip-label');
const finishDialog = document.querySelector('#finish-dialog');
const moviePlayer = document.querySelector('#movie-player');
const songRewardRail = document.querySelector('#song-reward-rail');
const songRewardList = document.querySelector('#song-reward-list');
const showSongRewardsButton = document.querySelector('#show-song-rewards');
const compactHeader = document.querySelector('#compact-header');
const compactPuzzleViewButton = document.querySelector('#compact-puzzle-view-button');
const compactSortViewButton = document.querySelector('#compact-sort-view-button');
const songRewardDialog = document.querySelector('#song-reward-dialog');
const songRewardTitle = document.querySelector('#song-reward-title');
const songRewardCopy = document.querySelector('.song-reward-copy');
const songRewardPlayer = document.querySelector('#song-reward-player');
const songRewardStatus = document.querySelector('#song-reward-status');
const songWatchButton = document.querySelector('#song-watch-button');
const songRewardActions = document.querySelector('#song-reward-actions');
const songReplayChoice = document.querySelector('#song-replay-choice');
const songReplayPrompt = document.querySelector('#song-replay-prompt');
const songPlayAgainButton = document.querySelector('#song-play-again');
const songReturnPuzzleButton = document.querySelector('#song-return-puzzle');
const leaderboardPoints = document.querySelector('#leaderboard-points');
const songShareLink = document.querySelector('#song-share-link');
const hintButton = document.querySelector('#hint-button');
const compactHintButton = document.querySelector('#compact-hint-button');
const hintNotice = document.querySelector('#hint-notice');
const hintCostDialog = document.querySelector('#hint-cost-dialog');

const PROTOTYPE_SCORE_KEY = 'puzzlemixxPrototypeScore';

let order = [];
let placed = new Set();
let sortedPileByClip = new Map();
let messyPositions = new Map();
let selected = null;
let dragging = null;
let dragMetrics = null;
let pointerReposition = null;
let draggedRecently = false;
let viewMode = 'puzzle';
let sortCompleted = false;
let messyZCounter = TOTAL;
let hintTimer;
let hoveredPreview = null;
let feedbackAudioContext = null;
let rewardRailHidden = false;
let activeSongReward = null;
let songRewardReturnFocus = null;
let compactHeaderFrame = null;
let mentalGridFrame = null;
let pendingPaidHint = null;
let freeHintAvailable = true;

const pad = (n) => String(n).padStart(2, '0');
const thumbnailFileFor = (n) => `media/nieve/hover/${pad(n)}.mp4`;   // silent hover clips, stored with the site
const previewFileFor = (n) => `yt:${PIECE_YOUTUBE_IDS[n - 1]}`;
const songWorkoutFileFor = (n) => `yt:${COMPLETE_PEACE_YOUTUBE_IDS[n - 1]}`;
const posterFileFor = (n) => `media/nieve/posters/${pad(n)}.webp`;
const shuffle = (items) => [...items].sort(() => Math.random() - .5);
const shuffledTags = shuffle(clips.map((_, index) => pad(index + 1)));
const reelLabels = new Map(clips.map((n, i) => [n, `REEL / ${shuffledTags[i]}`]));

function reelName(n) { return reelLabels.get(n); }
function songPileForClip(n) { return SONG_PILES.find((pile) => pile.clips.includes(n)); }
function sortedCountForPile(pile) { return pile.clips.filter((n) => sortedPileByClip.get(n) === pile.id).length; }
window.PM_GAME = { puzzle: 'nieve', titles: EXERCISE_TITLES, completeIds: COMPLETE_PEACE_YOUTUBE_IDS, mentalLink: 'https://youtu.be/D5uZbUJvSC4', currentSong: null };

function songRewardForPile(pileId) { return SONG_REWARDS.find((reward) => reward.id === pileId); }

function normaliseSuccessCycles(stored, songIds, mentalBonus) {
  const seen = new Set();
  const cycles = Array.isArray(stored.successes) ? stored.successes.flatMap((success, index) => {
    const type = success?.type === 'mental' ? 'mental' : success?.type === 'song' ? 'song' : null;
    const songId = type === 'song' && Number.isInteger(success.songId) && success.songId >= 1 && success.songId <= 10 ? success.songId : null;
    if (!type || (type === 'song' && !songId)) return [];
    const cycle = Number.isInteger(success.cycle) && success.cycle > 0 ? success.cycle : index + 1;
    const fallbackId = `${type}-${songId || 'workout'}-${cycle}`;
    const id = typeof success.id === 'string' && success.id ? success.id : fallbackId;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      type,
      songId,
      cycle,
      shares: Number.isInteger(success.shares) ? Math.min(Math.max(success.shares, 0), 3) : 0,
      completedAt: typeof success.completedAt === 'string' ? success.completedAt : ''
    }];
  }) : [];
  if (cycles.length) return cycles;
  const migrated = songIds.map((songId) => ({ id:`song-${songId}-1`, type:'song', songId, cycle:1, shares:0, completedAt:'' }));
  if (mentalBonus) migrated.push({ id:'mental-workout-1', type:'mental', songId:null, cycle:1, shares:0, completedAt:'' });
  return migrated;
}

function readPrototypeScore() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROTOTYPE_SCORE_KEY) || '{}');
    const songIds = Array.isArray(stored.songIds) ? [...new Set(stored.songIds)].filter((id) => Number.isInteger(id) && id >= 1 && id <= 10) : [];
    const mentalBonus = stored.mentalBonus === true;
    return {
      songIds,
      mentalBonus,
      shareCount: Number.isInteger(stored.shareCount) && stored.shareCount > 0 ? stored.shareCount : 0,
      spentPoints: Number.isInteger(stored.spentPoints) && stored.spentPoints > 0 ? stored.spentPoints : 0,
      freeHintsUsed: Number.isInteger(stored.freeHintsUsed) ? Math.min(Math.max(stored.freeHintsUsed, 0), 2) : 0,
      successes: normaliseSuccessCycles(stored, songIds, mentalBonus)
    };
  } catch {
    return { songIds: [], mentalBonus: false, shareCount: 0, spentPoints: 0, freeHintsUsed: 0, successes: [] };
  }
}

function prototypePoints(score = readPrototypeScore()) {
  const earned = score.songIds.length + (score.mentalBonus ? 10 : 0) + score.shareCount * 10;
  return earned - score.spentPoints;
}

// Points shown in the header: the online profile total when signed in, otherwise this browser's tally.
function shownPoints(score) {
  const online = window.PM?.state?.player;
  return online ? (window.PM?.roundPoints ? window.PM.roundPoints(online) : online.points) : prototypePoints(score);
}

function savePrototypeScore(score) {
  localStorage.setItem(PROTOTYPE_SCORE_KEY, JSON.stringify(score));
  leaderboardPoints.textContent = `${shownPoints(score)} pts`;
  updateHintButtons();
}

function updateHintButtons() {
  hintButton.textContent = 'Give me a hint';
  compactHintButton.textContent = 'Hint';
}

function showHintNotice(message) {
  clearTimeout(showHintNotice.timer);
  hintNotice.textContent = message;
  hintNotice.classList.add('visible');
  showHintNotice.timer = setTimeout(() => hintNotice.classList.remove('visible'), 3200);
}

function requestHintConfirmation(revealHint) {
  pendingPaidHint = revealHint;
  const currentPoints = shownPoints();
  document.querySelector('#hint-cost-balance').textContent = `${currentPoints} pts → ${currentPoints - HINT_COST} pts`;
  if (!hintCostDialog.open) hintCostDialog.showModal();
}

function offerHint(revealHint) {
  // Every hint asks first and costs 5 points.
  requestHintConfirmation(revealHint);
}

function closeHintCostDialog() {
  pendingPaidHint = null;
  if (hintCostDialog.open) hintCostDialog.close();
}

function confirmPaidHint() {
  const revealHint = pendingPaidHint;
  if (!revealHint) return;
  const score = readPrototypeScore();
  score.spentPoints += HINT_COST;
  savePrototypeScore(score);
  window.PM?.record('hint', { puzzle: 'nieve' });
  pendingPaidHint = null;
  if (hintCostDialog.open) hintCostDialog.close();
  showHintNotice('5 points deducted. Your hint glows for 6 seconds.');
  revealHint();
}

function recordSuccessCycle(score, type, songId = null) {
  const matching = score.successes.filter((success) => success.type === type && (type !== 'song' || success.songId === songId));
  const cycle = matching.reduce((highest, success) => Math.max(highest, success.cycle), 0) + 1;
  score.successes.push({
    id:`${type}-${songId || 'workout'}-${cycle}-${Date.now()}`,
    type,
    songId:type === 'song' ? songId : null,
    cycle,
    shares:0,
    completedAt:new Date().toISOString()
  });
}

function awardSongPoint(pileId) {
  const score = readPrototypeScore();
  if (!score.songIds.includes(pileId)) {
    score.songIds.push(pileId);
    score.songIds.sort((a, b) => a - b);
  }
  recordSuccessCycle(score, 'song', pileId);
  savePrototypeScore(score);
  window.PM?.record('song', { puzzle: 'nieve', songId: pileId });
}

function awardMentalWorkoutBonus() {
  const score = readPrototypeScore();
  if (!score.mentalBonus) score.mentalBonus = true;
  recordSuccessCycle(score, 'mental');
  savePrototypeScore(score);
  window.PM?.record('mental', { puzzle: 'nieve' });
}

const wonWorkoutDialog = document.querySelector('#won-workout-dialog');
const wonWorkoutPlayer = document.querySelector('#won-workout-player');
const wonWorkoutTitle = document.querySelector('#won-workout-title');
let wonWorkoutReturnFocus = null;

function openWonWorkout(pileId) {
  window.PM_GAME.currentSong = pileId; window.PMShare?.refresh();
  const reward = songRewardForPile(pileId);
  if (!reward || !wonWorkoutDialog) return;
  wonWorkoutReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wonWorkoutTitle.textContent = `Nieve’s ${EXERCISE_TITLES[pileId - 1]}`;
  wonWorkoutPlayer.muted = false;
  wonWorkoutPlayer.src = `yt:${reward.videoId}`;
  if (!wonWorkoutDialog.open) wonWorkoutDialog.showModal();
  wonWorkoutPlayer.play().catch(() => {});
}

function closeWonWorkout() {
  wonWorkoutPlayer.pause();
  wonWorkoutPlayer.removeAttribute('src');
  wonWorkoutPlayer.load?.();
  if (wonWorkoutDialog.open) wonWorkoutDialog.close();
}

if (wonWorkoutDialog) {
  document.querySelector('#won-workout-close').addEventListener('click', closeWonWorkout);
  wonWorkoutDialog.addEventListener('click', (event) => { if (event.target === wonWorkoutDialog) closeWonWorkout(); });
  wonWorkoutDialog.addEventListener('close', () => {
    wonWorkoutPlayer.pause();
    wonWorkoutPlayer.removeAttribute('src');
    if (wonWorkoutReturnFocus?.isConnected) wonWorkoutReturnFocus.focus({ preventScroll: true });
  });
}

function renderSongRewardRail() {
  const railIsAvailable = true;
  songRewardRail.hidden = !railIsAvailable || rewardRailHidden;
  showSongRewardsButton.hidden = !railIsAvailable || !rewardRailHidden;
  game.classList.toggle('reward-rail-hidden', rewardRailHidden);
  songRewardList.innerHTML = '';
  let wonCount = 0;

  SONG_PILES.forEach((pile) => {
    const reward = songRewardForPile(pile.id);
    const lazyWorkoutWon = sortedCountForPile(pile) === pile.clips.length;
    const mentalWorkoutWon = pile.clips.every((clip) => placed.has(clip));
    const isWon = lazyWorkoutWon || mentalWorkoutWon;

    if (isWon) {
      wonCount += 1;
      const thumbnail = document.createElement('button');
      thumbnail.type = 'button';
      thumbnail.className = 'song-reward-thumbnail won';
      const exerciseTitle = EXERCISE_TITLES[pile.id - 1];
      thumbnail.setAttribute('aria-label', `Play your won ${exerciseTitle} workout`);
      thumbnail.addEventListener('click', () => openWonWorkout(pile.id));
      thumbnail.innerHTML = `
        <img src="https://i.ytimg.com/vi/${reward.videoId}/hqdefault.jpg" alt="" loading="lazy" />
        <span class="reward-exercise-title">${exerciseTitle}</span>
        <span class="reward-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7.2v9.6l7.6-4.8z"/></svg></span>
        <span class="reward-won-label">✓ WON</span>`;
      songRewardList.append(thumbnail);
      return;
    }

    const locked = document.createElement('div');
    locked.className = 'song-reward-thumbnail locked';
    locked.setAttribute('role', 'img');
    locked.setAttribute('aria-label', `${EXERCISE_TITLES[pile.id - 1]}: not won yet`);
    locked.innerHTML = `
      <span class="reward-slot-number">${pile.id}</span>
      <svg class="reward-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>
      <span class="reward-locked-name">${EXERCISE_TITLES[pile.id - 1]}</span>`;
    songRewardList.append(locked);
  });
  const rewardCount = document.querySelector('#song-reward-count');
  if (rewardCount) {
    rewardCount.textContent = wonCount === SONG_PILES.length ? `All ${wonCount} won!` : `${wonCount} of ${SONG_PILES.length} won`;
    rewardCount.classList.toggle('has-wins', wonCount > 0);
  }
  scheduleMentalGridFit();
}

function saveMessyPosition(clip, clientX, clientY, metrics) {
  const frame = reels.getBoundingClientRect();
  if (clientX < frame.left || clientX > frame.right || clientY < frame.top || clientY > frame.bottom) return false;
  const headerClearance = 42;
  const pileVerticalScale = 0.88;
  const width = metrics?.width ?? 0;
  const height = metrics?.height ?? 0;
  const offsetX = metrics?.offsetX ?? width / 2;
  const offsetY = metrics?.offsetY ?? height / 2;
  const maxLeft = Math.max(frame.width - width, 0);
  const maxTop = Math.max(frame.height - height, 0);
  const left = Math.min(Math.max(clientX - frame.left - offsetX, 0), maxLeft);
  const top = Math.min(Math.max(clientY - frame.top - offsetY, headerClearance), maxTop);
  messyPositions.set(clip, {
    x: frame.width ? left / frame.width * 100 : 0,
    y: frame.height ? (top - headerClearance) / (frame.height * pileVerticalScale) * 100 : 0,
    z: ++messyZCounter
  });
  return true;
}

async function startHoverPreview(preview, n) {
  hoveredPreview = preview;
  preview.src = thumbnailFileFor(n);
  preview.currentTime = 0;
  preview.muted = !PIECE_SOUND;

  try {
    await preview.play();
  } catch {
    preview.muted = true;
    await preview.play().catch(() => {});
  }

  if (hoveredPreview === preview && !preview.paused) preview.classList.add('playing');
}

function stopHoverPreview(preview) {
  if (hoveredPreview === preview) hoveredPreview = null;
  preview.pause();
  preview.classList.remove('playing');
  preview.removeAttribute('src');
  preview.load();
}

function createReel(n, { messy = false, selectable = true } = {}) {
  const reel = template.content.firstElementChild.cloneNode(true);
  const preview = reel.querySelector('.reel-preview');
  reel.dataset.clip = n;
  reel.querySelector('.reel-poster').src = posterFileFor(n);
  preview.volume = 0.85;
  reel.setAttribute('aria-label', selectable
    ? `${reelName(n)}. Open the enlarged clip and select this reel.`
    : `${reelName(n)}. Open this correctly placed clip.`);

  if (messy) {
    const savedPosition = messyPositions.get(n);
    reel.classList.add('pile-piece');
    reel.style.setProperty('--pile-x', savedPosition?.x ?? 3 + ((n * 37) % 68));
    reel.style.setProperty('--pile-y', savedPosition?.y ?? 3 + ((n * 53) % 68));
    reel.style.setProperty('--pile-rotation', ((n * 17) % 25) - 12);
    reel.style.setProperty('--pile-z', savedPosition?.z ?? n);
    reel.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const rect = reel.getBoundingClientRect();
      pointerReposition = {
        clip: n,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        metrics: {
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          width: rect.width,
          height: rect.height
        }
      };
    });
  }

  if (selected === n) reel.classList.add('selected');
  reel.addEventListener('mouseenter', () => startHoverPreview(preview, n));
  reel.addEventListener('mouseleave', () => stopHoverPreview(preview));
  reel.addEventListener('dragstart', (event) => {
    const rect = reel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    dragging = n;
    pointerReposition = null;
    dragMetrics = {
      offsetX: offsetX >= 0 && offsetX <= rect.width ? offsetX : rect.width / 2,
      offsetY: offsetY >= 0 && offsetY <= rect.height ? offsetY : rect.height / 2,
      width: rect.width,
      height: rect.height
    };
    draggedRecently = true;
    reel.classList.add('dragging');
  });
  reel.addEventListener('dragend', () => {
    dragging = null;
    dragMetrics = null;
    reel.classList.remove('dragging');
    document.querySelectorAll('.slot, .song-pile').forEach((target) => target.classList.remove('drop-ready'));
    setTimeout(() => { draggedRecently = false; }, 0);
  });
  reel.addEventListener('click', () => {
    if (!draggedRecently) selectable ? selectAndPlayClip(n) : playClip(n);
  });
  reel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectable ? selectAndPlayClip(n) : playClip(n);
    }
  });
  return reel;
}

function selectAndPlayClip(n) {
  if (hoveredPreview) stopHoverPreview(hoveredPreview);
  selected = n;
  render();
  playClip(n);
}

function setView(mode) {
  viewMode = mode;
  selected = null;
  dragging = null;
  render();
}

function updateCompactHeader() {
  compactHeaderFrame = null;
  const compactHeight = Math.max(compactHeader.offsetHeight, 58);
  const shouldShow = game.getBoundingClientRect().top <= compactHeight + 14;
  compactHeader.classList.toggle('visible', shouldShow);
  compactHeader.setAttribute('aria-hidden', String(!shouldShow));
  compactHeader.inert = !shouldShow;
}

function scheduleCompactHeaderUpdate() {
  if (compactHeaderFrame !== null) return;
  compactHeaderFrame = requestAnimationFrame(updateCompactHeader);
}

function fitMentalGrid() {
  mentalGridFrame = null;
  if (!window.matchMedia('(min-width:761px)').matches || viewMode === 'sort') {
    timeline.style.removeProperty('--mental-columns');
    timeline.style.removeProperty('--mental-rows');
    return;
  }
  const gap = 6;
  const preferredTileWidth = 88;
  const columns = Math.max(3, Math.min(6, Math.floor((timeline.clientWidth + gap) / (preferredTileWidth + gap))));
  timeline.style.setProperty('--mental-columns', columns);
  timeline.style.setProperty('--mental-rows', Math.ceil(TOTAL / columns));
}

function scheduleMentalGridFit() {
  if (mentalGridFrame !== null) return;
  mentalGridFrame = requestAnimationFrame(fitMentalGrid);
}

function render() {
  if (hoveredPreview) stopHoverPreview(hoveredPreview);
  reels.innerHTML = '';
  timeline.innerHTML = '';
  game.classList.toggle('sort-mode', viewMode === 'sort');
  const songsSortedWorkspace = viewMode === 'puzzle' && sortCompleted;
  game.classList.toggle('songs-sorted', songsSortedWorkspace);
  document.body.classList.toggle('songs-sorted-workspace', songsSortedWorkspace);
  puzzleViewButton.setAttribute('aria-pressed', viewMode === 'puzzle');
  sortViewButton.setAttribute('aria-pressed', viewMode === 'sort');
  compactPuzzleViewButton.setAttribute('aria-pressed', viewMode === 'puzzle');
  compactSortViewButton.setAttribute('aria-pressed', viewMode === 'sort');

  if (viewMode === 'sort') renderSortView();
  else renderPuzzleView();

  reels.prepend(timelineHeading);
  timeline.prepend(progress);
  renderSongRewardRail();

  const sortedText = sortCompleted ? 'songs sorted' : `${sortedPileByClip.size} sorted`;
  const progressText = viewMode === 'sort'
    ? `${sortedPileByClip.size} of ${TOTAL} sorted`
    : `${placed.size} of ${TOTAL} placed${sortCompleted ? ' · songs sorted' : ''}`;
  renderProgress(progressText);
  sortStatus.dataset.summary = sortedText;
  scheduleMentalGridFit();
}

function renderProgress(progressText) {
  const workoutComplete = placed.size === TOTAL;
  progress.classList.toggle('completed-movie-link', workoutComplete);

  if (!workoutComplete) {
    progress.textContent = progressText;
    progress.removeAttribute('role');
    progress.removeAttribute('tabindex');
    progress.removeAttribute('aria-label');
    return;
  }

  const playlistLabel = document.createElement('span');
  playlistLabel.className = 'mental-playlist-label';
  playlistLabel.textContent = PLAYLIST_NAME;
  const workoutLabel = document.createElement('span');
  workoutLabel.className = 'mental-workout-label';
  workoutLabel.textContent = 'WORKOUT';
  progress.replaceChildren(playlistLabel, workoutLabel);
  progress.setAttribute('role', 'button');
  progress.setAttribute('tabindex', '0');
  progress.setAttribute('aria-label', `Watch the complete ${PLAYLIST_NAME} Workout`);
}

function renderPuzzleView() {
  const workoutComplete = placed.size === TOTAL;
  reelsHeading.textContent = workoutComplete ? '' : sortCompleted ? 'Nieve’s song piles' : '';
  reelsInstructions.textContent = workoutComplete ? '' : sortCompleted
    ? 'The songs are lined up. Choose a reel, then place it with The Mental Workout.'
    : '';
  timelineHeading.innerHTML = 'The Mental Workout <span class="workout-points">+10pts +10 bonus!</span>';
  timelineInstructions.textContent = '';
  reels.setAttribute('aria-label', workoutComplete ? 'Completed Mental Workout' : sortCompleted ? 'Reels grouped into ten song piles' : 'Unplaced video reels');
  timeline.setAttribute('aria-label', 'The Mental Workout puzzle');
  reels.className = workoutComplete ? 'reels completion-panel' : sortCompleted ? 'reels sorted-pile-list' : 'reels';
  timeline.className = 'timeline';

  if (workoutComplete) reels.append(createCompletedWorkoutBrandButton());
  else if (sortCompleted) renderSortedPileList();
  else order.filter((n) => !placed.has(n)).forEach((n) => reels.append(createReel(n)));

  clips.forEach((n) => {
    const isPlaced = placed.has(n);
    const slot = document.createElement(isPlaced ? 'div' : 'button');
    slot.className = `slot${isPlaced ? ' correct' : ''}`;
    slot.dataset.slot = n;
    slot.innerHTML = `<span class="slot-number">${pad(n)}</span>${isPlaced ? '' : '<span class="slot-text">place reel</span>'}`;

    if (isPlaced) {
      const placedReel = createReel(n, { selectable: false });
      placedReel.draggable = false;
      placedReel.classList.add('placed-reel');
      slot.append(placedReel);
      timeline.append(slot);
      return;
    }

    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('drop-ready');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-ready'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('drop-ready');
      attemptPlace(dragging, n);
    });
    slot.addEventListener('click', () => attemptPlace(selected, n));
    timeline.append(slot);
  });
}

function renderSortedPileList() {
  SONG_PILES.forEach((pile) => {
    const group = document.createElement('section');
    const remaining = pile.clips.filter((n) => !placed.has(n));
    group.className = `sorted-song-pile${remaining.length ? '' : ' depleted'}`;
    group.style.setProperty('--pile-index', pile.id - 1);
    group.innerHTML = `<div class="sorted-pile-heading"><span>Song ${pad(pile.id)}</span><span aria-label="Sorted">✓</span></div>`;
    const groupReels = document.createElement('div');
    groupReels.className = 'pile-reels';
    remaining.forEach((n) => groupReels.append(createReel(n)));
    if (!remaining.length) groupReels.innerHTML = '<span class="pile-complete-copy">Placed</span>';
    group.append(groupReels);
    reels.append(group);
  });
}

function renderSortView() {
  reelsHeading.textContent = sortCompleted ? 'All reels sorted' : '';
  reelsInstructions.textContent = sortCompleted ? 'Every reel has found its song.' : '';
  timelineHeading.innerHTML = 'The Lazy Workout <span class="workout-points">+10pts</span>';
  timelineInstructions.textContent = '';
  reels.setAttribute('aria-label', 'Unsorted reels in a messy pile');
  timeline.setAttribute('aria-label', 'Ten song piles');
  reels.className = 'reels messy-pile';
  timeline.className = 'timeline sort-piles';

  const unsorted = order.filter((n) => !sortedPileByClip.has(n));
  unsorted.forEach((n) => reels.append(createReel(n, { messy: true })));
  if (!unsorted.length) {
    reels.append(createCompletedWorkoutBrandButton());
  }

  SONG_PILES.forEach((pile) => {
    const count = sortedCountForPile(pile);
    const isComplete = count === pile.clips.length;
    const target = document.createElement('div');
    target.className = `song-pile${isComplete ? ' complete' : ''}`;
    target.dataset.pile = pile.id;
    target.setAttribute('role', 'group');
    target.setAttribute('aria-label', `Song ${pile.id}, ${count} of ${pile.clips.length} clips`);
    const sortedClips = pile.clips.filter((n) => sortedPileByClip.get(n) === pile.id);
    const exerciseTitle = EXERCISE_TITLES[pile.id - 1];
    target.innerHTML = `
      <button class="song-pile-action" type="button" aria-label="${isComplete ? `Play the completed short movie for Song ${pile.id}` : `Add the selected clip to Song ${pile.id}`}"></button>
      <span class="sort-pile-number">Song ${pad(pile.id)}${isComplete ? ` <span class="sort-pile-title">· ${exerciseTitle}</span>` : ''}</span>
      <span class="sort-pile-thumbs"></span>
      <span class="sort-pile-count">${count}/${pile.clips.length}</span>
      <span class="sort-pile-prompt">${isComplete ? 'Complete' : sortedPileByClip.size === 0 ? 'Drop clips here' : ''}</span>
      <span class="sort-pile-mark" aria-hidden="true">${isComplete ? '✓' : ''}</span>`;
    const thumbnailArea = target.querySelector('.sort-pile-thumbs');
    sortedClips.forEach((n) => {
      const sortedReel = createReel(n);
      sortedReel.draggable = false;
      sortedReel.classList.add('sorted-reel');
      thumbnailArea.append(sortedReel);
    });
    target.querySelector('.song-pile-action').addEventListener('click', () => {
      if (isComplete) showSongReward(pile.id);
      else attemptSort(selected, pile.id);
    });
    target.addEventListener('dragover', (event) => {
      if (!isComplete) {
        event.preventDefault();
        target.classList.add('drop-ready');
      }
    });
    target.addEventListener('dragleave', () => target.classList.remove('drop-ready'));
    target.addEventListener('drop', (event) => {
      event.preventDefault();
      target.classList.remove('drop-ready');
      attemptSort(dragging, pile.id);
    });
    timeline.append(target);
  });
}

function createCompletedWorkoutBrandButton() {
  const button = document.createElement('button');
  button.className = 'completion-brand-button';
  button.type = 'button';
  button.setAttribute('aria-label', `Watch the complete ${PLAYLIST_NAME} Workout`);

  const emblem = document.createElement('span');
  emblem.className = 'completion-brand-emblem';
  const brandImage = document.createElement('img');
  brandImage.src = 'assets/puzzlemixx-brand-mark.webp';
  brandImage.alt = '';
  emblem.append(brandImage);
  button.append(emblem);
  button.addEventListener('click', () => openCompletedMovie());
  return button;
}

function attemptSort(clip, pileId) {
  if (!clip || sortedPileByClip.has(clip)) return;
  const correctPile = songPileForClip(clip);
  if (correctPile.id === pileId) {
    sortedPileByClip.set(clip, pileId);
    selected = null;
    sortCompleted = sortedPileByClip.size === TOTAL;
    const completedThisSong = sortedCountForPile(correctPile) === correctPile.clips.length;
    if (completedThisSong) awardSongPoint(correctPile.id);
    render();
    const target = document.querySelector(`[data-pile="${pileId}"]`);
    target?.classList.add('correct-add');
    sortStatus.textContent = `${reelName(clip)} belongs in Song ${pad(pileId)}.`;
    playHappySound();
    setTimeout(() => target?.classList.remove('correct-add'), 520);
    if (completedThisSong) setTimeout(() => showSongReward(pileId), 620);
  } else {
    const target = document.querySelector(`[data-pile="${pileId}"]`);
    target?.classList.add('wrong-add');
    sortStatus.textContent = `${reelName(clip)} does not belong in Song ${pad(pileId)}.`;
    playSadSound();
    setTimeout(() => target?.classList.remove('wrong-add'), 520);
  }
}

function showSongReward(pileId) {
  window.PM_GAME.currentSong = pileId; window.PMShare?.refresh();
  const pile = SONG_PILES.find((songPile) => songPile.id === pileId);
  if (!pile) return;
  songRewardReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const exerciseTitle = EXERCISE_TITLES[pile.id - 1];
  const watchPrompt = `Click the PEACE to see Nieve’s ${exerciseTitle}`;
  activeSongReward = {
    ...pile,
    clips: SONG_REWARD_MOVIE_CLIPS.get(pile.id) || pile.clips
  };
  songRewardTitle.textContent = 'You have WON the Complete Peace!';
  songRewardCopy.hidden = false;
  songRewardStatus.textContent = '';
  songRewardActions.hidden = false;
  songReplayChoice.hidden = true;
  songReplayPrompt.textContent = `Play Nieve’s ${exerciseTitle} again?`;
  songWatchButton.disabled = false;
  songWatchButton.querySelector('span').replaceChildren('Click the ', songRewardCopy.querySelector('.rainbow-peace').cloneNode(true), ` to see Nieve’s ${exerciseTitle}`);
  songWatchButton.setAttribute('aria-label', watchPrompt);
  songRewardPlayer.hidden = true;
  songRewardPlayer.removeAttribute('src');
  songRewardPlayer.load();
  songShareLink.href = 'leaderboard.html';
  if (!songRewardDialog.open) songRewardDialog.showModal();
  playRewardSound();
  startSongRewardMovie();   // the CompletePeace video pops up and plays with music
}

function playSongRewardClip(index = 0) {
  if (!activeSongReward) return;
  const clip = activeSongReward.clips[index];
  if (!clip) {
    songRewardPlayer.pause();
    songRewardPlayer.onloadedmetadata = null;
    songRewardPlayer.ontimeupdate = null;
    songRewardPlayer.onended = null;
    songRewardPlayer.hidden = true;
    songRewardPlayer.removeAttribute('src');
    songRewardPlayer.load();
    songRewardStatus.textContent = '';
    songReplayChoice.hidden = false;
    songPlayAgainButton.focus();
    playRewardSound();
    return;
  }

  songRewardPlayer.onloadedmetadata = null;
  songRewardPlayer.ontimeupdate = null;
  songRewardPlayer.src = songWorkoutFileFor(clip);
  songRewardStatus.textContent = `Playing the complete ${EXERCISE_TITLES[activeSongReward.id - 1]} workout`;
  songRewardPlayer.onended = () => playSongRewardClip(index + 1);
  songRewardPlayer.play().catch(() => {});
}

function startSongRewardMovie() {
  if (!activeSongReward) return;
  songWatchButton.disabled = true;
  songRewardActions.hidden = true;
  songRewardCopy.hidden = true;
  songReplayChoice.hidden = true;
  songRewardPlayer.hidden = false;
  playSongRewardClip(0);
}

function leaveSongReward(event) {
  event?.preventDefault();
  event?.stopPropagation();
  const returnScrollX = window.scrollX;
  const returnScrollY = window.scrollY;
  const returnViewMode = viewMode;
  const returnSelected = selected;
  const returnFocus = songRewardReturnFocus;
  let interactionRestored = false;

  const restorePuzzleInteraction = () => {
    if (interactionRestored) return;
    interactionRestored = true;

    viewMode = returnViewMode;
    selected = returnSelected;

    requestAnimationFrame(() => {
      window.scrollTo(returnScrollX, returnScrollY);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      scheduleCompactHeaderUpdate();
      scheduleMentalGridFit();
    });
  };

  songRewardPlayer.pause();
  songRewardPlayer.onloadedmetadata = null;
  songRewardPlayer.ontimeupdate = null;
  songRewardPlayer.onended = null;
  songRewardPlayer.removeAttribute('src');
  songRewardPlayer.load();
  songRewardActions.hidden = false;
  songRewardCopy.hidden = false;
  songReplayChoice.hidden = true;
  activeSongReward = null;
  songRewardReturnFocus = null;
  dragging = null;
  dragMetrics = null;
  pointerReposition = null;
  draggedRecently = false;

  // A clip dialog left underneath the reward would keep the page modal and inert.
  if (clipDialog.open) closeClip();

  if (!songRewardDialog.open) {
    restorePuzzleInteraction();
    return;
  }

  // Wait until the modal has actually left the browser's top layer before restoring focus.
  songRewardDialog.addEventListener('close', restorePuzzleInteraction, { once: true });
  songRewardDialog.close('return-to-puzzle');
  setTimeout(restorePuzzleInteraction, 0);
}

function attemptPlace(clip, slot) {
  if (!clip || placed.has(slot)) return;
  if (clip === slot) {
    placed.add(clip);
    const completedPile = songPileForClip(clip);
    if (completedPile.clips.every((piece) => placed.has(piece))) awardSongPoint(completedPile.id);
    selected = null;
    playHappySound();
    render();
    if (placed.size === TOTAL) setTimeout(completeMovie, 420);
  } else {
    const target = document.querySelector(`[data-slot="${slot}"]`);
    target?.classList.add('wrong');
    setTimeout(() => target?.classList.remove('wrong'), 380);
  }
}

function playClip(n) {
  clipLabel.textContent = reelName(n);
  clipPlayer.muted = !PIECE_SOUND;
  clipPlayer.src = previewFileFor(n);
  clipDialog.showModal();
  clipPlayer.play().catch(() => {});
}

function closeClip() {
  clipPlayer.pause();
  clipPlayer.removeAttribute('src');
  clipPlayer.load();
  if (clipDialog.open) clipDialog.close();
}

function playTones(notes) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  feedbackAudioContext ??= new AudioContext();
  const ctx = feedbackAudioContext;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  notes.forEach(({ at, frequency, duration = .3, gain = .11 }) => {
    const osc = ctx.createOscillator();
    const volume = ctx.createGain();
    osc.frequency.value = frequency;
    volume.gain.setValueAtTime(.0001, ctx.currentTime + at);
    volume.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + at + .015);
    volume.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + at + duration);
    osc.connect(volume).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + duration + .02);
  });
}

function playHappySound() {
  playTones([
    { at: 0, frequency: 659 },
    { at: .11, frequency: 880 }
  ]);
}

function playSadSound() {
  playTones([
    { at: 0, frequency: 330, duration: .24, gain: .08 },
    { at: .13, frequency: 220, duration: .38, gain: .08 }
  ]);
}

function playRewardSound() {
  playTones([
    { at: 0, frequency: 523, duration: .4 },
    { at: .13, frequency: 659, duration: .4 },
    { at: .26, frequency: 784, duration: .52, gain: .14 }
  ]);
}

function showHint() {
  if (viewMode === 'sort') {
    const next = order.find((n) => !sortedPileByClip.has(n));
    if (!next) return;
    const revealHint = () => {
      const reel = document.querySelector(`[data-clip="${next}"]`);
      const pile = document.querySelector(`[data-pile="${songPileForClip(next).id}"]`);
      reel?.classList.add('hint');
      pile?.classList.add('hint');
      pile?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hintTimer = setTimeout(() => {
        reel?.classList.remove('hint');
        pile?.classList.remove('hint');
      }, HINT_DURATION_MS);
    };
    offerHint(revealHint);
    return;
  }

  const next = clips.find((n) => !placed.has(n));
  if (!next) return;
  const revealHint = () => {
    const slot = document.querySelector(`[data-slot="${next}"]`);
    const reel = document.querySelector(`[data-clip="${next}"]`);
    slot?.classList.add('hint');
    reel?.classList.add('hint');
    slot?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hintTimer = setTimeout(() => {
      slot?.classList.remove('hint');
      reel?.classList.remove('hint');
    }, HINT_DURATION_MS);
  };
  offerHint(revealHint);
}

function reset() {
  freeHintAvailable = true;
  closeHintCostDialog();
  order = shuffle(clips);
  placed.clear();
  sortedPileByClip.clear();
  messyPositions.clear();
  messyZCounter = TOTAL;
  sortCompleted = false;
  selected = null;
  dragging = null;
  render();
}

function openCompletedMovie({ recordCompletion = false } = {}) {
  if (placed.size !== TOTAL && !sortCompleted) return;
  if (recordCompletion) awardMentalWorkoutBonus();
  document.querySelectorAll('[data-playlist-name]').forEach((label) => {
    label.textContent = PLAYLIST_NAME;
  });
  if (!finishDialog.open) finishDialog.showModal();
  playMovie();
}

function completeMovie() {
  openCompletedMovie({ recordCompletion: true });
}

function playMovie() {
  moviePlayer.src = 'yt:D5uZbUJvSC4';   // Nieve’s 40-minute workout on YouTube (unlisted)
  moviePlayer.play().catch(() => {});
  moviePlayer.onended = null;
}

function closeFinishMovie() {
  moviePlayer.pause();
  moviePlayer.onended = null;
  moviePlayer.removeAttribute('src');
  moviePlayer.load();
  if (finishDialog.open) finishDialog.close();
}

puzzleViewButton.addEventListener('click', () => setView('puzzle'));
sortViewButton.addEventListener('click', () => setView('sort'));
compactPuzzleViewButton.addEventListener('click', () => setView('puzzle'));
compactSortViewButton.addEventListener('click', () => setView('sort'));
compactHintButton.addEventListener('click', showHint);
document.querySelector('#confirm-paid-hint').addEventListener('click', confirmPaidHint);
document.querySelector('#cancel-paid-hint').addEventListener('click', closeHintCostDialog);
document.querySelector('.hint-cost-close').addEventListener('click', closeHintCostDialog);
hintCostDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeHintCostDialog(); });
document.querySelector('#compact-reset-button').addEventListener('click', reset);
document.querySelector('#hide-song-rewards').addEventListener('click', () => {
  rewardRailHidden = true;
  renderSongRewardRail();
});
showSongRewardsButton.addEventListener('click', () => {
  rewardRailHidden = false;
  renderSongRewardRail();
});
songWatchButton.addEventListener('click', startSongRewardMovie);
songPlayAgainButton.addEventListener('click', startSongRewardMovie);
songReturnPuzzleButton.addEventListener('click', leaveSongReward);
document.querySelector('#song-reward-dialog .song-reward-close').addEventListener('click', leaveSongReward);
document.querySelector('#song-reward-dialog .song-reward-inline-close').addEventListener('click', leaveSongReward);
songRewardDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  leaveSongReward();
});
reels.addEventListener('dragover', (event) => {
  if (viewMode !== 'sort' || !dragging) return;
  event.preventDefault();
});
reels.addEventListener('drop', (event) => {
  if (viewMode !== 'sort' || !dragging) return;
  event.preventDefault();
  event.stopPropagation();
  const clip = dragging;
  if (saveMessyPosition(clip, event.clientX, event.clientY, dragMetrics)) render();
});
document.addEventListener('pointermove', (event) => {
  if (!pointerReposition || pointerReposition.moved) return;
  if (Math.hypot(event.clientX - pointerReposition.startX, event.clientY - pointerReposition.startY) > 6) {
    pointerReposition.moved = true;
  }
});
document.addEventListener('pointerup', (event) => {
  const reposition = pointerReposition;
  pointerReposition = null;
  if (!reposition?.moved || viewMode !== 'sort') return;
  if (saveMessyPosition(reposition.clip, event.clientX, event.clientY, reposition.metrics)) {
    draggedRecently = true;
    render();
    setTimeout(() => { draggedRecently = false; }, 0);
  }
});
document.addEventListener('pointercancel', () => { pointerReposition = null; });
hintButton.addEventListener('click', showHint);
document.querySelector('#reset-button').addEventListener('click', reset);
document.querySelector('.close').addEventListener('click', closeClip);
document.querySelector('.finish-close').addEventListener('click', closeFinishMovie);
progress.addEventListener('click', () => openCompletedMovie());
progress.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openCompletedMovie();
});
finishDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeFinishMovie();
});
document.querySelector('#replay-button').addEventListener('click', playMovie);
document.addEventListener('pointerdown', () => {
  if (!hoveredPreview) return;
  hoveredPreview.muted = !PIECE_SOUND;
  hoveredPreview.play().catch(() => {});
}, { capture: true });
clipDialog.addEventListener('close', closeClip);
window.addEventListener('scroll', scheduleCompactHeaderUpdate, { passive: true });
window.addEventListener('resize', scheduleCompactHeaderUpdate);
window.addEventListener('resize', scheduleMentalGridFit);
window.addEventListener('storage', () => {
  leaderboardPoints.textContent = `${shownPoints()} pts`;
  updateHintButtons();
});
reset();
savePrototypeScore(readPrototypeScore());
updateCompactHeader();

// Keep the header points in step with the online profile.
function connectOnlinePoints() {
  if (!window.PM) return;
  window.PM.onChange(() => { leaderboardPoints.textContent = `${shownPoints()} pts`; });
}
if (window.PM) connectOnlinePoints(); else window.addEventListener('pm-ready', connectOnlinePoints, { once: true });
