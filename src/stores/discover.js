// "Découverte" recommendations. Picks a random seed from the user's favorites
// (or library if no favorites yet), fetches the YouTube RD-mix for it, filters
// out anything already favorited, and exposes the result as stream tracks.
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { useLibraryStore } from './library';
import { useStreamsStore } from './streams';

export const useDiscoverStore = defineStore('discover', {
  state: () => ({
    tracks: [],       // array of stream-track objects (registered in streams store)
    loading: false,
    seedTrack: null,  // the favorite/library track used as seed
  }),
  actions: {
    async refresh() {
      const lib = useLibraryStore();
      const streams = useStreamsStore();
      const candidates = (lib.favorites.length > 0 ? lib.favorites : lib.tracks).filter(
        (t) => !!t.ytId,
      );

      this.loading = true;
      this.tracks = [];
      this.seedTrack = null;

      try {
        let rawTracks = [];
        if (candidates.length > 0) {
          // Personalized: YouTube Mix from a random favorite.
          const seed = candidates[Math.floor(Math.random() * candidates.length)];
          this.seedTrack = seed;
          const { tracks } = await api(`/api/mix/${seed.ytId}`);
          rawTracks = tracks || [];
        } else {
          // Cold start: trending top 30.
          const { tracks } = await api('/api/trending');
          rawTracks = tracks || [];
        }

        const favYtIds = new Set(lib.favorites.map((t) => t.ytId).filter(Boolean));
        const filtered = rawTracks.filter((m) => !favYtIds.has(m.id)).slice(0, 30);

        this.tracks = filtered.map((m) => {
          const streamId = `stream-${m.id}`;
          let entry = streams.get(streamId);
          if (!entry) {
            entry = {
              id: streamId,
              title: m.title,
              uploader: m.uploader || '',
              duration: m.duration,
              thumbnail: m.thumbnail,
              file: `/api/stream/${m.id}`,
              ytId: m.id,
              isStream: true,
            };
            streams.set(streamId, entry);
          }
          return entry;
        });
      } catch (e) {
        console.error('[discover] refresh failed:', e);
        this.tracks = [];
      } finally {
        this.loading = false;
      }
    },
  },
});
