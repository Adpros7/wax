<script setup>
import { computed, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { useViewStore } from '@/stores/view';
import { useStreamsStore } from '@/stores/streams';
import { ICON_HEART, ICON_NOTE, ICON_CLOCK, ICON_CHART } from '@/lib/icons';
import { gradientFromString, onThumbError, onThumbLoad } from '@/lib/format';
import { openSettings } from './settings';
import { showToast } from '@/lib/toast';

const library = useLibraryStore();
const playlists = usePlaylistsStore();
const view = useViewStore();
const streams = useStreamsStore();

const dragOverPlaylistId = ref(null);

const items = computed(() => {
  const out = [];
  // Favoris
  out.push({
    kind: 'library',
    active: view.name === 'library',
    name: 'Favoris',
    sub: `${library.favorites.length} titre${library.favorites.length > 1 ? 's' : ''}`,
    iconHtml: ICON_HEART,
    iconClass: 'liked-icon',
  });
  // Smart playlists
  const recentCount = library.smartTracks('recent').length;
  out.push({
    kind: 'smart',
    smartView: 'recent',
    active: view.name === 'smart' && view.smartView === 'recent',
    name: 'Récemment ajoutés',
    sub: `${recentCount} titre${recentCount !== 1 ? 's' : ''}`,
    iconHtml: ICON_CLOCK,
    iconClass: '',
  });
  const topCount = library.smartTracks('top').length;
  if (topCount > 0) {
    out.push({
      kind: 'smart',
      smartView: 'top',
      active: view.name === 'smart' && view.smartView === 'top',
      name: 'Les plus écoutés',
      sub: `${topCount} titre${topCount !== 1 ? 's' : ''}`,
      iconHtml: ICON_CHART,
      iconClass: '',
    });
  }
  // User playlists
  for (const pl of playlists.items) {
    const tracks = pl.trackIds
      .map((id) => library.findById(id))
      .filter(Boolean);
    const cover = tracks[0]?.thumbnail;
    out.push({
      kind: 'playlist',
      id: pl.id,
      active: view.name === 'playlist' && view.selectedPlaylistId === pl.id,
      name: pl.name,
      sub: `Playlist · ${tracks.length} titre${tracks.length > 1 ? 's' : ''}`,
      cover,
      gradient: cover ? null : gradientFromString(pl.name).replace('180deg', '135deg'),
      iconHtml: cover ? null : ICON_NOTE,
    });
  }
  return out;
});

function clickItem(item) {
  if (item.kind === 'library') view.switchTo('library');
  else if (item.kind === 'smart') view.switchTo('smart', item.smartView);
  else if (item.kind === 'playlist') view.switchTo('playlist', item.id);
}

function parseDrop(event) {
  // Try rich format first (set by TrackRow.handleDragStart),
  // fall back to text/plain (set by useDragReorder as the track ID).
  const raw = event.dataTransfer.getData('wax/track');
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const plainId = event.dataTransfer.getData('text/plain');
  if (plainId) return { id: plainId, isStream: false };
  return null;
}

async function resolveLibraryId(data, liked) {
  if (!data.isStream) return data.id;
  const st = streams.get(data.id);
  if (!st) return null;
  const added = await library.add({
    id: st.ytId, ytId: st.ytId, title: st.title, uploader: st.uploader,
    duration: st.duration, thumbnail: st.thumbnail,
    url: `https://www.youtube.com/watch?v=${st.ytId}`,
  }, { liked, silent: true });
  return added?.id ?? null;
}

async function handleDrop(event, playlistId) {
  dragOverPlaylistId.value = null;
  const data = parseDrop(event);
  if (!data) return;

  const pl = playlists.findById(playlistId);
  if (!pl) return;

  // Check duplicate before resolving stream → library (avoids unnecessary add)
  if (!data.isStream) {
    if (pl.trackIds.includes(data.id)) { showToast('Déjà dans cette playlist'); return; }
  } else {
    const existing = library.tracks.find((t) => t.ytId === data.ytId);
    if (existing && pl.trackIds.includes(existing.id)) { showToast('Déjà dans cette playlist'); return; }
  }

  const trackId = await resolveLibraryId(data, false);
  if (!trackId) return;
  await playlists.addTrack(playlistId, trackId);
  showToast('Ajouté à la playlist', 'success');
}

function onDragOver(event, item) {
  if (item.kind !== 'playlist' && item.kind !== 'library') return;
  event.dataTransfer.dropEffect = 'move';
  dragOverPlaylistId.value = item.kind === 'playlist' ? item.id : 'favs';
}

function onDragLeave(event) {
  // Only clear when leaving the <li> itself, not when entering a child.
  if (event.currentTarget.contains(event.relatedTarget)) return;
  dragOverPlaylistId.value = null;
}

function onDrop(event, item) {
  if (item.kind === 'playlist') handleDrop(event, item.id);
  else if (item.kind === 'library') handleFavDrop(event);
}

async function handleFavDrop(event) {
  dragOverPlaylistId.value = null;
  const data = parseDrop(event);
  if (!data) return;
  if (data.isStream) {
    const st = streams.get(data.id);
    if (!st) return;
    if (library.isFavorite(st)) { showToast('Déjà dans les favoris'); return; }
    library.toggleFav(st);
  } else {
    const t = library.findById(data.id);
    if (!t) return;
    if (library.isFavorite(t)) { showToast('Déjà dans les favoris'); return; }
    library._setLiked(t.id, true);
  }
}

async function createPlaylist() {
  const pl = await playlists.create();
  if (pl) view.switchTo('playlist', pl.id);
}

function selectDownload() {
  view.switchTo('download');
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-section sidebar-top">
      <div class="brand">
        <img class="logo" src="/textlogo.png" alt="Wax" />
      </div>
      <nav class="sidebar-nav">
        <a
          class="sidebar-link"
          :class="{ active: view.name === 'download' }"
          @click="selectDownload"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2.2" />
            <path d="M21 21l-4.5-4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          </svg>
          <span>Rechercher</span>
        </a>
        <a class="sidebar-link" id="settings-link" @click="openSettings">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>Paramètres</span>
        </a>
      </nav>
    </div>

    <div class="sidebar-section sidebar-library">
      <div class="sidebar-library-header">
        <button class="library-title-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18M3 12h18M3 19h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>Ta bibliothèque</span>
        </button>
        <span
          v-if="library.ytdlpStatus.active > 0 || library.ytdlpStatus.queued > 0"
          class="ytdlp-badge"
          :title="`${library.ytdlpStatus.active} en cours · ${library.ytdlpStatus.queued} en attente`"
        >
          {{ library.ytdlpStatus.active + library.ytdlpStatus.queued }}
        </span>
        <button
          class="icon-btn"
          id="create-playlist-btn"
          title="Nouvelle playlist"
          aria-label="Nouvelle playlist"
          @click="createPlaylist"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <ul class="library-items">
        <li
          v-for="(item, i) in items"
          :key="item.kind + (item.id || 'lib') + i"
          class="library-item"
          :class="{ active: item.active, 'drag-over': (item.kind === 'playlist' && dragOverPlaylistId === item.id) || (item.kind === 'library' && dragOverPlaylistId === 'favs') }"
          @click="clickItem(item)"
          @dragover.prevent="onDragOver($event, item)"
          @dragleave="onDragLeave($event)"
          @drop.prevent="onDrop($event, item)"
        >
          <div
            class="lib-icon"
            :class="item.iconClass"
            :style="item.gradient ? { background: item.gradient } : null"
          >
            <img v-if="item.cover" :src="item.cover" alt="" loading="lazy" @error="onThumbError" @load="onThumbLoad" />
            <span v-if="item.iconHtml" v-html="item.iconHtml"></span>
          </div>
          <div class="lib-text">
            <div class="lib-name">{{ item.name }}</div>
            <div class="lib-sub">{{ item.sub }}</div>
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>
