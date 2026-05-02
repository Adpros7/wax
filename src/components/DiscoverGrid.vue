<script setup>
import { computed } from 'vue';
import { useDiscoverStore } from '@/stores/discover';
import { usePlayerStore } from '@/stores/player';
import { onThumbError, onThumbLoad } from '@/lib/format';

const discover = useDiscoverStore();
const player = usePlayerStore();

const queueIds = computed(() => discover.tracks.map((t) => t.id));
const currentId = computed(() => player.queue[player.index] || null);

function isLoading(track) {
  return player.loading && currentId.value === track.id;
}

function play(track) {
  player.playFromList(track.id, queueIds.value);
}

function onDragStart(event, track) {
  event.dataTransfer.setData('wax/track', JSON.stringify({
    id: track.id,
    ytId: track.ytId,
    isStream: true,
  }));
  try { event.dataTransfer.setData('text/plain', track.id); } catch {}
}
</script>

<template>
  <section class="discover" v-if="discover.tracks.length > 0 || discover.loading">
    <div class="discover-header">
      <div>
        <h2>{{ discover.seedTrack ? 'Découverte' : 'Top du moment' }}</h2>
        <p v-if="discover.seedTrack" class="discover-sub">
          Inspiré par
          <em>{{ discover.seedTrack.title }}</em>
        </p>
        <p v-else class="discover-sub">Les hits du moment sur YouTube</p>
      </div>
      <button
        class="icon-btn"
        :disabled="discover.loading"
        title="Régénérer"
        @click="discover.refresh()"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12a9 9 0 0 1 16-5.7M21 4v5h-5M21 12a9 9 0 0 1-16 5.7M3 20v-5h5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
    <div class="discover-grid" v-if="!discover.loading">
      <button
        v-for="t in discover.tracks"
        :key="t.id"
        class="discover-card"
        :class="{ 'is-loading': isLoading(t) }"
        draggable="true"
        @click="play(t)"
        @dragstart="onDragStart($event, t)"
      >
        <div class="discover-card-cover">
          <img :src="t.thumbnail" alt="" loading="lazy" @error="onThumbError" @load="onThumbLoad" />
          <div v-if="isLoading(t)" class="discover-card-spinner" aria-label="Chargement…"></div>
        </div>
        <div class="discover-card-meta">
          <div class="discover-card-title">{{ t.title }}</div>
          <div class="discover-card-sub">{{ t.uploader }}</div>
        </div>
      </button>
    </div>
    <div v-else class="discover-grid">
      <div v-for="i in 12" :key="i" class="discover-card discover-card-skeleton">
        <div class="discover-card-cover">
          <div class="skeleton-block" style="width:100%;height:100%;border-radius:4px"></div>
        </div>
        <div class="discover-card-meta">
          <div class="skeleton-block" style="height:13px;width:80%;border-radius:3px;margin-bottom:6px"></div>
          <div class="skeleton-block" style="height:10px;width:55%;border-radius:3px"></div>
        </div>
      </div>
    </div>
  </section>
</template>
