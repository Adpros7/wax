import { defineStore } from 'pinia';

const PREFS_KEY = 'ytmp3:prefs';

export const usePrefsStore = defineStore('prefs', {
  state: () => ({
    volume: 0.8,
    crossfadeEnabled: false,
    crossfadeDuration: 3,
    accentMode: 'auto',
    accentColor: null,
    theme: 'dark',
    eq: { bass: 0, mid: 0, treble: 0 },
  }),
  actions: {
    load() {
      try {
        const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        if (typeof p.volume === 'number') this.volume = p.volume;
        if (typeof p.crossfadeEnabled === 'boolean') this.crossfadeEnabled = p.crossfadeEnabled;
        if (p.accentMode) this.accentMode = p.accentMode;
        if (p.accentColor) this.accentColor = p.accentColor;
        if (p.theme) this.theme = p.theme;
        if (p.eq && typeof p.eq === 'object') this.eq = { ...this.eq, ...p.eq };
      } catch {}
      this.applyTheme();
    },
    save() {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
          volume: this.volume,
          crossfadeEnabled: this.crossfadeEnabled,
          accentMode: this.accentMode,
          accentColor: this.accentColor,
          theme: this.theme,
          eq: this.eq,
        }));
      } catch {}
    },
    applyTheme() {
      if (this.theme === 'light') document.documentElement.classList.add('light');
      else document.documentElement.classList.remove('light');
    },
    setTheme(t) {
      this.theme = t;
      this.applyTheme();
      this.save();
    },
  },
});
