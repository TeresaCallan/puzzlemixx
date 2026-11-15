const PROFILE_KEY = 'puzzlemixxPrototypeProfile';
const SCORE_KEY = 'puzzlemixxPrototypeScore';
const SOCIAL_CARD_KEY = 'puzzlemixxSocialCardHidden';
const SHARE_CARD_KEY = 'puzzlemixxShareCardHidden';
const JOIN_GAME_URL = new URL('index.html', location.href).href;
const CONTEST_END = Date.UTC(2026, 11, 31, 23, 59, 59);
const SHARE_LIMIT = 3;
const SONG_SUCCESS_TITLES = ['Mobility','Mobility & Core Prep','Cardio','Mobility & Core','Flexibility & Core','Legs, Core & Coordination','Legs, Core & Coordination 2nd Side','Combination Exercises','Adage','Stretch'];
const SOCIAL_NETWORKS = [
  { id:'instagram', label:'Instagram' },
  { id:'tiktok', label:'TikTok' },
  { id:'snapchat', label:'Snapchat' },
  { id:'youtube', label:'YouTube' },
  { id:'facebook', label:'Facebook' }
];

const accountForm = document.querySelector('#account-form');
const accountTitle = document.querySelector('#account-title');
const accountTitleBrand = accountTitle.querySelector('.profile-title-brand').cloneNode(true);
function setAccountTitle(action) {
  accountTitle.replaceChildren(`${action} `, accountTitleBrand.cloneNode(true), ' profile');
}
const profileSummary = document.querySelector('#profile-summary');
const displayName = document.querySelector('#display-name');
const email = document.querySelector('#email');
const profileName = document.querySelector('#profile-name');
const profileEmail = document.querySelector('#profile-email');
const profileAvatar = document.querySelector('#profile-avatar');
const socialForm = document.querySelector('#social-form');
const socialStatus = document.querySelector('#social-status');
const shareStatus = document.querySelector('#share-status');
const accountCard = document.querySelector('#account-card');
const socialCard = document.querySelector('#social-card');
const showSocialCard = document.querySelector('#show-social-card');
const shareCard = document.querySelector('#share-card');
const showShareCard = document.querySelector('#show-share-card');
const jumpToMe = document.querySelector('#jump-to-me');
const leaderboardSticky = document.querySelector('#leaderboard-sticky');
const leaderboardGrid = document.querySelector('#leaderboard-grid');
const standingsCard = document.querySelector('#standings-card');
const leaderWord = document.querySelector('#leader-word');
const leaderCelebration = document.querySelector('#leader-celebration');
const leaderCelebrationName = document.querySelector('#leader-celebration-name');
const shareSuccessList = document.querySelector('#share-success-list');
const shareLimitNote = document.querySelector('#share-limit-note');
const shareNetworkList = document.querySelector('#share-network-list');
const shareNetworkNote = document.querySelector('#share-network-note');
const addShareSocialsButton = document.querySelector('#add-share-socials');
const shareButton = document.querySelector('#share-button');
const copyButton = document.querySelector('#copy-button');
const shareVideo = document.querySelector('#share-video');
const shareBrandLink = document.querySelector('#share-brand-link');
const sharePublishDialog = document.querySelector('#share-publish-dialog');
const sharePrepareStage = document.querySelector('#share-prepare-stage');
const shareConfirmStage = document.querySelector('#share-confirm-stage');
const shareViewStage = document.querySelector('#share-view-stage');
const sharePrepareCopy = document.querySelector('#share-prepare-copy');
const shareConfirmCopy = document.querySelector('#share-confirm-copy');
const shareViewCopy = document.querySelector('#share-view-copy');
const sharePublishStatus = document.querySelector('#share-publish-status');
const prepareNetworkPostButton = document.querySelector('#prepare-network-post');
const confirmNetworkPostButton = document.querySelector('#confirm-network-post');
const postNotPublishedButton = document.querySelector('#post-not-published');
const viewNetworkPostButton = document.querySelector('#view-network-post');
const publishedPostUrl = document.querySelector('#published-post-url');
let selectedSuccessId = null;
let selectedNetworkId = null;
let pendingNetworkShare = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function normaliseSuccessCycles(score, songIds, mentalBonus) {
  const seen = new Set();
  const cycles = Array.isArray(score.successes) ? score.successes.flatMap((success, index) => {
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
      shares:Number.isInteger(success.shares) ? Math.min(Math.max(success.shares, 0), SHARE_LIMIT) : 0,
      completedAt:typeof success.completedAt === 'string' ? success.completedAt : ''
    }];
  }) : [];
  if (cycles.length) return cycles;
  const migrated = songIds.map((songId) => ({ id:`song-${songId}-1`, type:'song', songId, cycle:1, shares:0, completedAt:'' }));
  if (mentalBonus) migrated.push({ id:'mental-workout-1', type:'mental', songId:null, cycle:1, shares:0, completedAt:'' });
  return migrated;
}

function readScore() {
  const score = readJson(SCORE_KEY, {});
  const songIds = Array.isArray(score.songIds) ? [...new Set(score.songIds)].filter((id) => Number.isInteger(id) && id >= 1 && id <= 10) : [];
  const mentalBonus = score.mentalBonus === true;
  return {
    songIds,
    mentalBonus,
    shareCount: Number.isInteger(score.shareCount) && score.shareCount > 0 ? score.shareCount : 0,
    spentPoints: Number.isInteger(score.spentPoints) && score.spentPoints > 0 ? score.spentPoints : 0,
    freeHintsUsed: Number.isInteger(score.freeHintsUsed) ? Math.min(Math.max(score.freeHintsUsed, 0), 2) : 0,
    successes:normaliseSuccessCycles(score, songIds, mentalBonus)
  };
}

function pointsFor(score) {
  const earned = score.songIds.length + (score.mentalBonus ? 10 : 0) + score.shareCount * 10;
  return earned - score.spentPoints;
}
function readProfile() { return readJson(PROFILE_KEY, null); }

function successName(success) {
  return success.type === 'mental' ? 'The Mental Workout' : SONG_SUCCESS_TITLES[success.songId - 1];
}

function ensureSelectedSuccess(score) {
  if (score.successes.some((success) => success.id === selectedSuccessId)) return score.successes.find((success) => success.id === selectedSuccessId);
  const params = new URLSearchParams(location.search);
  const requestedSong = Number(params.get('song'));
  const reversed = [...score.successes].reverse();
  const requested = params.get('share') === 'mental'
    ? reversed.find((success) => success.type === 'mental')
    : params.get('share') === 'song' && requestedSong
      ? reversed.find((success) => success.type === 'song' && success.songId === requestedSong)
      : null;
  const selected = requested || reversed.find((success) => success.shares < SHARE_LIMIT) || reversed[0] || null;
  selectedSuccessId = selected?.id || null;
  return selected;
}

function shareMessageFor(success, points) {
  if (!success) return 'Complete a song or The Mental Workout to unlock a success to share.';
  if (success.type === 'mental') return `I completed the Mental Workout on PuzzleMixx! My score is ${points} points.`;
  const title = SONG_SUCCESS_TITLES[success.songId - 1];
  return `I completed the ${title} workout on PuzzleMixx! My score is ${points} points.`;
}

function shareClipFor(success) {
  return success?.type === 'mental'
    ? 'assets/share-clips/mental-workout.mp4?v=3'
    : success?.type === 'song'
      ? `assets/share-clips/song-${String(success.songId).padStart(2, '0')}.mp4?v=3`
      : '';
}

function linkedSocialNetworks(profile) {
  return SOCIAL_NETWORKS.filter((network) => typeof profile?.socials?.[network.id] === 'string' && profile.socials[network.id].trim());
}

function ensureSelectedNetwork(profile) {
  const linked = linkedSocialNetworks(profile);
  const selected = linked.find((network) => network.id === selectedNetworkId) || linked[0] || null;
  selectedNetworkId = selected?.id || null;
  return selected;
}

function renderShareNetworks(profile) {
  const linked = linkedSocialNetworks(profile);
  const selected = ensureSelectedNetwork(profile);
  shareNetworkList.innerHTML = linked.length ? linked.map((network) => {
    const active = network.id === selected?.id;
    return `<button class="share-network-option${active ? ' active' : ''}" type="button" data-share-network="${network.id}" aria-pressed="${active}">${network.label}</button>`;
  }).join('') : '<p class="share-network-empty">No social networks are linked yet.</p>';
  shareNetworkNote.textContent = selected
    ? `Your reward will be recorded for sharing with ${selected.label}.`
    : 'Add at least one social media account before sharing.';
  addShareSocialsButton.hidden = linked.length > 0;
  return selected;
}

function renderShareSuccesses(score, points, profile) {
  const selected = ensureSelectedSuccess(score);
  const selectedNetwork = renderShareNetworks(profile);
  const newestFirst = [...score.successes].reverse();
  shareSuccessList.innerHTML = newestFirst.length ? newestFirst.map((success) => {
    const active = success.id === selected?.id;
    return `<button class="share-success-option${active ? ' active' : ''}${success.shares >= SHARE_LIMIT ? ' exhausted' : ''}" type="button" data-success-id="${escapeHtml(success.id)}" aria-pressed="${active}"><strong>${escapeHtml(successName(success))}</strong><span>Success ${success.cycle} · ${success.shares} of ${SHARE_LIMIT} shares used</span></button>`;
  }).join('') : '<p class="share-success-empty">Complete a song or The Mental Workout to unlock your first shareable success.</p>';
  document.querySelector('#share-message').textContent = shareMessageFor(selected, points);
  const clipUrl = shareClipFor(selected);
  if (clipUrl) {
    if (shareVideo.getAttribute('src') !== clipUrl) shareVideo.src = clipUrl;
    shareVideo.hidden = false;
  } else {
    shareVideo.pause();
    shareVideo.removeAttribute('src');
    shareVideo.hidden = true;
  }
  const remaining = selected ? Math.max(SHARE_LIMIT - selected.shares, 0) : 0;
  shareLimitNote.textContent = !selected
    ? 'Every new success can be shared up to three times.'
    : remaining
      ? `${remaining} of ${SHARE_LIMIT} rewarded shares remaining for this success.`
      : `You have shared this success ${SHARE_LIMIT} times. Complete the puzzle for ${successName(selected)} again to share a new success.`;
  shareButton.disabled = !selected || !remaining || !selectedNetwork;
  copyButton.disabled = !selected || !remaining || !selectedNetwork;
  shareButton.textContent = !selected
    ? 'Complete a success first'
    : !selectedNetwork
      ? 'Add social media first'
      : remaining
        ? `Share to ${selectedNetwork.label} · ${remaining} left`
        : '3 shares used';
}

function winnerRibbon(index) {
  if (Date.now() < CONTEST_END || index > 2) return '';
  const prizes = ['first','second','third'];
  return `<span class="winner-ribbon winner-${prizes[index]}" aria-label="${prizes[index]} prize winner">${index + 1}</span>`;
}

function awardShareBonus(successId) {
  const score = readScore();
  const success = score.successes.find((entry) => entry.id === successId);
  if (!success || success.shares >= SHARE_LIMIT) {
    shareStatus.textContent = success
      ? `You have shared this success ${SHARE_LIMIT} times. Complete the puzzle again to share a new success.`
      : 'Complete a song or The Mental Workout before sharing.';
    render();
    return false;
  }
  success.shares += 1;
  score.shareCount += 1;
  localStorage.setItem(SCORE_KEY, JSON.stringify(score));
  selectedSuccessId = success.id;
  render();
  const remaining = SHARE_LIMIT - success.shares;
  shareStatus.textContent = remaining
    ? `Shared successfully — 10 bonus points added. ${remaining} rewarded share${remaining === 1 ? '' : 's'} remaining for this success.`
    : `Shared successfully — 10 bonus points added. You have shared this success ${SHARE_LIMIT} times. Complete the puzzle again to share a new success.`;
  return true;
}

function render() {
  const score = readScore();
  const profile = readProfile();
  const points = pointsFor(score);
  document.querySelector('#sticky-my-points').textContent = `${points} pts`;

  const socialCardHidden = localStorage.getItem(SOCIAL_CARD_KEY) === 'true';
  const shareCardHidden = localStorage.getItem(SHARE_CARD_KEY) === 'true';
  socialCard.hidden = socialCardHidden;
  showSocialCard.hidden = !socialCardHidden;
  shareCard.hidden = shareCardHidden;
  showShareCard.hidden = !shareCardHidden;
  accountCard.hidden = Boolean(profile);
  const visibleRightCards = [accountCard, socialCard, shareCard].filter((card) => !card.hidden);
  leaderboardGrid.classList.toggle('right-stack-empty', visibleRightCards.length === 0);
  leaderboardGrid.style.gridTemplateRows = visibleRightCards.length ? `repeat(${visibleRightCards.length},minmax(min-content,1fr))` : 'minmax(0,1fr)';
  standingsCard.style.gridRow = `1 / span ${Math.max(visibleRightCards.length, 1)}`;
  visibleRightCards.forEach((card, index) => { card.style.gridRow = String(index + 1); });

  if (profile) {
    accountForm.hidden = true;
    profileSummary.hidden = false;
    profileName.textContent = profile.name;
    profileEmail.textContent = profile.email;
    profileAvatar.textContent = profile.name.trim().charAt(0).toUpperCase() || 'P';
    setAccountTitle('Your');
    ['instagram','tiktok','snapchat','youtube','facebook'].forEach((network) => {
      document.querySelector(`#${network}`).value = profile.socials?.[network] || '';
    });
  } else {
    accountForm.hidden = false;
    profileSummary.hidden = true;
    setAccountTitle('Create your');
  }

  const entries = [
    { name:'Aria M.', points:39 }, { name:'Leo J.', points:36 }, { name:'Maya R.', points:33 },
    { name:'Noor S.', points:31 }, { name:'Theo K.', points:29 }, { name:'Amelia B.', points:27 },
    { name:'Oscar W.', points:25 }, { name:'Freya C.', points:24 }, { name:'Milo T.', points:23 },
    { name:'Sofia L.', points:22 }, { name:'Zara N.', points:21 }, { name:'Ethan P.', points:20 },
    { name:'Ivy G.', points:19 }, { name:'Lucas H.', points:18 }, { name:'Layla D.', points:17 },
    { name:'Finn A.', points:16 }, { name:'Esme V.', points:15 }, { name:'Arthur F.', points:14 },
    { name:'Luna Q.', points:13 }, { name:'Kai E.', points:12 }, { name:'Evie O.', points:11 },
    { name:'Jude I.', points:10 }, { name:'Ada S.', points:9 }, { name:'Rowan M.', points:8 },
    { name:'Ruby J.', points:7 }, { name:'Alex R.', points:6 }, { name:'Mae K.', points:5 },
    { name:'Sam B.', points:4 }, { name:'Nia C.', points:3 }, { name:'Ben T.', points:2 }
  ];
  if (profile) entries.push({ name:profile.name, points, current:true });
  entries.sort((a,b) => b.points-a.points || a.name.localeCompare(b.name));
  const topScorer = entries[0];
  document.querySelector('#top-scorer-points').textContent = topScorer.points;
  document.querySelector('#top-scorer-name').textContent = topScorer.name;
  leaderCelebrationName.textContent = topScorer.name;
  jumpToMe.disabled = !profile;
  jumpToMe.textContent = profile ? 'Jump to my standing' : 'Create an account to join';
  document.querySelector('#standings').innerHTML = entries.map((entry, index) => `
    <li class="standing-row${entry.current ? ' current' : ''}">
      <span class="standing-name"><span class="standing-person">${winnerRibbon(index)}${escapeHtml(entry.name)}</span>${entry.current ? '<small>You</small>' : ''}</span>
      <span class="standing-points">${entry.points} pts</span>
    </li>`).join('');

  renderShareSuccesses(score, points, profile);
  document.querySelector('#join-game-link').href = JOIN_GAME_URL;
  shareBrandLink.href = JOIN_GAME_URL;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

accountForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const existing = readProfile();
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    name:displayName.value.trim(), email:email.value.trim(), socials:existing?.socials || {}, createdAt:existing?.createdAt || new Date().toISOString()
  }));
  render();
});

document.querySelector('#edit-profile').addEventListener('click', () => {
  const profile = readProfile();
  if (!profile) return;
  displayName.value = profile.name;
  email.value = profile.email;
  accountForm.hidden = false;
  profileSummary.hidden = true;
  setAccountTitle('Edit your');
});

document.querySelector('#remove-profile').addEventListener('click', () => {
  localStorage.removeItem(PROFILE_KEY);
  const score = readScore();
  score.freeHintsUsed = 0;
  localStorage.setItem(SCORE_KEY, JSON.stringify(score));
  accountForm.reset();
  socialForm.reset();
  socialStatus.textContent = 'Prototype profile removed. Your earned points are still safe.';
  render();
});

document.querySelector('#hide-social-card').addEventListener('click', () => {
  localStorage.setItem(SOCIAL_CARD_KEY, 'true');
  render();
});

showSocialCard.addEventListener('click', () => {
  localStorage.setItem(SOCIAL_CARD_KEY, 'false');
  render();
  socialCard.scrollIntoView({ behavior:'smooth', block:'center' });
});

document.querySelector('#hide-share-card').addEventListener('click', () => {
  localStorage.setItem(SHARE_CARD_KEY, 'true');
  render();
});

showShareCard.addEventListener('click', () => {
  localStorage.setItem(SHARE_CARD_KEY, 'false');
  render();
  shareCard.scrollIntoView({ behavior:'smooth', block:'center' });
});

jumpToMe.addEventListener('click', () => {
  const currentStanding = document.querySelector('.standing-row.current');
  if (!currentStanding) return;
  currentStanding.tabIndex = -1;
  currentStanding.scrollIntoView({ behavior:'smooth', block:'center' });
  currentStanding.focus({ preventScroll:true });
});

socialForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = readProfile();
  if (!profile) {
    socialStatus.textContent = 'Create your account first, then save your social links.';
    accountForm.querySelector('input').focus();
    return;
  }
  profile.socials = Object.fromEntries(['instagram','tiktok','snapchat','youtube','facebook'].map((network) => [network, document.querySelector(`#${network}`).value.trim()]));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  render();
  socialStatus.textContent = 'Your social links are saved on this device.';
});

async function copyAchievement() {
  const success = ensureSelectedSuccess(readScore());
  const network = ensureSelectedNetwork(readProfile());
  if (!network) {
    shareStatus.textContent = 'Add at least one social media account before sharing.';
    return false;
  }
  if (!success || success.shares >= SHARE_LIMIT) {
    shareStatus.textContent = success
      ? `You have shared this success ${SHARE_LIMIT} times. Complete the puzzle again to share a new success.`
      : 'Complete a song or The Mental Workout before sharing.';
    return;
  }
  const message = document.querySelector('#share-message').textContent;
  const copied = await copyShareCaption(`${message} JOIN THE GAME ! ${JOIN_GAME_URL}`);
  if (!copied) throw new Error('The achievement caption could not be copied.');
  shareStatus.textContent = `Achievement copied — ready to share with ${network.label}.`;
  return true;
}

async function copyShareCaption(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}

function showShareStage(stage) {
  sharePrepareStage.hidden = stage !== 'prepare';
  shareConfirmStage.hidden = stage !== 'confirm';
  shareViewStage.hidden = stage !== 'view';
}

function openSharePreparation(success, network) {
  const profile = readProfile();
  const clipUrl = shareClipFor(success);
  pendingNetworkShare = {
    successId:success.id,
    network,
    networkUrl:profile.socials[network.id],
    clipUrl,
    viewUrl:profile.socials[network.id]
  };
  sharePrepareCopy.textContent = `Your PuzzleMixx card and short video are ready for ${network.label}.`;
  shareConfirmCopy.textContent = `${network.label} is open. Publish the downloaded video with the copied caption, then confirm below.`;
  prepareNetworkPostButton.textContent = `Copy, download & open ${network.label}`;
  publishedPostUrl.value = '';
  sharePublishStatus.textContent = '';
  showShareStage('prepare');
  if (!sharePublishDialog.open) sharePublishDialog.showModal();
}

function downloadShareClip(share) {
  const link = document.createElement('a');
  link.href = share.clipUrl;
  link.download = `PuzzleMixx-${share.successId}.mp4`;
  document.body.append(link);
  link.click();
  link.remove();
}

function validPostUrlForNetwork(value, network) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const linkedHost = new URL(pendingNetworkShare.networkUrl).hostname.replace(/^www\./, '');
    const postHost = url.hostname.replace(/^www\./, '');
    return postHost === linkedHost || postHost.endsWith(`.${linkedHost}`) ? url.href : '';
  } catch { return ''; }
}

shareSuccessList.addEventListener('click', (event) => {
  const option = event.target.closest('[data-success-id]');
  if (!option) return;
  selectedSuccessId = option.dataset.successId;
  shareStatus.textContent = '';
  render();
});

shareNetworkList.addEventListener('click', (event) => {
  const option = event.target.closest('[data-share-network]');
  if (!option) return;
  selectedNetworkId = option.dataset.shareNetwork;
  shareStatus.textContent = '';
  render();
});

addShareSocialsButton.addEventListener('click', () => {
  localStorage.setItem(SOCIAL_CARD_KEY, 'false');
  render();
  socialStatus.textContent = 'Add and save at least one social media account to begin sharing.';
  socialCard.scrollIntoView({ behavior:'smooth', block:'center' });
});

copyButton.addEventListener('click', () => copyAchievement().catch(() => { shareStatus.textContent = 'Select and copy the achievement message above.'; }));
shareButton.addEventListener('click', async () => {
  const success = ensureSelectedSuccess(readScore());
  const network = ensureSelectedNetwork(readProfile());
  if (!network) {
    shareStatus.textContent = 'Add at least one social media account before sharing.';
    return;
  }
  if (!success || success.shares >= SHARE_LIMIT) {
    shareStatus.textContent = success
      ? `You have shared this success ${SHARE_LIMIT} times. Complete the puzzle again to share a new success.`
      : 'Complete a song or The Mental Workout before sharing.';
    return;
  }
  openSharePreparation(success, network);
});

prepareNetworkPostButton.addEventListener('click', async () => {
  if (!pendingNetworkShare) return;
  window.open(pendingNetworkShare.networkUrl, '_blank', 'noopener,noreferrer');
  downloadShareClip(pendingNetworkShare);
  const message = document.querySelector('#share-message').textContent;
  const copied = await copyShareCaption(`${message} JOIN THE GAME ! ${JOIN_GAME_URL}`);
  sharePublishStatus.textContent = copied
    ? 'Caption copied and video downloaded.'
    : 'Video downloaded. Copy the caption from your PuzzleMixx card before publishing.';
  showShareStage('confirm');
});

postNotPublishedButton.addEventListener('click', () => {
  sharePublishStatus.textContent = 'No points were added. Return when your post is published.';
  if (sharePublishDialog.open) sharePublishDialog.close();
  pendingNetworkShare = null;
});

confirmNetworkPostButton.addEventListener('click', () => {
  if (!pendingNetworkShare) return;
  const suppliedUrl = publishedPostUrl.value.trim();
  const exactPostUrl = validPostUrlForNetwork(suppliedUrl, pendingNetworkShare.network);
  if (suppliedUrl && !exactPostUrl) {
    sharePublishStatus.textContent = `That post link does not match your linked ${pendingNetworkShare.network.label} account. Remove it or paste the correct link.`;
    return;
  }
  pendingNetworkShare.viewUrl = exactPostUrl || pendingNetworkShare.networkUrl;
  if (!awardShareBonus(pendingNetworkShare.successId)) return;
  shareViewCopy.textContent = `Your ${pendingNetworkShare.network.label} share is confirmed. Would you like to see your post now?`;
  viewNetworkPostButton.textContent = `View on ${pendingNetworkShare.network.label}`;
  sharePublishStatus.textContent = '';
  showShareStage('view');
});

viewNetworkPostButton.addEventListener('click', () => {
  if (!pendingNetworkShare) return;
  window.open(pendingNetworkShare.viewUrl, '_blank', 'noopener,noreferrer');
  if (sharePublishDialog.open) sharePublishDialog.close();
  pendingNetworkShare = null;
});

const prizeDialogs = {
  first:document.querySelector('#prize-first'),
  second:document.querySelector('#prize-second'),
  third:document.querySelector('#prize-third')
};
const secondPrizeVideo = document.querySelector('#second-prize-video');
const prizeShirtZoom = document.querySelector('#prize-shirt-zoom');
const prizeShirtZoomHint = document.querySelector('#prize-shirt-zoom-hint');

prizeShirtZoom.addEventListener('click', () => {
  const zoomed = prizeShirtZoom.classList.toggle('zoomed');
  prizeShirtZoom.setAttribute('aria-pressed', String(zoomed));
  prizeShirtZoom.setAttribute('aria-label', zoomed ? 'Zoom out from the inside back-neck embroidery' : 'Zoom in to inspect the inside back-neck embroidery');
  prizeShirtZoomHint.textContent = zoomed ? 'Click to return to the full T-shirt' : 'Click to zoom into the neck embroidery';
  if (zoomed) {
    prizeShirtZoom.scrollTop = 0;
    setTimeout(() => {
      if (!prizeShirtZoom.classList.contains('zoomed')) return;
      prizeShirtZoom.scrollLeft = (prizeShirtZoom.scrollWidth - prizeShirtZoom.clientWidth) / 2;
      prizeShirtZoom.scrollTop = 0;
    }, 320);
  }
});

document.querySelectorAll('[data-prize]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = prizeDialogs[button.dataset.prize];
    dialog.showModal();
    if (button.dataset.prize === 'second') secondPrizeVideo.play().catch(() => {});
  });
});

document.querySelectorAll('[data-close-prize]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

Object.values(prizeDialogs).forEach((dialog) => {
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    if (dialog === prizeDialogs.second) secondPrizeVideo.pause();
    if (dialog === prizeDialogs.third) {
      prizeShirtZoom.classList.remove('zoomed');
      prizeShirtZoom.setAttribute('aria-pressed', 'false');
      prizeShirtZoom.setAttribute('aria-label', 'Zoom in to inspect the inside back-neck embroidery');
      prizeShirtZoomHint.textContent = 'Click to zoom into the neck embroidery';
      prizeShirtZoom.scrollTo(0, 0);
    }
  });
});

document.querySelectorAll('.association-choice').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.association-choice').forEach((choice) => choice.classList.toggle('active', choice === button));
    document.querySelector('#cheque-payee').textContent = button.dataset.payee;
  });
});

let leaderCelebrationTimer;
function celebrateLeader() {
  leaderCelebrationName.textContent = document.querySelector('#top-scorer-name').textContent;
  leaderCelebration.classList.remove('active');
  void leaderCelebration.offsetWidth;
  leaderCelebration.classList.add('active');
  clearTimeout(leaderCelebrationTimer);
  leaderCelebrationTimer = setTimeout(() => leaderCelebration.classList.remove('active'), 2150);
}

leaderWord.addEventListener('pointerenter', celebrateLeader);
leaderWord.addEventListener('click', celebrateLeader);
leaderWord.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  celebrateLeader();
});

let contestWasOpen = Date.now() < CONTEST_END;
function updateCountdown() {
  const remaining = Math.max(CONTEST_END - Date.now(), 0);
  const countdown = document.querySelector('#contest-countdown');
  if (!remaining) {
    countdown.textContent = 'Winners confirmed';
    if (contestWasOpen) { contestWasOpen = false; render(); }
    return;
  }
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  countdown.textContent = `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;
}

function updateStickyLeaderboard() {
  const shouldShow = window.matchMedia('(min-width:761px)').matches
    || document.querySelector('.leaderboard-nav').getBoundingClientRect().bottom <= 0;
  leaderboardSticky.classList.toggle('visible', shouldShow);
  leaderboardSticky.setAttribute('aria-hidden', String(!shouldShow));
  leaderboardSticky.inert = !shouldShow;
}

window.addEventListener('scroll', updateStickyLeaderboard, { passive:true });
window.addEventListener('resize', updateStickyLeaderboard);
window.addEventListener('storage', render);

render();
updateStickyLeaderboard();
updateCountdown();
setInterval(updateCountdown, 1000);
