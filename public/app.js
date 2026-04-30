'use strict';

// ============================================================
// State
// ============================================================
const state = {
  view: 'download',
  selectedPlaylistId: null,
  smartView: null,
  library: [],
  playlists: [],
  jobs: [],
  preview: null,
  playlistSource: null,
  playlistSelection: new Set(),
  search: '',
  activeDownloads: new Map(),
  queueOpen: false,
  crossfadeEnabled: false,
  crossfadeDuration: 3,
  viz: { ctx: null, analyser: null, dataArray: null, running: false, frame: null },
  loading: { library: true, playlists: true },
  player: {
    queue: [],
    index: -1,
    playing: false,
    shuffle: false,
    repeat: 'off',
    volume: 0.8,
    muted: false,
  },
};

const PREFS_KEY = 'ytmp3:prefs';
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (typeof p.volume === 'number') state.player.volume = p.volume;
    if (typeof p.crossfadeEnabled === 'boolean') state.crossfadeEnabled = p.crossfadeEnabled;
  } catch {}
}
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      volume: state.player.volume,
      crossfadeEnabled: state.crossfadeEnabled,
    }));
  } catch {}
}

// ============================================================
// Utilities
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function fmtDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  return wrapped;
}
function showToast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + kind;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, 2800);
}

function gradientFromString(str) {
  let hash = 0;
  for (const c of str || '') hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(180deg, hsl(${hue}, 60%, 32%) 0%, transparent 100%)`;
}

const YT_REGEX = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|playlist\?list=)|youtu\.be\/)[A-Za-z0-9_\-=&?%/]+/;
function isYoutubeUrl(url) { return YT_REGEX.test(url); }
function isPlaylistUrl(url) {
  return /[?&]list=/.test(url) && (!/[?&]v=/.test(url) || /youtube\.com\/playlist/.test(url));
}

// Equalizer SVG (3 animated bars)
function eqHtml(playing) {
  return `<svg class="eq${playing ? ' is-playing' : ''}" viewBox="0 0 16 14" aria-hidden="true">
    <rect x="1" y="0" width="3" height="14" rx="0.5"/>
    <rect x="6.5" y="0" width="3" height="14" rx="0.5"/>
    <rect x="12" y="0" width="3" height="14" rx="0.5"/>
  </svg>`;
}

// Adaptive accent — extract dominant color from album art
const DEFAULT_ACCENT = { h: 271, s: 91, l: 65 };

async function extractDominantColor(imgUrl) {
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
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 200) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max < 40) continue;        // too dark
          if (min > 220) continue;        // too pale
          if (max - min < 20) continue;   // too gray
          const key = `${Math.round(r/24)}-${Math.round(g/24)}-${Math.round(b/24)}`;
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
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
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

function applyAccent(hsl) {
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

function resetAccent() { applyAccent(DEFAULT_ACCENT); }

async function adaptToTrack(track) {
  if (!track || !track.thumbnail) return;
  const rgb = await extractDominantColor(track.thumbnail);
  if (rgb) applyAccent(rgbToHsl(rgb));
}

// SVG strings
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_MINUS = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
const ICON_HEART_OUTLINE = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" stroke-width="2"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_CHART = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 21h17M7 21V11M12 21V4M17 21v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="2"/></svg>';

// ============================================================
// API
// ============================================================
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchLibrary() {
  try {
    const { tracks } = await api('/api/library');
    state.library = tracks || [];
  } finally {
    state.loading.library = false;
  }
  $('#library-count').textContent = state.library.length;
  renderSidebar();
  if (state.view === 'library') renderLibraryView();
  if (state.view === 'playlist') renderPlaylistView();
  if (state.view === 'smart') renderSmartView();
  if (state.searchResults) renderSearchResults();
  if (state.queueOpen) renderQueue();
}
async function fetchPlaylists() {
  try {
    const { playlists } = await api('/api/playlists');
    state.playlists = playlists || [];
  } finally {
    state.loading.playlists = false;
  }
  renderSidebar();
  if (state.view === 'playlist') renderPlaylistView();
}

// ============================================================
// View switching
// ============================================================
function switchView(view, arg) {
  state.view = view;
  state.selectedPlaylistId = view === 'playlist' ? arg : null;
  state.smartView = view === 'smart' ? arg : null;

  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  $$('.sidebar-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));

  if (view === 'library') renderLibraryView();
  if (view === 'playlist') renderPlaylistView();
  if (view === 'smart') renderSmartView();
  renderSidebar();

  document.querySelector('.main').scrollTop = 0;
}

function smartTracks(key) {
  if (key === 'favorites') return state.library.filter(t => t.liked);
  if (key === 'recent') return [...state.library].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 50);
  if (key === 'top') return [...state.library].filter(t => (t.playCount || 0) > 0).sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 50);
  return [];
}

function renderSmartView() {
  const labels = {
    favorites: 'Favoris',
    recent: 'Récemment ajoutées',
    top: 'Les plus écoutées',
  };
  const name = labels[state.smartView] || 'Auto';
  const tracks = smartTracks(state.smartView);

  $('#smart-name').textContent = name;
  $('#smart-meta').textContent = `${tracks.length} titre${tracks.length > 1 ? 's' : ''}`;
  $('#smart-empty').hidden = tracks.length > 0;

  const list = $('#smart-tracks');
  list.innerHTML = '';
  const queueIds = tracks.map(t => t.id);
  tracks.forEach((t, i) => list.appendChild(trackRow(t, { index: i, queue: queueIds })));
}

// ============================================================
// Sidebar
// ============================================================
function renderSidebar() {
  const items = $('#library-items');
  items.innerHTML = '';

  // Library entry
  const libEl = el('li', {
    class: 'library-item' + (state.view === 'library' ? ' active' : ''),
    onclick: () => switchView('library'),
  }, [
    el('div', { class: 'lib-icon liked-icon', html: ICON_NOTE }),
    el('div', { class: 'lib-text' }, [
      el('div', { class: 'lib-name', text: 'Toutes les pistes' }),
      el('div', { class: 'lib-sub', text: `Bibliothèque · ${state.library.length} titre${state.library.length > 1 ? 's' : ''}` }),
    ]),
  ]);
  items.appendChild(libEl);

  // Smart playlists
  const smarts = [
    { key: 'favorites', name: 'Favoris', icon: ICON_HEART, count: state.library.filter(t => t.liked).length },
    { key: 'recent', name: 'Récemment ajoutées', icon: ICON_CLOCK, count: Math.min(state.library.length, 50) },
    { key: 'top', name: 'Les plus écoutées', icon: ICON_CHART, count: state.library.filter(t => (t.playCount || 0) > 0).length },
  ];
  for (const sp of smarts) {
    items.appendChild(el('li', {
      class: 'library-item is-smart' + (state.view === 'smart' && state.smartView === sp.key ? ' active' : ''),
      onclick: () => switchView('smart', sp.key),
    }, [
      el('div', { class: 'lib-icon', html: sp.icon }),
      el('div', { class: 'lib-text' }, [
        el('div', { class: 'lib-name', text: sp.name }),
        el('div', { class: 'lib-sub', text: `Auto · ${sp.count} titre${sp.count > 1 ? 's' : ''}` }),
      ]),
    ]));
  }

  // Playlists
  for (const pl of state.playlists) {
    const tracks = pl.trackIds.map(id => state.library.find(t => t.id === id)).filter(Boolean);
    const cover = tracks[0]?.thumbnail;
    const iconEl = el('div', { class: 'lib-icon' });
    if (cover) {
      iconEl.appendChild(el('img', { src: cover, alt: '', loading: 'lazy' }));
    } else {
      iconEl.style.background = gradientFromString(pl.name).replace('180deg', '135deg');
      iconEl.innerHTML = ICON_NOTE;
    }
    items.appendChild(el('li', {
      class: 'library-item' + (state.view === 'playlist' && state.selectedPlaylistId === pl.id ? ' active' : ''),
      onclick: () => switchView('playlist', pl.id),
    }, [
      iconEl,
      el('div', { class: 'lib-text' }, [
        el('div', { class: 'lib-name', text: pl.name }),
        el('div', { class: 'lib-sub', text: `Playlist · ${tracks.length} titre${tracks.length > 1 ? 's' : ''}` }),
      ]),
    ]));
  }
}

// ============================================================
// URL preview / playlist source / search
// ============================================================
function clearInputResults() {
  state.preview = null;
  state.playlistSource = null;
  state.playlistSelection.clear();
  state.searchResults = null;
  $('#preview-card').hidden = true;
  $('#playlist-source').hidden = true;
  $('#search-results').hidden = true;
  $('#search-status').hidden = true;
  $('#submit-btn').hidden = true;
  $('#submit-label').textContent = 'Télécharger';
}

const onUrlChange = debounce(async () => {
  const value = $('#url-input').value.trim();
  clearInputResults();
  if (!value) return;

  if (isYoutubeUrl(value)) {
    if (isPlaylistUrl(value)) {
      await loadPlaylistSource(value);
      $('#submit-btn').hidden = false;
      return;
    }
    try {
      const info = await api(`/api/info?url=${encodeURIComponent(value)}`);
      state.preview = info;
      renderPreview();
      $('#submit-btn').hidden = false;
    } catch {}
    return;
  }

  // Otherwise: search
  if (value.length < 2) return;
  $('#submit-btn').hidden = true;
  $('#search-status').hidden = false;
  $('#search-status').className = 'search-status';
  $('#search-status').textContent = 'Recherche YouTube…';
  try {
    const { results } = await api(`/api/search?q=${encodeURIComponent(value)}`);
    state.searchResults = results;
    $('#search-status').hidden = true;
    renderSearchResults();
  } catch (e) {
    $('#search-status').className = 'search-status error';
    $('#search-status').textContent = 'Recherche échouée : ' + e.message;
  }
}, 500);

function renderSearchResults() {
  const ul = $('#search-results');
  ul.innerHTML = '';
  if (!state.searchResults || state.searchResults.length === 0) {
    ul.hidden = true;
    return;
  }
  ul.hidden = false;

  for (const r of state.searchResults) {
    const inLibrary = state.library.some(t => t.ytId === r.id || t.url === r.url);
    const dl = state.activeDownloads.get(r.url);

    let btnHtml, btnClass = 'ghost-btn', disabled = false;
    if (inLibrary) {
      btnHtml = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Téléchargé</span>`;
      btnClass += ' is-done';
      disabled = true;
    } else if (dl) {
      const label = dl.phase === 'converting' ? 'Conversion' :
                    dl.phase === 'starting' ? '…' :
                    `${Math.round(dl.progress)}%`;
      btnHtml = `<span>${label}</span>`;
      btnClass += ' is-loading';
      disabled = true;
    } else {
      btnHtml = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Télécharger</span>`;
    }

    const btn = el('button', {
      type: 'button',
      class: btnClass,
      disabled,
      onclick: disabled ? null : (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDownload(r.url, '320', { title: r.title });
      },
      html: btnHtml,
    });

    const previewButton = el('button', {
      type: 'button',
      class: 'preview-btn',
      'aria-label': 'Aperçu 12 s',
      title: 'Aperçu 12 s',
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); togglePreview(r.id, previewButton); },
      html: `
        <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg class="icon-stop" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
      `,
    });

    ul.appendChild(el('li', { class: 'search-result' }, [
      el('img', { class: 'search-result-thumb', src: r.thumbnail, alt: '', loading: 'lazy' }),
      el('div', { class: 'search-result-meta' }, [
        el('div', { class: 'search-result-title', text: r.title }),
        el('div', { class: 'search-result-sub', text: r.uploader || 'YouTube' }),
      ]),
      el('span', { class: 'search-result-duration', text: fmtDuration(r.duration) }),
      previewButton,
      btn,
    ]));
  }
}

function renderPreview() {
  const card = $('#preview-card');
  if (!state.preview || !state.preview.title) { card.hidden = true; return; }
  $('#preview-thumb').src = state.preview.thumbnail || '';
  $('#preview-title').textContent = state.preview.title;
  $('#preview-author').textContent = state.preview.author || '';
  card.hidden = false;
}

async function loadPlaylistSource(url) {
  try {
    showToast('Lecture de la playlist YouTube...');
    const { tracks } = await api(`/api/playlist-info?url=${encodeURIComponent(url)}`);
    state.playlistSource = { url, tracks };
    state.playlistSelection = new Set(tracks.map(t => t.id));
    renderPlaylistSource();
  } catch (e) {
    showToast('Énumération impossible : ' + e.message, 'error');
  }
}

function renderPlaylistSource() {
  const box = $('#playlist-source');
  if (!state.playlistSource) { box.hidden = true; return; }
  const { tracks } = state.playlistSource;
  const list = $('#playlist-source-list');
  list.innerHTML = '';
  for (const t of tracks) {
    const li = el('li', {
      onclick: (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = li.querySelector('input');
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
      },
    }, [
      el('input', {
        type: 'checkbox', checked: state.playlistSelection.has(t.id),
        onchange: (e) => {
          if (e.target.checked) state.playlistSelection.add(t.id);
          else state.playlistSelection.delete(t.id);
          $('#playlist-selected').textContent = state.playlistSelection.size;
          updateSubmitLabel();
        },
      }),
      el('img', { src: t.thumbnail, alt: '', loading: 'lazy' }),
      el('span', { class: 'ps-title', text: t.title }),
      el('span', { class: 'muted', text: fmtDuration(t.duration) }),
    ]);
    list.appendChild(li);
  }
  $('#playlist-selected').textContent = state.playlistSelection.size;
  $('#playlist-total').textContent = tracks.length;
  box.hidden = false;
  updateSubmitLabel();
}

function updateSubmitLabel() {
  const n = state.playlistSelection.size;
  $('#submit-label').textContent = state.playlistSource ? (n ? `Télécharger ${n}` : 'Télécharger') : 'Télécharger';
}

// ============================================================
// Download
// ============================================================
function startDownload(url, quality, hint) {
  if (state.activeDownloads.has(url)) return;
  const placeholder = {
    id: 'tmp-' + Math.random().toString(36).slice(2),
    url,
    title: hint?.title || state.preview?.title || url,
    progress: 0,
    phase: 'starting',
    status: 'pending',
  };
  state.jobs.unshift(placeholder);
  state.activeDownloads.set(url, { progress: 0, phase: 'starting', status: 'pending' });
  renderJobs();
  if (state.searchResults) renderSearchResults();

  api('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({ url, quality }),
  }).then(({ id }) => {
    placeholder.id = id;
    listenJobProgress(placeholder);
  }).catch((e) => {
    placeholder.status = 'error';
    placeholder.error = e.message;
    state.activeDownloads.delete(url);
    renderJobs();
    if (state.searchResults) renderSearchResults();
  });
}

function listenJobProgress(job) {
  const es = new EventSource(`/api/jobs/${job.id}/progress`);
  es.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'progress') {
      job.progress = data.progress;
      job.phase = data.phase;
      job.status = 'downloading';
      state.activeDownloads.set(job.url, { progress: data.progress, phase: data.phase, status: 'downloading' });
      renderJobs();
      if (state.searchResults) renderSearchResults();
    } else if (data.type === 'ready') {
      job.status = 'success';
      job.progress = 100;
      job.track = data.track;
      state.activeDownloads.delete(job.url);
      renderJobs();
      if (data.duplicate) showToast('Déjà dans la bibliothèque', 'success');
      else showToast(`Téléchargé : ${data.track.title}`, 'success');
      fetchLibrary();
      es.close();
      setTimeout(() => {
        state.jobs = state.jobs.filter(j => j !== job);
        renderJobs();
      }, 4000);
    } else if (data.type === 'error') {
      job.status = 'error';
      job.error = data.error;
      state.activeDownloads.delete(job.url);
      renderJobs();
      if (state.searchResults) renderSearchResults();
      showToast('Erreur : ' + data.error, 'error');
      es.close();
    }
  };
  es.onerror = () => { es.close(); };
}

function renderJobs() {
  const c = $('#jobs-list');
  c.innerHTML = '';
  for (const job of state.jobs) {
    const isConv = job.phase === 'converting';
    c.appendChild(el('div', { class: 'job' + (isConv ? ' is-converting' : '') }, [
      el('div', { class: 'job-head' }, [
        el('span', { class: 'job-title', text: job.title }),
        el('span', {
          class: 'job-status' + (job.status === 'error' ? ' error' : job.status === 'success' ? ' success' : ''),
          text:
            job.status === 'error' ? 'Erreur' :
            job.status === 'success' ? 'Terminé' :
            isConv ? 'Conversion' :
            job.phase === 'starting' ? 'Démarrage' :
            `${Math.round(job.progress)}%`,
        }),
      ]),
      el('div', { class: 'progress-bar' }, [
        el('div', { class: 'progress-fill', style: `width: ${job.status === 'error' ? 0 : job.progress}%` }),
      ]),
    ]));
  }
}

// ============================================================
// Library view
// ============================================================
function renderLibraryView() {
  const list = $('#library-list');
  list.innerHTML = '';
  if (state.loading.library && state.library.length === 0) {
    $('#library-empty').hidden = true;
    for (let i = 0; i < 8; i++) list.appendChild(skeletonTrackRow());
    return;
  }
  const q = state.search.toLowerCase();
  const filtered = q
    ? state.library.filter(t => t.title.toLowerCase().includes(q) || (t.uploader || '').toLowerCase().includes(q))
    : state.library;
  $('#library-empty').hidden = state.library.length > 0;
  filtered.forEach((t, i) => list.appendChild(trackRow(t, {
    index: i,
    queue: state.library.map(x => x.id),
    onReorder: (draggedId, targetId, above) => reorderLibrary(draggedId, targetId, above),
  })));
}

function skeletonTrackRow() {
  const titleW = 50 + Math.random() * 30;
  const subW = 30 + Math.random() * 25;
  return el('li', { class: 'skeleton-track' }, [
    el('span', { class: 'skeleton sk-num' }),
    el('span', { class: 'skeleton sk-thumb' }),
    el('div', { class: 'sk-meta' }, [
      el('span', { class: 'skeleton sk-title', style: { width: `${titleW}%` } }),
      el('span', { class: 'skeleton sk-sub', style: { width: `${subW}%` } }),
    ]),
    el('span', { class: 'skeleton sk-dur' }),
    el('span', { class: 'skeleton sk-actions' }),
  ]);
}

async function reorderLibrary(draggedId, targetId, above) {
  const ids = state.library.map(t => t.id).filter(id => id !== draggedId);
  const targetIdx = ids.indexOf(targetId);
  if (targetIdx === -1) return;
  const insertAt = above ? targetIdx : targetIdx + 1;
  ids.splice(insertAt, 0, draggedId);
  const byId = new Map(state.library.map(t => [t.id, t]));
  state.library = ids.map(id => byId.get(id)).filter(Boolean);
  renderLibraryView();
  renderSidebar();
  try {
    await api('/api/library/order', {
      method: 'PUT',
      body: JSON.stringify({ trackIds: ids }),
    });
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
    fetchLibrary();
  }
}

let draggedTrackId = null;

function clearDropMarkers() {
  document.querySelectorAll('.track.drop-above, .track.drop-below').forEach(el => {
    el.classList.remove('drop-above', 'drop-below');
  });
}

function trackRow(track, opts = {}) {
  const isCurrent = state.player.queue[state.player.index] === track.id;
  const isPlaying = isCurrent && state.player.playing;
  const queueIds = opts.queue || state.library.map(t => t.id);
  const playThis = () => {
    if (isCurrent) togglePlay();
    else playFromList(track.id, queueIds);
  };

  const numEl = el('div', { class: 'track-num' }, [
    isCurrent
      ? el('div', { class: 'track-num-eq', html: eqHtml(state.player.playing) })
      : el('span', { class: 'track-num-default', text: opts.index != null ? String(opts.index + 1) : '' }),
    el('button', {
      class: 'track-num-action',
      onclick: (e) => { e.stopPropagation(); playThis(); },
      'aria-label': 'Lire',
      html: isPlaying ? ICON_PAUSE : ICON_PLAY,
    }),
  ]);

  const row = el('li', {
    class: 'track' + (isCurrent ? ' is-playing' : ''),
    'data-id': track.id,
    ondblclick: playThis,
  }, [
    numEl,
    el('img', { class: 'track-thumb', src: track.thumbnail || '', alt: '', loading: 'lazy' }),
    el('div', { class: 'track-meta' }, [
      el('div', { class: 'track-title', text: track.title }),
      el('div', { class: 'track-sub', text: track.uploader || '' }),
    ]),
    el('span', { class: 'track-duration', text: fmtDuration(track.duration) }),
    el('div', { class: 'track-actions' }, [
      el('button', {
        class: 'icon-btn like-btn' + (track.liked ? ' is-liked' : ''),
        title: track.liked ? 'Retirer des favoris' : 'Ajouter aux favoris',
        onclick: (e) => { e.stopPropagation(); toggleLike(track.id); },
        html: track.liked ? ICON_HEART : ICON_HEART_OUTLINE,
      }),
      el('button', {
        class: 'icon-btn', title: 'Ajouter à une playlist',
        onclick: (e) => { e.stopPropagation(); openAddToPlaylistModal(track.id); },
        html: ICON_PLUS,
      }),
      el('a', {
        class: 'icon-btn', title: 'Télécharger',
        href: track.file, download: `${track.title}.mp3`,
        onclick: (e) => e.stopPropagation(),
        html: ICON_DOWNLOAD,
      }),
      opts.removeFromPlaylist
        ? el('button', {
            class: 'icon-btn danger', title: 'Retirer',
            onclick: (e) => { e.stopPropagation(); opts.removeFromPlaylist(track.id); },
            html: ICON_MINUS,
          })
        : el('button', {
            class: 'icon-btn danger', title: 'Supprimer',
            onclick: (e) => { e.stopPropagation(); deleteTrack(track.id); },
            html: ICON_TRASH,
          }),
    ]),
  ]);

  if (opts.onReorder) {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', (e) => {
      draggedTrackId = track.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', track.id); } catch {}
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      clearDropMarkers();
      draggedTrackId = null;
    });
    row.addEventListener('dragover', (e) => {
      if (!draggedTrackId || draggedTrackId === track.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      clearDropMarkers();
      row.classList.add(above ? 'drop-above' : 'drop-below');
    });
    row.addEventListener('dragleave', (e) => {
      // Only clear if leaving the row entirely (not just hovering a child)
      if (e.relatedTarget && row.contains(e.relatedTarget)) return;
      row.classList.remove('drop-above', 'drop-below');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!draggedTrackId || draggedTrackId === track.id) return;
      const rect = row.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      const dragged = draggedTrackId;
      clearDropMarkers();
      draggedTrackId = null;
      opts.onReorder(dragged, track.id, above);
    });
  }

  return row;
}

async function deleteTrack(id) {
  const track = state.library.find(t => t.id === id);
  const ok = await confirmModal({
    title: 'Supprimer cette piste ?',
    message: track ? `« ${track.title} » sera retirée de ta bibliothèque et de toutes les playlists. Le fichier MP3 sera supprimé.` : 'Le fichier sera retiré de ta bibliothèque.',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/library/${id}`, { method: 'DELETE' });
    if (state.player.queue.includes(id)) {
      const wasPlaying = state.player.queue[state.player.index] === id;
      state.player.queue = state.player.queue.filter(qid => qid !== id);
      if (wasPlaying) stopPlayer();
    }
    await fetchLibrary();
    await fetchPlaylists();
    showToast('Piste supprimée', 'success');
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ============================================================
// Playlist view
// ============================================================
function renderPlaylistView() {
  const pl = state.playlists.find(p => p.id === state.selectedPlaylistId);
  if (!pl) { switchView('library'); return; }

  $('#hero-playlist').style.backgroundImage = gradientFromString(pl.name);
  $('#pl-detail-name').textContent = pl.name;

  const tracks = pl.trackIds.map(id => state.library.find(t => t.id === id)).filter(Boolean);
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  $('#pl-detail-meta').textContent = `${tracks.length} titre${tracks.length > 1 ? 's' : ''}` + (totalDuration ? ` · ${fmtDuration(totalDuration)}` : '');

  const list = $('#pl-detail-tracks');
  list.innerHTML = '';
  $('#pl-detail-empty').hidden = tracks.length > 0;

  const queueIds = tracks.map(t => t.id);
  tracks.forEach((t, i) => list.appendChild(trackRow(t, {
    index: i,
    queue: queueIds,
    removeFromPlaylist: async (trackId) => {
      try {
        await api(`/api/playlists/${pl.id}/tracks/${trackId}`, { method: 'DELETE' });
        await fetchPlaylists();
      } catch (e) { showToast(e.message, 'error'); }
    },
    onReorder: (draggedId, targetId, above) => reorderPlaylistTracks(pl.id, draggedId, targetId, above),
  })));
}

async function reorderPlaylistTracks(playlistId, draggedId, targetId, above) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  const ids = pl.trackIds.filter(id => id !== draggedId);
  const targetIdx = ids.indexOf(targetId);
  if (targetIdx === -1) return;
  const insertAt = above ? targetIdx : targetIdx + 1;
  ids.splice(insertAt, 0, draggedId);
  pl.trackIds = ids;
  renderPlaylistView();
  renderSidebar();
  try {
    await api(`/api/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify({ trackIds: ids }),
    });
  } catch (e) {
    showToast('Erreur réorganisation : ' + e.message, 'error');
    fetchPlaylists();
  }
}

async function createPlaylist() {
  const name = await promptModal({
    title: 'Nouvelle playlist',
    placeholder: 'Mes pépites',
    confirmLabel: 'Créer',
  });
  if (!name) return;
  try {
    const { playlist } = await api('/api/playlists', { method: 'POST', body: JSON.stringify({ name }) });
    await fetchPlaylists();
    showToast('Playlist créée', 'success');
    switchView('playlist', playlist.id);
  } catch (e) { showToast(e.message, 'error'); }
}

async function deletePlaylist(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  const ok = await confirmModal({
    title: `Supprimer « ${pl.name} » ?`,
    message: 'Les pistes resteront dans ta bibliothèque, seule la playlist sera supprimée.',
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/api/playlists/${id}`, { method: 'DELETE' });
    state.selectedPlaylistId = null;
    await fetchPlaylists();
    switchView('library');
    showToast('Playlist supprimée', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function renamePlaylist(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  const name = await promptModal({
    title: 'Renommer la playlist',
    defaultValue: pl.name,
    confirmLabel: 'Renommer',
  });
  if (!name) return;
  try {
    await api(`/api/playlists/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
    await fetchPlaylists();
    showToast('Playlist renommée', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

function openAddTracksToPlaylistModal(playlistId) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;

  const available = state.library.filter(t => !pl.trackIds.includes(t.id));
  if (available.length === 0) {
    showToast('Toutes tes pistes sont déjà ici', 'success');
    return;
  }

  const selection = new Set();
  let filter = '';
  const wrap = el('div', { class: 'bulk-wrap' });
  const list = el('ul', { class: 'bulk-track-list' });
  const counter = el('span', { class: 'muted' });
  const search = el('input', {
    type: 'text',
    class: 'bulk-search',
    placeholder: 'Filtrer la bibliothèque...',
    oninput: (e) => { filter = e.target.value.toLowerCase(); renderList(); },
  });
  const selectAll = el('button', { type: 'button', class: 'link-btn', text: 'Tout', onclick: () => {
    visibleTracks().forEach(t => selection.add(t.id));
    renderList();
  }});
  const selectNone = el('button', { type: 'button', class: 'link-btn', text: 'Aucun', onclick: () => {
    visibleTracks().forEach(t => selection.delete(t.id));
    renderList();
  }});

  const header = el('div', { class: 'bulk-header' }, [
    search,
    selectAll,
    selectNone,
  ]);
  const subheader = el('div', { class: 'bulk-header', style: { borderBottom: 'none', paddingBottom: '0' } }, [counter]);

  function visibleTracks() {
    if (!filter) return available;
    return available.filter(t =>
      t.title.toLowerCase().includes(filter) ||
      (t.uploader || '').toLowerCase().includes(filter)
    );
  }

  function updateCounter() {
    counter.textContent = `${selection.size} sélectionnée${selection.size > 1 ? 's' : ''} sur ${available.length}`;
    const btn = $('#modal-confirm');
    btn.disabled = selection.size === 0;
    btn.textContent = selection.size === 0 ? 'Ajouter' : `Ajouter ${selection.size}`;
  }

  function renderList() {
    list.innerHTML = '';
    const tracks = visibleTracks();
    if (tracks.length === 0) {
      list.appendChild(el('p', { class: 'empty-state', text: 'Aucun résultat' }));
      updateCounter();
      return;
    }
    for (const t of tracks) {
      const checked = selection.has(t.id);
      const li = el('li', {
        class: 'bulk-track-item',
        onclick: (e) => {
          if (e.target.tagName === 'INPUT') return;
          if (selection.has(t.id)) selection.delete(t.id);
          else selection.add(t.id);
          renderList();
        },
      }, [
        el('input', {
          type: 'checkbox', checked,
          onchange: (e) => {
            if (e.target.checked) selection.add(t.id);
            else selection.delete(t.id);
            updateCounter();
          },
        }),
        el('img', { src: t.thumbnail || '', alt: '', loading: 'lazy' }),
        el('div', { class: 'bulk-track-meta' }, [
          el('div', { class: 'bulk-track-title', text: t.title }),
          el('div', { class: 'bulk-track-sub', text: t.uploader || '' }),
        ]),
        el('span', { class: 'bulk-track-duration', text: fmtDuration(t.duration) }),
      ]);
      list.appendChild(li);
    }
    updateCounter();
  }

  wrap.appendChild(header);
  wrap.appendChild(subheader);
  wrap.appendChild(list);

  openModal({
    title: `Ajouter à « ${pl.name} »`,
    body: wrap,
    confirmLabel: 'Ajouter',
    wide: true,
    onConfirm: async () => {
      if (selection.size === 0) return;
      try {
        await api(`/api/playlists/${playlistId}/tracks/bulk`, {
          method: 'POST',
          body: JSON.stringify({ trackIds: Array.from(selection) }),
        });
        await fetchPlaylists();
        showToast(`${selection.size} piste${selection.size > 1 ? 's ajoutées' : ' ajoutée'}`, 'success');
        modalCloseHandler = null;
        closeModal();
      } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
    },
  });

  renderList();
  setTimeout(() => search.focus(), 50);
}

function openAddToPlaylistModal(trackId) {
  const list = el('div', { class: 'modal-pl-list' });
  if (state.playlists.length === 0) {
    list.appendChild(el('p', { class: 'empty-state', text: 'Aucune playlist. Crée-en une depuis la sidebar (icône +).' }));
  }
  for (const pl of state.playlists) {
    const inPl = pl.trackIds.includes(trackId);
    list.appendChild(el('div', {
      class: 'modal-pl-item',
      onclick: async () => {
        if (inPl) { showToast('Déjà dans cette playlist'); return; }
        try {
          await api(`/api/playlists/${pl.id}/tracks`, { method: 'POST', body: JSON.stringify({ trackId }) });
          await fetchPlaylists();
          showToast(`Ajouté à « ${pl.name} »`, 'success');
          closeModal();
        } catch (e) { showToast(e.message, 'error'); }
      },
    }, [
      el('span', { text: pl.name }),
      el('span', { class: 'pl-mini-count', text: inPl ? 'Déjà ajouté' : `${pl.trackIds.length} titre${pl.trackIds.length > 1 ? 's' : ''}` }),
    ]));
  }
  openModal({ title: 'Ajouter à une playlist', body: list });
}

// ============================================================
// Modal
// ============================================================
let modalCloseHandler = null;

function openModal({ title, body, confirmLabel, onConfirm, onClose, danger, wide }) {
  modalCloseHandler = onClose || null;
  document.querySelector('.modal-content').classList.toggle('wide', !!wide);
  $('#modal-title').textContent = title;
  const bodyEl = $('#modal-body');
  bodyEl.innerHTML = '';
  bodyEl.appendChild(typeof body === 'string' ? document.createTextNode(body) : body);
  const confirmBtn = $('#modal-confirm');
  if (onConfirm) {
    confirmBtn.hidden = false;
    confirmBtn.textContent = confirmLabel || 'OK';
    confirmBtn.className = 'primary-btn' + (danger ? ' danger' : '');
    confirmBtn.onclick = onConfirm;
  } else {
    confirmBtn.hidden = true;
  }
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
  const h = modalCloseHandler;
  modalCloseHandler = null;
  if (h) h();
}

function confirmModal({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    openModal({
      title,
      body: el('p', { class: 'modal-message', text: message }),
      confirmLabel,
      danger,
      onConfirm: () => { finish(true); modalCloseHandler = null; closeModal(); },
      onClose: () => finish(false),
    });
  });
}

function promptModal({ title, label, defaultValue = '', placeholder = '', confirmLabel = 'OK' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    const wrap = el('div');
    if (label) wrap.appendChild(el('p', { class: 'modal-message', text: label, style: { marginBottom: '12px' } }));
    const input = el('input', { type: 'text', value: defaultValue, placeholder, maxlength: '100' });
    wrap.appendChild(input);
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      finish(v);
      modalCloseHandler = null;
      closeModal();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    openModal({
      title,
      body: wrap,
      confirmLabel,
      onConfirm: submit,
      onClose: () => finish(null),
    });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

// ============================================================
// Preview audio (search result snippets)
// ============================================================
let previewAudio = null;
let previewBtn = null;

function stopPreview() {
  if (previewAudio) {
    try { previewAudio.pause(); } catch {}
    previewAudio = null;
  }
  if (previewBtn) {
    previewBtn.classList.remove('is-playing', 'is-loading');
    previewBtn = null;
  }
}

async function togglePreview(videoId, btn) {
  // Same button → stop
  if (previewBtn === btn) { stopPreview(); return; }

  // Different button → swap
  stopPreview();
  if (audio && !audio.paused) audio.pause();

  previewBtn = btn;
  btn.classList.add('is-loading');

  try {
    const { url } = await api(`/api/preview/${videoId}`);
    if (previewBtn !== btn) return;
    previewAudio = new Audio(url);
    previewAudio.volume = state.player.volume * 0.7;
    previewAudio.addEventListener('ended', () => {
      if (previewBtn === btn) { btn.classList.remove('is-playing'); previewBtn = null; }
      previewAudio = null;
    });
    previewAudio.addEventListener('error', () => {
      if (previewBtn === btn) { btn.classList.remove('is-playing', 'is-loading'); previewBtn = null; }
      previewAudio = null;
      showToast('Aperçu illisible', 'error');
    });
    await previewAudio.play();
    btn.classList.remove('is-loading');
    btn.classList.add('is-playing');
  } catch (e) {
    if (previewBtn === btn) { btn.classList.remove('is-loading'); previewBtn = null; }
    showToast('Aperçu indisponible', 'error');
  }
}

// ============================================================
// Player
// ============================================================
const audio = $('#audio-element');

function playFromList(trackId, queue) {
  const idx = queue.indexOf(trackId);
  state.player.queue = [...queue];
  state.player.index = idx >= 0 ? idx : 0;
  loadAndPlay();
}

function loadAndPlay() {
  const trackId = state.player.queue[state.player.index];
  const track = state.library.find(t => t.id === trackId);
  if (!track) return;
  stopPreview();
  if (crossfading) {
    try { audio2.pause(); audio2.removeAttribute('src'); } catch {}
    crossfading = false;
  }
  $('#player').hidden = false;
  $('#player-thumb').src = track.thumbnail || '';
  $('#player-title').textContent = track.title;
  $('#player-uploader').textContent = track.uploader || '';
  audio.src = track.file;
  audio.volume = state.player.muted ? 0 : state.player.volume;
  updateRangeFill($('#player-volume'));
  audio.play().catch(() => {});
  adaptToTrack(track);
  rerenderPlayingMarkers();
  updatePlayerLike();
  updateMediaMetadata(track);
  savePlayerState();
  playCountedFor = null;
  if (state.queueOpen) renderQueue();
}

function rerenderPlayingMarkers() {
  if (state.view === 'library') renderLibraryView();
  if (state.view === 'playlist') renderPlaylistView();
}

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) audio.play();
  else audio.pause();
}

function nextTrack() {
  if (state.player.queue.length === 0) return;
  if (state.player.shuffle) {
    state.player.index = Math.floor(Math.random() * state.player.queue.length);
  } else {
    state.player.index = (state.player.index + 1) % state.player.queue.length;
  }
  loadAndPlay();
}

function prevTrack() {
  if (state.player.queue.length === 0) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  state.player.index = (state.player.index - 1 + state.player.queue.length) % state.player.queue.length;
  loadAndPlay();
}

function stopPlayer() {
  audio.pause();
  audio.src = '';
  state.player.playing = false;
  $('#player').hidden = true;
  resetAccent();
  rerenderPlayingMarkers();
}

function updateRangeFill(input) {
  const min = +input.min || 0;
  const max = +input.max || 100;
  const val = +input.value;
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--pct', pct + '%');
}

audio.addEventListener('play', () => {
  state.player.playing = true;
  $('#player-toggle').classList.add('is-playing');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  rerenderPlayingMarkers();
  if (state.queueOpen) renderQueue();
  startVisualizer();
  savePlayerState();
});
audio.addEventListener('pause', () => {
  state.player.playing = false;
  $('#player-toggle').classList.remove('is-playing');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  rerenderPlayingMarkers();
  if (state.queueOpen) renderQueue();
  stopVisualizer();
  savePlayerState();
});
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  const seek = $('#player-seek');
  seek.value = pct;
  updateRangeFill(seek);
  $('#player-current').textContent = fmtDuration(audio.currentTime);
  $('#player-total').textContent = fmtDuration(audio.duration);
  trackPlayProgress();
  maybeCrossfade();
  updateMediaPosition();
  savePlayerState();
});
audio.addEventListener('ended', () => {
  if (crossfading) return;
  if (state.player.repeat === 'one') {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  if (state.player.index >= state.player.queue.length - 1 && state.player.repeat !== 'all' && !state.player.shuffle) {
    state.player.playing = false;
    return;
  }
  nextTrack();
});

// ============================================================
// Likes / play count tracking
// ============================================================
async function toggleLike(trackId) {
  const track = state.library.find(t => t.id === trackId);
  if (!track) return;
  const newLiked = !track.liked;
  track.liked = newLiked;
  if (state.view === 'library') renderLibraryView();
  if (state.view === 'playlist') renderPlaylistView();
  if (state.view === 'smart') renderSmartView();
  renderSidebar();
  updatePlayerLike();
  try {
    await api(`/api/library/${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({ liked: newLiked }),
    });
  } catch (e) {
    track.liked = !newLiked;
    showToast('Erreur favoris', 'error');
  }
}

function updatePlayerLike() {
  const trackId = state.player.queue[state.player.index];
  const track = state.library.find(t => t.id === trackId);
  const btn = $('#player-like');
  if (!btn) return;
  btn.hidden = !track;
  if (track) {
    btn.classList.toggle('is-liked', !!track.liked);
    btn.title = track.liked ? 'Retirer des favoris' : 'Ajouter aux favoris';
    btn.innerHTML = track.liked ? ICON_HEART : ICON_HEART_OUTLINE;
  }
}

let playCountedFor = null;
function trackPlayProgress() {
  const trackId = state.player.queue[state.player.index];
  if (!trackId) return;
  if (audio.currentTime > 30 && playCountedFor !== trackId) {
    playCountedFor = trackId;
    api(`/api/library/${trackId}/play`, { method: 'POST' }).then(() => {
      const t = state.library.find(t => t.id === trackId);
      if (t) { t.playCount = (t.playCount || 0) + 1; t.lastPlayedAt = Date.now(); }
      renderSidebar();
    }).catch(() => {});
  }
}

// ============================================================
// Queue panel
// ============================================================
function renderQueue() {
  const current = $('#queue-current');
  const upcoming = $('#queue-upcoming');
  current.innerHTML = '';
  upcoming.innerHTML = '';

  const queue = state.player.queue;
  const idx = state.player.index;

  if (idx >= 0 && idx < queue.length) {
    const t = state.library.find(t => t.id === queue[idx]);
    if (t) current.appendChild(queueItem(t, idx, true));
  }

  const upcomingTracks = queue.slice(idx + 1)
    .map((id, i) => ({ track: state.library.find(t => t.id === id), qIdx: idx + 1 + i }))
    .filter(x => x.track);

  $('#queue-empty').hidden = upcomingTracks.length > 0;
  upcomingTracks.forEach(({ track, qIdx }) => upcoming.appendChild(queueItem(track, qIdx, false)));
}

function queueItem(track, qIdx, isCurrent) {
  const li = el('li', {
    class: 'queue-item' + (isCurrent ? ' is-current' : ''),
    'data-qidx': qIdx,
    onclick: () => {
      if (isCurrent) return;
      state.player.index = qIdx;
      loadAndPlay();
      renderQueue();
    },
  }, [
    el('img', { class: 'qi-thumb', src: track.thumbnail || '', alt: '', loading: 'lazy' }),
    el('div', { class: 'qi-meta' }, [
      el('div', { class: 'qi-title', text: track.title }),
      el('div', { class: 'qi-sub', text: track.uploader || '' }),
    ]),
    isCurrent ? el('span', { class: 'eq', html: '<svg viewBox="0 0 16 14"><rect x="1" y="0" width="3" height="14" rx="0.5"/><rect x="6.5" y="0" width="3" height="14" rx="0.5"/><rect x="12" y="0" width="3" height="14" rx="0.5"/></svg>' }) : el('button', {
      class: 'icon-btn qi-remove', title: 'Retirer',
      onclick: (e) => {
        e.stopPropagation();
        state.player.queue.splice(qIdx, 1);
        renderQueue();
      },
      html: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    }),
  ]);

  if (isCurrent) {
    li.querySelector('.eq')?.classList.add(state.player.playing ? 'is-playing' : '');
  } else {
    li.setAttribute('draggable', 'true');
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(qIdx));
      li.classList.add('is-dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('is-dragging');
      document.querySelectorAll('.queue-item.drop-above, .queue-item.drop-below').forEach(el => el.classList.remove('drop-above', 'drop-below'));
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = li.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      document.querySelectorAll('.queue-item.drop-above, .queue-item.drop-below').forEach(el => el.classList.remove('drop-above', 'drop-below'));
      li.classList.add(above ? 'drop-above' : 'drop-below');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(fromIdx) || fromIdx === qIdx) return;
      const rect = li.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      const targetIdx = above ? qIdx : qIdx + 1;
      reorderQueue(fromIdx, targetIdx);
    });
  }
  return li;
}

function reorderQueue(fromIdx, targetIdx) {
  const queue = state.player.queue;
  if (fromIdx <= state.player.index || fromIdx >= queue.length) return;
  if (targetIdx <= state.player.index) targetIdx = state.player.index + 1;
  const [moved] = queue.splice(fromIdx, 1);
  const adjusted = fromIdx < targetIdx ? targetIdx - 1 : targetIdx;
  queue.splice(adjusted, 0, moved);
  renderQueue();
}

// ============================================================
// Visualizer
// ============================================================
function initVisualizer() {
  if (state.viz.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    state.viz.ctx = new Ctx();
    const source = state.viz.ctx.createMediaElementSource(audio);
    state.viz.analyser = state.viz.ctx.createAnalyser();
    state.viz.analyser.fftSize = 64;
    state.viz.analyser.smoothingTimeConstant = 0.8;
    source.connect(state.viz.analyser);
    state.viz.analyser.connect(state.viz.ctx.destination);
    state.viz.dataArray = new Uint8Array(state.viz.analyser.frequencyBinCount);
  } catch (e) { /* ignore */ }
}

function startVisualizer() {
  initVisualizer();
  if (!state.viz.analyser) return;
  if (state.viz.ctx.state === 'suspended') state.viz.ctx.resume();
  if (state.viz.running) return;
  state.viz.running = true;
  document.body.classList.add('viz-running');

  const bins = state.viz.dataArray;
  const total = bins.length;
  const third = Math.floor(total / 3);

  function draw() {
    if (!state.viz.running) return;
    state.viz.frame = requestAnimationFrame(draw);
    state.viz.analyser.getByteFrequencyData(bins);

    let low = 0, mid = 0, high = 0;
    for (let i = 0; i < third; i++) low += bins[i];
    for (let i = third; i < third * 2; i++) mid += bins[i];
    for (let i = third * 2; i < total; i++) high += bins[i];
    const minS = 0.18;
    const ls = minS + (low / third / 255) * (1 - minS);
    const ms = minS + (mid / third / 255) * (1 - minS);
    const hs = minS + (high / (total - third * 2) / 255) * (1 - minS);

    document.querySelectorAll('.eq.is-playing').forEach(eq => {
      const rects = eq.querySelectorAll('rect');
      if (rects[0]) rects[0].style.transform = `scaleY(${ls})`;
      if (rects[1]) rects[1].style.transform = `scaleY(${ms})`;
      if (rects[2]) rects[2].style.transform = `scaleY(${hs})`;
    });
  }
  draw();
}

function stopVisualizer() {
  state.viz.running = false;
  if (state.viz.frame) cancelAnimationFrame(state.viz.frame);
  document.body.classList.remove('viz-running');
  document.querySelectorAll('.eq rect').forEach(r => r.style.transform = '');
}

// ============================================================
// Crossfade
// ============================================================
const audio2 = $('#audio-element-2');
let crossfading = false;

function startCrossfade(nextIdx) {
  if (crossfading) return;
  const baseVol = state.player.muted ? 0 : state.player.volume;
  const nextTrackId = state.player.queue[nextIdx];
  const nextTrack = state.library.find(t => t.id === nextTrackId);
  if (!nextTrack) return;
  crossfading = true;

  audio2.src = audio.src;
  audio2.currentTime = audio.currentTime;
  audio2.volume = baseVol;
  audio2.play().catch(() => {});

  audio.src = nextTrack.file;
  audio.volume = 0;
  audio.currentTime = 0;
  audio.play().catch(() => {});

  state.player.index = nextIdx;
  $('#player-thumb').src = nextTrack.thumbnail || '';
  $('#player-title').textContent = nextTrack.title;
  $('#player-uploader').textContent = nextTrack.uploader || '';
  adaptToTrack(nextTrack);
  rerenderPlayingMarkers();
  updatePlayerLike();
  if (state.queueOpen) renderQueue();
  playCountedFor = null;

  const startTime = performance.now();
  const fade = () => {
    const elapsed = (performance.now() - startTime) / 1000;
    const t = Math.min(elapsed / state.crossfadeDuration, 1);
    audio.volume = baseVol * t;
    audio2.volume = baseVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(fade);
    } else {
      audio2.pause();
      try { audio2.removeAttribute('src'); audio2.load(); } catch {}
      crossfading = false;
    }
  };
  fade();
}

function maybeCrossfade() {
  if (crossfading) return;
  if (!state.crossfadeEnabled) return;
  if (audio.paused || !audio.duration) return;
  const remaining = audio.duration - audio.currentTime;
  if (remaining > state.crossfadeDuration || remaining <= 0) return;

  const queue = state.player.queue;
  const idx = state.player.index;
  let nextIdx = -1;
  if (state.player.shuffle && queue.length > 1) {
    do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === idx);
  } else if (idx < queue.length - 1) {
    nextIdx = idx + 1;
  } else if (state.player.repeat === 'all' && queue.length > 0) {
    nextIdx = 0;
  }
  if (nextIdx === -1) return;
  startCrossfade(nextIdx);
}

// ============================================================
// MediaSession (OS-level media controls)
// ============================================================
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => audio.play());
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('previoustrack', () => prevTrack());
  ms.setActionHandler('nexttrack', () => nextTrack());
  try {
    ms.setActionHandler('seekto', (e) => {
      if (e.fastSeek && 'fastSeek' in audio) audio.fastSeek(e.seekTime);
      else audio.currentTime = e.seekTime;
    });
  } catch {}
  try {
    ms.setActionHandler('seekbackward', (e) => {
      audio.currentTime = Math.max(0, audio.currentTime - (e.seekOffset || 10));
    });
    ms.setActionHandler('seekforward', (e) => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.seekOffset || 10));
    });
  } catch {}
}

function updateMediaMetadata(track) {
  if (!('mediaSession' in navigator)) return;
  if (!track) { navigator.mediaSession.metadata = null; return; }
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || '',
      artist: track.uploader || '',
      album: 'Wax',
      artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: '480x360', type: 'image/jpeg' }] : [],
    });
  } catch {}
}

function updateMediaPosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!audio.duration || isNaN(audio.duration)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime || 0, audio.duration),
    });
  } catch {}
}

// ============================================================
// Player state persistence (resume on reload)
// ============================================================
const PLAYER_STATE_KEY = 'wax:player';
let saveStateTimer = null;

function savePlayerState() {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(() => {
    if (!state.player.queue.length || state.player.index < 0) {
      try { localStorage.removeItem(PLAYER_STATE_KEY); } catch {}
      return;
    }
    try {
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({
        queue: state.player.queue,
        index: state.player.index,
        currentTime: audio.currentTime || 0,
        shuffle: state.player.shuffle,
        repeat: state.player.repeat,
      }));
    } catch {}
  }, 800);
}

function restorePlayerState() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) || 'null'); }
  catch { return; }
  if (!saved || !Array.isArray(saved.queue)) return;

  const validQueue = saved.queue.filter(id => state.library.find(t => t.id === id));
  if (validQueue.length === 0) return;
  let idx = saved.index;
  if (idx < 0 || idx >= validQueue.length) idx = 0;

  state.player.queue = validQueue;
  state.player.index = idx;
  state.player.shuffle = !!saved.shuffle;
  state.player.repeat = saved.repeat || 'off';

  $('#player-shuffle').classList.toggle('active', state.player.shuffle);
  $('#player-repeat').classList.toggle('active', state.player.repeat !== 'off');

  const track = state.library.find(t => t.id === validQueue[idx]);
  if (!track) return;

  $('#player').hidden = false;
  $('#player-thumb').src = track.thumbnail || '';
  $('#player-title').textContent = track.title;
  $('#player-uploader').textContent = track.uploader || '';
  audio.src = track.file;
  audio.volume = state.player.muted ? 0 : state.player.volume;

  audio.addEventListener('loadedmetadata', () => {
    const t = Math.min(saved.currentTime || 0, Math.max((audio.duration || 0) - 1, 0));
    audio.currentTime = t;
  }, { once: true });

  adaptToTrack(track);
  updatePlayerLike();
  updateMediaMetadata(track);
  rerenderPlayingMarkers();
}

// ============================================================
// Lyrics
// ============================================================
function guessArtistAndTitle(track) {
  const raw = track.title || '';
  const cleaned = raw.replace(/\s*[\[\(](?:slowed|reverb(?:ed)?|lyrics|official|audio|video|hq|4k|remaster|m\/v|mv|hd)[^)\]]*[\]\)]/gi, '').trim();
  const m = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: track.uploader || '', title: cleaned };
}

async function showLyrics() {
  const trackId = state.player.queue[state.player.index];
  const track = state.library.find(t => t.id === trackId);
  if (!track) { showToast('Aucune piste en lecture', 'error'); return; }

  const { artist, title } = guessArtistAndTitle(track);
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'lyrics-meta', text: `${artist} — ${title}` }));
  const content = el('pre', { class: 'lyrics-content placeholder', text: 'Recherche des paroles…' });
  wrap.appendChild(content);
  openModal({ title: 'Paroles', body: wrap, wide: true });

  try {
    const data = await api(`/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
    content.classList.remove('placeholder');
    content.textContent = data.lyrics;
  } catch (e) {
    content.classList.remove('placeholder');
    content.classList.add('error');
    content.textContent = e.message === 'Paroles introuvables'
      ? `Pas de paroles trouvées pour cette piste.\n\nL'extraction artiste/titre depuis YouTube est imparfaite — la piste « ${artist} — ${title} » n'a peut-être pas été reconnue par lyrics.ovh.`
      : `Erreur : ${e.message}`;
  }
}

// ============================================================
// Init
// ============================================================
function init() {
  loadPrefs();

  // Sidebar nav
  document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
    link.addEventListener('click', () => switchView(link.dataset.view));
  });

  // URL input
  $('#url-input').addEventListener('input', onUrlChange);
  $('#preview-clear').addEventListener('click', () => {
    $('#url-input').value = '';
    clearInputResults();
  });

  // Paste
  $('#paste-btn').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('#url-input').value = text;
      onUrlChange();
    } catch {
      showToast('Presse-papier inaccessible', 'error');
    }
  });

  // Quality
  $$('input[name="quality"]').forEach(r => r.addEventListener('change', savePrefs));

  // Playlist source actions
  $('#select-all-btn').addEventListener('click', () => {
    if (!state.playlistSource) return;
    state.playlistSelection = new Set(state.playlistSource.tracks.map(t => t.id));
    renderPlaylistSource();
  });
  $('#select-none-btn').addEventListener('click', () => {
    state.playlistSelection.clear();
    renderPlaylistSource();
  });

  // Submit
  $('#download-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#url-input').value.trim();
    if (!value) return;

    // Search query? Trigger immediate search instead of submit.
    if (!isYoutubeUrl(value)) {
      onUrlChange.flush();
      return;
    }

    const quality = '320';

    if (state.playlistSource) {
      const selected = state.playlistSource.tracks.filter(t => state.playlistSelection.has(t.id));
      if (selected.length === 0) { showToast('Aucune piste sélectionnée', 'error'); return; }
      showToast(`Lancement de ${selected.length} téléchargement${selected.length > 1 ? 's' : ''}...`);
      for (const t of selected) {
        startDownload(t.url, quality, { title: t.title });
        await new Promise(r => setTimeout(r, 100));
      }
      $('#url-input').value = '';
      clearInputResults();
    } else {
      startDownload(value, quality);
      $('#url-input').value = '';
      clearInputResults();
    }
  });

  // Library
  $('#library-search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderLibraryView();
  });
  $('#play-library-btn').addEventListener('click', () => {
    if (state.library.length === 0) return;
    const ids = state.library.map(t => t.id);
    playFromList(ids[0], ids);
  });

  // Playlists
  $('#create-playlist-btn').addEventListener('click', createPlaylist);
  $('#delete-playlist-btn').addEventListener('click', () => {
    if (state.selectedPlaylistId) deletePlaylist(state.selectedPlaylistId);
  });
  $('#rename-playlist-btn').addEventListener('click', () => {
    if (state.selectedPlaylistId) renamePlaylist(state.selectedPlaylistId);
  });
  $('#play-playlist-btn').addEventListener('click', () => {
    const pl = state.playlists.find(p => p.id === state.selectedPlaylistId);
    if (!pl || pl.trackIds.length === 0) return;
    const ids = pl.trackIds.filter(id => state.library.find(t => t.id === id));
    if (ids.length === 0) return;
    playFromList(ids[0], ids);
  });
  $('#add-tracks-btn').addEventListener('click', () => {
    if (state.selectedPlaylistId) openAddTracksToPlaylistModal(state.selectedPlaylistId);
  });

  // Player
  $('#player-toggle').addEventListener('click', togglePlay);
  $('#player-next').addEventListener('click', nextTrack);
  $('#player-prev').addEventListener('click', prevTrack);
  $('#player-shuffle').addEventListener('click', () => {
    state.player.shuffle = !state.player.shuffle;
    $('#player-shuffle').classList.toggle('active', state.player.shuffle);
  });
  $('#player-repeat').addEventListener('click', () => {
    const order = ['off', 'all', 'one'];
    state.player.repeat = order[(order.indexOf(state.player.repeat) + 1) % order.length];
    $('#player-repeat').classList.toggle('active', state.player.repeat !== 'off');
    $('#player-repeat').title = `Répéter : ${state.player.repeat === 'off' ? 'non' : state.player.repeat === 'one' ? 'piste' : 'tout'}`;
  });
  $('#player-seek').addEventListener('input', (e) => {
    if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    updateRangeFill(e.target);
  });
  const volSlider = $('#player-volume');
  volSlider.value = state.player.volume;
  updateRangeFill(volSlider);
  volSlider.addEventListener('input', (e) => {
    state.player.volume = parseFloat(e.target.value);
    state.player.muted = false;
    audio.volume = state.player.volume;
    updateRangeFill(e.target);
    savePrefs();
  });
  $('#player-mute').addEventListener('click', () => {
    state.player.muted = !state.player.muted;
    audio.volume = state.player.muted ? 0 : state.player.volume;
    $('#player-mute').classList.toggle('active', state.player.muted);
  });

  // Modal
  $('#modal-cancel').addEventListener('click', closeModal);
  $('.modal-overlay').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
    if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !$('#player').hidden) {
      e.preventDefault();
      togglePlay();
    }
  });

  // Highlight initial sidebar link
  document.querySelector('.sidebar-link[data-view="download"]').classList.add('active');

  // Apply default accent palette
  resetAccent();

  // OS-level media controls
  setupMediaSession();

  // Lyrics button
  $('#player-lyrics').addEventListener('click', showLyrics);

  // Player extras: like, queue, crossfade
  $('#player-like').addEventListener('click', () => {
    const trackId = state.player.queue[state.player.index];
    if (trackId) toggleLike(trackId);
  });
  $('#player-queue').addEventListener('click', () => {
    state.queueOpen = !state.queueOpen;
    $('#queue-panel').hidden = !state.queueOpen;
    $('#player-queue').classList.toggle('active', state.queueOpen);
    if (state.queueOpen) renderQueue();
  });
  $('#close-queue').addEventListener('click', () => {
    state.queueOpen = false;
    $('#queue-panel').hidden = true;
    $('#player-queue').classList.remove('active');
  });
  $('#player-crossfade').addEventListener('click', () => {
    state.crossfadeEnabled = !state.crossfadeEnabled;
    $('#player-crossfade').classList.toggle('active', state.crossfadeEnabled);
    showToast(state.crossfadeEnabled ? 'Crossfade activé (3 s)' : 'Crossfade désactivé');
    savePrefs();
  });
  $('#player-crossfade').classList.toggle('active', state.crossfadeEnabled);

  // Smart playlist play-all
  $('#play-smart-btn').addEventListener('click', () => {
    if (!state.smartView) return;
    const tracks = smartTracks(state.smartView);
    if (tracks.length === 0) return;
    const ids = tracks.map(t => t.id);
    playFromList(ids[0], ids);
  });

  fetchLibrary().then(() => restorePlayerState());
  fetchPlaylists();
}

document.addEventListener('DOMContentLoaded', init);
