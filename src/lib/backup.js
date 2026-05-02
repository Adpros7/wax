// Full app backup: library + playlists (server-side JSON files) bundled with
// client-side prefs (localStorage). Audio MP3s are NOT included — the user
// can copy library/audio/ separately if they want offline files migrated.
//
// Export → triggers a JSON download. Import → POSTs to the server, then
// rewrites localStorage prefs and reloads so every store re-fetches clean.
import { api } from '@/lib/api';

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

export async function buildExportBlob() {
  const server = await api('/api/export');
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

export async function exportToFile() {
  const data = await buildExportBlob();
  const json = JSON.stringify(data, null, 2);
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

export async function importFromData(data) {
  // Push library + playlists to the server (atomic — server validates and
  // overwrites both files together).
  const result = await api('/api/import', {
    method: 'POST',
    body: JSON.stringify({
      version: data.version,
      library: data.library,
      playlists: data.playlists,
    }),
  });
  // Restore client-side prefs + player state from the backup.
  if (data.prefs) writeLocal(PREFS_KEY, data.prefs);
  if (data.playerState) writeLocal(PLAYER_STATE_KEY, data.playerState);
  return result; // { ok, tracks, playlists }
}
