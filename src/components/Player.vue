<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { usePlayerStore, fmtDuration } from '@/stores/player';
import { onThumbError, onThumbLoad } from '@/lib/format';
import { useLibraryStore } from '@/stores/library';
import { useStreamsStore } from '@/stores/streams';
import { usePrefsStore } from '@/stores/prefs';
import { showToast } from '@/lib/toast';
import { ICON_HEART, ICON_HEART_OUTLINE } from '@/lib/icons';
import { useVisualizer } from '@/composables/useVisualizer';
import { showLyrics } from '@/composables/useLyrics';
import { t } from '@/lib/i18n';

const player = usePlayerStore();
const lib = useLibraryStore();
const streams = useStreamsStore();
const prefs = usePrefsStore();

const audioRef = ref(null);
const audio2Ref = ref(null);

const liked = computed(() => player.isLikedCurrent);
const seekPct = computed(() => {
  if (!player.duration) return 0;
  return (player.currentTime / player.duration) * 100;
});

function onSeek(e) {
  player.seekToPct(parseFloat(e.target.value));
}

function onVolumeInput(e) {
  player.setVolume(parseFloat(e.target.value));
}

function toggleLike() {
  const trackId = player.queue[player.index];
  if (!trackId) return;
  if (typeof trackId === 'string' && trackId.startsWith('stream-')) {
    const stream = streams.get(trackId);
    if (!stream) return;
    const existing = lib.tracks.find((t) => t.ytId === stream.ytId);
    if (existing) lib.remove(existing.id);
    else lib.add({
      id: stream.ytId,
      title: stream.title,
      uploader: stream.uploader,
      duration: stream.duration,
      thumbnail: stream.thumbnail,
      url: `https://www.youtube.com/watch?v=${stream.ytId}`,
    });
  } else {
    lib.remove(trackId);
  }
}

function toggleCrossfade() {
  prefs.crossfadeEnabled = !prefs.crossfadeEnabled;
  prefs.save();
  showToast(
    prefs.crossfadeEnabled
      ? t('player.crossfade_on', prefs.crossfadeDuration)
      : t('player.crossfade_off'),
  );
}

// CSS slider fill: the inputs use --pct to render the leading colored part.
function setRangeFill(el) {
  if (!el) return;
  const min = +el.min || 0;
  const max = +el.max || 100;
  const val = +el.value;
  const pct = ((val - min) / (max - min)) * 100;
  el.style.setProperty('--pct', pct + '%');
}

onMounted(() => {
  player.bindAudio(audioRef.value, audio2Ref.value);
  setRangeFill(document.getElementById('player-volume'));
  setRangeFill(document.getElementById('player-seek'));
});

useVisualizer();

watch(
  () => seekPct.value,
  () => setRangeFill(document.getElementById('player-seek')),
);
watch(
  () => prefs.volume,
  () => setRangeFill(document.getElementById('player-volume')),
);
</script>

<template>
  <footer id="player" class="player" :hidden="!player.visible">
    <div class="player-track">
      <div class="player-thumb-wrap" :class="{ 'is-loading': player.loading }">
        <img
          id="player-thumb"
          class="player-thumb"
          :src="player.currentTrack?.thumbnail || ''"
          alt=""
          @error="onThumbError"
          @load="onThumbLoad"
        />
        <div v-if="player.loading" class="player-thumb-spinner" :aria-label="t('player.loading')"></div>
      </div>
      <div class="player-info">
        <div class="player-title">{{ player.currentTrack?.title || '' }}</div>
        <div class="player-uploader">{{ player.currentTrack?.uploader || '' }}</div>
      </div>
    </div>
    <div class="player-center">
      <div class="player-controls">
        <button
          class="icon-btn"
          id="player-shuffle"
          :class="{ active: player.shuffle }"
          :title="t('player.shuffle')"
          @click="player.toggleShuffle"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M16 3h5v5M4 20l16.2-16.2M21 16v5h-5M15 15l5.2 5.2M4 4l5 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button class="icon-btn" id="player-prev" :title="t('player.previous')" @click="player.prev">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 5v14l-12-7zM6 5h2v14H6z" />
          </svg>
        </button>
        <button
          class="icon-btn play-btn"
          id="player-toggle"
          :class="{ 'is-playing': player.playing }"
          :title="t('player.play_pause')"
          @click="player.togglePlay"
        >
          <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        </button>
        <button class="icon-btn" id="player-next" :title="t('player.next')" @click="player.next">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5 5v14l12-7zM18 5h-2v14h2z" />
          </svg>
        </button>
        <button
          class="icon-btn"
          id="player-repeat"
          :class="{ active: player.repeat !== 'off' }"
          :title="t('player.repeat', t(player.repeat === 'off' ? 'player.repeat_off' : player.repeat === 'one' ? 'player.repeat_one' : 'player.repeat_all'))"
          @click="player.cycleRepeat"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="player-progress">
        <span id="player-current">{{ fmtDuration(player.currentTime) }}</span>
        <input
          type="range"
          id="player-seek"
          min="0"
          max="100"
          step="0.1"
          :value="seekPct"
          @input="onSeek"
        />
        <span id="player-total">{{ fmtDuration(player.duration) }}</span>
      </div>
    </div>
    <div class="player-volume">
      <button
        class="icon-btn"
        id="player-like"
        :class="{ 'is-liked': liked }"
        :title="liked ? t('player.remove_from_favorites') : t('player.add_to_favorites')"
        @click="toggleLike"
        v-html="liked ? ICON_HEART : ICON_HEART_OUTLINE"
      ></button>
      <button class="icon-btn" id="player-lyrics" :title="t('player.lyrics')" @click="showLyrics">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="icon-btn"
        id="player-crossfade"
        :class="{ active: prefs.crossfadeEnabled }"
        :title="t('player.crossfade')"
        @click="toggleCrossfade"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 17h6m0 0l-3-3m3 3l-3 3M21 7h-6m0 0l3-3m-3 3l3 3"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="icon-btn"
        id="player-queue"
        :class="{ active: player.queueOpen }"
        :title="t('player.queue')"
        @click="player.toggleQueueOpen"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 6h13M3 12h13M3 18h9M17 13l4 3-4 3v-6z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="icon-btn"
        id="player-mute"
        :class="{ active: player.muted }"
        :title="t('player.mute')"
        @click="player.toggleMute"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <input
        type="range"
        id="player-volume"
        min="0"
        max="1"
        step="0.01"
        :value="prefs.volume"
        @input="onVolumeInput"
      />
    </div>
    <audio id="audio-element" ref="audioRef" preload="metadata"></audio>
    <audio id="audio-element-2" ref="audio2Ref" preload="metadata"></audio>
  </footer>
</template>
