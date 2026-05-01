// Playlists store. Maps to public/js/playlists.js minus its DOM-rendering.
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { confirmModal, promptModal } from '@/lib/modal';

export const usePlaylistsStore = defineStore('playlists', {
  state: () => ({
    items: [],
    loading: true,
  }),
  getters: {
    findById: (state) => (id) => state.items.find((p) => p.id === id) || null,
  },
  actions: {
    async fetch() {
      try {
        const { playlists } = await api('/api/playlists');
        this.items = playlists || [];
      } finally {
        this.loading = false;
      }
    },
    // Drop a track id from every playlist locally (no fetch). Used after
    // library.remove or library.deleteTrack so the sidebar/views reflect
    // the deletion immediately without a round-trip.
    dropTrackLocally(trackId) {
      for (const pl of this.items) {
        const i = pl.trackIds.indexOf(trackId);
        if (i !== -1) pl.trackIds.splice(i, 1);
      }
    },
    async create() {
      const name = await promptModal({
        title: 'Nouvelle playlist',
        placeholder: 'Mes pépites',
        confirmLabel: 'Créer',
      });
      if (!name) return null;
      try {
        const { playlist } = await api('/api/playlists', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        // Local mutation — push the new playlist; sidebar reacts instantly.
        this.items.push(playlist);
        showToast('Playlist créée', 'success');
        return playlist;
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
    async remove(id) {
      const pl = this.findById(id);
      if (!pl) return false;
      const ok = await confirmModal({
        title: `Supprimer « ${pl.name} » ?`,
        message: 'Les pistes resteront dans ta bibliothèque, seule la playlist sera supprimée.',
        confirmLabel: 'Supprimer',
        danger: true,
      });
      if (!ok) return false;
      try {
        await api(`/api/playlists/${id}`, { method: 'DELETE' });
        await this.fetch();
        showToast('Playlist supprimée', 'success');
        return true;
      } catch (e) {
        showToast(e.message, 'error');
        return false;
      }
    },
    async rename(id) {
      const pl = this.findById(id);
      if (!pl) return;
      const name = await promptModal({
        title: 'Renommer la playlist',
        defaultValue: pl.name,
        confirmLabel: 'Renommer',
      });
      if (!name) return;
      try {
        await api(`/api/playlists/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
        await this.fetch();
        showToast('Playlist renommée', 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
    async addTrack(playlistId, trackId) {
      try {
        await api(`/api/playlists/${playlistId}/tracks`, {
          method: 'POST',
          body: JSON.stringify({ trackId }),
        });
        await this.fetch();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
    async addTracksBulk(playlistId, trackIds) {
      try {
        await api(`/api/playlists/${playlistId}/tracks/bulk`, {
          method: 'POST',
          body: JSON.stringify({ trackIds }),
        });
        await this.fetch();
        return true;
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
        return false;
      }
    },
    async removeTrack(playlistId, trackId) {
      try {
        await api(`/api/playlists/${playlistId}/tracks/${trackId}`, {
          method: 'DELETE',
        });
        await this.fetch();
      } catch (e) {
        showToast(e.message, 'error');
      }
    },
    async reorder(playlistId, draggedId, targetId, above) {
      const pl = this.findById(playlistId);
      if (!pl) return;
      const ids = pl.trackIds.filter((id) => id !== draggedId);
      const targetIdx = ids.indexOf(targetId);
      if (targetIdx === -1) return;
      const insertAt = above ? targetIdx : targetIdx + 1;
      ids.splice(insertAt, 0, draggedId);
      pl.trackIds = ids;
      try {
        await api(`/api/playlists/${playlistId}`, {
          method: 'PUT',
          body: JSON.stringify({ trackIds: ids }),
        });
      } catch (e) {
        showToast('Erreur réorganisation : ' + e.message, 'error');
        this.fetch();
      }
    },
  },
});
