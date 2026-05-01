<script setup>
import { usePlaylistsStore } from '@/stores/playlists';
import { showToast } from '@/lib/toast';
import { closeModal } from '@/lib/modal';

const props = defineProps({ trackId: { type: String, required: true } });

const playlists = usePlaylistsStore();

async function pick(pl) {
  const inPl = pl.trackIds.includes(props.trackId);
  if (inPl) {
    showToast('Déjà dans cette playlist');
    return;
  }
  await playlists.addTrack(pl.id, props.trackId);
  showToast(`Ajouté à « ${pl.name} »`, 'success');
  closeModal();
}
</script>

<template>
  <div class="modal-pl-list">
    <p v-if="playlists.items.length === 0" class="empty-state">
      Aucune playlist. Crée-en une depuis la sidebar (icône +).
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
            ? 'Déjà ajouté'
            : `${pl.trackIds.length} titre${pl.trackIds.length > 1 ? 's' : ''}`
        }}
      </span>
    </div>
  </div>
</template>
