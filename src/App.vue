<script setup>
import { onMounted, computed } from 'vue';
import Sidebar from './components/Sidebar.vue';
import Player from './components/Player.vue';
import QueuePanel from './components/QueuePanel.vue';
import ModalRoot from './components/ModalRoot.vue';
import Toast from './components/Toast.vue';
import ViewSearch from './views/ViewSearch.vue';
import ViewLibrary from './views/ViewLibrary.vue';
import ViewPlaylist from './views/ViewPlaylist.vue';
import ViewMix from './views/ViewMix.vue';
import ViewSmart from './views/ViewSmart.vue';

import { usePrefsStore } from './stores/prefs';
import { useAccentStore } from './stores/accent';
import { useLibraryStore } from './stores/library';
import { usePlaylistsStore } from './stores/playlists';
import { useViewStore } from './stores/view';
import { usePlayerStore } from './stores/player';
import { useDiscoverStore } from './stores/discover';
import { closeModal, modalState } from './lib/modal';

const prefs = usePrefsStore();
const accent = useAccentStore();
const library = useLibraryStore();
const playlists = usePlaylistsStore();
const view = useViewStore();
const player = usePlayerStore();
const discover = useDiscoverStore();

const currentView = computed(() => view.name);

onMounted(async () => {
  prefs.load();
  accent.applyUserAccent();

  // Player MediaSession (after audio elements are bound from Player.vue)
  // queued for next tick so Player has had a chance to mount.
  setTimeout(() => player.setupMediaSession(), 0);

  // Initial fetches
  await library.fetch();
  player.restorePlayerState();
  playlists.fetch();
  // Populate Découverte once the library is loaded — no-op if empty.
  discover.refresh();

  // Global keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalState.visible) {
      closeModal();
      return;
    }
    if (
      e.key === ' ' &&
      !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) &&
      player.visible
    ) {
      e.preventDefault();
      player.togglePlay();
    }
  });
});
</script>

<template>
  <div class="app">
    <Sidebar />
    <main class="main">
      <div class="content">
        <ViewSearch v-show="currentView === 'download'" />
        <ViewLibrary v-show="currentView === 'library'" />
        <ViewSmart v-show="currentView === 'smart'" />
        <ViewMix v-show="currentView === 'mix'" />
        <ViewPlaylist v-show="currentView === 'playlist'" />
      </div>
    </main>
    <Player />
    <QueuePanel />
    <ModalRoot />
    <Toast />
  </div>
</template>
