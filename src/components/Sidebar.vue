<script setup>
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { useViewStore } from '@/stores/view';
import { ICON_HEART, ICON_NOTE } from '@/lib/icons';
import { gradientFromString } from '@/lib/format';
import { openSettings } from './settings';

const library = useLibraryStore();
const playlists = usePlaylistsStore();
const view = useViewStore();

const items = computed(() => {
  const out = [];
  // Favoris
  out.push({
    kind: 'library',
    active: view.name === 'library',
    name: 'Favoris',
    sub: `${library.tracks.length} titre${library.tracks.length > 1 ? 's' : ''}`,
    iconHtml: ICON_HEART,
    iconClass: 'liked-icon',
  });
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
  else if (item.kind === 'playlist') view.switchTo('playlist', item.id);
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
          :class="{ active: item.active }"
          @click="clickItem(item)"
        >
          <div
            class="lib-icon"
            :class="item.iconClass"
            :style="item.gradient ? { background: item.gradient } : null"
          >
            <img v-if="item.cover" :src="item.cover" alt="" loading="lazy" />
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
