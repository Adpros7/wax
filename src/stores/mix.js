// Temporary mix view (RD<videoId> based playlist preview).
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { promptModal } from '@/lib/modal';
import { useStreamsStore } from './streams';
import { useLibraryStore } from './library';
import { usePlaylistsStore } from './playlists';

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
        // No bulk prefetch — would saturate the yt-dlp queue and slow down
        // the first track the user actually clicks. We rely on player
        // look-ahead (next track in queue) once playback starts.
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
        label: 'Le mix devient une playlist permanente. Les pistes restent en streaming (pas de téléchargement). Tu pourras toujours en télécharger une par une après.',
        defaultValue: defaultName,
        confirmLabel: 'Sauvegarder',
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

      const lib = useLibraryStore();
      const playlists = usePlaylistsStore();

      // Local mutation — sidebar shows the new playlist immediately.
      playlists.items.push(playlist);

      // Ensure each mix track exists in the library (metadata only, no MP3).
      // Sequential — server's library.json read/write is non-atomic, so
      // parallelizing risks losing entries to last-write-wins.
      const trackIds = [];
      let added = 0;
      for (const m of this.current.mixTracks) {
        const existing = lib.tracks.find((t) => t.ytId === m.id);
        if (existing) {
          trackIds.push(existing.id);
          continue;
        }
        try {
          // liked: false → track lives in library only as a playlist
          // reference, never appears in the Favoris view.
          const track = await lib.add(
            {
              id: m.id,
              title: m.title,
              uploader: m.uploader,
              duration: m.duration,
              thumbnail: m.thumbnail,
              url: m.url,
            },
            { liked: false, silent: true },
          );
          if (track) {
            trackIds.push(track.id);
            if (!lib.tracks.some((t) => t.id === track.id) && track.id) {
              // Defensive — lib.add already pushes when not duplicate.
            } else {
              added++;
            }
          }
        } catch (e) {
          console.error('[mix.save] library/add failed for', m.title, e);
        }
      }

      // Bulk-add all collected track ids to the playlist (single round-trip).
      if (trackIds.length > 0) {
        try {
          await api(`/api/playlists/${playlist.id}/tracks/bulk`, {
            method: 'POST',
            body: JSON.stringify({ trackIds }),
          });
          const pl = playlists.findById(playlist.id);
          if (pl) {
            for (const id of trackIds) {
              if (!pl.trackIds.includes(id)) pl.trackIds.push(id);
            }
          }
        } catch (e) {
          console.error('[mix.save] bulk-add failed:', e);
          showToast('Erreur ajout : ' + e.message, 'error');
        }
      }

      this.current = null;
      if (onSwitchView) onSwitchView(playlist.id);
      showToast(
        `« ${name} » sauvegardée · ${trackIds.length} piste${trackIds.length > 1 ? 's' : ''} (${added} nouvelle${added > 1 ? 's' : ''} en favoris)`,
        'success',
      );
    },
  },
});
