<script setup>
import { onMounted, ref } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useQueueDrag } from '@/composables/useDragReorder';

const props = defineProps({
  track: { type: Object, required: true },
  qIdx: { type: Number, required: true },
  isCurrent: { type: Boolean, default: false },
});

const player = usePlayerStore();
const itemRef = ref(null);

function activate() {
  if (props.isCurrent) return;
  player.index = props.qIdx;
  player.loadAndPlay();
}

function removeFromQueue(e) {
  e.stopPropagation();
  player.removeQueueAt(props.qIdx);
}

onMounted(() => {
  if (props.isCurrent) return;
  const { bind } = useQueueDrag((from, to) => player.reorderQueue(from, to));
  bind(itemRef.value, props.qIdx);
});
</script>

<template>
  <li
    ref="itemRef"
    class="queue-item"
    :class="{ 'is-current': isCurrent }"
    :data-qidx="qIdx"
    @click="activate"
  >
    <img class="qi-thumb" :src="track.thumbnail || ''" alt="" loading="lazy" />
    <div class="qi-meta">
      <div class="qi-title">{{ track.title }}</div>
      <div class="qi-sub">{{ track.uploader || '' }}</div>
    </div>
    <span v-if="isCurrent" class="eq" :class="{ 'is-playing': player.playing }">
      <svg viewBox="0 0 16 14">
        <rect x="1" y="0" width="3" height="14" rx="0.5" />
        <rect x="6.5" y="0" width="3" height="14" rx="0.5" />
        <rect x="12" y="0" width="3" height="14" rx="0.5" />
      </svg>
    </span>
    <button v-else class="icon-btn qi-remove" title="Retirer" @click="removeFromQueue">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  </li>
</template>
