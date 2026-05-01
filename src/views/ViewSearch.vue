<script setup>
import { computed, ref } from 'vue';
import { useSearchStore, makeSearchHandler } from '@/stores/search';
import { useLibraryStore } from '@/stores/library';
import { useStreamsStore } from '@/stores/streams';
import { usePlayerStore } from '@/stores/player';
import { useJobsStore } from '@/stores/jobs';
import { fmtDuration, isYoutubeUrl } from '@/lib/format';
import { showToast } from '@/lib/toast';
import JobItem from '@/components/JobItem.vue';
import TrackRow from '@/components/TrackRow.vue';
import DiscoverGrid from '@/components/DiscoverGrid.vue';

const search = useSearchStore();
const library = useLibraryStore();
const streams = useStreamsStore();
const player = usePlayerStore();
const jobs = useJobsStore();

const submitVisible = computed(() => {
  if (search.playlistSource) return true;
  if (search.preview && search.preview.title) return true;
  return false;
});

const submitLabel = computed(() => {
  if (search.playlistSource) {
    const n = search.playlistSelection.size;
    return n ? `Télécharger ${n}` : 'Télécharger';
  }
  return 'Télécharger';
});

const onUrlChange = makeSearchHandler(search);

function handleInput(e) {
  search.inputValue = e.target.value;
  onUrlChange();
}

function clearInput() {
  search.inputValue = '';
  search.clearAll();
}

async function submit() {
  const value = search.inputValue.trim();
  if (!value) return;
  if (!isYoutubeUrl(value)) {
    onUrlChange.flush();
    return;
  }
  const quality = '320';
  if (search.playlistSource) {
    const selected = search.playlistSource.tracks.filter((t) => search.playlistSelection.has(t.id));
    if (selected.length === 0) {
      showToast('Aucune piste sélectionnée', 'error');
      return;
    }
    showToast(`Lancement de ${selected.length} téléchargement${selected.length > 1 ? 's' : ''}...`);
    for (const t of selected) {
      jobs.startDownload(t.url, quality, { title: t.title });
      await new Promise((r) => setTimeout(r, 100));
    }
    search.inputValue = '';
    search.clearAll();
  } else {
    jobs.startDownload(value, quality, { title: search.preview?.title });
    search.inputValue = '';
    search.clearAll();
  }
}

// Convert each YouTube search hit into a "stream track" registered in the
// streams store, so TrackRow can render them like any other track (spinner,
// heart toggle, mix, look-ahead — all reused).
const searchTracks = computed(() => {
  if (!search.results) return [];
  return search.results.map((r) => {
    const streamId = `stream-${r.id}`;
    let entry = streams.get(streamId);
    if (!entry) {
      entry = {
        id: streamId,
        title: r.title,
        uploader: r.uploader || '',
        duration: r.duration,
        thumbnail: r.thumbnail,
        file: `/api/stream/${r.id}`,
        ytId: r.id,
        isStream: true,
      };
      streams.set(streamId, entry);
    }
    return entry;
  });
});
const searchQueueIds = computed(() => searchTracks.value.map((t) => t.id));

function selectAllPlaylist() { search.selectAllPlaylist(); }
function selectNonePlaylist() { search.selectNonePlaylist(); }

function togglePlaylistTrack(id) { search.togglePlaylistTrack(id); }
</script>

<template>
  <section id="view-download" class="view active">
    <header class="hero hero-download">
      <div class="hero-content">
        <span class="eyebrow">Recherche</span>
        <h1>Que veux-tu écouter&nbsp;?</h1>
        <p class="hero-meta">Tape un titre, un artiste</p>
      </div>
    </header>
    <div class="page-body">
      <form
        id="download-form"
        class="download-form"
        autocomplete="off"
        @submit.prevent="submit"
      >
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
            <path d="M21 21l-4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input
            type="text"
            id="url-input"
            placeholder="Chase Atlantic, Daft Punk Around the World, ou une URL..."
            :value="search.inputValue"
            @input="handleInput"
            required
          />
        </div>

        <div
          id="preview-card"
          class="preview-card"
          :hidden="!(search.preview && search.preview.title)"
        >
          <img id="preview-thumb" :src="search.preview?.thumbnail || ''" alt="" />
          <div class="preview-info">
            <div id="preview-title" class="preview-title">{{ search.preview?.title || '' }}</div>
            <div id="preview-author" class="preview-author">{{ search.preview?.author || '' }}</div>
          </div>
          <button
            type="button"
            id="preview-clear"
            class="icon-btn ghost"
            aria-label="Effacer"
            @click="clearInput"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div
          id="playlist-source"
          class="playlist-source"
          :hidden="!search.playlistSource"
        >
          <div class="playlist-source-header">
            <strong>Playlist YouTube</strong>
            <span class="muted">
              <span id="playlist-selected">{{ search.playlistSelection.size }}</span> /
              <span id="playlist-total">{{ search.playlistSource?.tracks.length || 0 }}</span>
            </span>
            <div class="batch-actions">
              <button type="button" class="link-btn" @click="selectAllPlaylist">Tout</button>
              <button type="button" class="link-btn" @click="selectNonePlaylist">Aucun</button>
            </div>
          </div>
          <ul id="playlist-source-list" class="playlist-source-list">
            <li
              v-for="t in search.playlistSource?.tracks || []"
              :key="t.id"
              @click="togglePlaylistTrack(t.id)"
            >
              <input
                type="checkbox"
                :checked="search.playlistSelection.has(t.id)"
                @click.stop="togglePlaylistTrack(t.id)"
              />
              <img :src="t.thumbnail" alt="" loading="lazy" />
              <span class="ps-title">{{ t.title }}</span>
              <span class="muted">{{ fmtDuration(t.duration) }}</span>
            </li>
          </ul>
        </div>

        <button type="submit" class="primary-btn" id="submit-btn" :hidden="!submitVisible">
          <span id="submit-label">{{ submitLabel }}</span>
        </button>
      </form>

      <ul
        class="track-list track-list-skeleton"
        v-if="search.status === 'searching'"
        aria-busy="true"
      >
        <li v-for="i in 6" :key="i" class="track track-skeleton">
          <span class="skeleton-block skel-num"></span>
          <span class="skeleton-block skel-thumb"></span>
          <span class="skeleton-block skel-title"></span>
          <span class="skeleton-block skel-indicator"></span>
          <span class="skeleton-block skel-duration"></span>
          <span class="skeleton-block skel-actions"></span>
        </li>
      </ul>
      <p
        v-else-if="search.status === 'error'"
        class="search-status error"
      >
        {{ search.statusMessage }}
      </p>

      <ul
        class="track-list"
        v-if="search.status !== 'searching' && searchTracks.length > 0"
      >
        <TrackRow
          v-for="(t, i) in searchTracks"
          :key="t.id"
          :track="t"
          :index="i"
          :queue="searchQueueIds"
        />
      </ul>

      <div id="jobs-list" class="jobs-list">
        <JobItem v-for="(job, i) in jobs.items" :key="job.id + i" :job="job" />
      </div>

      <!-- Discovery: shown only when the input is empty (no preview, no playlist source, no results). -->
      <DiscoverGrid
        v-if="!search.inputValue && !search.preview && !search.playlistSource && (!search.results || search.results.length === 0)"
      />
    </div>
  </section>
</template>
