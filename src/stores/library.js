// Library: tracks the user has favorited or downloaded. Maps to
// public/js/library.js plus its smart-view helpers.
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { confirmModal } from '@/lib/modal';
import { t } from '@/lib/i18n';
import { isStreamId } from '@/lib/format';
import { usePlayerStore } from './player';
import { usePlaylistsStore } from './playlists';
import { useStreamsStore } from './streams';

export const useLibraryStore = defineStore('library', {
  state: () => ({
    tracks: [],
    loading: true,
    search: '',                 // current filter
    libraryDownloads: new Map(), // trackId -> { progress, phase }
    ytdlpStatus: { active: 0, queued: 0 },
  }),
  getters: {
    inLibraryByYtId: (state) => (ytId) => state.tracks.some((t) => t.ytId === ytId),
    findById: (state) => (id) => state.tracks.find((t) => t.id === id) || null,
    // Tracks the user has explicitly hearted. Treats undefined `liked` as
    // true for backward compat with rows added before the field existed.
    favorites: (state) => state.tracks.filter((t) => t.liked !== false),
    filtered(state) {
      const base = state.tracks.filter((t) => t.liked !== false);
      const q = state.search.toLowerCase();
      if (!q) return base;
      return base.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.uploader || '').toLowerCase().includes(q),
      );
    },
  },
  actions: {
    isInLibrary(track) {
      if (!track) return false;
      if (track.isStream) return this.tracks.some((t) => t.ytId === track.ytId);
      return this.tracks.some((t) => t.id === track.id);
    },
    // For the heart UI: is this track in the user's Favoris (liked!==false)?
    isFavorite(track) {
      if (!track) return false;
      const lib = track.isStream
        ? this.tracks.find((t) => t.ytId === track.ytId)
        : this.findById(track.id);
      return !!lib && lib.liked !== false;
    },
    async fetch() {
      try {
        const { tracks } = await api('/api/library');
        this.tracks = tracks || [];
      } finally {
        this.loading = false;
      }
    },
    async add(r, opts = {}) {
      const liked = opts.liked !== false; // default true: explicit favorites
      const silent = opts.silent === true;
      try {
        const data = await api('/api/library/add', {
          method: 'POST',
          body: JSON.stringify({
            ytId: r.id || r.ytId,
            title: r.title,
            uploader: r.uploader,
            duration: r.duration,
            thumbnail: r.thumbnail,
            url: r.url,
            liked,
          }),
        });
        if (!data.duplicate && data.track) {
          this.tracks.unshift(data.track);
          if (!silent) showToast(liked ? t('toast.added_to_favorites') : t('toast.added'), 'success');
        } else if (!silent) {
          showToast(t('toast.already_in_library'), 'success');
        }
        return data.track;
      } catch (e) {
        if (!silent) showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    async removeByYtId(ytId) {
      const track = this.tracks.find((tr) => tr.ytId === ytId);
      if (!track) return;
      await this.remove(track.id);
    },
    async remove(trackId) {
      try {
        await api(`/api/library/${trackId}`, { method: 'DELETE' });
        const player = usePlayerStore();
        if (player.queue.includes(trackId)) {
          const wasPlaying = player.queue[player.index] === trackId;
          player.queue = player.queue.filter((qid) => qid !== trackId);
          if (wasPlaying) player.stop();
        }
        // Local mutation: drop track + clean playlist references.
        const idx = this.tracks.findIndex((t) => t.id === trackId);
        if (idx !== -1) this.tracks.splice(idx, 1);
        const playlists = usePlaylistsStore();
        playlists.dropTrackLocally(trackId);
        showToast(t('toast.removed_from_favorites'));
      } catch (e) {
        showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    async deleteTrack(id) {
      const track = this.findById(id);
      const ok = await confirmModal({
        title: t('confirm.delete_track.title'),
        message: track
          ? t('confirm.delete_track.message', track.title)
          : t('confirm.delete_track.fallback'),
        confirmLabel: t('common.delete'),
        danger: true,
      });
      if (!ok) return;
      try {
        await api(`/api/library/${id}`, { method: 'DELETE' });
        const player = usePlayerStore();
        if (player.queue.includes(id)) {
          const wasPlaying = player.queue[player.index] === id;
          player.queue = player.queue.filter((qid) => qid !== id);
          if (wasPlaying) player.stop();
        }
        const idx = this.tracks.findIndex((t) => t.id === id);
        if (idx !== -1) this.tracks.splice(idx, 1);
        const playlists = usePlaylistsStore();
        playlists.dropTrackLocally(id);
        showToast(t('toast.track_deleted'), 'success');
      } catch (e) {
        showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    async toggleLike(trackId) {
      const track = this.findById(trackId);
      if (!track) return;
      const newLiked = !track.liked;
      track.liked = newLiked;
      try {
        await api(`/api/library/${trackId}`, {
          method: 'PATCH',
          body: JSON.stringify({ liked: newLiked }),
        });
      } catch (e) {
        track.liked = !newLiked;
        showToast(t('toast.fav_error'), 'error');
      }
    },
    async toggleFav(track) {
      if (track.isStream) {
        const existing = this.tracks.find((t) => t.ytId === track.ytId);
        if (existing) {
          this._setLiked(existing.id, !(existing.liked !== false));
        } else {
          this._optimisticAddFavorite(track);
        }
      } else {
        this._setLiked(track.id, !(track.liked !== false));
      }
    },
    // Insert a synthetic favorite immediately so the heart UI flips on click,
    // then sync to the server. The server returns a canonical track which
    // replaces the optimistic placeholder; on failure we revert.
    async _optimisticAddFavorite(track) {
      const optimistic = {
        id: track.ytId,
        ytId: track.ytId,
        title: track.title,
        uploader: track.uploader,
        duration: track.duration,
        thumbnail: track.thumbnail,
        url: `https://www.youtube.com/watch?v=${track.ytId}`,
        liked: true,
        addedAt: Date.now(),
        _optimistic: true,
      };
      this.tracks.unshift(optimistic);
      showToast(t('toast.added_to_favorites'), 'success');
      try {
        const data = await api('/api/library/add', {
          method: 'POST',
          body: JSON.stringify({
            ytId: track.ytId,
            title: track.title,
            uploader: track.uploader,
            duration: track.duration,
            thumbnail: track.thumbnail,
            url: `https://www.youtube.com/watch?v=${track.ytId}`,
            liked: true,
          }),
        });
        // Pinia/Vue wraps state in proxies, so `t === optimistic` (raw)
        // never matches. Locate by the synthetic flag + ytId instead.
        const idx = this.tracks.findIndex((t) => t._optimistic && t.ytId === track.ytId);
        if (data.track && idx !== -1) this.tracks.splice(idx, 1, data.track);
        else if (idx !== -1) this.tracks.splice(idx, 1);
      } catch (e) {
        const idx = this.tracks.findIndex((tr) => tr._optimistic && tr.ytId === track.ytId);
        if (idx !== -1) this.tracks.splice(idx, 1);
        showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    async _setLiked(trackId, liked) {
      const track = this.findById(trackId);
      if (!track) return;
      track.liked = liked;
      try {
        await api(`/api/library/${trackId}`, {
          method: 'PATCH',
          body: JSON.stringify({ liked }),
        });
      } catch (e) {
        track.liked = !liked;
        showToast(t('toast.fav_error'), 'error');
      }
    },
    async reorder(draggedId, targetId, above) {
      const ids = this.tracks.map((tr) => tr.id).filter((id) => id !== draggedId);
      const targetIdx = ids.indexOf(targetId);
      if (targetIdx === -1) return;
      const insertAt = above ? targetIdx : targetIdx + 1;
      ids.splice(insertAt, 0, draggedId);
      const byId = new Map(this.tracks.map((tr) => [tr.id, tr]));
      this.tracks = ids.map((id) => byId.get(id)).filter(Boolean);
      try {
        await api('/api/library/order', {
          method: 'PUT',
          body: JSON.stringify({ trackIds: ids }),
        });
      } catch (e) {
        showToast(t('common.error_prefix', e.message), 'error');
        this.fetch();
      }
    },
    async renameTrack(trackId, newTitle) {
      const track = this.findById(trackId);
      if (!track) return;
      const old = track.title;
      track.title = newTitle;
      try {
        await api(`/api/library/${trackId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: newTitle }),
        });
      } catch (e) {
        track.title = old;
        showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    async removeDownload(trackId) {
      const track = this.findById(trackId);
      if (!track || !track.file) return;
      try {
        await api(`/api/library/${trackId}/download`, { method: 'DELETE' });
        track.file = null;
        showToast(t('toast.local_file_removed'));
      } catch (e) {
        showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    async purgeOrphans() {
      const pls = usePlaylistsStore();
      const playlistTrackIds = new Set(pls.items.flatMap((pl) => pl.trackIds));
      const orphans = this.tracks.filter((tr) => tr.liked === false && !playlistTrackIds.has(tr.id));
      if (orphans.length === 0) return 0;
      for (const tr of orphans) {
        try {
          await api(`/api/library/${tr.id}`, { method: 'DELETE' });
          const idx = this.tracks.findIndex((o) => o.id === tr.id);
          if (idx !== -1) this.tracks.splice(idx, 1);
        } catch {}
      }
      return orphans.length;
    },
    async downloadTrack(trackId) {
      if (this.libraryDownloads.has(trackId)) return;
      const m = new Map(this.libraryDownloads);
      m.set(trackId, { progress: 0, phase: 'starting' });
      this.libraryDownloads = m;
      try {
        const { id: jobId } = await api(`/api/library/${trackId}/download`, {
          method: 'POST',
        });
        this._listenLibraryProgress(jobId, trackId);
      } catch (e) {
        const m2 = new Map(this.libraryDownloads);
        m2.delete(trackId);
        this.libraryDownloads = m2;
        showToast(t('common.error_prefix', e.message), 'error');
      }
    },
    _listenLibraryProgress(jobId, trackId) {
      const es = new EventSource(`/api/jobs/${jobId}/progress`);
      es.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'progress') {
          const m = new Map(this.libraryDownloads);
          m.set(trackId, { progress: data.progress, phase: data.phase });
          this.libraryDownloads = m;
        } else if (data.type === 'ready') {
          const m = new Map(this.libraryDownloads);
          m.delete(trackId);
          this.libraryDownloads = m;
          es.close();
          // Mark the local track as offline-ready instead of full re-fetch.
          const track = this.findById(trackId);
          if (track) track.file = `/audio/${trackId}.mp3`;
          showToast(t('toast.available_offline'), 'success');
        } else if (data.type === 'error') {
          const m = new Map(this.libraryDownloads);
          m.delete(trackId);
          this.libraryDownloads = m;
          es.close();
          showToast(t('toast.dl_error', data.error), 'error');
        }
        if (typeof data.ytdlpActive === 'number') {
          this.ytdlpStatus = { active: data.ytdlpActive, queued: data.ytdlpQueued ?? 0 };
        }
      };
      es.onerror = () => es.close();
    },
    smartTracks(key) {
      if (key === 'recent') {
        return [...this.tracks]
          .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
          .slice(0, 50);
      }
      if (key === 'top') {
        return [...this.tracks]
          .filter((t) => (t.playCount || 0) > 0)
          .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
          .slice(0, 50);
      }
      return [];
    },
  },
});

// Lookup helper used by the player; checks streams too.
export function findTrackById(id) {
  const lib = useLibraryStore();
  const streams = useStreamsStore();
  return lib.findById(id) || streams.get(id) || null;
}

export { isStreamId };
