// Helper used by TrackRow.vue: opens the per-track "add to playlist" picker.
import { openComponentModal } from '@/lib/modal';
import AddToPlaylistBody from './AddToPlaylistBody.vue';

export function openAddToPlaylistModal(trackId) {
  openComponentModal({
    title: 'Ajouter à une playlist',
    component: AddToPlaylistBody,
    componentProps: { trackId },
  });
}
