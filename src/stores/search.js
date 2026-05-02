// Search store — drives the URL/free-text input on the Search page.
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { t } from '@/lib/i18n';
import { isYoutubeUrl, isPlaylistUrl, debounce } from '@/lib/format';
import { useStreamsStore } from './streams';

export const useSearchStore = defineStore('search', {
  state: () => ({
    inputValue: '',
    preview: null,                 // { title, author, thumbnail }
    playlistSource: null,          // { url, tracks }
    playlistSelection: new Set(),
    results: null,                 // search results array (or null = no search yet)
    status: '',                    // 'searching' | 'error' | ''
    statusMessage: '',
  }),
  actions: {
    clearAll() {
      this.preview = null;
      this.playlistSource = null;
      this.playlistSelection = new Set();
      this.results = null;
      this.status = '';
      this.statusMessage = '';
    },
    setPlaylistSelection(set) {
      this.playlistSelection = set;
    },
    togglePlaylistTrack(id) {
      const s = new Set(this.playlistSelection);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      this.playlistSelection = s;
    },
    selectAllPlaylist() {
      if (!this.playlistSource) return;
      this.playlistSelection = new Set(this.playlistSource.tracks.map((t) => t.id));
    },
    selectNonePlaylist() {
      this.playlistSelection = new Set();
    },
    async runSearch(value) {
      this.clearAll();
      if (!value) return;
      const streams = useStreamsStore();
      if (isYoutubeUrl(value)) {
        if (isPlaylistUrl(value)) {
          await this._loadPlaylistSource(value);
          return;
        }
        try {
          const info = await api(`/api/info?url=${encodeURIComponent(value)}`);
          this.preview = info;
        } catch {
          /* swallow */
        }
        return;
      }
      // Free-text search
      if (value.length < 2) return;
      this.status = 'searching';
      this.statusMessage = t('search.searching');
      try {
        const { results } = await api(`/api/search?q=${encodeURIComponent(value)}`);
        this.results = results;
        this.status = '';
        this.statusMessage = '';
        results.forEach((r) => streams.prefetch(r.id));
      } catch (e) {
        this.status = 'error';
        this.statusMessage = t('search.failed', e.message);
      }
    },
    async _loadPlaylistSource(url) {
      const streams = useStreamsStore();
      try {
        showToast(t('toast.youtube_playlist_loading'));
        const { tracks } = await api(`/api/playlist-info?url=${encodeURIComponent(url)}`);
        this.playlistSource = { url, tracks };
        this.playlistSelection = new Set(tracks.map((t) => t.id));
        tracks.forEach((t) => streams.prefetch(t.id));
      } catch (e) {
        showToast(t('toast.youtube_enum_failed', e.message), 'error');
      }
    },
  },
});

// Debounced searcher — call from input handler.
export function makeSearchHandler(store) {
  return debounce(() => store.runSearch(store.inputValue.trim()), 500);
}
