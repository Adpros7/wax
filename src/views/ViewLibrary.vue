<script setup>
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { t } from '@/lib/i18n';
import TrackRow from '@/components/TrackRow.vue';

const lib = useLibraryStore();
const player = usePlayerStore();

const favorites = computed(() => lib.favorites);
const queueIds = computed(() => favorites.value.map((t) => t.id));
const filtered = computed(() => lib.filtered);

function playAll() {
  if (favorites.value.length === 0) return;
  const ids = queueIds.value;
  player.playFromList(ids[0], ids);
}

function reorder(draggedId, targetId, above) {
  lib.reorder(draggedId, targetId, above);
}

function onSearchInput(e) {
  lib.search = e.target.value;
}

const skeletonRows = computed(() =>
  lib.loading && lib.tracks.length === 0 ? Array.from({ length: 8 }) : [],
);
function skTitleW() { return 50 + Math.random() * 30; }
function skSubW() { return 30 + Math.random() * 25; }
</script>

<template>
  <section id="view-library" class="view active">
    <header class="hero hero-library">
      <div class="hero-content">
        <span class="eyebrow">{{ t('library.favorites') }}</span>
        <h1>{{ t('library.favorites') }}</h1>
        <p class="hero-meta">{{ t('common.tracks', favorites.length) }}</p>
      </div>
    </header>
    <div class="page-body">
      <div class="action-row">
        <button class="play-circle" :title="t('playlist.play_all')" @click="playAll">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <input
          type="search"
          id="library-search"
          class="page-search"
          :placeholder="t('nav.search') + '…'"
          :value="lib.search"
          @input="onSearchInput"
        />
      </div>
      <ul id="library-list" class="track-list">
        <li v-for="(_, i) in skeletonRows" :key="'sk' + i" class="skeleton-track">
          <span class="skeleton sk-num"></span>
          <span class="skeleton sk-thumb"></span>
          <div class="sk-meta">
            <span class="skeleton sk-title" :style="{ width: skTitleW() + '%' }"></span>
            <span class="skeleton sk-sub" :style="{ width: skSubW() + '%' }"></span>
          </div>
          <span class="skeleton sk-dur"></span>
          <span class="skeleton sk-actions"></span>
        </li>
        <TrackRow
          v-for="(t, i) in filtered"
          :key="t.id"
          :track="t"
          :index="i"
          :queue="queueIds"
          :on-reorder="reorder"
        />
      </ul>
      <p class="empty-state" :hidden="favorites.length > 0">
        {{ t('library.empty_hint') }}
      </p>
    </div>
  </section>
</template>
