// Stream tracks (live YouTube stream playback). Equivalent to the
// `state.streams` Map + prefetch/streamSearchResult helpers.
import { defineStore } from 'pinia';
import { showToast } from '@/lib/toast';
import { t } from '@/lib/i18n';

export const useStreamsStore = defineStore('streams', {
  state: () => ({
    map: new Map(), // streamId -> track-like object
    prefetched: new Set(),
  }),
  actions: {
    get(streamId) {
      return this.map.get(streamId) || null;
    },
    set(streamId, track) {
      this.map.set(streamId, track);
    },
    prefetch(videoId) {
      if (this.prefetched.has(videoId)) return;
      this.prefetched.add(videoId);
      fetch(`/api/stream/${videoId}/prefetch`, { method: 'POST' }).catch(() => {
        this.prefetched.delete(videoId);
      });
    },
    /**
     * Begin streaming a YouTube search result. Constructs the fake-track
     * record, registers it under stream-<videoId>, and asks the player to
     * start a one-track queue.
     */
    streamSearchResult(r, btn, player) {
      const streamId = `stream-${r.id}`;
      const fakeTrack = {
        id: streamId,
        title: r.title,
        uploader: r.uploader || '',
        duration: r.duration || 0,
        thumbnail: r.thumbnail,
        file: `/api/stream/${r.id}`,
        ytId: r.id,
        isStream: true,
      };
      this.map.set(streamId, fakeTrack);
      this.prefetch(r.id);
      if (btn) btn.classList.add('is-loading');
      player.audioEl?.addEventListener('canplay', () => {
        if (btn) btn.classList.remove('is-loading');
      }, { once: true });
      player.audioEl?.addEventListener('error', () => {
        if (btn) btn.classList.remove('is-loading');
        showToast(t('toast.stream_unavailable'), 'error');
      }, { once: true });
      player.queue = [streamId];
      player.index = 0;
      player.loadAndPlay();
    },
  },
});
