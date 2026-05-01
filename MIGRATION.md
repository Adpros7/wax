# Wax — Vue 3 + Vite + Electron migration

This document captures the move from the legacy single-page app (vanilla JS
modules + Express) to a modern stack that ships as `.dmg` (macOS) and
`.exe` (Windows) via Electron.

## What changed at a glance

- **Frontend** rewritten as Vue 3 (Composition API + `<script setup>` SFCs)
  with **Pinia** stores. Vite handles dev server + bundling.
- **Backend** (`server.js`) is **kept verbatim** — same Express endpoints,
  same yt-dlp/ffmpeg invocations. Three small **backward-compatible** env-var
  hooks were added so the packaged app can override paths:
  - `PORT` (already there) — the bind port
  - `WAX_LIBRARY_DIR` — overrides `<root>/library` for user data
  - `WAX_PUBLIC_DIR` — overrides `<root>/public` for the legacy static mount
  - `WAX_YT_DLP` / `WAX_FFMPEG` — point at bundled binaries
- **Electron main** (`electron/main.cjs`) forks `server.js` as a child
  process on `127.0.0.1:3000` and loads either the Vite dev URL (in dev) or
  `dist/index.html` (in prod). `preload.cjs` exposes a tiny `window.wax`
  surface for forward compat.
- The legacy `public/{app.js,index.html,js/,style.css}` were moved to
  `legacy-public/` (gitignored) for reference. `public/` now only holds the
  static brand assets (`logo.png`, `textlogo.png`).
- The pre-Vue style.css is migrated to `src/styles/style.css` **unchanged**
  (1667 lines, byte-identical). It is imported once in `src/main.js`.

## File counts

| | Files | LOC |
| --- | ---: | ---: |
| Old frontend (`public/app.js` + `public/js/*.js`) | 20 | 2568 |
| New frontend (`src/**/*.{vue,js}` + `electron/*.cjs`) | 41 | 3918 |

(The line increase is mostly Vue template syntax + the comment headers I
added in stores/composables explaining the porting decisions.)

## Mapping — old → new

### Stores (Pinia)

| Old module | New store / module |
| --- | --- |
| `public/js/state.js` (state object + loadPrefs/savePrefs) | `src/stores/prefs.js` (persisted prefs) + slices spread across the other stores |
| `public/js/library.js` (CRUD, reorder, smart views) | `src/stores/library.js` |
| `public/js/playlists.js` (CRUD, reorder, bulk add) | `src/stores/playlists.js` |
| `public/js/player.js` (queue, audio events, crossfade, MediaSession, persistence) | `src/stores/player.js` |
| `public/js/jobs.js` (download SSE) | `src/stores/jobs.js` |
| `public/js/search.js` (URL/free-text input, playlist source) | `src/stores/search.js` |
| `public/js/mix.js` (RD&lt;id&gt; mix preview + save) | `src/stores/mix.js` |
| `public/js/views.js` (view switching) | `src/stores/view.js` |
| `public/js/stream.js` (search-result streaming + prefetch) | `src/stores/streams.js` |
| `public/js/accent.js` (palette extraction + presets) | `src/stores/accent.js` (action methods) — module-level `extractDominantColor`, `ACCENT_PRESETS`, `hexToHsl`, `rgbToHsl` exported alongside |

### Composables

| Old | New |
| --- | --- |
| `public/js/visualizer.js` | `src/composables/useVisualizer.js` (auto-binds via `watch(player.playing)`) |
| `public/js/preview.js` | `src/composables/usePreview.js` |
| Lyrics fetch (in `modals.js`) | `src/composables/useLyrics.js` |
| Drag-reorder helpers (inside `trackRow.js` / `queue.js`) | `src/composables/useDragReorder.js` |

### Lib

| Old | New |
| --- | --- |
| `public/js/api.js` | `src/lib/api.js` |
| `public/js/dom.js` (helpers like `fmtDuration`, `gradientFromString`, regex) | `src/lib/format.js` |
| `public/js/icons.js` | `src/lib/icons.js` |
| `showToast` (in `dom.js`) | `src/lib/toast.js` (reactive bus) |
| `openModal/confirmModal/promptModal` (in `modals.js`) | `src/lib/modal.js` (reactive bus) |

### Components / Views

| Legacy DOM node / fn | New SFC |
| --- | --- |
| `<aside class="sidebar">` (built by `sidebar.js`) | `src/components/Sidebar.vue` |
| `<footer id="player">` + `audio.addEventListener` wiring | `src/components/Player.vue` |
| `<aside id="queue-panel">` + `queueItem` builder | `src/components/QueuePanel.vue` + `QueueItem.vue` |
| Track-list `<li>` (built by `trackRow()` in `trackRow.js`) | `src/components/TrackRow.vue` |
| `#jobs-list` + `renderJobs` | `src/components/JobItem.vue` |
| `#modal` (built by `modals.js`) | `src/components/ModalRoot.vue` |
| `#toast` | `src/components/Toast.vue` |
| `openSettings` (in `modals.js`) | `src/components/SettingsBody.vue` (+ `settings.js` opener) |
| `openAddToPlaylistModal` | `src/components/AddToPlaylistBody.vue` (+ `addToPlaylistModal.js` opener) |
| `openAddTracksToPlaylistModal` (bulk add) | `src/components/BulkAddBody.vue` |
| `<section id="view-download">` | `src/views/ViewSearch.vue` |
| `<section id="view-library">` | `src/views/ViewLibrary.vue` |
| `<section id="view-playlist">` | `src/views/ViewPlaylist.vue` |
| `<section id="view-mix">` | `src/views/ViewMix.vue` |
| `<section id="view-smart">` | `src/views/ViewSmart.vue` |

### Electron

| File | Purpose |
| --- | --- |
| `electron/main.cjs` | Spawns `server.js`, boots `BrowserWindow`, resolves bundled binaries / library dir |
| `electron/preload.cjs` | `contextBridge` shim — exposes `window.wax` (platform/versions) |
| `electron-builder.yml` | DMG (mac), NSIS (win), AppImage (linux) targets; `extraResources` block for bundling yt-dlp / ffmpeg if available under `build/bin/<os>/<arch>/` |

### Legacy snapshot

The legacy frontend lives untouched at `legacy-public/`. It's gitignored
and kept only for diff/reference; the production build does not include it.

## Running in dev

```bash
npm install
npm run dev
```

`npm run dev` uses `concurrently` to start (a) Vite at `localhost:5173` and
(b) Electron (which itself forks `server.js` at `localhost:3000`).
`wait-on` makes Electron hold until Vite is ready. Vite's dev server proxies
`/api`, `/audio`, `/preview-files` to the Express backend.

You can also run the parts independently:

```bash
npm run server   # Express only
npm run vite     # Vite only (browser at localhost:5173)
npm run electron # Electron only (assumes the others are already up)
```

The Express backend honours `PORT` (default `3000`). All other env vars
(`WAX_LIBRARY_DIR`, `WAX_PUBLIC_DIR`, `WAX_YT_DLP`, `WAX_FFMPEG`) are
optional and only used by the packaged build.

## Building production binaries

```bash
npm run build       # vite build → dist/
npm run dist:mac    # → release/Wax-<ver>-arm64.dmg + Wax-<ver>-x64.dmg
npm run dist:win    # → release/Wax Setup <ver>.exe (NSIS)
npm run dist:linux  # → release/Wax-<ver>.AppImage
```

`electron-builder` reads `electron-builder.yml`. Output lands in `release/`.

### Bundling yt-dlp / ffmpeg (optional)

To ship the binaries instead of relying on the user's PATH, drop them under:

- macOS arm64: `build/bin/mac/arm64/{yt-dlp,ffmpeg}`
- macOS x64:   `build/bin/mac/x64/{yt-dlp,ffmpeg}`
- Windows:     `build/bin/win/x64/{yt-dlp.exe,ffmpeg.exe}`
- Linux:       `build/bin/linux/x64/{yt-dlp,ffmpeg}`

`electron-builder` will copy them to `Resources/bin/` in the packaged app,
and `electron/main.cjs` will detect them and pass `WAX_YT_DLP` / `WAX_FFMPEG`
to the forked server. If the bundled binaries are absent, the app falls
back to the system `PATH` (same behaviour as today).

## Behaviour preserved (no regressions intended)

- Sidebar: Search/Settings nav, Favoris, user playlists with thumbnail or
  gradient covers.
- Search view: hero, single input that detects YT URL vs free-text, oembed
  preview, playlist enumeration with checkbox selection, free-text search
  with parallel stream prefetch, heart toggle and stream-play buttons on
  results.
- Library "Favoris": filter input, drag-reorder, full track-action toolbar
  (heart / mix / +playlist / offline-status / hover-play overlay).
- Playlist view: Tout lire / Ajouter / Télécharger tout / rename / delete,
  drag-reorder within the playlist, bulk add modal, per-row remove.
- Mix view: build 50-track stream queue, save-to-playlist with bulk
  download.
- Player: shuffle / prev / play / next / repeat, like, lyrics, crossfade
  (3 s), queue panel with reorder, mute, volume slider, sticky bottom.
  MediaSession (OS-level transport controls + position state). Persistent
  resume across reloads (queue + index + currentTime + shuffle + repeat).
- Adaptive accent: dominant color extraction from album art, applied via
  CSS variables. 8-color preset grid + auto/custom toggle in Settings.
- Modal system: confirm, prompt, generic component-body. Toast notifications.
- Keyboard: Space (play/pause), Esc (close modal).
- Visualizer: real audio-reactive 3-bar SVG driven by Web Audio frequency
  data, applied to every `.eq.is-playing` (current track row + queue).
- Skeleton loaders for the library list while the initial fetch is in
  flight.

## Known gaps / follow-ups

- **No icons in `build/`**. `electron-builder.yml` references
  `build/icon.icns` and `build/icon.ico`, which don't exist yet — the first
  `npm run dist:*` will fail until those are dropped in. (Use the existing
  `public/logo.png` as the source: `iconutil`/`png2ico`.)
- **Code signing / notarization** is not configured for macOS or Windows.
  The DMG/EXE will be unsigned; users will see Gatekeeper / SmartScreen
  warnings.
- **`useStreamsStore.map` is a plain `Map`** — mutations don't trigger
  reactive re-renders directly. This is intentional (it's a lookup, not a
  rendered list), and it matches the legacy behaviour, but if a future
  feature needs to reactively iterate streams, swap it for a Pinia
  setup-style store with a `reactive(new Map())` or replace-on-update.
- **The "smart" view (recently added / most played)** is wired up
  (`ViewSmart.vue`) but the legacy sidebar didn't expose links to it; that
  parity gap also exists in the source app. Reviewing whether to surface it
  is left to a separate task.
- **The lyrics modal** uses a single shared modal slot — opening another
  modal on top of it isn't supported (matches legacy).
- **No automated tests**. The dev workflow currently relies on
  `vite build` + `node --check` for static validation.
- **Vue Devtools** are not auto-loaded in dev. Consider adding
  `vite-plugin-vue-devtools` if you'd like the inspector.
