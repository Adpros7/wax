// User preferences persisted in localStorage. Mirrors the `loadPrefs` /
// `savePrefs` functions in the legacy state.js.
import { defineStore } from 'pinia';

const PREFS_KEY = 'ytmp3:prefs';

export const usePrefsStore = defineStore('prefs', {
  state: () => ({
    volume: 0.8,
    crossfadeEnabled: false,
    crossfadeDuration: 3,
    accentMode: 'auto', // 'auto' | 'custom'
    accentColor: null,  // hex
  }),
  actions: {
    load() {
      try {
        const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        if (typeof p.volume === 'number') this.volume = p.volume;
        if (typeof p.crossfadeEnabled === 'boolean') this.crossfadeEnabled = p.crossfadeEnabled;
        if (p.accentMode) this.accentMode = p.accentMode;
        if (p.accentColor) this.accentColor = p.accentColor;
      } catch {}
    },
    save() {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
          volume: this.volume,
          crossfadeEnabled: this.crossfadeEnabled,
          accentMode: this.accentMode,
          accentColor: this.accentColor,
        }));
      } catch {}
    },
  },
});
