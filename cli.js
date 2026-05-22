#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');

// ANSI colors
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
};
const NO_COLOR = !process.stdout.isTTY || process.env.NO_COLOR;
const col = (code, str) => NO_COLOR ? str : `${code}${str}${c.reset}`;

// Library path resolution:
//  1. WAX_LIBRARY_DIR env var (explicit override)
//  2. ~/Library/Application Support/Wax/library (Electron app's userData)
//  3. ./library  (dev mode, running from the repo)
function resolveLibraryDir() {
  if (process.env.WAX_LIBRARY_DIR) return process.env.WAX_LIBRARY_DIR;
  const prod = path.join(os.homedir(), 'Library', 'Application Support', 'Wax', 'library');
  if (fs.existsSync(prod)) return prod;
  const dev = path.join(process.cwd(), 'library');
  if (fs.existsSync(dev)) return dev;
  return prod; // will be created on first write
}

const LIBRARY_DIR = resolveLibraryDir();
const LIBRARY_FILE  = path.join(LIBRARY_DIR, 'library.json');
const PLAYLISTS_FILE = path.join(LIBRARY_DIR, 'playlists.json');
const AUDIO_DIR = path.join(LIBRARY_DIR, 'audio');

const YT_DLP_BIN = process.env.WAX_YT_DLP || 'yt-dlp';

// --- I/O helpers ---
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function readLibrary()   { return readJson(LIBRARY_FILE);   }
function readPlaylists() { return readJson(PLAYLISTS_FILE); }
function saveLibrary(t)  { writeJson(LIBRARY_FILE, t);   }
function savePlaylists(p){ writeJson(PLAYLISTS_FILE, p); }
function genId()         { return crypto.randomBytes(6).toString('hex'); }

function fmtDuration(s) {
  if (!s || isNaN(s)) return '--:--';
  s = Math.round(s);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
function trunc(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function die(msg)  { console.error(col(c.red, 'Error: ') + msg); process.exit(1); }
function ok(msg)   { console.log(col(c.green, '✓ ') + msg); }
function warn(msg) { console.log(col(c.yellow, '⚠ ') + msg); }

function ensureYtDlp() {
  const r = spawnSync(YT_DLP_BIN, ['--version'], { encoding: 'utf8' });
  if (r.error) die(`yt-dlp not found. Install it: brew install yt-dlp\nOr set WAX_YT_DLP=/path/to/yt-dlp`);
}

// --- Commands ---

function cmdList(args) {
  const showAll = args.includes('--all') || args.includes('-a');
  const json    = args.includes('--json');
  const tracks  = readLibrary();
  const list    = showAll ? tracks : tracks.filter(t => t.liked !== false);

  if (json) { console.log(JSON.stringify(list, null, 2)); return; }
  if (list.length === 0) {
    warn('Library is empty' + (showAll ? '.' : '. Use --all to include non-favorites.'));
    return;
  }

  const header = col(c.bold,
    '#'.padStart(3) + '  ' +
    'Title'.padEnd(46) +
    'Artist'.padEnd(22) +
    'Dur'.padEnd(7) +
    'ID'.padEnd(14) +
    'DL  Fav'
  );
  console.log('\n' + header);
  console.log('─'.repeat(98));
  list.forEach((t, i) => {
    const dl  = t.file ? col(c.green, '✓') : ' ';
    const fav = t.liked === false ? ' ' : col(c.red, '♥');
    console.log(
      String(i + 1).padStart(3) + '  ' +
      trunc(t.title, 46).padEnd(46) +
      trunc(t.uploader || '', 22).padEnd(22) +
      fmtDuration(t.duration).padEnd(7) +
      (t.id || '').padEnd(14) +
      dl + '   ' + fav
    );
  });
  console.log(col(c.dim, `\n${list.length} track${list.length === 1 ? '' : 's'}`));
}

function cmdSearch(args) {
  const query = args.filter(a => !a.startsWith('-')).join(' ').trim();
  if (!query) die('Usage: wax search <query>');
  ensureYtDlp();

  process.stdout.write(col(c.dim, `Searching for "${query}"...\n`));
  const r = spawnSync(YT_DLP_BIN, [
    `ytsearch10:${query}`,
    '--flat-playlist', '--skip-download',
    '--print', '%(id)s|||%(title)s|||%(uploader)s|||%(duration)s',
    '--no-warnings',
  ], { encoding: 'utf8', timeout: 30000 });

  if (r.error || r.status !== 0) die(`yt-dlp failed: ${r.stderr?.slice(-300) || r.error?.message || 'unknown'}`);

  const lines = r.stdout.split('\n').filter(l => l.includes('|||'));
  if (!lines.length) { warn('No results.'); return; }

  const inLib = new Set(readLibrary().map(t => t.ytId));
  const header = col(c.bold,
    ' #  ' + 'Title'.padEnd(50) + 'Artist'.padEnd(22) + 'Dur'.padEnd(7) + 'YT ID'.padEnd(14) + 'In lib'
  );
  console.log('\n' + header);
  console.log('─'.repeat(100));

  lines.forEach((line, i) => {
    const [id, title, uploader, duration] = line.split('|||');
    const dup = inLib.has(id) ? col(c.green, '✓') : ' ';
    const up  = uploader === 'NA' ? '' : (uploader || '');
    console.log(
      String(i + 1).padStart(2) + '  ' +
      trunc(title, 50).padEnd(50) +
      trunc(up, 22).padEnd(22) +
      fmtDuration(parseFloat(duration) || 0).padEnd(7) +
      (id || '').padEnd(14) +
      dup
    );
  });
  console.log(col(c.dim, '\nTo add: wax add <youtube-url-or-id>'));
}

function cmdAdd(args) {
  const input = args[0];
  if (!input) die('Usage: wax add <youtube-url-or-video-id>');
  ensureYtDlp();

  const url = /^[A-Za-z0-9_-]{6,15}$/.test(input)
    ? `https://www.youtube.com/watch?v=${input}`
    : input;

  process.stdout.write(col(c.dim, 'Fetching track info...\n'));
  const r = spawnSync(YT_DLP_BIN, [
    url,
    '--skip-download', '--no-playlist', '--no-warnings',
    '--print', '%(id)s|||%(title)s|||%(uploader)s|||%(duration)s',
  ], { encoding: 'utf8', timeout: 30000 });

  if (r.error || r.status !== 0) die(`yt-dlp failed: ${r.stderr?.slice(-300) || r.error?.message}`);

  const line = r.stdout.trim().split('\n')[0];
  const [ytId, title, uploader, duration] = line.split('|||');
  if (!ytId) die('Could not parse track info.');

  const library = readLibrary();
  const existing = library.find(t => t.ytId === ytId);
  if (existing) { warn(`Already in library: "${existing.title}" (id: ${existing.id})`); return; }

  const track = {
    id: genId(), ytId,
    title:    title || 'Sans titre',
    uploader: uploader === 'NA' ? '' : (uploader || ''),
    duration: parseFloat(duration) || 0,
    thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${ytId}`,
    file: null, liked: true, addedAt: Date.now(),
  };

  library.unshift(track);
  saveLibrary(library);
  ok(`Added "${track.title}"${track.uploader ? ' by ' + track.uploader : ''} (id: ${track.id})`);
}

function cmdRemove(args) {
  const key = args[0];
  if (!key) die('Usage: wax remove <track-id>');

  const library = readLibrary();
  const idx = library.findIndex(t => t.id === key || t.ytId === key);
  if (idx === -1) die(`Track not found: ${key}`);

  const [track] = library.splice(idx, 1);
  saveLibrary(library);

  // remove from all playlists
  const pls = readPlaylists();
  let changed = false;
  for (const pl of pls) {
    const before = pl.trackIds?.length || 0;
    pl.trackIds = (pl.trackIds || []).filter(id => id !== track.id);
    if (pl.trackIds.length !== before) changed = true;
  }
  if (changed) savePlaylists(pls);

  // delete MP3 if downloaded
  if (track.file) {
    try { fs.unlinkSync(path.join(AUDIO_DIR, `${track.id}.mp3`)); } catch {}
  }

  ok(`Removed "${track.title}"`);
}

function cmdDownload(args) {
  const key = args[0];
  if (!key) die('Usage: wax download <track-id>');
  ensureYtDlp();

  const library = readLibrary();
  const track = library.find(t => t.id === key || t.ytId === key);
  if (!track) die(`Track not found: ${key}`);

  const outPath = path.join(AUDIO_DIR, `${track.id}.mp3`);
  if (track.file && fs.existsSync(outPath)) {
    warn(`"${track.title}" is already downloaded.`);
    return;
  }

  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  console.log(col(c.dim, `Downloading "${track.title}"...`));

  const child = spawn(YT_DLP_BIN, [
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '--no-playlist', '--no-warnings',
    '--extractor-args', 'youtube:player_client=android,web',
    '-o', path.join(AUDIO_DIR, `${track.id}.%(ext)s`),
    `https://www.youtube.com/watch?v=${track.ytId}`,
  ], { stdio: 'inherit' });

  child.on('error', err => die(`yt-dlp error: ${err.message}`));
  child.on('close', code => {
    if (code !== 0 || !fs.existsSync(outPath)) { die('Download failed.'); }
    const lib2 = readLibrary();
    const t2 = lib2.find(t => t.id === track.id);
    if (t2) { t2.file = `/audio/${track.id}.mp3`; saveLibrary(lib2); }
    ok(`Downloaded to ${outPath}`);
  });
}

function cmdFav(args) {
  const key = args[0];
  if (!key) die('Usage: wax fav <track-id>');

  const library = readLibrary();
  const track = library.find(t => t.id === key || t.ytId === key);
  if (!track) die(`Track not found: ${key}`);

  track.liked = track.liked === false ? true : false;
  saveLibrary(library);
  ok(`"${track.title}" — ${track.liked ? col(c.red, 'favorited') : 'unfavorited'}`);
}

function cmdInfo() {
  const library   = readLibrary();
  const playlists = readPlaylists();
  const favorites  = library.filter(t => t.liked !== false);
  const downloaded = library.filter(t => t.file);
  const totalSecs  = library.reduce((s, t) => s + (t.duration || 0), 0);

  console.log(col(c.bold, '\nWax Library'));
  console.log('─'.repeat(46));
  console.log(`  Library path:    ${LIBRARY_DIR}`);
  console.log(`  Tracks:          ${library.length} total, ${favorites.length} favorites, ${downloaded.length} downloaded`);
  console.log(`  Playlists:       ${playlists.length}`);
  console.log(`  Total duration:  ${fmtDuration(totalSecs)}`);
  console.log();
}

function cmdPlaylists() {
  const pls = readPlaylists();
  if (!pls.length) { warn('No playlists. Create one: wax playlist create <name>'); return; }

  const header = col(c.bold, 'ID'.padEnd(14) + 'Name'.padEnd(32) + 'Tracks');
  console.log('\n' + header);
  console.log('─'.repeat(52));
  for (const pl of pls) {
    console.log((pl.id || '').padEnd(14) + trunc(pl.name, 32).padEnd(32) + (pl.trackIds || []).length);
  }
  console.log();
}

function cmdPlaylistShow(args) {
  const key = args[0];
  if (!key) die('Usage: wax playlist show <playlist-id-or-name>');

  const pls = readPlaylists();
  const pl  = pls.find(p => p.id === key || p.name.toLowerCase() === key.toLowerCase());
  if (!pl) die(`Playlist not found: ${key}`);

  const trackMap = Object.fromEntries(readLibrary().map(t => [t.id, t]));
  console.log(col(c.bold, `\n${pl.name}`) + ` (${(pl.trackIds || []).length} tracks)`);
  console.log('─'.repeat(80));

  if (!pl.trackIds?.length) { warn('Playlist is empty.'); return; }

  pl.trackIds.forEach((tid, i) => {
    const t = trackMap[tid];
    if (t) {
      const dl = t.file ? col(c.green, '✓') : ' ';
      console.log(
        String(i + 1).padStart(3) + '  ' +
        trunc(t.title, 50).padEnd(50) +
        trunc(t.uploader || '', 20).padEnd(20) +
        fmtDuration(t.duration).padEnd(7) +
        t.id.padEnd(14) + dl
      );
    } else {
      console.log(String(i + 1).padStart(3) + '  ' + col(c.dim, `[missing: ${tid}]`));
    }
  });
  console.log();
}

function cmdPlaylistCreate(args) {
  const name = args.join(' ').trim();
  if (!name) die('Usage: wax playlist create <name>');

  const pls = readPlaylists();
  if (pls.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    die(`Playlist "${name}" already exists.`);
  }

  const pl = { id: genId(), name, trackIds: [], createdAt: Date.now() };
  pls.push(pl);
  savePlaylists(pls);
  ok(`Created playlist "${name}" (id: ${pl.id})`);
}

function cmdPlaylistDelete(args) {
  const key = args[0];
  if (!key) die('Usage: wax playlist delete <playlist-id>');

  const pls = readPlaylists();
  const idx = pls.findIndex(p => p.id === key);
  if (idx === -1) die(`Playlist not found: ${key}`);

  const { name } = pls.splice(idx, 1)[0];
  savePlaylists(pls);
  ok(`Deleted playlist "${name}"`);
}

function cmdPlaylistRename(args) {
  const [id, ...rest] = args;
  const newName = rest.join(' ').trim();
  if (!id || !newName) die('Usage: wax playlist rename <playlist-id> <new-name>');

  const pls = readPlaylists();
  const pl  = pls.find(p => p.id === id);
  if (!pl) die(`Playlist not found: ${id}`);

  const old = pl.name;
  pl.name = newName;
  savePlaylists(pls);
  ok(`Renamed "${old}" → "${newName}"`);
}

function cmdPlaylistAdd(args) {
  const [plKey, trackKey] = args;
  if (!plKey || !trackKey) die('Usage: wax playlist add <playlist-id> <track-id>');

  const library = readLibrary();
  const track = library.find(t => t.id === trackKey || t.ytId === trackKey);
  if (!track) die(`Track not found: ${trackKey}`);

  const pls = readPlaylists();
  const pl  = pls.find(p => p.id === plKey);
  if (!pl) die(`Playlist not found: ${plKey}`);

  if ((pl.trackIds || []).includes(track.id)) {
    warn(`"${track.title}" is already in "${pl.name}".`);
    return;
  }

  pl.trackIds = [...(pl.trackIds || []), track.id];
  savePlaylists(pls);
  ok(`Added "${track.title}" to "${pl.name}"`);
}

function cmdPlaylistRemove(args) {
  const [plKey, trackKey] = args;
  if (!plKey || !trackKey) die('Usage: wax playlist remove <playlist-id> <track-id>');

  const pls = readPlaylists();
  const pl  = pls.find(p => p.id === plKey);
  if (!pl) die(`Playlist not found: ${plKey}`);

  const library = readLibrary();
  const track = library.find(t => t.id === trackKey || t.ytId === trackKey);
  const rid = track?.id || trackKey;

  const before = (pl.trackIds || []).length;
  pl.trackIds = (pl.trackIds || []).filter(tid => tid !== rid);
  if (pl.trackIds.length === before) {
    warn(`Track not found in playlist "${pl.name}".`);
    return;
  }

  savePlaylists(pls);
  ok(`Removed track from "${pl.name}"`);
}

function cmdHelp() {
  console.log(`
${col(c.bold, 'wax')} — Wax music library CLI

${col(c.bold, 'USAGE')}
  wax <command> [options]

${col(c.bold, 'LIBRARY')}
  ${col(c.cyan, 'list')} [--all]                     List tracks (favorites only, --all for everything)
  ${col(c.cyan, 'search')} <query>                   Search YouTube (top 10 results)
  ${col(c.cyan, 'add')} <url | video-id>             Add a track to library
  ${col(c.cyan, 'remove')} <track-id>                Remove a track (also removes from playlists + disk)
  ${col(c.cyan, 'download')} <track-id>              Download a track as MP3
  ${col(c.cyan, 'fav')} <track-id>                   Toggle favorite status
  ${col(c.cyan, 'info')}                             Show library stats + path

${col(c.bold, 'PLAYLISTS')}
  ${col(c.cyan, 'playlists')}                        List all playlists
  ${col(c.cyan, 'playlist show')} <id-or-name>       Show tracks in a playlist
  ${col(c.cyan, 'playlist create')} <name>           Create a new playlist
  ${col(c.cyan, 'playlist delete')} <playlist-id>    Delete a playlist
  ${col(c.cyan, 'playlist rename')} <id> <name>      Rename a playlist
  ${col(c.cyan, 'playlist add')} <p-id> <track-id>   Add a track to a playlist
  ${col(c.cyan, 'playlist remove')} <p-id> <track-id> Remove a track from a playlist

${col(c.bold, 'ENV VARS')}
  WAX_LIBRARY_DIR   Library path (default: ~/Library/Application Support/Wax/library)
  WAX_YT_DLP        Path to yt-dlp binary (default: yt-dlp from PATH)

${col(c.bold, 'EXAMPLES')}
  wax search "Tame Impala"
  wax add https://www.youtube.com/watch?v=dQw4w9WgXcQ
  wax list
  wax playlist create "Summer Vibes"
  wax playlist add <playlist-id> <track-id>
  wax download <track-id>
`);
}

// --- Router ---
const [,, cmd, ...rest] = process.argv;

switch (cmd) {
  case 'list':      cmdList(rest); break;
  case 'search':    cmdSearch(rest); break;
  case 'add':       cmdAdd(rest); break;
  case 'remove':
  case 'rm':        cmdRemove(rest); break;
  case 'download':
  case 'dl':        cmdDownload(rest); break;
  case 'fav':       cmdFav(rest); break;
  case 'info':      cmdInfo(); break;
  case 'playlists': cmdPlaylists(); break;
  case 'playlist':
    switch (rest[0]) {
      case 'show':   cmdPlaylistShow(rest.slice(1));   break;
      case 'create': cmdPlaylistCreate(rest.slice(1)); break;
      case 'delete':
      case 'rm':     cmdPlaylistDelete(rest.slice(1)); break;
      case 'rename': cmdPlaylistRename(rest.slice(1)); break;
      case 'add':    cmdPlaylistAdd(rest.slice(1));    break;
      case 'remove': cmdPlaylistRemove(rest.slice(1)); break;
      default: die(`Unknown playlist subcommand: "${rest[0] || ''}". Run wax --help for usage.`);
    }
    break;
  case '--help':
  case '-h':
  case 'help':
  case undefined:   cmdHelp(); break;
  default:          die(`Unknown command: "${cmd}". Run wax --help for usage.`);
}
