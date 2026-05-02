<script setup>
// Smart playlist view (recently added / most played). Wired but not yet
// linked from the sidebar — preserved for parity with the legacy `view-smart`
// section so existing flows that switch to 'smart' keep working.
import { computed } from 'vue';
import { useViewStore } from '@/stores/view';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { t } from '@/lib/i18n';
import TrackRow from '@/components/TrackRow.vue';

const view = useViewStore();
const lib = useLibraryStore();
const player = usePlayerStore();

const name = computed(() =>
  view.smartView === 'recent' ? t('library.recently_added')
  : view.smartView === 'top' ? t('library.most_played')
  : 'Auto',
);
const tracks = computed(() => lib.smartTracks(view.smartView));
const queueIds = computed(() => tracks.value.map((tr) => tr.id));
const meta = computed(() => t('common.tracks', tracks.value.length));

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
        <span class="eyebrow">{{ t('smart.eyebrow') }}</span>
        <h1>{{ name }}</h1>
        <p class="hero-meta">{{ meta }}</p>
      </div>
    </header>
    <div class="page-body">
      <div class="action-row">
        <button class="play-circle" :title="t('playlist.play_all')" @click="playAll">
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
        {{ t('smart.empty') }}
      </p>
    </div>
  </section>
</template>
