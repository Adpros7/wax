// Temporary mix view (RD<videoId> based playlist preview).
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { promptModal } from '@/lib/modal';
import { useStreamsStore } from './streams';
import { useLibraryStore } from './library';
import { usePlaylistsStore } from './playlists';
import { useJobsStore } from './jobs';

export const useMixStore = defineStore('mix', {
  state: () => ({
    current: null, // { sourceTitle, sourceTrack, mixTracks, queueIds }
  }),
  actions: {
    async streamFrom(track, onSwitchView) {
      const ytId = track.ytId;
      if (!ytId) {
        showToast("Pas d'ID YouTube pour cette piste", 'error');
        return;
      }
      const streams = useStreamsStore();
      showToast('Génération du mix…');
      try {
        const { tracks: mixTracks } = await api(`/api/mix/${ytId}`);
        if (!mixTracks.length) {
          showToast('Mix vide', 'error');
          return;
        }
        const queueIds = [];
        for (const m of mixTracks) {
          const streamId = `stream-${m.id}`;
          streams.set(streamId, {
            id: streamId,
            title: m.title,
            uploader: m.uploader,
            duration: m.duration,
            thumbnail: m.thumbnail,
            file: `/api/stream/${m.id}`,
            ytId: m.id,
            isStream: true,
          });
          queueIds.push(streamId);
        }
        this.current = {
          sourceTitle: track.title,
          sourceTrack: track,
          mixTracks,
          queueIds,
        };
        if (onSwitchView) onSwitchView();
        mixTracks.forEach((m) => streams.prefetch(m.id));
      } catch (e) {
        showToast('Erreur mix : ' + e.message, 'error');
      }
    },
    close() {
      this.current = null;
    },
    async save(onSwitchView) {
      if (!this.current) return;
      const defaultName = `Mix · ${this.current.sourceTitle.slice(0, 60)}`;
      const name = await promptModal({
        title: 'Sauvegarder le mix',
        label: 'Toutes les pistes seront téléchargées en MP3 dans ta bibliothèque puis ajoutées à cette playlist.',
        defaultValue: defaultName,
        confirmLabel: 'Lancer',
      });
      if (!name) return;

      let playlist;
      try {
        ({ playlist } = await api('/api/playlists', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }));
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
        return;
      }
      const playlists = usePlaylistsStore();
      await playlists.fetch();

      const lib = useLibraryStore();
      const jobs = useJobsStore();
      let queued = 0, alreadyHad = 0;
      for (const m of this.current.mixTracks) {
        const existing = lib.tracks.find((t) => t.ytId === m.id);
        if (existing) {
          try {
            await api(`/api/playlists/${playlist.id}/tracks`, {
              method: 'POST',
              body: JSON.stringify({ trackId: existing.id }),
            });
            alreadyHad++;
          } catch {}
        } else {
          jobs.startDownload(m.url, '320', { title: m.title }, async (newTrack) => {
            try {
              await api(`/api/playlists/${playlist.id}/tracks`, {
                method: 'POST',
                body: JSON.stringify({ trackId: newTrack.id }),
              });
              await playlists.fetch();
            } catch {}
          });
          queued++;
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      await playlists.fetch();
      showToast(`Mix « ${name} » créé · ${alreadyHad} déjà là, ${queued} en téléchargement`, 'success');
      this.current = null;
      if (onSwitchView) onSwitchView(playlist.id);
    },
  },
});
