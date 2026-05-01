<script setup>
import { computed } from 'vue';
import { useMixStore } from '@/stores/mix';
import { useViewStore } from '@/stores/view';
import { useStreamsStore } from '@/stores/streams';
import { usePlayerStore } from '@/stores/player';
import TrackRow from '@/components/TrackRow.vue';

const mix = useMixStore();
const view = useViewStore();
const streams = useStreamsStore();
const player = usePlayerStore();

const tracks = computed(() => {
  if (!mix.current) return [];
  return mix.current.queueIds
    .map((id) => streams.get(id))
    .filter(Boolean);
});

const queueIds = computed(() => mix.current?.queueIds || []);
const meta = computed(() =>
  mix.current ? `${mix.current.queueIds.length} pistes · non sauvegardé` : '',
);

function playAll() {
  if (!mix.current || mix.current.queueIds.length === 0) return;
  player.queue = [...mix.current.queueIds];
  player.index = 0;
  player.loadAndPlay();
}

function save() {
  mix.save((newPlaylistId) => view.switchTo('playlist', newPlaylistId));
}

function close() {
  mix.close();
  view.switchTo('library');
}
</script>

<template>
  <section id="view-mix" class="view active">
    <header class="hero hero-mix">
      <div class="hero-content">
        <span class="eyebrow">Mix inspiré · Temporaire</span>
        <h1>{{ mix.current ? `Mix inspiré par « ${mix.current.sourceTitle} »` : 'Mix' }}</h1>
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
        <button class="secondary-btn" @click="save">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Sauvegarder
        </button>
        <button class="icon-btn round large danger" title="Fermer le mix" @click="close">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
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
    </div>
  </section>
</template>
