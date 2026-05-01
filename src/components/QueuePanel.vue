<script setup>
import { computed } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useStreamsStore } from '@/stores/streams';
import QueueItem from './QueueItem.vue';

const player = usePlayerStore();
const lib = useLibraryStore();
const streams = useStreamsStore();

function findTrack(id) {
  return lib.findById(id) || streams.get(id);
}

const current = computed(() => {
  const id = player.queue[player.index];
  if (!id) return null;
  const t = findTrack(id);
  if (!t) return null;
  return { track: t, qIdx: player.index };
});

const upcoming = computed(() => {
  const out = [];
  const start = player.index + 1;
  for (let i = start; i < player.queue.length; i++) {
    const t = findTrack(player.queue[i]);
    if (t) out.push({ track: t, qIdx: i });
  }
  return out;
});
</script>

<template>
  <aside class="queue-panel" :hidden="!player.queueOpen">
    <div class="queue-header">
      <h2>File d'attente</h2>
      <button class="icon-btn" aria-label="Fermer" @click="player.closeQueue">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="queue-body">
      <div class="queue-section">
        <h3>En cours</h3>
        <ul class="queue-list">
          <QueueItem
            v-if="current"
            :track="current.track"
            :q-idx="current.qIdx"
            :is-current="true"
          />
        </ul>
      </div>
      <div class="queue-section">
        <h3>À suivre</h3>
        <ul class="queue-list">
          <QueueItem
            v-for="item in upcoming"
            :key="item.qIdx"
            :track="item.track"
            :q-idx="item.qIdx"
            :is-current="false"
          />
        </ul>
        <p class="empty-state" :hidden="upcoming.length > 0">
          Plus rien après celle-ci.
        </p>
      </div>
    </div>
  </aside>
</template>
