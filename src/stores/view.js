// View state — what page is showing, and any per-page args.
import { defineStore } from 'pinia';

export const useViewStore = defineStore('view', {
  state: () => ({
    name: 'download', // 'download' | 'library' | 'playlist' | 'mix'
    selectedPlaylistId: null,
  }),
  actions: {
    switchTo(name, arg) {
      this.name = name;
      this.selectedPlaylistId = name === 'playlist' ? arg : null;
      // Scroll the main panel back to top on view change
      const main = document.querySelector('.main');
      if (main) main.scrollTop = 0;
    },
  },
});
