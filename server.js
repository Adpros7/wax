const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const LIBRARY_DIR = path.join(ROOT, 'library');
const AUDIO_DIR = path.join(LIBRARY_DIR, 'audio');
const PREVIEW_DIR = path.join(LIBRARY_DIR, 'previews');
const LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');
const PLAYLISTS_FILE = path.join(LIBRARY_DIR, 'playlists.json');

fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });
if (!fs.existsSync(LIBRARY_FILE)) fs.writeFileSync(LIBRARY_FILE, '[]');
if (!fs.existsSync(PLAYLISTS_FILE)) fs.writeFileSync(PLAYLISTS_FILE, '[]');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/audio', express.static(AUDIO_DIR, { maxAge: '1d' }));
app.use('/preview-files', express.static(PREVIEW_DIR, { maxAge: '1h' }));

const YT_REGEX = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|playlist\?list=)|youtu\.be\/)[A-Za-z0-9_\-=&?%/]+/;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const getLibrary = () => readJson(LIBRARY_FILE);
const saveLibrary = (lib) => writeJson(LIBRARY_FILE, lib);
const getPlaylists = () => readJson(PLAYLISTS_FILE);
const savePlaylists = (pls) => writeJson(PLAYLISTS_FILE, pls);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

app.get('/api/lyrics', (req, res) => {
  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();
  if (!artist || !title) return res.status(400).json({ error: 'artist + title requis' });

  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
    let data = '';
    r.on('data', chunk => { data += chunk; });
    r.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.lyrics && json.lyrics.trim()) {
          res.json({ lyrics: json.lyrics, artist, title });
        } else {
          res.status(404).json({ error: 'Paroles introuvables' });
        }
      } catch {
        res.status(404).json({ error: 'Paroles introuvables' });
      }
    });
  }).on('error', () => res.status(500).json({ error: 'Erreur réseau' }));
});

app.get('/api/info', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!YT_REGEX.test(url)) return res.status(400).json({ error: 'URL invalide' });
  try {
    const data = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    res.json({
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      isPlaylist: /[?&]list=/.test(url) && !/[?&]v=/.test(url),
    });
  } catch (e) {
    const isPlaylist = /[?&]list=/.test(url) && !/[?&]v=/.test(url);
    if (isPlaylist) return res.json({ isPlaylist: true });
    res.status(500).json({ error: 'oEmbed indisponible', details: e.message });
  }
});

app.get('/api/preview/:videoId', (req, res) => {
  const id = req.params.videoId;
  if (!/^[A-Za-z0-9_-]{6,15}$/.test(id)) return res.status(400).json({ error: 'ID invalide' });

  const previewFile = path.join(PREVIEW_DIR, `${id}.mp3`);
  const publicUrl = `/preview-files/${id}.mp3`;

  if (fs.existsSync(previewFile)) {
    return res.json({ url: publicUrl });
  }

  const outTemplate = path.join(PREVIEW_DIR, `${id}.%(ext)s`);
  const ytdlp = spawn('yt-dlp', [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '5',
    '--download-sections', '*0:00-0:12',
    '--no-playlist',
    '--no-warnings',
    '-o', outTemplate,
    `https://www.youtube.com/watch?v=${id}`,
  ]);
  let stderr = '';
  ytdlp.stderr.on('data', (d) => { stderr += d; });
  ytdlp.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp indisponible' });
  });
  const timeout = setTimeout(() => {
    try { ytdlp.kill('SIGKILL'); } catch {}
    if (!res.headersSent) res.status(504).json({ error: 'Timeout aperçu' });
  }, 25000);
  ytdlp.on('close', (code) => {
    clearTimeout(timeout);
    if (res.headersSent) return;
    if (code !== 0 || !fs.existsSync(previewFile)) {
      return res.status(500).json({ error: 'Aperçu indisponible', details: stderr.slice(-200) });
    }
    res.json({ url: publicUrl });
  });
});

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  if (q.length > 200) return res.status(400).json({ error: 'Requête trop longue' });

  const ytdlp = spawn('yt-dlp', [
    `ytsearch10:${q}`,
    '--flat-playlist',
    '--skip-download',
    '--print', '%(id)s|||%(title)s|||%(uploader)s|||%(duration)s',
    '--no-warnings',
  ]);
  let out = '', err = '';
  ytdlp.stdout.on('data', d => { out += d; });
  ytdlp.stderr.on('data', d => { err += d; });
  ytdlp.on('error', () => res.status(500).json({ error: 'yt-dlp indisponible' }));
  ytdlp.on('close', code => {
    if (code !== 0) return res.status(500).json({ error: 'Recherche échouée', details: err.slice(-200) });
    const results = out.split('\n').filter(l => l.trim()).map(line => {
      const [id, title, uploader, duration] = line.split('|||');
      return {
        id,
        title: title || 'Sans titre',
        uploader: uploader === 'NA' ? '' : (uploader || ''),
        duration: parseFloat(duration) || 0,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    });
    res.json({ results });
  });
});

app.get('/api/playlist-info', (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!YT_REGEX.test(url)) return res.status(400).json({ error: 'URL invalide' });

  const ytdlp = spawn('yt-dlp', [
    '--flat-playlist',
    '--skip-download',
    '--print', '%(id)s|||%(title)s|||%(uploader)s|||%(duration)s',
    '--no-warnings',
    url,
  ]);
  let out = '', err = '';
  ytdlp.stdout.on('data', d => { out += d; });
  ytdlp.stderr.on('data', d => { err += d; });
  ytdlp.on('error', () => res.status(500).json({ error: 'yt-dlp indisponible' }));
  ytdlp.on('close', code => {
    if (code !== 0) return res.status(500).json({ error: 'Énumération échouée', details: err.slice(-300) });
    const items = out.split('\n').filter(l => l.trim()).map(line => {
      const [id, title, uploader, duration] = line.split('|||');
      return {
        id,
        title: title || 'Sans titre',
        uploader: uploader === 'NA' ? '' : (uploader || ''),
        duration: parseFloat(duration) || 0,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    });
    res.json({ tracks: items });
  });
});

const jobs = new Map();

function broadcast(job, payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const listener of job.listeners) {
    try { listener.write(data); } catch {}
  }
  if (payload.type === 'ready' || payload.type === 'error') {
    for (const listener of job.listeners) {
      try { listener.end(); } catch {}
    }
    job.listeners.clear();
  }
}

function startJob(job) {
  const expectedFile = path.join(AUDIO_DIR, `${job.trackId}.mp3`);
  const infoJsonFile = path.join(AUDIO_DIR, `${job.trackId}.info.json`);
  const outputTemplate = path.join(AUDIO_DIR, `${job.trackId}.%(ext)s`);

  const lib = getLibrary();
  if (lib.some(t => t.url === job.url)) {
    const existing = lib.find(t => t.url === job.url);
    job.status = 'ready';
    job.progress = 100;
    job.track = existing;
    setTimeout(() => broadcast(job, { type: 'ready', track: existing, duplicate: true }), 50);
    return;
  }

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', `${job.bitrate}K`,
    '--no-playlist',
    '--newline',
    '--write-info-json',
    '--no-warnings',
    '-o', outputTemplate,
    job.url,
  ];

  const ytdlp = spawn('yt-dlp', args);
  job.status = 'downloading';
  job.phase = 'download';
  let stderr = '';

  ytdlp.stdout.on('data', (data) => {
    const text = data.toString();
    for (const line of text.split('\n')) {
      const m = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (m) {
        const pct = parseFloat(m[1]);
        if (!isNaN(pct)) {
          job.progress = pct;
          broadcast(job, { type: 'progress', progress: pct, phase: 'download' });
        }
      } else if (line.startsWith('[ExtractAudio]') || line.startsWith('[ffmpeg]')) {
        if (job.phase !== 'converting') {
          job.phase = 'converting';
          broadcast(job, { type: 'progress', progress: 100, phase: 'converting' });
        }
      }
    }
  });

  ytdlp.stderr.on('data', (d) => { stderr += d; });

  ytdlp.on('error', (err) => {
    job.status = 'error';
    job.error = err.message;
    broadcast(job, { type: 'error', error: err.message });
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(expectedFile)) {
      job.status = 'error';
      job.error = stderr.split('\n').filter(l => l.trim()).slice(-3).join(' | ').slice(0, 500) || 'Erreur inconnue';
      broadcast(job, { type: 'error', error: job.error });
      try { fs.unlinkSync(expectedFile); } catch {}
      try { fs.unlinkSync(infoJsonFile); } catch {}
      return;
    }

    let info = {};
    try { info = JSON.parse(fs.readFileSync(infoJsonFile, 'utf8')); } catch {}

    const safeTitle = String(info.title || 'Sans titre').replace(/[\/\\:*?"<>|]/g, '').slice(0, 200);
    const track = {
      id: job.trackId,
      title: safeTitle,
      uploader: info.uploader || info.channel || '',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || (info.id ? `https://i.ytimg.com/vi/${info.id}/mqdefault.jpg` : ''),
      ytId: info.id || '',
      url: info.webpage_url || job.url,
      bitrate: job.bitrate,
      file: `/audio/${job.trackId}.mp3`,
      addedAt: Date.now(),
    };

    const currentLib = getLibrary();
    currentLib.unshift(track);
    saveLibrary(currentLib);

    try { fs.unlinkSync(infoJsonFile); } catch {}

    job.status = 'ready';
    job.progress = 100;
    job.phase = 'done';
    job.track = track;
    broadcast(job, { type: 'ready', track });
  });
}

app.post('/api/jobs', (req, res) => {
  const { url, quality } = req.body || {};
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || !YT_REGEX.test(cleanUrl)) return res.status(400).json({ error: 'URL invalide' });
  const bitrate = ['128', '192', '320'].includes(String(quality)) ? String(quality) : '192';

  const id = crypto.randomBytes(8).toString('hex');
  const trackId = crypto.randomBytes(6).toString('hex');
  const job = {
    id,
    trackId,
    url: cleanUrl,
    bitrate,
    progress: 0,
    phase: 'starting',
    status: 'pending',
    track: null,
    error: null,
    listeners: new Set(),
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  setImmediate(() => startJob(job));
  res.json({ id, trackId });
});

app.get('/api/jobs/:id/progress', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job introuvable' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (job.status === 'ready') {
    res.write(`data: ${JSON.stringify({ type: 'ready', track: job.track })}\n\n`);
    return res.end();
  }
  if (job.status === 'error') {
    res.write(`data: ${JSON.stringify({ type: 'error', error: job.error })}\n\n`);
    return res.end();
  }

  res.write(`data: ${JSON.stringify({ type: 'progress', progress: job.progress, phase: job.phase })}\n\n`);
  job.listeners.add(res);
  req.on('close', () => job.listeners.delete(res));
});

app.get('/api/library', (req, res) => {
  res.json({ tracks: getLibrary() });
});

app.put('/api/library/order', (req, res) => {
  const trackIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds : null;
  if (!trackIds) return res.status(400).json({ error: 'trackIds requis' });
  const lib = getLibrary();
  const byId = new Map(lib.map(t => [t.id, t]));
  const reordered = [];
  for (const id of trackIds) {
    if (typeof id !== 'string') continue;
    const t = byId.get(id);
    if (t) { reordered.push(t); byId.delete(id); }
  }
  for (const t of byId.values()) reordered.push(t);
  saveLibrary(reordered);
  res.json({ ok: true });
});

app.patch('/api/library/:id', (req, res) => {
  const lib = getLibrary();
  const track = lib.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: 'Piste introuvable' });
  if (typeof req.body?.liked === 'boolean') track.liked = req.body.liked;
  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    track.title = req.body.title.trim().slice(0, 200);
  }
  saveLibrary(lib);
  res.json({ track });
});

app.post('/api/library/:id/play', (req, res) => {
  const lib = getLibrary();
  const track = lib.find(t => t.id === req.params.id);
  if (!track) return res.status(404).json({ error: 'Piste introuvable' });
  track.playCount = (track.playCount || 0) + 1;
  track.lastPlayedAt = Date.now();
  saveLibrary(lib);
  res.json({ track });
});

app.delete('/api/library/:id', (req, res) => {
  const lib = getLibrary();
  const idx = lib.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Piste introuvable' });
  const [track] = lib.splice(idx, 1);
  saveLibrary(lib);

  const pls = getPlaylists();
  let plsChanged = false;
  for (const pl of pls) {
    const before = pl.trackIds.length;
    pl.trackIds = pl.trackIds.filter(tid => tid !== track.id);
    if (pl.trackIds.length !== before) plsChanged = true;
  }
  if (plsChanged) savePlaylists(pls);

  try { fs.unlinkSync(path.join(AUDIO_DIR, `${track.id}.mp3`)); } catch {}
  res.json({ ok: true });
});

app.get('/api/playlists', (req, res) => {
  res.json({ playlists: getPlaylists() });
});

app.post('/api/playlists', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const pls = getPlaylists();
  const playlist = {
    id: crypto.randomBytes(6).toString('hex'),
    name: name.slice(0, 100),
    trackIds: [],
    createdAt: Date.now(),
  };
  pls.push(playlist);
  savePlaylists(pls);
  res.json({ playlist });
});

app.put('/api/playlists/:id', (req, res) => {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    pl.name = req.body.name.trim().slice(0, 100);
  }
  if (Array.isArray(req.body?.trackIds)) {
    pl.trackIds = req.body.trackIds.filter(t => typeof t === 'string');
  }
  savePlaylists(pls);
  res.json({ playlist: pl });
});

app.delete('/api/playlists/:id', (req, res) => {
  const pls = getPlaylists();
  const idx = pls.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Playlist introuvable' });
  pls.splice(idx, 1);
  savePlaylists(pls);
  res.json({ ok: true });
});

app.post('/api/playlists/:id/tracks', (req, res) => {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });
  const trackId = String(req.body?.trackId || '');
  if (!trackId) return res.status(400).json({ error: 'trackId requis' });
  const lib = getLibrary();
  if (!lib.find(t => t.id === trackId)) return res.status(404).json({ error: 'Piste introuvable' });
  if (!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId);
  savePlaylists(pls);
  res.json({ playlist: pl });
});

app.post('/api/playlists/:id/tracks/bulk', (req, res) => {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });
  const trackIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds : [];
  const lib = getLibrary();
  let added = 0;
  for (const tid of trackIds) {
    if (typeof tid !== 'string') continue;
    if (!lib.find(t => t.id === tid)) continue;
    if (!pl.trackIds.includes(tid)) {
      pl.trackIds.push(tid);
      added++;
    }
  }
  savePlaylists(pls);
  res.json({ playlist: pl, added });
});

app.delete('/api/playlists/:plId/tracks/:trackId', (req, res) => {
  const pls = getPlaylists();
  const pl = pls.find(p => p.id === req.params.plId);
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });
  pl.trackIds = pl.trackIds.filter(tid => tid !== req.params.trackId);
  savePlaylists(pls);
  res.json({ playlist: pl });
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
