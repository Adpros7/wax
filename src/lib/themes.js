// Theme registry. Each theme is a named surface palette.
// `kind` controls which CSS-var family applies on top:
//   - 'dark'  → only the theme-<id> class is added.
//   - 'light' → both `light` AND theme-<id> are added (the `light` class
//                  carries the inverted surface tints, modal-bg, on-accent,
//                  logo-filter, etc., shared across all light themes).
//
// `swatch` drives the preview pill in Settings. Order: [bg, card, accent].
// The accent in `swatch` is purely cosmetic for the picker — the actual app
// accent stays controlled by `prefs.accentMode` (auto-from-cover / custom hex).
export const THEMES = [
  // ---------- Dark family ----------
  { id: 'dark',        label: 'Sombre',      kind: 'dark',  swatch: ['#0d0d10', '#28282e', '#A855F7'] },
  { id: 'ardoise',     label: 'Ardoise',     kind: 'dark',  swatch: ['#15181f', '#2a2f3f', '#6366F1'] },
  { id: 'midnight',    label: 'Minuit',      kind: 'dark',  swatch: ['#0a0c14', '#1f2236', '#818cf8'] },
  { id: 'vinyle',      label: 'Vinyle',      kind: 'dark',  swatch: ['#000000', '#1a1a1c', '#f5b13a'] },
  { id: 'mocha',       label: 'Moka',        kind: 'dark',  swatch: ['#150f0c', '#2a201c', '#F59E0B'] },
  { id: 'bordeaux',    label: 'Bordeaux',    kind: 'dark',  swatch: ['#16090d', '#3d1a23', '#dc2626'] },
  { id: 'forest',      label: 'Forêt',       kind: 'dark',  swatch: ['#0d130e', '#243024', '#1DB954'] },
  { id: 'studio',      label: 'Studio',      kind: 'dark',  swatch: ['#131210', '#2a2924', '#FF6B4A'] },
  { id: 'dracula',     label: 'Dracula',     kind: 'dark',  swatch: ['#282a36', '#44475a', '#ff79c6'] },
  { id: 'nord',        label: 'Nord',        kind: 'dark',  swatch: ['#2e3440', '#434c5e', '#88c0d0'] },
  { id: 'tokyo-night', label: 'Tokyo Night', kind: 'dark',  swatch: ['#1a1b26', '#24283b', '#bb9af7'] },
  { id: 'rose-pine',   label: 'Rose Pine',   kind: 'dark',  swatch: ['#1f1d2e', '#26233a', '#eb6f92'] },
  { id: 'gruvbox',     label: 'Gruvbox',     kind: 'dark',  swatch: ['#282828', '#3c3836', '#fe8019'] },
  { id: 'neon',        label: 'Néon',        kind: 'dark',  swatch: ['#0a0514', '#1d0a31', '#EC4899'] },

  // ---------- Light family ----------
  { id: 'paper',       label: 'Papier',      kind: 'light', swatch: ['#e8e4dc', '#f7f5ef', '#6366F1'] },
  { id: 'lin',         label: 'Lin',         kind: 'light', swatch: ['#ece5d6', '#f7f3e8', '#F59E0B'] },
  { id: 'cream',       label: 'Crème',       kind: 'light', swatch: ['#ece5d4', '#fbf6e9', '#A855F7'] },
  { id: 'sable',       label: 'Sable',       kind: 'light', swatch: ['#e8d9c4', '#f5e9d8', '#FF6B4A'] },
  { id: 'peche',       label: 'Pêche',       kind: 'light', swatch: ['#f1e2d6', '#fcf2e8', '#FB7185'] },
  { id: 'mint',        label: 'Menthe',      kind: 'light', swatch: ['#dde9e2', '#f3f8f5', '#1DB954'] },
  { id: 'glacier',     label: 'Glacier',     kind: 'light', swatch: ['#dde6ee', '#f3f6fa', '#06B6D4'] },
  { id: 'lavende',     label: 'Lavande',     kind: 'light', swatch: ['#ebe5f0', '#f9f5fc', '#A855F7'] },
];

export const DEFAULT_THEME_ID = 'dark';
export const THEME_IDS = THEMES.map((t) => t.id);
export const themeById = (id) => THEMES.find((t) => t.id === id) || null;
export const darkThemes = () => THEMES.filter((t) => t.kind === 'dark');
export const lightThemes = () => THEMES.filter((t) => t.kind === 'light');
