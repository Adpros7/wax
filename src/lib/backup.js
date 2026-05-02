// Full app backup: library + playlists (server-side JSON files) bundled with
// client-side prefs (localStorage). Audio MP3s are NOT included — the user
// can copy library/audio/ separately if they want offline files migrated.
//
// Both `exportToFile` and `importFromData` accept an `onProgress(fraction)`
// callback that the Settings UI feeds into a progress bar.
//   - Export reads the server response with a streaming reader so it can
//     report bytes received vs Content-Length.
//   - Import goes through XMLHttpRequest (not fetch) so we get
//     `upload.onprogress` events on the way out — fetch doesn't expose that
//     without manually wrapping the body in a ReadableStream that tracks
//     reads.

const PREFS_KEY = 'ytmp3:prefs';
const PLAYER_STATE_KEY = 'wax:player';
const EXPORT_VERSION = 1;

function getAppVersion() {
  // electron preload exposes window.wax.versions if present.
  return window?.wax?.versions?.app || '';
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLocal(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function assemble(server) {
  return {
    version: EXPORT_VERSION,
    exportedAt: server.exportedAt || new Date().toISOString(),
    appVersion: getAppVersion(),
    library: server.library || [],
    playlists: server.playlists || [],
    prefs: readLocal(PREFS_KEY),
    playerState: readLocal(PLAYER_STATE_KEY),
  };
}

export async function buildExportBlob({ onProgress } = {}) {
  const res = await fetch('/api/export');
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  const total = parseInt(res.headers.get('Content-Length') || '0', 10);
  // Browsers without ReadableStream on response.body, or no Content-Length →
  // fall back to a single .json() read with coarse 0/0.5/1 reporting.
  if (!total || !res.body || typeof res.body.getReader !== 'function') {
    onProgress?.(0.5);
    const server = await res.json();
    onProgress?.(0.95);
    return assemble(server);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    // Cap at 95% so the bar shows the parse + JSON.stringify happening too.
    onProgress?.(Math.min(received / total, 0.95));
  }
  const text = new TextDecoder().decode(
    chunks.length === 1 ? chunks[0] : concatChunks(chunks, received),
  );
  const server = JSON.parse(text);
  return assemble(server);
}

function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export async function exportToFile({ onProgress } = {}) {
  const data = await buildExportBlob({ onProgress });
  const json = JSON.stringify(data, null, 2);
  onProgress?.(0.98);
  const blob = new Blob([json], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wax-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  onProgress?.(1);
  return data;
}

export async function readImportFile(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Invalid JSON file'); }
  if (!data || data.version !== EXPORT_VERSION) {
    throw new Error('Unsupported export version');
  }
  if (!Array.isArray(data.library) || !Array.isArray(data.playlists)) {
    throw new Error('Malformed backup');
  }
  return data;
}

export function importFromData(data, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/import');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      // Reserve the last 5% for server-side processing + reload prep.
      onProgress?.(Math.min(e.loaded / e.total, 0.95));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let result;
        try { result = JSON.parse(xhr.responseText); }
        catch { return reject(new Error('Invalid response')); }
        if (data.prefs) writeLocal(PREFS_KEY, data.prefs);
        if (data.playerState) writeLocal(PLAYER_STATE_KEY, data.playerState);
        onProgress?.(1);
        resolve(result);
      } else {
        let msg = `HTTP ${xhr.status}`;
        try { const j = JSON.parse(xhr.responseText); msg = j.error || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(JSON.stringify({
      version: data.version,
      library: data.library,
      playlists: data.playlists,
    }));
  });
}
