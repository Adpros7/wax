// Theme-driven accent. Each theme registered in `@/lib/themes` carries its
// own accent hex (the third entry in `swatch`); switching themes is the only
// way to change the accent. There's no longer a cover-derived "auto" mode or
// a user-picked custom color.
import { defineStore } from 'pinia';
import { themeById } from '@/lib/themes';
import { usePrefsStore } from './prefs';

export function hexToHsl(hex) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue, sat, lit = (max + min) / 2;
  if (max === min) {
    hue = sat = 0;
  } else {
    const d = max - min;
    sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      case b: hue = (r - g) / d + 4; break;
    }
    hue /= 6;
  }
  return {
    h: Math.round(hue * 360),
    s: Math.round(sat * 100),
    l: Math.round(lit * 100),
  };
}

function applyHsl(hsl) {
  if (!hsl) return;
  const h = hsl.h;
  const s = Math.max(hsl.s, 55);
  const root = document.documentElement.style;
  const isLight = document.documentElement.classList.contains('light');
  root.setProperty('--accent', `hsl(${h}, ${s}%, 60%)`);
  root.setProperty('--accent-bright', `hsl(${h}, ${Math.min(s + 8, 85)}%, 70%)`);
  root.setProperty('--accent-dark', `hsl(${h}, ${s}%, 38%)`);
  root.setProperty('--accent-soft', `hsla(${h}, ${s}%, 60%, 0.18)`);
  // Hero band: dark themes get a deep saturated band fading into near-black;
  // light themes get a pastel band fading into the warm/cool surface.
  if (isLight) {
    root.setProperty('--accent-bg', `hsl(${h}, ${Math.min(s, 38)}%, 86%)`);
    root.setProperty('--accent-glow', `hsla(${h}, ${s}%, 55%, 0.18)`);
  } else {
    root.setProperty('--accent-bg', `hsl(${h}, ${Math.min(s, 55)}%, 22%)`);
    root.setProperty('--accent-glow', `hsla(${h}, ${s}%, 60%, 0.4)`);
  }
}

export const useAccentStore = defineStore('accent', {
  actions: {
    applyThemeAccent() {
      const prefs = usePrefsStore();
      const theme = themeById(prefs.themeId);
      if (!theme) return;
      const hsl = hexToHsl(theme.swatch[2]);
      if (hsl) applyHsl(hsl);
    },
  },
});
