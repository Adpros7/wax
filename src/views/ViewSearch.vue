<script setup>
import { computed, ref } from 'vue';
import { useSearchStore, makeSearchHandler } from '@/stores/search';
import { useLibraryStore } from '@/stores/library';
import { useStreamsStore } from '@/stores/streams';
import { usePlayerStore } from '@/stores/player';
import { useJobsStore } from '@/stores/jobs';
import { fmtDuration, isYoutubeUrl } from '@/lib/format';
import { ICON_HEART, ICON_HEART_OUTLINE } from '@/lib/icons';
import { showToast } from '@/lib/toast';
import JobItem from '@/components/JobItem.vue';

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

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    search.inputValue = text;
    onUrlChange();
  } catch {
    showToast('Presse-papier inaccessible', 'error');
  }
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

// search-result helpers
function favForResult(r) {
  return library.tracks.some((t) => t.ytId === r.id || t.url === r.url);
}
function isStreamingResult(r) {
  return player.queue[player.index] === `stream-${r.id}`;
}
function streamPlay(r, btnEvent) {
  streams.streamSearchResult(r, btnEvent.currentTarget, player);
}
function toggleFavResult(r) {
  if (favForResult(r)) library.removeByYtId(r.id);
  else library.add(r);
}
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
        <p class="hero-meta">Tape un titre, un artiste — ou colle une URL YouTube</p>
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
          <button type="button" id="paste-btn" class="paste-btn" title="Coller" @click="pasteFromClipboard">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="3" rx="1" stroke="currentColor" stroke-width="2" />
              <path
                d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
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

      <p
        id="search-status"
        :class="['search-status', { error: search.status === 'error' }]"
        :hidden="!search.statusMessage"
      >
        {{ search.statusMessage }}
      </p>

      <ul
        id="search-results"
        class="search-results"
        :hidden="!search.results || search.results.length === 0"
      >
        <li
          v-for="r in search.results || []"
          :key="r.id"
          class="search-result"
        >
          <img class="search-result-thumb" :src="r.thumbnail" alt="" loading="lazy" />
          <div class="search-result-meta">
            <div class="search-result-title">{{ r.title }}</div>
            <div class="search-result-sub">{{ r.uploader || 'YouTube' }}</div>
          </div>
          <span class="search-result-duration">{{ fmtDuration(r.duration) }}</span>
          <button
            type="button"
            class="stream-btn"
            :class="{ 'is-playing': isStreamingResult(r) && player.playing }"
            title="Lire en streaming"
            @mouseenter="streams.prefetch(r.id)"
            @focus="streams.prefetch(r.id)"
            @click.stop.prevent="streamPlay(r, $event)"
          >
            <svg
              v-if="isStreamingResult(r) && player.playing"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <button
            type="button"
            class="add-btn fav-btn"
            :class="{ 'is-favorited': favForResult(r) }"
            :title="favForResult(r) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            :aria-label="favForResult(r) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            @click.stop.prevent="toggleFavResult(r)"
            v-html="favForResult(r) ? ICON_HEART : ICON_HEART_OUTLINE"
          ></button>
        </li>
      </ul>

      <div id="jobs-list" class="jobs-list">
        <JobItem v-for="(job, i) in jobs.items" :key="job.id + i" :job="job" />
      </div>
    </div>
  </section>
</template>
