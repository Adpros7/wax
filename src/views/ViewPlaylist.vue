<script setup>
import { computed } from 'vue';
import { useViewStore } from '@/stores/view';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePlayerStore } from '@/stores/player';
import { showToast } from '@/lib/toast';
import { fmtDuration, gradientFromString } from '@/lib/format';
import { t } from '@/lib/i18n';
import TrackRow from '@/components/TrackRow.vue';
import { openComponentModal, closeModal } from '@/lib/modal';
import BulkAddBody from '@/components/BulkAddBody.vue';

const view = useViewStore();
const lib = useLibraryStore();
const playlists = usePlaylistsStore();
const player = usePlayerStore();

const playlist = computed(() => playlists.findById(view.selectedPlaylistId));
const tracks = computed(() => {
  if (!playlist.value) return [];
  return playlist.value.trackIds.map((id) => lib.findById(id)).filter(Boolean);
});
const queueIds = computed(() => tracks.value.map((tr) => tr.id));
const totalDuration = computed(() => tracks.value.reduce((s, tr) => s + (tr.duration || 0), 0));
const heroBg = computed(() => playlist.value ? gradientFromString(playlist.value.name) : '');

function playAll() {
  if (!playlist.value || playlist.value.trackIds.length === 0) return;
  const ids = playlist.value.trackIds.filter((id) => lib.findById(id));
  if (ids.length === 0) return;
  player.playFromList(ids[0], ids);
}

function removeFromPl(trackId) {
  if (!playlist.value) return;
  playlists.removeTrack(playlist.value.id, trackId);
}

function reorder(draggedId, targetId, above) {
  if (!playlist.value) return;
  playlists.reorder(playlist.value.id, draggedId, targetId, above);
}

async function deleteThis() {
  if (!playlist.value) return;
  const ok = await playlists.remove(playlist.value.id);
  if (ok) view.switchTo('library');
}

function renameThis() {
  if (!playlist.value) return;
  playlists.rename(playlist.value.id);
}

async function addTracks() {
  if (!playlist.value) return;
  const pl = playlist.value;
  const available = lib.tracks.filter((t) => !pl.trackIds.includes(t.id));
  if (available.length === 0) {
    showToast(t('toast.all_already_here'), 'success');
    return;
  }
  const selection = new Set();
  openComponentModal({
    title: t('modal.add_to_named', pl.name),
    component: BulkAddBody,
    componentProps: { available, selection },
    confirmLabel: t('common.add'),
    wide: true,
    onConfirm: async () => {
      if (selection.size === 0) return;
      const ok = await playlists.addTracksBulk(pl.id, Array.from(selection));
      if (ok) {
        showToast(t('toast.tracks_added_n', selection.size), 'success');
        closeModal();
      }
    },
  });
}

async function downloadAll() {
  if (!playlist.value) return;
  const todo = playlist.value.trackIds
    .map((id) => lib.findById(id))
    .filter((tr) => tr && !tr.file && !lib.libraryDownloads.has(tr.id));
  if (todo.length === 0) {
    showToast(t('toast.all_already_offline'), 'success');
    return;
  }
  showToast(t('toast.dl_started_n', todo.length));
  for (const tr of todo) {
    lib.downloadTrack(tr.id);
    await new Promise((r) => setTimeout(r, 80));
  }
}
</script>

<template>
  <section id="view-playlist" class="view active">
    <header class="hero hero-playlist" :style="{ backgroundImage: heroBg }">
      <div class="hero-content">
        <span class="eyebrow">{{ t('playlist.eyebrow') }}</span>
        <h1>{{ playlist?.name || t('playlist.eyebrow') }}</h1>
        <p class="hero-meta">
          {{ t('common.tracks', tracks.length) }}<span v-if="totalDuration"> · {{ fmtDuration(totalDuration) }}</span>
        </p>
      </div>
    </header>
    <div class="page-body">
      <div class="action-row">
        <button class="play-circle" :title="t('playlist.play_all')" @click="playAll">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button class="secondary-btn" @click="addTracks">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          {{ t('playlist.add') }}
        </button>
        <button class="secondary-btn" @click="downloadAll">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ t('playlist.download_all') }}
        </button>
        <button class="icon-btn round large" :title="t('playlist.rename')" @click="renameThis">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button class="icon-btn round large danger" :title="t('playlist.delete')" @click="deleteThis">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <ul class="track-list">
        <TrackRow
          v-for="(t, i) in tracks"
          :key="t.id"
          :track="t"
          :index="i"
          :queue="queueIds"
          :remove-from-playlist="removeFromPl"
          :on-reorder="reorder"
        />
      </ul>
      <p class="empty-state" :hidden="tracks.length > 0">
        {{ t('playlist.empty') }}
      </p>
    </div>
  </section>
</template>
