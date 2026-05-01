// Adaptive accent color — extract dominant color from album art and apply
// CSS variables. Maps directly from public/js/accent.js.
import { defineStore } from 'pinia';
import { usePrefsStore } from './prefs';

export const DEFAULT_ACCENT = { h: 271, s: 91, l: 65 };

export const ACCENT_PRESETS = [
  { name: 'Violet', hex: '#A855F7' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Magenta', hex: '#EC4899' },
  { name: 'Coral', hex: '#FB7185' },
  { name: 'Sunset', hex: '#FF6B4A' },
  { name: 'Or', hex: '#F59E0B' },
  { name: 'Spotify', hex: '#1DB954' },
  { name: 'Cyan', hex: '#06B6D4' },
];

export async function extractDominantColor(imgUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const size = 60;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const buckets = {};
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max < 40) continue;
          if (min > 220) continue;
          if (max - min < 20) continue;
          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
          if (!buckets[key]) buckets[key] = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
          buckets[key].count++;
          buckets[key].sumR += r;
          buckets[key].sumG += g;
          buckets[key].sumB += b;
        }
        const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
        if (!sorted.length) return resolve(null);
        const top = sorted[0];
        resolve({
          r: Math.round(top.sumR / top.count),
          g: Math.round(top.sumG / top.count),
          b: Math.round(top.sumB / top.count),
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hexToHsl(hex) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return rgbToHsl({ r, g, b });
}

function applyHsl(hsl) {
  if (!hsl) return;
  const h = hsl.h;
  const s = Math.max(hsl.s, 55);
  const root = document.documentElement.style;
  root.setProperty('--accent', `hsl(${h}, ${s}%, 60%)`);
  root.setProperty('--accent-bright', `hsl(${h}, ${Math.min(s + 8, 85)}%, 70%)`);
  root.setProperty('--accent-dark', `hsl(${h}, ${s}%, 38%)`);
  root.setProperty('--accent-soft', `hsla(${h}, ${s}%, 60%, 0.18)`);
  root.setProperty('--accent-bg', `hsl(${h}, ${Math.min(s, 55)}%, 22%)`);
  root.setProperty('--accent-glow', `hsla(${h}, ${s}%, 60%, 0.4)`);
}

export const useAccentStore = defineStore('accent', {
  actions: {
    applyUserAccent() {
      const prefs = usePrefsStore();
      if (prefs.accentMode === 'custom' && prefs.accentColor) {
        const hsl = hexToHsl(prefs.accentColor);
        if (hsl) {
          applyHsl(hsl);
          return;
        }
      }
      applyHsl(DEFAULT_ACCENT);
    },
    resetAccent() {
      this.applyUserAccent();
    },
    async adaptToTrack(track) {
      const prefs = usePrefsStore();
      if (prefs.accentMode === 'custom') return;
      if (!track || !track.thumbnail) return;
      const rgb = await extractDominantColor(track.thumbnail);
      if (rgb) applyHsl(rgbToHsl(rgb));
    },
  },
});
