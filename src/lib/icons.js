// Inline SVG strings — used as v-html in template-driven icon buttons that
// need to flip between two states (heart filled vs outline, play vs pause)
// without spinning up a wrapper component for each.
export const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
export const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
export const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_MINUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_HEART = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
export const ICON_HEART_OUTLINE = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="2"/></svg>';
export const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_CHART = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 21h17M7 21V11M12 21V4M17 21v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="2"/></svg>';
export const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const ICON_QUEUE_ADD = '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h13M3 18h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 15v6M16 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const ICON_SPARKLES = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M19 15l0.6 1.5L21 17l-1.4 0.5L19 19l-0.6-1.5L17 17l1.4-0.5L19 15z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

export function eqHtml(playing) {
  return `<svg class="eq${playing ? ' is-playing' : ''}" viewBox="0 0 16 14" aria-hidden="true">
    <rect x="1" y="0" width="3" height="14" rx="0.5"/>
    <rect x="6.5" y="0" width="3" height="14" rx="0.5"/>
    <rect x="12" y="0" width="3" height="14" rx="0.5"/>
  </svg>`;
}
