# CLAUDE.md — Wax codebase map

This file is for **you, future Claude**. Read it first when starting a session on this repo. It's the fastest way back into the codebase without re-discovering everything from scratch.

## TL;DR — what is this?

**Wax** is a YouTube → MP3 player with two clients on the same backend:
- `server.js` (Express) shells out to `yt-dlp` for searching, downloading, streaming. Same endpoints serve both clients.
- `src/` — desktop renderer (Vue 3 + Vite + Pinia). Wrapped by `electron/main.cjs` (forks `server.js`, opens a BrowserWindow). Packaged via `electron-builder` to `.dmg` / `.exe` / `.AppImage`.
- `flutter/` — iOS companion (Flutter 3 + Riverpod + just_audio + audio_service). Hits the same Express endpoints over the LAN. `API_BASE` is baked at build time via `--dart-define`.

The user is **Dylan**, a senior dev. Communicate concisely, in **French** (he writes in French). Confirm before destructive ops.

## Quick reference

```bash
npm run dev          # vite + electron + server, with HMR
npm run build        # vite build → dist/
npm run dist:mac     # → release/Wax-{version}.dmg
npm run dist:win     # → release/Wax-Setup-{version}.exe
node server.js       # backend only (port 3000)
```

Dev URLs: Vite at `http://localhost:5173`, Express at `http://localhost:3000`.
Vite proxies `/api/*`, `/audio/*`, `/preview-files/*` → `localhost:3000`.

Runtime deps (PATH): `yt-dlp`, `ffmpeg`. Falls back via `WAX_YT_DLP` / `WAX_FFMPEG` env vars when the Electron app bundles them.

## File map (where things live)

### Backend
- **`server.js`** (~700 lines) — Express. Single-file, no framework beyond Express. Spawns `yt-dlp` for: search (`ytsearch10:`), playlist enumeration (`--flat-playlist`), single-track stream URL extraction (`-g`), MP3 download (`-x --audio-format mp3`), Mix enumeration (`RD<videoId>` playlist), preview clips (`--download-sections`).
  - JSON storage: `library/library.json` + `library/playlists.json`. No DB.
  - Audio files: `library/audio/<id>.mp3`. Preview cache: `library/previews/<id>.mp3`.
  - Stream URL cache: in-memory Map, 5h TTL.
  - **yt-dlp concurrency limited to 3** via a semaphore (`runYtDlp`) — prevents CPU saturation when prefetching 10+ search results in parallel. Every SSE progress event is enriched with `ytdlpActive` + `ytdlpQueued` so the sidebar badge can surface global queue depth without polling.
  - SSE for download progress: `GET /api/jobs/:id/progress` streams `data: {type, progress, phase, ytdlpActive, ytdlpQueued}\n\n` lines.
  - **Thumbnail upgrade on read**: `getLibrary()` rewrites stored `mqdefault/hqdefault` URLs to `maxresdefault.jpg` on the way out. Storage isn't migrated; clients handle the 404 / placeholder fallback. New tracks (search, mix, trending, library/add) all default to `maxresdefault` directly.

### Electron
- **`electron/main.cjs`** — Forks `server.js` with env vars (`PORT=3000`, `WAX_LIBRARY_DIR=<userData>/library`, etc.). Creates `BrowserWindow` with `titleBarStyle: 'hiddenInset'` on macOS. Loads Vite URL in dev, `dist/index.html` in prod. Apps launched from Finder/LaunchServices inherit a minimal `PATH`, so the fork augments it with `/opt/homebrew/bin`, `/usr/local/bin`, etc., to make user-installed `yt-dlp` / `ffmpeg` discoverable.
- **`electron/preload.cjs`** — Exposes `window.wax = { platform, versions }` to the renderer via `contextBridge`. Currently informational only.
- The root-level `main.cjs` is a leftover from an earlier layout — not wired in (`package.json` `main` points to `electron/main.cjs`). Safe to ignore or delete.

### Mobile (`flutter/`)
Flutter 3 + Riverpod iOS app. Same backend, no mobile-specific endpoints.
- **`lib/api/api_client.dart`** — Single Dio client. Base URL injected at build time via `--dart-define=API_BASE=http://...:3000`. Helpers wrap every endpoint the desktop app uses (`/api/library`, `/api/playlists`, `/api/search`, `/api/trending`, `/api/stream/:id`, `/api/library/add`, `PATCH /api/library/:id`, etc.). `streamUrl(ytId)` and `fileUrl(filePath)` build full URLs the audio player can hit directly.
- **`lib/api/models.dart`** — `Track`, `Playlist` with `fromLibrary` / `fromSearch` factories so search hits and library rows share the same shape.
- **`lib/audio/audio_handler.dart`** — `WaxAudioHandler` extends `BaseAudioHandler`. Drives `just_audio` and exposes lock-screen / Control Center controls via `audio_service`.
- **`lib/providers.dart`** — Riverpod graph. Notable providers: `apiClientProvider`, `audioHandlerProvider`, `libraryProvider` (async), `playlistsProvider` (async + optimistic mutations), `searchQueryProvider` + `searchResultsProvider` (350 ms debounce inside the FutureProvider), `mediaItemProvider` / `playbackStateProvider` / `positionProvider` (streams from `audio_service`), `isCurrentFavoriteProvider` + `toggleCurrentFavorite(ref)` for the now-playing heart. `initAudioService(container)` runs once in `main()` before `runApp`.
- **`lib/screens/`** — Home, Library, Search, Playlists, PlaylistDetail, NowPlaying. **`lib/widgets/`** — MiniPlayer, TrackTile, TrackActions.
- **Run**: `cd flutter && flutter pub get && flutter run --dart-define=API_BASE=http://<mac-ip>:3000`. Both devices must be on the same LAN.

### Frontend (`src/`)

**Entry point**: `src/main.js` mounts `App.vue` to `#app` in `index.html` (root-level Vite entry HTML, NOT in `public/`).

**`App.vue`**: 5 views (`v-show` toggle, all kept mounted) — Search, Library, Smart, Mix, Playlist. Sidebar always visible. Player + Queue panel + ModalRoot + Toast as siblings of `<main>`.

**`src/views/`**:
- `ViewSearch.vue` — the "Rechercher" page. Single input that dispatches: YouTube URL → preview/playlist-source; otherwise → text search via `/api/search`. Heart button to add to library, stream button to play, prefetches all 10 result URLs in parallel on search.
- `ViewLibrary.vue` — "Favoris". Lists everything in `lib.tracks`. Drag-reorder enabled.
- `ViewPlaylist.vue` — single playlist details. Drag-reorder; bulk-add modal; "Tout télécharger" cascade-downloads anything not yet offline.
- `ViewMix.vue` — temporary view shown after clicking ✨ on any track. Holds a 50-track stream queue from YouTube's RD-mix; "Sauvegarder" persists it as a real playlist (downloading missing tracks in background).
- `ViewSmart.vue` — wired but no sidebar entry currently surfaces it. Renders `recent` / `top` smart playlists if `view.smartView` is set.

**`src/components/`** (reusable UI):
- `Sidebar.vue` — brand (textlogo.png) + Search / Settings nav + "Ta bibliothèque" with Favoris, smart playlists ("Récemment ajoutés", "Les plus écoutés"), and user playlists. Each playlist gets a name-hashed gradient cover when no track thumbnail is available. Drop targets: Favoris and every user playlist accept dragged tracks (stream rows from search/discover/mix included; they're silently added to the library with `liked:false` first to get a stable id). Pulsing badge surfaces `library.ytdlpStatus.active + queued` when yt-dlp is busy.
- `Player.vue` — sticky bottom bar. Audio elements (`audioRef`, `audio2Ref` for crossfade) bound to player store on mount. All transport controls + like/lyrics/crossfade/queue/mute/volume.
- `TrackRow.vue` — the most reused component. Composes track-num (with eq SVG when current) + thumb + meta + persistent offline indicator (✓ when downloaded; on hover it morphs into × to call `lib.removeDownload`) + duration + hover-only actions: heart, mix, +playlist, **rename** (✏️ via `promptModal` → `lib.renameTrack`), ⬇offline-download, **add-to-queue** (`player.addToQueue`), delete/remove. `draggable="true"` — `handleDragStart` writes both `wax/track` (rich JSON) and `text/plain` (track id) for compatibility with `useDragReorder`.
- `QueuePanel.vue` — slide-in panel from right showing `player.queue` from `index+1` onwards.
- `ModalRoot.vue` — single mounted modal that renders different variants (`confirm`, `prompt`, `lyrics`, `component`) based on `modalState.variant`. Imperatively driven via `lib/modal.js`.
- `Toast.vue` — single toast bottom-center, driven by `lib/toast.js`.
- `BulkAddBody.vue`, `AddToPlaylistBody.vue` — modal bodies.
- `SettingsBody.vue` — Settings modal content. Sections: Apparence (light/dark theme switch via `prefs.setTheme`), Couleur d'accent (auto vs presets), Égaliseur (3-band ±12 dB sliders → `setEq` from `useVisualizer` + persisted in `prefs.eq`), Bibliothèque (orphan count + "Nettoyer" → `lib.purgeOrphans`).
- `settings.js` — settings modal opener (custom because it has interactive state).

**`src/stores/`** (Pinia):
- `library.js` — `tracks`, `loading`, `search`, `libraryDownloads` (Map), `ytdlpStatus: {active, queued}` (driven by SSE — server enriches every progress event with the current semaphore counters). Actions: `fetch`, `add(r, opts)` (opts.liked default true; opts.silent skips the toast), `remove`, `removeByYtId`, `deleteTrack`, `toggleFav` (toggles `liked` flag, doesn't delete), `_setLiked` (PATCH /api/library/:id), `reorder`, `renameTrack(id, title)` (PATCH /api/library/:id with title; optimistic + rollback on error), `removeDownload(id)` (DELETE /api/library/:id/download — strips `file` but keeps the metadata row), `purgeOrphans` (deletes every track with `liked:false` not referenced by any playlist), `downloadTrack`, `_listenLibraryProgress` (SSE), `smartTracks(kind)` ('recent' = last 30 by addedAt; 'top' = top 30 by playCount). Getters: `favorites` (tracks where `liked !== false`), `filtered` (favorites + search filter), `isInLibrary(track)`, `isFavorite(track)`. **All mutations are local-first** (no full re-fetch round-trip after add/remove).
- `playlists.js` — `items`. Actions: `fetch`, `dropTrackLocally` (called by library.remove), `create`, `remove`, `rename`, `addTrack`, `addTracksBulk`, `removeTrack`, `reorder`.
- `player.js` — `queue`, `index`, `playing`, `loading` (true between `loadAndPlay()` and the first audio `playing` event), `shuffle`, `repeat`, `volume`, `currentTime`, `duration`, `audioEl`, `audio2El`. Actions: `bindAudio` (wires `play`/`pause`/`playing`/`waiting`/`error`/`timeupdate`/`ended` events; on `error` shows a toast and auto-skips after 3 s if there's another track in the queue), `playFromList`, `loadAndPlay` (also prefetches the next streamable track in queue — look-ahead), `togglePlay`, `next`, `prev`, `stop`, `seekToPct`, `setVolume`, `addToQueue(trackId)` (inserts at `index+1`, blocks duplicates with a toast), MediaSession setup, persistence (save/restore to localStorage), crossfade orchestration.
- `prefs.js` — `volume`, `crossfadeEnabled`, `crossfadeDuration`, `accentMode`, `accentColor`, `theme` ('dark' | 'light'), `eq: {bass, mid, treble}`. Persisted via `ytmp3:prefs` localStorage key. `setTheme(t)` toggles the `light` class on `documentElement` and saves; `applyTheme` is called on `load()` so the theme is reapplied at boot.
- `accent.js` — palette derivation. Functions: `extractDominantColor`, `rgbToHsl`, `hexToHsl`, `applyHsl` (sets CSS vars on `documentElement`). Actions: `applyUserAccent`, `adaptToTrack` (extracts from thumbnail).
- `view.js` — `name` ('download' | 'library' | 'playlist' | 'mix' | 'smart'), `selectedPlaylistId`, `smartView`. Actions: `switchTo`.
- `mix.js` — `tempMix` (the 50-track YouTube Mix in flight). Actions: `streamFrom` (no bulk prefetch; relies on player look-ahead), `save` (creates playlist + adds metadata-only library entries with `liked: false` + bulk-attaches them — never downloads), `close`, `playAll`.
- `search.js` — `query`, `results`, `playlistSource`, `playlistSelection`, `preview`. Drives `ViewSearch.vue`.
- `streams.js` — `entries` Map<id, virtualTrack> for ephemeral streamed tracks (those not in library). `prefetched` Set + `prefetch(videoId)` action.
- `discover.js` — `tracks`, `loading`, `seedTrack`. Action `refresh()` picks a random favorite (or library track) → calls `/api/mix/:ytId`. Falls back to `/api/trending` (YouTube's `RDCLAK5uy_ly6s4irLuZAcjEDwJmqcA_UtSipMyGgbQ` "Today's Top Hits" playlist) when the library is empty. Filters out already-favorited entries.
- `jobs.js` — `pending` Map<id, job> for download jobs in flight. `startDownload(url, hint, onReady)` + SSE listener.

**`src/composables/`**:
- `useVisualizer.js` — Web Audio API graph: `audio → bass (lowshelf 100Hz) → mid (peaking 1kHz Q=1) → treble (highshelf 3kHz) → analyser → destination`. AnalyserNode FFT 64, smoothingTimeConstant 0.55. On `player.playing` → RAF loop drives all `.eq.is-playing rect` elements via inline `transform: scaleY(...)`. Sensitivity: `minS 0.08`, `gain 1.4`, sqrt curve via `Math.pow(v, 0.55)`. Exports `setEq(bass, mid, treble)` to update the BiquadFilter gains live (called by `SettingsBody.vue`).
- `useLyrics.js` — `showLyrics` opens a lyrics modal, fetches from `/api/lyrics?artist=&title=`. Uses `guessArtistAndTitle(track)` to split YouTube titles like "Artist - Song (Slowed)".
- `useDragReorder.js` — HTML5 DnD helpers, used by track rows in library/playlist views. Sets `text/plain` to the track id; `Sidebar.vue` uses that as a fallback when `wax/track` is missing (so a row dragged with reorder semantics still works as a sidebar drop).

**`src/lib/`**:
- `api.js` — fetch wrapper, throws on non-2xx with the server's `{error}` message.
- `modal.js` — imperative modal bus (`reactive` state). Functions: `confirmModal`, `promptModal`, `openComponentModal`, `openLyricsModal`, `closeModal`, `confirmFromModal`, `setModalCloseHandler` (cross-module write to `modalState.onCancel`).
- `toast.js` — imperative toast bus (`showToast(msg, kind)`).
- `format.js` — `fmtDuration`, `debounce`, `gradientFromString` (hash-based color, fades to `var(--main)`), `eqHtml`, `YT_REGEX`, `isYoutubeUrl`, `isPlaylistUrl`, `isStreamId`, `onThumbError` / `onThumbLoad` (the maxres → hq → mq fallback chain — server upgrades stored thumbnails to `maxresdefault` on read, but YouTube sometimes serves a 120×90 grey placeholder with HTTP 200, so `onThumbLoad` checks `naturalWidth ≤ 120` and downgrades).
- `icons.js` — all SVG icon constants. Includes `ICON_EDIT` (rename), `ICON_QUEUE_ADD`, `ICON_CLOCK` (recent), `ICON_CHART` (top).

**`src/styles/style.css`** — single global stylesheet, ~1700 lines. CSS variables in `:root`:
- Layout: `--main`, `--card`, `--card-hover`, `--text`, `--text-soft`, `--text-muted`, `--border`
- Accent (dynamic, set by `applyHsl`): `--accent`, `--accent-bright`, `--accent-dark`, `--accent-soft`, `--accent-bg`, `--accent-glow`
- Typography: `--font-body` (Inter), `--font-display` (Bricolage Grotesque)
- Transitions: `--t-accent` (0.8s ease for color shifts)

The grid template `.app` is `280px 1fr` columns × `1fr auto` rows. Below 880px, sidebar moves under main as a horizontal scroller.

Drag region for window movement: `-webkit-app-region: drag` on `.brand` and `.sidebar-section.sidebar-top`. Buttons inside opt out via `no-drag`. `padding-top: 28px` on sidebar-top reserves space for macOS traffic lights (titleBarStyle: hiddenInset).

## Key flows (data flow tracing)

### Search → stream a track
1. User types in `#url-input` → `ViewSearch.vue` calls `search.handleInput()` (debounced 500ms)
2. Detects URL vs query. For query: `api('/api/search?q=...')` → results in `search.results`.
3. Each result displays: ▶ stream button + ❤ add-to-favoris + (preview button removed). Hovering the stream button calls `streams.prefetch(r.id)` which POSTs `/api/stream/:id/prefetch` (warms the URL cache).
4. User clicks ▶ → `streams.streamSearchResult(r, btn)`:
   - Generates a virtual `stream-<ytId>` track
   - Adds to `streams.entries` Map + sets `player.queue` = [streamId]
   - `player.loadAndPlay()` sets `audio.src = '/api/stream/:ytId'`
5. Server `/api/stream/:videoId` calls `getStreamUrl(videoId)` (yt-dlp -g, cached) → 302 proxy of YouTube CDN m4a stream.

### Search → add to library
1. User clicks ❤ on a search result → `library.add(r)` posts `/api/library/add` with `{ ytId, title, uploader, duration, thumbnail, url }`.
2. Server creates `track.file = null` entry in `library.json`.
3. Frontend mutates `lib.tracks.unshift(data.track)` locally — no full re-fetch.
4. Track now playable (will stream via `/api/stream/:ytId` on play since `file` is null).

### Library track → offline
1. User hovers a track → ⬇ button visible in actions
2. Click → `lib.downloadTrack(trackId)` POSTs `/api/library/:trackId/download` → server starts a yt-dlp download job, returns jobId
3. Frontend opens SSE on `/api/jobs/:jobId/progress`
4. Each `progress` event updates `lib.libraryDownloads.get(trackId).progress` → `TrackRow.vue` re-renders the persistent indicator with circular progress
5. On `ready` event: `lib.findById(trackId).file = '/audio/:trackId.mp3'` (local mutation, no fetch). Indicator becomes ✓.

### Mix from a track
1. ✨ button in `TrackRow.vue` → `mix.streamFrom(track, callback)` calls `/api/mix/:ytId`
2. Server runs `yt-dlp --flat-playlist <RD${videoId} url>` → returns up to 50 video metadata.
3. Frontend creates virtual stream tracks for all 50, populates `mix.tempMix.queueIds`, switches view to `mix`.
4. Prefetches all 50 stream URLs in parallel (server semaphore = 3).
5. User can play any track (clicks row) or "Sauvegarder" → cascades downloads + creates playlist.

### Adaptive accent
1. On `player.loadAndPlay`, after the audio element is loaded, `accent.adaptToTrack(track)` is called.
2. `extractDominantColor(track.thumbnail)` loads the thumbnail in a hidden canvas, samples 60×60 pixels, buckets RGB → most common color.
3. `applyHsl(rgbToHsl(rgb))` sets CSS vars on `documentElement.style`.
4. `--t-accent` transition (0.8s) makes the change feel smooth.
5. Skipped entirely if `prefs.accentMode === 'custom'` (user picked a fixed color in Settings).

### Découverte
1. App mount: after `library.fetch()`, calls `discover.refresh()`.
2. If favoris/library has at least one ytId, picks a random one → `GET /api/mix/:ytId` → up to 30 tracks (filtered to exclude favorites).
3. Else (cold start), `GET /api/trending` → YouTube's auto-curated "Today's Top Hits" playlist.
4. Each result is registered as a stream track in the streams store and exposed via the `discover.tracks` array.
5. `<DiscoverGrid>` renders them as a grid of cards (cover + title + uploader). Click → `player.playFromList(track.id, queueIds)`. The grid is hidden whenever the search input is non-empty.
6. The refresh button (↻) re-rolls the seed.

## Conventions / style

- **Vue**: Composition API + `<script setup>`. No Options API.
- **Stores**: Pinia, defined with `defineStore('name', { state, getters, actions })`. Action names: `add`, `remove`, `fetch`, `reorder`, `toggleFav` — short imperative verbs. `_listenSomethingProgress` prefix for SSE event handlers.
- **State mutations**: prefer **local-first** (mutate the Pinia state directly after a successful API call) over re-fetch. Only refetch when truly stale.
- **Imports**: use `@/` alias for `src/`. ES modules everywhere (no CommonJS in `src/`, only in `electron/*.cjs` and `server.js`).
- **CSS**: avoid scoped styles unless really necessary. The single global stylesheet covers everything via class selectors. Use CSS vars for theming.
- **Icons**: SVG strings in `lib/icons.js`. Inline via `v-html` in templates.
- **Modals**: imperative API via `lib/modal.js`. Don't try to mount modals declaratively — `ModalRoot.vue` handles everything. For interactive modal content (e.g. bulk-add with selection state), pass a Vue component as `componentProps` to `openComponentModal`.
- **Toasts**: `showToast(msg, kind?)` — `kind` is `'success' | 'error' | undefined`.
- **Emoji in code**: avoid in source files unless the user explicitly asks (per repo norm).
- **French in user-facing strings**, code/comments in English.

## Common tasks

### Add a new view
1. Create `src/views/ViewFoo.vue`
2. Register it in `App.vue` (`<ViewFoo v-show="currentView === 'foo'" />`)
3. Add a sidebar entry in `Sidebar.vue` (or wherever the user navigates from)
4. Update `view.switchTo` if needed (no-op — store accepts any string for `name`)

### Add a backend endpoint
1. Edit `server.js`. Add `app.METHOD('/api/...', handler)`.
2. The Vite dev proxy already covers `/api/*` so no client config needed.
3. For long-running jobs, use the existing SSE pattern (see `/api/jobs/:id/progress`).

### Add a Pinia store
1. Create `src/stores/foo.js`
2. `import { defineStore } from 'pinia'`
3. `export const useFooStore = defineStore('foo', { state, getters, actions })`
4. Use in components: `const foo = useFooStore()` — props automatically reactive.

### Debug a runtime issue
1. In dev, **DevTools is the entry point**: View → Toggle Developer Tools in Electron menu, or `Cmd+Option+I`.
2. Network tab shows `/api/*` calls.
3. Console shows Vue + Vite errors.
4. The `vue-devtools` extension can be enabled in Electron via `electron-devtools-installer` (not currently set up).

## Fragile / gotchas

- **`@distube/ytdl-core` is currently REMOVED** from the stream path. We tried it (10× faster than yt-dlp -g) but it broke when YouTube changed their format selection ("Failed to find any playable formats" / "no playable format"). yt-dlp is the only path now. If you re-add it, wrap in try/catch with quick timeout fallback.
- **yt-dlp uses `--extractor-args "youtube:player_client=android,web"`** — the `android` client is ~2.5× faster than the default `web` because it skips the SABR/sig dance. Trade-off: returns the combined mp4 (itag 18, video+audio @360p) instead of audio-only m4a; `<audio>` plays it transparently, costs ~1.5× bandwidth. yt-dlp tries `web` as fallback when android refuses.
- **Mix endpoint URL**: must be `https://www.youtube.com/watch?v=<id>&list=RD<id>` (the watch-page form). The `playlist?list=RD<id>` form returns "This playlist type is unviewable" since mid-2026.
- **Trending playlist**: hardcoded to `RDCLAK5uy_ly6s4irLuZAcjEDwJmqcA_UtSipMyGgbQ` (YouTube's "Today's Top Hits" radio). Stable URL but contents auto-rotate.
- **yt-dlp concurrency**: limited to 3 simultaneous processes via `runYtDlp` semaphore. Prefixed prefetches (10 results) queue silently — no UI feedback for the queue position. The Mix `streamFrom` no longer bulk-prefetches all 50 tracks; only the player's `loadAndPlay` look-ahead prefetches the next track in queue.
- **`createMediaElementSource` is one-shot**: once called on the audio element, the audio MUST flow through the AudioContext destination. Don't call it twice.
- **Crossfade with two audio elements**: `audio` plays the new track, `audio2` plays the outgoing one. Volumes ramp via `requestAnimationFrame` over 3 s. Make sure not to break this if you touch `Player.vue` or `player.js`.
- **MediaSession API is browser-version-sensitive**: gracefully degrades if not supported, but always test on Electron's bundled Chromium.
- **Drag-reorder uses HTML5 DnD**: reordering inside long lists can have flicker if the data is mutated mid-drag. Current implementation calls the API non-blockingly and reverts on error.
- **Modal cancel callback**: when a modal is closed via overlay/Escape, `modalState.onCancel` fires. When a modal is confirmed, `confirmFromModal` clears `onCancel` first to avoid double-resolve. Be careful if you add new modal patterns.
- **Sidebar drag region**: clickable elements inside the drag area need `-webkit-app-region: no-drag` or they swallow drag and become unclickable.
- **`liked` flag semantic**: undefined or `true` → favori; only `false` excludes from Favoris. Backward compat with rows added before the field existed.
- **Library mutation on download "ready"**: previously did a full `lib.fetch()` after each download. Now mutates `track.file = '/audio/<id>.mp3'` locally on the existing entry. Don't add another `lib.fetch()` here unless you want to nuke the local-first optimization.
- **Search → TrackRow**: search results are converted to virtual `stream-<ytId>` tracks registered in the streams store, then rendered through TrackRow. Same component path as mix/playlist tracks. Spinner / heart / mix / look-ahead all reused.
- **EQ filter chain is wired into the source path**: `useVisualizer.init()` builds `source → bass → mid → treble → analyser → destination` once. If you ever bypass the analyser you'll also bypass the EQ — keep them on the same chain.
- **Drop targets in Sidebar**: `parseDrop(event)` reads `wax/track` (rich JSON) first, then falls back to `text/plain` (track id, set by `useDragReorder`). Don't strip either or sidebar drops break for one drag origin or the other. Stream rows are silently added to the library with `liked:false` before being attached to a playlist (so playlists always reference real library ids).
- **Theme class lives on `documentElement`**: `prefs.applyTheme()` toggles `.light` on `<html>`. Light-mode CSS is keyed on `:root.light` overrides. Don't move the class to `<body>` without rewriting every override.
- **Thumbnail fallback chain**: server upgrades stored thumbs to `maxresdefault` on read. Templates that render thumbs MUST wire `@error="onThumbError"` AND `@load="onThumbLoad"` — the load handler is what catches YouTube's silent 120×90 grey placeholder (HTTP 200, no `onerror`).
- **`addToQueue` insert position**: inserts at `index+1` so the next-up slot is predictable. If the queue is empty it inserts at 0 — which means hitting "Ajouter à la queue" with no track playing primes the queue but does NOT auto-start playback.
- **Stream error auto-skip**: the audio `error` listener waits 3 s before calling `next()`. The delay exists so a transient blip doesn't skip a track the user wanted; if you shorten it, expect noisier behavior on flaky networks.

## Migration history (context for understanding the codebase)

The project went through **two major refactors**:

1. **Vanilla JS → ES modules** (early): single 2400-line `app.js` split into 19 modules under `public/js/`. Snapshot preserved in `legacy-public/` (gitignored).
2. **ES modules → Vue 3 + Vite + Electron** (later): full rewrite of the frontend to SFCs + Pinia, wrapped in Electron for `.dmg`/`.exe` distribution. Backend (`server.js`) preserved verbatim with three additive `WAX_*` env vars for prod packaging.

`MIGRATION.md` documents the module-by-module mapping from legacy to Vue.

## Active TODOs / known gaps

- `build/icon.icns` and `build/icon.ico` not committed — `dist:mac` / `dist:win` will fail until they're added.
- No code signing / notarization configured (desktop or iOS).
- No keyboard shortcut help overlay (Space play/pause + Esc close-modal exist but aren't documented in-app).
- Discover never auto-refreshes when favorites change. User must click the ↻ button on the section header.
- Mobile (Flutter) is read-mostly: no offline-download trigger, no playlist drag-reorder, no mix view yet — all those endpoints exist server-side, just not wired in the iOS UI.
- Root-level `main.cjs` is a stale duplicate of `electron/main.cjs` (not referenced by `package.json`). Should be removed.

## Communication style with Dylan

- French, casual. He says "tu" and writes informally.
- Explain decisions briefly when proposing options. Confirm before destructive changes.
- He values **performance** and **polish**: small UX issues (alignment, perceived latency, jank) get flagged.
- He often iterates: small change → review → next ask. Don't over-engineer.
- When something is broken, he describes the symptom (not always the cause). Investigate before fixing.

## Workflow: "commit et pousse" / "commit and push"

When Dylan asks to commit & push (any phrasing — "commit et pousse", "commit and push", "push", "envoie ça", etc.), do all four of these in **one** flow before pushing:

1. **Bump the version** in both `package.json` and `flutter/pubspec.yaml` (keep them in sync).
   - Default: **patch** bump (1.0.0 → 1.0.1) — bug fixes, polish, doc-only changes, refactors with no user-visible impact.
   - **Minor** bump (1.0.0 → 1.1.0) — new feature, new endpoint, new view, new public store action.
   - **Major** bump (1.x → 2.0.0) — only when Dylan asks for it explicitly, or for a breaking change he flagged.
   - For Flutter, append `+N` build code (`1.0.1+2`) — increment monotonically.
2. **Update `README.md`** if the change is user-visible (new feature, removed feature, new install/build step, new dep). Skip if it's an internal refactor or a tiny fix.
3. **Update `CLAUDE.md`** if architecture, files, stores, key flows, gotchas, or active TODOs shifted. Skip for cosmetic-only fixes.
4. **Then commit and push** in a single commit that includes the version bump + doc updates alongside the actual code change.

Don't ask permission for any of the four — just do them. If a step is genuinely a no-op (e.g. CLAUDE.md needs no change), say so in one line in the reply.

Commit message: imperative, French or English (match the codebase — recent history is mixed). Do NOT prepend `vX.Y.Z:` — the version lives in `package.json`, not in commit subjects.
