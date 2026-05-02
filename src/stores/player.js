// Audio player store. Owns the queue, the <audio> elements, and exposes
// playback methods. Event listeners are wired in the Player.vue mount
// callback (see init()).
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { api } from '@/lib/api';
import { isStreamId, fmtDuration } from '@/lib/format';
import { useLibraryStore } from './library';
import { useStreamsStore } from './streams';
import { usePrefsStore } from './prefs';
import { showToast } from '@/lib/toast';

const PLAYER_STATE_KEY = 'wax:player';

function findTrack(id) {
  const lib = useLibraryStore();
  const streams = useStreamsStore();
  return lib.findById(id) || streams.get(id) || null;
}

function trackPlayUrl(track) {
  if (!track) return null;
  if (track.file) return track.file;
  if (track.ytId) return `/api/stream/${track.ytId}`;
  return null;
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    queue: [],
    index: -1,
    playing: false,
    loading: false,  // true between loadAndPlay() and the first 'playing' event
    shuffle: false,
    repeat: 'off', // 'off' | 'all' | 'one'
    muted: false,
    queueOpen: false,
    crossfading: false,
    audioEl: null,   // primary <audio>
    audioEl2: null,  // crossfade <audio>
    visible: false,
    currentTime: 0,
    duration: 0,
    playCountedFor: null,
    saveStateTimer: null,
  }),
  getters: {
    currentTrackId: (state) => state.queue[state.index] || null,
    currentTrack(state) {
      const id = state.queue[state.index];
      if (!id) return null;
      return findTrack(id);
    },
    isLikedCurrent(state) {
      const id = state.queue[state.index];
      if (!id) return false;
      const lib = useLibraryStore();
      if (isStreamId(id)) {
        const stream = useStreamsStore().get(id);
        return !!stream && lib.tracks.some((t) => t.ytId === stream.ytId);
      }
      return lib.tracks.some((t) => t.id === id);
    },
  },
  actions: {
    bindAudio(el, el2) {
      // Don't let Pinia wrap raw HTMLAudioElements in reactive proxies —
      // it adds overhead and breaks some media APIs.
      this.audioEl = markRaw(el);
      this.audioEl2 = markRaw(el2);
      const prefs = usePrefsStore();
      el.volume = this.muted ? 0 : prefs.volume;
      // Wire event listeners
      el.addEventListener('play', () => this._onAudioPlay());
      el.addEventListener('pause', () => this._onAudioPause());
      el.addEventListener('playing', () => { this.loading = false; });
      el.addEventListener('waiting', () => { this.loading = true; });
      el.addEventListener('error', () => {
        this.loading = false;
        const track = findTrack(this.queue[this.index]);
        showToast(track ? `Impossible de lire « ${track.title} »` : 'Erreur de lecture', 'error');
        setTimeout(() => { if (this.queue.length > 1) this.next(); }, 3000);
      });
      el.addEventListener('timeupdate', () => this._onAudioTimeUpdate());
      el.addEventListener('ended', () => this._onAudioEnded());
    },
    playFromList(trackId, queue) {
      const idx = queue.indexOf(trackId);
      this.queue = [...queue];
      this.index = idx >= 0 ? idx : 0;
      this.loadAndPlay();
    },
    loadAndPlay() {
      const trackId = this.queue[this.index];
      const track = findTrack(trackId);
      if (!track || !this.audioEl) return;
      // Stop any in-flight crossfade
      if (this.crossfading && this.audioEl2) {
        try { this.audioEl2.pause(); this.audioEl2.removeAttribute('src'); } catch {}
        this.crossfading = false;
      }
      this.visible = true;
      this.loading = true;
      this.audioEl.src = trackPlayUrl(track);
      const prefs = usePrefsStore();
      // Stream prefetch
      if (!track.file && track.ytId) {
        useStreamsStore().prefetch(track.ytId);
      }
      this.audioEl.volume = this.muted ? 0 : prefs.volume;
      this.audioEl.play().catch(() => { this.loading = false; });
      // Look-ahead: warm the next streamable track's URL so the queue
      // transition feels instant. Only prefetches the immediate next.
      const streamsStore = useStreamsStore();
      const nextIdx = (this.index + 1) % this.queue.length;
      if (nextIdx !== this.index) {
        const nextTrack = findTrack(this.queue[nextIdx]);
        if (nextTrack && !nextTrack.file && nextTrack.ytId) {
          streamsStore.prefetch(nextTrack.ytId);
        }
      }
      this._updateMediaMetadata(track);
      this.savePlayerState();
      this.playCountedFor = null;
    },
    togglePlay() {
      if (!this.audioEl?.src) return;
      if (this.audioEl.paused) this.audioEl.play();
      else this.audioEl.pause();
    },
    next() {
      if (this.queue.length === 0) return;
      if (this.shuffle) {
        this.index = Math.floor(Math.random() * this.queue.length);
      } else {
        this.index = (this.index + 1) % this.queue.length;
      }
      this.loadAndPlay();
    },
    prev() {
      if (this.queue.length === 0) return;
      if (this.audioEl?.currentTime > 3) {
        this.audioEl.currentTime = 0;
        return;
      }
      this.index = (this.index - 1 + this.queue.length) % this.queue.length;
      this.loadAndPlay();
    },
    stop() {
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.src = '';
      }
      this.playing = false;
      this.loading = false;
      this.visible = false;
    },
    toggleShuffle() { this.shuffle = !this.shuffle; },
    cycleRepeat() {
      const order = ['off', 'all', 'one'];
      this.repeat = order[(order.indexOf(this.repeat) + 1) % order.length];
    },
    toggleMute() {
      const prefs = usePrefsStore();
      this.muted = !this.muted;
      if (this.audioEl) this.audioEl.volume = this.muted ? 0 : prefs.volume;
    },
    setVolume(v) {
      const prefs = usePrefsStore();
      prefs.volume = v;
      this.muted = false;
      if (this.audioEl) this.audioEl.volume = v;
      prefs.save();
    },
    seekToPct(pct) {
      if (!this.audioEl?.duration) return;
      this.audioEl.currentTime = (pct / 100) * this.audioEl.duration;
    },
    addToQueue(trackId) {
      if (this.queue.includes(trackId)) {
        showToast('Déjà dans la queue');
        return;
      }
      const insertAt = this.queue.length > 0 ? this.index + 1 : 0;
      this.queue.splice(insertAt, 0, trackId);
      showToast('Ajouté à la queue', 'success');
    },
    toggleQueueOpen() { this.queueOpen = !this.queueOpen; },
    closeQueue() { this.queueOpen = false; },
    removeQueueAt(qIdx) {
      this.queue.splice(qIdx, 1);
    },
    reorderQueue(fromIdx, targetIdx) {
      if (fromIdx <= this.index || fromIdx >= this.queue.length) return;
      if (targetIdx <= this.index) targetIdx = this.index + 1;
      const [moved] = this.queue.splice(fromIdx, 1);
      const adjusted = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;
      this.queue.splice(adjusted, 0, moved);
    },
    // ============================================================
    // Crossfade
    // ============================================================
    _startCrossfade(nextIdx) {
      if (this.crossfading) return;
      const prefs = usePrefsStore();
      const baseVol = this.muted ? 0 : prefs.volume;
      const nextTrackId = this.queue[nextIdx];
      const nextTrack = findTrack(nextTrackId);
      if (!nextTrack || !this.audioEl || !this.audioEl2) return;
      this.crossfading = true;

      // Park the currently-playing track on audio2, then start audio fresh on
      // the next track.
      this.audioEl2.src = this.audioEl.src;
      this.audioEl2.currentTime = this.audioEl.currentTime;
      this.audioEl2.volume = baseVol;
      this.audioEl2.play().catch(() => {});

      this.audioEl.src = nextTrack.file;
      this.audioEl.volume = 0;
      this.audioEl.currentTime = 0;
      this.audioEl.play().catch(() => {});

      this.index = nextIdx;
      this._updateMediaMetadata(nextTrack);
      this.playCountedFor = null;

      const startTime = performance.now();
      const fade = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(elapsed / prefs.crossfadeDuration, 1);
        this.audioEl.volume = baseVol * t;
        this.audioEl2.volume = baseVol * (1 - t);
        if (t < 1) {
          requestAnimationFrame(fade);
        } else {
          this.audioEl2.pause();
          try {
            this.audioEl2.removeAttribute('src');
            this.audioEl2.load();
          } catch {}
          this.crossfading = false;
        }
      };
      fade();
    },
    _maybeCrossfade() {
      if (this.crossfading) return;
      const prefs = usePrefsStore();
      if (!prefs.crossfadeEnabled) return;
      if (this.audioEl?.paused || !this.audioEl?.duration) return;
      const remaining = this.audioEl.duration - this.audioEl.currentTime;
      if (remaining > prefs.crossfadeDuration || remaining <= 0) return;
      let nextIdx = -1;
      if (this.shuffle && this.queue.length > 1) {
        do { nextIdx = Math.floor(Math.random() * this.queue.length); } while (nextIdx === this.index);
      } else if (this.index < this.queue.length - 1) {
        nextIdx = this.index + 1;
      } else if (this.repeat === 'all' && this.queue.length > 0) {
        nextIdx = 0;
      }
      if (nextIdx === -1) return;
      this._startCrossfade(nextIdx);
    },
    // ============================================================
    // Audio event handlers
    // ============================================================
    _onAudioPlay() {
      this.playing = true;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      this.savePlayerState();
    },
    _onAudioPause() {
      this.playing = false;
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      this.savePlayerState();
    },
    _onAudioTimeUpdate() {
      if (!this.audioEl?.duration) return;
      this.currentTime = this.audioEl.currentTime;
      this.duration = this.audioEl.duration;
      this._trackPlayProgress();
      this._maybeCrossfade();
      this._updateMediaPosition();
      this.savePlayerState();
    },
    _onAudioEnded() {
      if (this.crossfading) return;
      if (this.repeat === 'one') {
        this.audioEl.currentTime = 0;
        this.audioEl.play();
        return;
      }
      if (this.index >= this.queue.length - 1 && this.repeat !== 'all' && !this.shuffle) {
        this.playing = false;
        return;
      }
      this.next();
    },
    _trackPlayProgress() {
      const trackId = this.queue[this.index];
      if (!trackId || isStreamId(trackId)) return;
      if (this.audioEl.currentTime > 30 && this.playCountedFor !== trackId) {
        this.playCountedFor = trackId;
        api(`/api/library/${trackId}/play`, { method: 'POST' })
          .then(() => {
            const lib = useLibraryStore();
            const t = lib.findById(trackId);
            if (t) {
              t.playCount = (t.playCount || 0) + 1;
              t.lastPlayedAt = Date.now();
            }
          })
          .catch(() => {});
      }
    },
    // ============================================================
    // MediaSession integration
    // ============================================================
    setupMediaSession() {
      if (!('mediaSession' in navigator)) return;
      const ms = navigator.mediaSession;
      ms.setActionHandler('play', () => this.audioEl?.play());
      ms.setActionHandler('pause', () => this.audioEl?.pause());
      ms.setActionHandler('previoustrack', () => this.prev());
      ms.setActionHandler('nexttrack', () => this.next());
      try {
        ms.setActionHandler('seekto', (e) => {
          if (!this.audioEl) return;
          if (e.fastSeek && 'fastSeek' in this.audioEl) this.audioEl.fastSeek(e.seekTime);
          else this.audioEl.currentTime = e.seekTime;
        });
      } catch {}
      try {
        ms.setActionHandler('seekbackward', (e) => {
          if (!this.audioEl) return;
          this.audioEl.currentTime = Math.max(0, this.audioEl.currentTime - (e.seekOffset || 10));
        });
        ms.setActionHandler('seekforward', (e) => {
          if (!this.audioEl) return;
          this.audioEl.currentTime = Math.min(this.audioEl.duration || 0, this.audioEl.currentTime + (e.seekOffset || 10));
        });
      } catch {}
    },
    _updateMediaMetadata(track) {
      if (!('mediaSession' in navigator)) return;
      if (!track) {
        navigator.mediaSession.metadata = null;
        return;
      }
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || '',
          artist: track.uploader || '',
          album: 'Wax',
          artwork: track.thumbnail
            ? [{ src: track.thumbnail, sizes: '480x360', type: 'image/jpeg' }]
            : [],
        });
      } catch {}
    },
    _updateMediaPosition() {
      if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
      if (!this.audioEl?.duration || isNaN(this.audioEl.duration)) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: this.audioEl.duration,
          playbackRate: this.audioEl.playbackRate || 1,
          position: Math.min(this.audioEl.currentTime || 0, this.audioEl.duration),
        });
      } catch {}
    },
    // ============================================================
    // State persistence
    // ============================================================
    savePlayerState() {
      clearTimeout(this.saveStateTimer);
      this.saveStateTimer = setTimeout(() => {
        const persistableQueue = this.queue.filter((id) => !isStreamId(id));
        if (!persistableQueue.length || this.index < 0) {
          try { localStorage.removeItem(PLAYER_STATE_KEY); } catch {}
          return;
        }
        if (this.queue.some(isStreamId)) return;
        try {
          localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({
            queue: this.queue,
            index: this.index,
            currentTime: this.audioEl?.currentTime || 0,
            shuffle: this.shuffle,
            repeat: this.repeat,
          }));
        } catch {}
      }, 800);
    },
    restorePlayerState() {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) || 'null'); } catch { return; }
      if (!saved || !Array.isArray(saved.queue)) return;
      const lib = useLibraryStore();
      const validQueue = saved.queue.filter((id) => lib.findById(id));
      if (validQueue.length === 0) return;
      let idx = saved.index;
      if (idx < 0 || idx >= validQueue.length) idx = 0;
      this.queue = validQueue;
      this.index = idx;
      this.shuffle = !!saved.shuffle;
      this.repeat = saved.repeat || 'off';
      const track = lib.findById(validQueue[idx]);
      if (!track) return;
      this.visible = true;
      if (!this.audioEl) return;
      this.audioEl.src = track.file;
      const prefs = usePrefsStore();
      this.audioEl.volume = this.muted ? 0 : prefs.volume;
      this.audioEl.addEventListener('loadedmetadata', () => {
        const t = Math.min(saved.currentTime || 0, Math.max((this.audioEl.duration || 0) - 1, 0));
        this.audioEl.currentTime = t;
      }, { once: true });
      this._updateMediaMetadata(track);
    },
  },
});

export { fmtDuration };
