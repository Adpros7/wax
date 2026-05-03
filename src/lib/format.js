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

// All thumbnails go through the server's `/api/cover/:ytId` endpoint, which
// already cycles maxres → hq → mq → default and caches successful hits to
// disk. If every variant fails, the endpoint returns 404 and we fall back
// to a local SVG placeholder. The client used to do that variant cycling
// itself; now it's a single hop on the server.
const PLACEHOLDER_THUMB = '/placeholder-cover.svg';

export function onThumbError(e) {
  const img = e.target;
  if (!img) return;
  // Avoid an infinite loop if the placeholder itself somehow fails. We
  // check `src` directly (not a dataset flag) because long-lived <img>
  // elements like the player thumb get a new src on every track change —
  // a sticky flag would prevent the placeholder from re-applying after
  // the user navigates to a track whose cover also fails.
  if (img.src.endsWith('placeholder-cover.svg')) return;
  img.src = PLACEHOLDER_THUMB;
}

// Kept as an exported no-op so existing `@load="onThumbLoad"` bindings
// across templates don't break. The server-side cover endpoint takes care
// of detecting and rejecting YouTube's grey placeholder, so no client-side
// post-load detection is needed anymore.
export function onThumbLoad() {}

export function gradientFromString(str) {
  let hash = 0;
  for (const c of str || '') hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  // Fade to var(--main) so the gradient doesn't leak into accent-bg
  // (which is dynamically set by adaptive accent and may collide).
  return `linear-gradient(180deg, hsl(${hue}, 55%, 28%) 0%, var(--main) 360px, var(--main) 100%)`;
}
