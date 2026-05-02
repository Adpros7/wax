// Pure formatters / regex / classifiers, ported from public/js/dom.js.

export const YT_REGEX =
  /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|playlist\?list=)|youtu\.be\/)[A-Za-z0-9_\-=&?%/]+/;

export function isYoutubeUrl(url) {
  return YT_REGEX.test(url);
}

export function isPlaylistUrl(url) {
  return /[?&]list=/.test(url) && (!/[?&]v=/.test(url) || /youtube\.com\/playlist/.test(url));
}

export function isStreamId(id) {
  return typeof id === 'string' && id.startsWith('stream-');
}

export function fmtDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return wrapped;
}

// maxresdefault doesn't exist for every video. YouTube sometimes returns a
// 120×90 grey placeholder with HTTP 200 instead of a 404, so onerror alone
// isn't enough — onThumbLoad also checks naturalWidth and falls back.
export function onThumbError(e) {
  const src = e.target.src || '';
  if (src.includes('maxresdefault')) e.target.src = src.replace('maxresdefault', 'hqdefault');
  else if (src.includes('hqdefault')) e.target.src = src.replace('hqdefault', 'mqdefault');
}

export function onThumbLoad(e) {
  const img = e.target;
  const src = img.src || '';
  // naturalWidth ≤ 120 means YouTube served its generic grey placeholder.
  if (src.includes('maxresdefault') && img.naturalWidth <= 120) {
    img.src = src.replace('maxresdefault', 'hqdefault');
  }
}

export function gradientFromString(str) {
  let hash = 0;
  for (const c of str || '') hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  // Fade to var(--main) so the gradient doesn't leak into accent-bg
  // (which is dynamically set by adaptive accent and may collide).
  return `linear-gradient(180deg, hsl(${hue}, 55%, 28%) 0%, var(--main) 360px, var(--main) 100%)`;
}
