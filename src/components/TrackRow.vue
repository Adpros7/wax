<script setup>
import { computed, ref, onMounted } from 'vue';
import { fmtDuration, onThumbError, onThumbLoad } from '@/lib/format';
import {
  ICON_PLAY,
  ICON_PAUSE,
  ICON_PLUS,
  ICON_DOWNLOAD,
  ICON_TRASH,
  ICON_MINUS,
  ICON_HEART,
  ICON_HEART_OUTLINE,
  ICON_SPARKLES,
  ICON_QUEUE_ADD,
  ICON_EDIT,
  eqHtml,
} from '@/lib/icons';
import { promptModal } from '@/lib/modal';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useViewStore } from '@/stores/view';
import { useMixStore } from '@/stores/mix';
import { useTrackDrag } from '@/composables/useDragReorder';
import { openAddToPlaylistModal } from './addToPlaylistModal';

const RING_CIRCUMFERENCE = 2 * Math.PI * 9;

const props = defineProps({
  track: { type: Object, required: true },
  index: { type: Number, default: null },
  queue: { type: Array, default: () => [] },
  removeFromPlaylist: { type: Function, default: null }, // (trackId) => void
  onReorder: { type: Function, default: null },
});

const lib = useLibraryStore();
const player = usePlayerStore();
const view = useViewStore();
const mix = useMixStore();

const rowRef = ref(null);

const isCurrent = computed(() => player.queue[player.index] === props.track.id);
const isPlaying = computed(() => isCurrent.value && player.playing);
const fav = computed(() => lib.isFavorite(props.track));
const dl = computed(() => lib.libraryDownloads.get(props.track.id));

function playThis() {
  if (isCurrent.value) player.togglePlay();
  else player.playFromList(props.track.id, props.queue.length ? props.queue : lib.tracks.map((t) => t.id));
}

function handleHeart(e) {
  e.stopPropagation();
  lib.toggleFav(props.track);
}

function handleMix(e) {
  e.stopPropagation();
  mix.streamFrom(props.track, () => view.switchTo('mix'));
}

function handleAddPlaylist(e) {
  e.stopPropagation();
  openAddToPlaylistModal(props.track.id);
}

function handleDownload(e) {
  e.stopPropagation();
  lib.downloadTrack(props.track.id);
}

function handleRemoveDownload(e) {
  e.stopPropagation();
  lib.removeDownload(props.track.id);
}

function handleAddToQueue(e) {
  e.stopPropagation();
  player.addToQueue(props.track.id);
}

async function handleRenameTitle(e) {
  e.stopPropagation();
  if (props.track.isStream) return;
  const newTitle = await promptModal({
    title: 'Renommer',
    defaultValue: props.track.title,
    placeholder: props.track.title,
    confirmLabel: 'Renommer',
  });
  if (newTitle && newTitle !== props.track.title) lib.renameTrack(props.track.id, newTitle);
}

function handleDragStart(e) {
  // Don't set effectAllowed here — useDragReorder may also fire and set 'move'.
  // Let the browser/destination decide. The key data is in wax/track.
  e.dataTransfer.setData('wax/track', JSON.stringify({
    id: props.track.id,
    ytId: props.track.ytId,
    isStream: !!props.track.isStream,
  }));
  // Fallback for useDragReorder compatibility (text/plain = track ID)
  try { e.dataTransfer.setData('text/plain', props.track.id); } catch {}
}

function handleRemoveFromPlaylist(e) {
  e.stopPropagation();
  if (props.removeFromPlaylist) props.removeFromPlaylist(props.track.id);
}

function handleDelete(e) {
  e.stopPropagation();
  lib.deleteTrack(props.track.id);
}

const offlineRing = computed(() => {
  if (!dl.value) return null;
  const isConv = dl.value.phase === 'converting';
  const pct = isConv ? 100 : Math.round(dl.value.progress);
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  return { isConv, pct, offset };
});

onMounted(() => {
  if (props.onReorder) {
    const { bind } = useTrackDrag(props.onReorder);
    bind(rowRef.value, props.track.id);
  }
});
</script>

<template>
  <li
    ref="rowRef"
    class="track"
    :class="{ 'is-playing': isCurrent }"
    :data-id="track.id"
    draggable="true"
    @dblclick="playThis"
    @dragstart="handleDragStart"
  >
    <div class="track-num">
      <div v-if="isCurrent && player.loading" class="track-num-spinner" aria-label="Chargement…"></div>
      <div v-else-if="isCurrent" class="track-num-eq" v-html="eqHtml(player.playing)"></div>
      <span v-else class="track-num-default">{{ index != null ? index + 1 : '' }}</span>
      <button
        class="track-num-action"
        aria-label="Lire"
        @click.stop="playThis"
        v-html="isPlaying ? ICON_PAUSE : ICON_PLAY"
      ></button>
    </div>
    <img class="track-thumb" :src="track.thumbnail || ''" alt="" loading="lazy" @error="onThumbError" @load="onThumbLoad" />
    <div class="track-meta">
      <div class="track-title">{{ track.title }}</div>
      <div class="track-sub">{{ track.uploader || '' }}</div>
    </div>
    <!-- Persistent offline indicator (always visible) -->
    <span v-if="track.isStream" class="track-offline-indicator empty"></span>
    <span
      v-else-if="offlineRing"
      class="track-offline-indicator is-downloading"
      :title="offlineRing.isConv ? 'Conversion MP3…' : `Téléchargement ${offlineRing.pct}%`"
    >
      <svg viewBox="0 0 24 24" fill="none" :class="{ 'is-converting': offlineRing.isConv }">
        <circle class="ring-track" cx="12" cy="12" r="9" stroke-width="1.6" fill="none" />
        <circle
          cx="12" cy="12" r="9"
          stroke="currentColor" stroke-width="1.8" fill="none"
          :stroke-dasharray="RING_CIRCUMFERENCE.toFixed(2)"
          :stroke-dashoffset="offlineRing.offset.toFixed(2)"
          stroke-linecap="round"
          class="ring-progress"
        />
      </svg>
    </span>
    <button
      v-else-if="track.file"
      class="track-offline-indicator is-done"
      title="Retirer de l'offline"
      @click.stop="handleRemoveDownload"
    >
      <svg class="icon-check" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg class="icon-remove" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
    <span v-else class="track-offline-indicator empty" title="Non téléchargé"></span>
    <span class="track-duration">{{ fmtDuration(track.duration) }}</span>
    <div class="track-actions">
      <button
        class="icon-btn like-btn"
        :class="{ 'is-liked': fav }"
        :title="fav ? 'Retirer des favoris' : 'Ajouter aux favoris'"
        @click="handleHeart"
        v-html="fav ? ICON_HEART : ICON_HEART_OUTLINE"
      ></button>
      <button
        class="icon-btn mix-btn"
        title="Mix inspiré par ce titre"
        @click="handleMix"
        v-html="ICON_SPARKLES"
      ></button>
      <button
        v-if="!track.isStream"
        class="icon-btn"
        title="Ajouter à une playlist"
        @click="handleAddPlaylist"
        v-html="ICON_PLUS"
      ></button>
      <button
        v-if="!track.isStream"
        class="icon-btn"
        title="Renommer"
        @click.stop="handleRenameTitle"
        v-html="ICON_EDIT"
      ></button>
      <button
        v-if="!track.isStream && !track.file && !offlineRing"
        class="icon-btn offline-btn"
        title="Télécharger pour l'écoute hors ligne"
        @click="handleDownload"
        v-html="ICON_DOWNLOAD"
      ></button>
      <button
        class="icon-btn queue-add-btn"
        title="Ajouter à la queue"
        @click="handleAddToQueue"
        v-html="ICON_QUEUE_ADD"
      ></button>
      <button
        v-if="removeFromPlaylist"
        class="icon-btn danger"
        title="Retirer de la playlist"
        @click="handleRemoveFromPlaylist"
        v-html="ICON_MINUS"
      ></button>
      <button
        v-else-if="!track.isStream && view.name !== 'library'"
        class="icon-btn danger"
        title="Supprimer"
        @click="handleDelete"
        v-html="ICON_TRASH"
      ></button>
    </div>
  </li>
</template>
