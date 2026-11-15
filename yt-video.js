/*
  <yt-video> — a YouTube player that behaves like a <video> element.

  The game code was written for <video> (src, play(), pause(), muted, onended…).
  This element keeps that same interface but plays a YouTube video, so the game
  logic barely changes. Set src to a YouTube ID, written as "yt:VIDEO_ID".

  Attributes: controls (show YouTube controls), loop (repeat), muted (start silent).
*/
(function () {
  let apiPromise = null;
  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof previous === 'function') previous(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.append(tag);
    });
    return apiPromise;
  }

  const idFrom = (value) => {
    if (!value) return '';
    const text = String(value).trim();
    if (text.startsWith('yt:')) return text.slice(3);
    const match = text.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return match ? match[1] : text;
  };

  class YTVideo extends HTMLElement {
    constructor() {
      super();
      this._id = '';
      this._player = null;
      this._playerId = '';
      this._paused = true;
      this._muted = this.hasAttribute('muted');
      this._volume = 1;
      this._startAt = 0;
      this.onended = null;
      this.onloadedmetadata = null;
      this.ontimeupdate = null;
    }

    get src() { return this._id ? `yt:${this._id}` : ''; }
    set src(value) {
      const id = idFrom(value);
      if (id === this._id) return;
      this._destroy();
      this._id = id;
      this._startAt = 0;
    }

    setAttribute(name, value) {
      if (name === 'src') { this.src = value; return; }
      super.setAttribute(name, value);
    }
    removeAttribute(name) {
      if (name === 'src') { this._destroy(); this._id = ''; return; }
      super.removeAttribute(name);
    }

    get paused() { return this._paused; }
    get muted() { return this._muted; }
    set muted(value) {
      this._muted = Boolean(value);
      if (!this._player || !this._player.mute) return;
      if (this._muted) this._player.mute(); else this._player.unMute();
    }
    get volume() { return this._volume; }
    set volume(value) {
      this._volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (this._player && this._player.setVolume) this._player.setVolume(Math.round(this._volume * 100));
    }
    get currentTime() { return this._player && this._player.getCurrentTime ? this._player.getCurrentTime() : this._startAt; }
    set currentTime(value) {
      const seconds = Math.max(0, Number(value) || 0);
      if (this._player && this._player.seekTo) this._player.seekTo(seconds, true);
      else this._startAt = seconds;
    }
    get duration() { return this._player && this._player.getDuration ? this._player.getDuration() : NaN; }

    load() { if (!this._id) this._destroy(); }

    pause() {
      this._paused = true;
      if (this._player && this._player.pauseVideo) this._player.pauseVideo();
    }

    play() {
      if (!this._id) return Promise.reject(new Error('No YouTube video set'));
      this._paused = false;
      if (this._player && this._playerId === this._id && this._player.playVideo) {
        this._player.playVideo();
        return Promise.resolve();
      }
      const id = this._id;
      return loadYouTubeApi().then((YT) => new Promise((resolve) => {
        if (this._id !== id) { resolve(); return; }
        this._destroy();
        const mount = document.createElement('div');
        this.replaceChildren(mount);
        const loop = this.hasAttribute('loop');
        const controls = this.hasAttribute('controls');
        let settled = false;
        const finish = () => { if (!settled) { settled = true; resolve(); } };
        setTimeout(finish, 5000);
        this._playerId = id;
        this._player = new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: controls ? 1 : 0,
            disablekb: controls ? 0 : 1,
            fs: controls ? 1 : 0,
            iv_load_policy: 3,
            loop: loop ? 1 : 0,
            playlist: loop ? id : undefined,
            mute: this._muted ? 1 : 0,
            playsinline: 1,
            rel: 0,
            start: Math.floor(this._startAt) || undefined,
            origin: location.origin
          },
          events: {
            onReady: (event) => {
              if (this._muted) event.target.mute(); else event.target.unMute();
              event.target.setVolume(Math.round(this._volume * 100));
              if (!this._paused) event.target.playVideo();
              if (typeof this.onloadedmetadata === 'function') this.onloadedmetadata();
              finish();
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) { this._paused = false; this.classList.add('is-playing'); }
              if (event.data === YT.PlayerState.PAUSED) this._paused = true;
              if (event.data === YT.PlayerState.ENDED && !loop) {
                this._paused = true;
                this.classList.remove('is-playing');
                if (typeof this.onended === 'function') this.onended();
                this.dispatchEvent(new Event('ended'));
              }
            },
            onError: () => { this._paused = true; finish(); }
          }
        });
        const iframe = this.querySelector('iframe');
        if (iframe) iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
      }));
    }

    _destroy() {
      if (this._player && this._player.destroy) {
        try { this._player.destroy(); } catch (error) { /* player already gone */ }
      }
      this._player = null;
      this._playerId = '';
      this._paused = true;
      this.classList.remove('is-playing');
      this.replaceChildren();
    }

    disconnectedCallback() { this._destroy(); }
  }

  if (!customElements.get('yt-video')) customElements.define('yt-video', YTVideo);
})();
