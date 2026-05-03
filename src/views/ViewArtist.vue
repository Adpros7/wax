<script setup>
import { computed } from 'vue';
import { useViewStore } from '@/stores/view';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { fmtDuration, gradientFromString } from '@/lib/format';
import { t } from '@/lib/i18n';
import TrackRow from '@/components/TrackRow.vue';

const view = useViewStore();
const lib = useLibraryStore();
const player = usePlayerStore();

const artistName = computed(() => view.selectedArtist || '');
const tracks = computed(() => lib.tracksByArtist(artistName.value));
const queueIds = computed(() => tracks.value.map((tr) => tr.id));
const totalDuration = computed(() =>
  tracks.value.reduce((s, tr) => s + (tr.duration || 0), 0),
);
const heroBg = computed(() =>
  artistName.value ? gradientFromString(artistName.value) : '',
);

function playAll() {
  if (tracks.value.length === 0) return;
  player.playFromList(queueIds.value[0], queueIds.value);
}
</script>

<template>
  <section id="view-artist" class="view active">
    <header class="hero hero-artist" :style="{ backgroundImage: heroBg }">
      <div class="hero-content">
        <span class="eyebrow">{{ t('artist.eyebrow') }}</span>
        <h1>{{ artistName || t('artist.eyebrow') }}</h1>
        <p class="hero-meta">
          {{ t('common.tracks', tracks.length)
          }}<span v-if="totalDuration"> · {{ fmtDuration(totalDuration) }}</span>
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
      </div>
      <ul class="track-list">
        <TrackRow
          v-for="(tr, i) in tracks"
          :key="tr.id"
          :track="tr"
          :index="i"
          :queue="queueIds"
        />
      </ul>
      <p class="empty-state" :hidden="tracks.length > 0">
        {{ t('artist.empty') }}
      </p>
    </div>
  </section>
</template>
