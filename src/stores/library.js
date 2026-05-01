// Library: tracks the user has favorited or downloaded. Maps to
// public/js/library.js plus its smart-view helpers.
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { confirmModal } from '@/lib/modal';
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
          if (!silent) showToast(liked ? 'Ajouté aux favoris' : 'Ajouté', 'success');
        } else if (!silent) {
          showToast('Déjà dans la bibliothèque', 'success');
        }
        return data.track;
      } catch (e) {
        if (!silent) showToast('Erreur : ' + e.message, 'error');
      }
    },
    async removeByYtId(ytId) {
      const t = this.tracks.find((t) => t.ytId === ytId);
      if (!t) return;
      await this.remove(t.id);
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
        showToast('Retiré des favoris');
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    },
    async deleteTrack(id) {
      const track = this.findById(id);
      const ok = await confirmModal({
        title: 'Supprimer cette piste ?',
        message: track
          ? `« ${track.title} » sera retirée de ta bibliothèque et de toutes les playlists. Le fichier MP3 sera supprimé.`
          : 'Le fichier sera retiré de ta bibliothèque.',
        confirmLabel: 'Supprimer',
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
        showToast('Piste supprimée', 'success');
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    },
    async toggleLike(trackId) {
      const t = this.findById(trackId);
      if (!t) return;
      const newLiked = !t.liked;
      t.liked = newLiked;
      try {
        await api(`/api/library/${trackId}`, {
          method: 'PATCH',
          body: JSON.stringify({ liked: newLiked }),
        });
      } catch (e) {
        t.liked = !newLiked;
        showToast('Erreur favoris', 'error');
      }
    },
    async toggleFav(track) {
      if (track.isStream) {
        const existing = this.tracks.find((t) => t.ytId === track.ytId);
        if (existing) {
          // Toggle the liked flag on the existing library entry.
          await this._setLiked(existing.id, !(existing.liked !== false));
        } else {
          // Stream not in library — add as favorite.
          await this.add({
            id: track.ytId,
            title: track.title,
            uploader: track.uploader,
            duration: track.duration,
            thumbnail: track.thumbnail,
            url: `https://www.youtube.com/watch?v=${track.ytId}`,
          });
        }
      } else {
        // Track is already in library — just flip its liked flag.
        await this._setLiked(track.id, !(track.liked !== false));
      }
    },
    async _setLiked(trackId, liked) {
      const t = this.findById(trackId);
      if (!t) return;
      t.liked = liked;
      try {
        await api(`/api/library/${trackId}`, {
          method: 'PATCH',
          body: JSON.stringify({ liked }),
        });
      } catch (e) {
        t.liked = !liked;
        showToast('Erreur favoris', 'error');
      }
    },
    async reorder(draggedId, targetId, above) {
      const ids = this.tracks.map((t) => t.id).filter((id) => id !== draggedId);
      const targetIdx = ids.indexOf(targetId);
      if (targetIdx === -1) return;
      const insertAt = above ? targetIdx : targetIdx + 1;
      ids.splice(insertAt, 0, draggedId);
      const byId = new Map(this.tracks.map((t) => [t.id, t]));
      this.tracks = ids.map((id) => byId.get(id)).filter(Boolean);
      try {
        await api('/api/library/order', {
          method: 'PUT',
          body: JSON.stringify({ trackIds: ids }),
        });
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
        this.fetch();
      }
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
        showToast('Erreur : ' + e.message, 'error');
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
          const t = this.findById(trackId);
          if (t) t.file = `/audio/${trackId}.mp3`;
          showToast('Disponible hors ligne', 'success');
        } else if (data.type === 'error') {
          const m = new Map(this.libraryDownloads);
          m.delete(trackId);
          this.libraryDownloads = m;
          es.close();
          showToast('Erreur téléchargement : ' + data.error, 'error');
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
