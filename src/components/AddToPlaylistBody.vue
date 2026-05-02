<script setup>
import { usePlaylistsStore } from '@/stores/playlists';
import { showToast } from '@/lib/toast';
import { closeModal } from '@/lib/modal';
import { t } from '@/lib/i18n';

const props = defineProps({ trackId: { type: String, required: true } });

const playlists = usePlaylistsStore();

async function pick(pl) {
  const inPl = pl.trackIds.includes(props.trackId);
  if (inPl) {
    showToast(t('toast.already_in_playlist'));
    return;
  }
  await playlists.addTrack(pl.id, props.trackId);
  showToast(t('toast.added_to_named_playlist', pl.name), 'success');
  closeModal();
}
</script>

<template>
  <div class="modal-pl-list">
    <p v-if="playlists.items.length === 0" class="empty-state">
      {{ t('modal.no_playlists') }}
    </p>
    <div
      v-for="pl in playlists.items"
      :key="pl.id"
      class="modal-pl-item"
      @click="pick(pl)"
    >
      <span>{{ pl.name }}</span>
      <span class="pl-mini-count">
        {{
          pl.trackIds.includes(trackId)
            ? t('modal.already_added')
            : t('common.tracks', pl.trackIds.length)
        }}
      </span>
    </div>
  </div>
</template>
