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

// YouTube titles follow loose conventions like "Artist - Song (Official
// Video)" — extract the artist + the cleaned song title. Used by the artist
// view + future album logic. Falls back to the channel uploader for the
// artist when no separator is found in the title.
const TITLE_CRUFT = /\s*[\[\(](?:slowed|reverb(?:ed)?|reverb|lyrics?|official|audio|video|hq|4k|hd|remaster(?:ed)?|m\/v|mv|live|acoustic|cover|extended|radio edit|version|sped[ -]?up|nightcore|8d|3d|bass boosted|visualizer|color(?:ed)? coded)[^)\]]*[\]\)]/gi;

export function parseTrackTitle(track) {
  if (!track) return { artist: '', song: '' };
  const raw = (track.title || '').trim();
  const cleaned = raw.replace(TITLE_CRUFT, '').replace(/\s+/g, ' ').trim();
  // Most YouTube music titles use " - ", " – ", " — ", or " | " between
  // the artist and the song. Match the FIRST occurrence so featuring
  // artists in the suffix stay attached to the artist column ("A ft. B - X").
  const m = cleaned.match(/^(.+?)\s*[-–—|]\s*(.+)$/);
  if (m) return { artist: m[1].trim(), song: m[2].trim() };
  return { artist: track.uploader || '', song: cleaned };
}

// Cluster artist names that differ only by suffix (TheWeekndVEVO, The Weeknd
// Official, the weeknd) into a single key — case-insensitive, alphanumerics
// only, common YouTube channel suffixes stripped. Used to match tracks under
// one canonical artist regardless of how the channel is named.
export function normalizeArtistKey(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s*[-—]\s*topic$/i, '')      // "Artist - Topic" auto-channels
    .replace(/\s*(vevo|official|music|tv|hd|records?)$/i, '')
    .replace(/[^a-z0-9]/g, '');
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
