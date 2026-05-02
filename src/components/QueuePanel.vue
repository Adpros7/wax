<script setup>
import { computed } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useStreamsStore } from '@/stores/streams';
import { t } from '@/lib/i18n';
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
  const tr = findTrack(id);
  if (!tr) return null;
  return { track: tr, qIdx: player.index };
});

const upcoming = computed(() => {
  const out = [];
  const start = player.index + 1;
  for (let i = start; i < player.queue.length; i++) {
    const tr = findTrack(player.queue[i]);
    if (tr) out.push({ track: tr, qIdx: i });
  }
  return out;
});
</script>

<template>
  <aside class="queue-panel" :hidden="!player.queueOpen">
    <div class="queue-header">
      <h2>{{ t('queue.title') }}</h2>
      <button class="icon-btn" :aria-label="t('common.close')" @click="player.closeQueue">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="queue-body">
      <div class="queue-section">
        <h3>{{ t('queue.now_playing') }}</h3>
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
        <h3>{{ t('queue.next_up') }}</h3>
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
          {{ t('queue.empty_after') }}
        </p>
      </div>
    </div>
  </aside>
</template>
