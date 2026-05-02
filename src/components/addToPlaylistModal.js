// Helper used by TrackRow.vue: opens the per-track "add to playlist" picker.
import { openComponentModal } from '@/lib/modal';
import { t } from '@/lib/i18n';
import AddToPlaylistBody from './AddToPlaylistBody.vue';

export function openAddToPlaylistModal(trackId) {
  openComponentModal({
    title: t('modal.add_to_playlist'),
    component: AddToPlaylistBody,
    componentProps: { trackId },
  });
}
