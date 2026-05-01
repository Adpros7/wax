<script setup>
// Smart playlist view (recently added / most played). Wired but not yet
// linked from the sidebar — preserved for parity with the legacy `view-smart`
// section so existing flows that switch to 'smart' keep working.
import { computed } from 'vue';
import { useViewStore } from '@/stores/view';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import TrackRow from '@/components/TrackRow.vue';

const view = useViewStore();
const lib = useLibraryStore();
const player = usePlayerStore();

const labels = { recent: 'Récemment ajoutées', top: 'Les plus écoutées' };
const name = computed(() => labels[view.smartView] || 'Auto');
const tracks = computed(() => lib.smartTracks(view.smartView));
const queueIds = computed(() => tracks.value.map((t) => t.id));
const meta = computed(
  () => `${tracks.value.length} titre${tracks.value.length > 1 ? 's' : ''}`,
);

function playAll() {
  if (tracks.value.length === 0) return;
  const ids = queueIds.value;
  player.playFromList(ids[0], ids);
}
</script>

<template>
  <section id="view-smart" class="view active">
    <header class="hero hero-smart">
      <div class="hero-content">
        <span class="eyebrow">Playlist auto</span>
        <h1>{{ name }}</h1>
        <p class="hero-meta">{{ meta }}</p>
      </div>
    </header>
    <div class="page-body">
      <div class="action-row">
        <button class="play-circle" title="Tout lire" @click="playAll">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
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
        />
      </ul>
      <p class="empty-state" :hidden="tracks.length > 0">
        Aucune piste pour l'instant.
      </p>
    </div>
  </section>
</template>
