import { defineStore } from 'pinia';
import { THEMES, DEFAULT_THEME_ID, THEME_IDS, themeById } from '@/lib/themes';
import { setLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/i18n';

const PREFS_KEY = 'ytmp3:prefs';
const LOCALE_IDS = SUPPORTED_LOCALES.map((l) => l.id);

export const usePrefsStore = defineStore('prefs', {
  state: () => ({
    volume: 0.8,
    crossfadeEnabled: false,
    crossfadeDuration: 3,
    themeId: DEFAULT_THEME_ID,
    locale: DEFAULT_LOCALE,
    eq: { bass: 0, mid: 0, treble: 0 },
  }),
  actions: {
    load() {
      try {
        const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        if (typeof p.volume === 'number') this.volume = p.volume;
        if (typeof p.crossfadeEnabled === 'boolean') this.crossfadeEnabled = p.crossfadeEnabled;
        if (typeof p.crossfadeDuration === 'number' && p.crossfadeDuration >= 1 && p.crossfadeDuration <= 12) {
          this.crossfadeDuration = p.crossfadeDuration;
        }
        if (p.locale && LOCALE_IDS.includes(p.locale)) {
          this.locale = p.locale;
        }
        if (p.themeId && THEME_IDS.includes(p.themeId)) {
          this.themeId = p.themeId;
        } else if (p.theme === 'light') {
          // Migrate the legacy crisp-white "light" theme to the soft warm
          // default — the old palette was reported as too harsh on the eyes.
          this.themeId = 'cream';
        } else if (p.theme === 'dark') {
          this.themeId = 'dark';
        }
        if (p.eq && typeof p.eq === 'object') this.eq = { ...this.eq, ...p.eq };
      } catch {}
      this.applyTheme();
      setLocale(this.locale);
    },
    save() {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
          volume: this.volume,
          crossfadeEnabled: this.crossfadeEnabled,
          crossfadeDuration: this.crossfadeDuration,
          themeId: this.themeId,
          locale: this.locale,
          eq: this.eq,
        }));
      } catch {}
    },
    applyTheme() {
      const t = themeById(this.themeId) || themeById(DEFAULT_THEME_ID);
      const root = document.documentElement;
      // Strip every previous theme-* class so switching is clean.
      for (const cls of [...root.classList]) {
        if (cls.startsWith('theme-')) root.classList.remove(cls);
      }
      root.classList.remove('light');
      root.classList.add(`theme-${t.id}`);
      if (t.kind === 'light') root.classList.add('light');
    },
    setTheme(id) {
      if (!THEME_IDS.includes(id)) return;
      this.themeId = id;
      this.applyTheme();
      this.save();
      // Re-apply accent so --accent-bg picks up the new theme kind. Avoid a
      // direct import (would create a circular dep with accent.js → prefs).
      window.dispatchEvent(new Event('wax:theme-changed'));
    },
    setLocale(loc) {
      if (!LOCALE_IDS.includes(loc)) return;
      this.locale = loc;
      setLocale(loc);
      this.save();
    },
  },
});

// Re-export so existing imports `import { THEMES } from '@/stores/prefs'`
// (if any appear later) keep working alongside `@/lib/themes`.
export { THEMES };
