// Electron main process — boots the Express backend and a BrowserWindow.
//
// In dev (NODE_ENV=development) the renderer loads http://localhost:5173 (Vite).
// In prod it loads dist/index.html. The Express backend is forked as a child
// process on PORT=3000; the renderer hits /api/* directly.
//
// Bundled binaries (yt-dlp / ffmpeg) are detected via electron-builder
// extraResources; if missing we silently fall back to the system PATH.

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { fork } = require('node:child_process');

const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;
const SERVER_PORT = process.env.WAX_SERVER_PORT || '3000';
const VITE_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let mainWindow = null;
let serverProc = null;

// ----------------------------------------------------------------
// Resolve runtime paths (binaries + library + server.js)
// ----------------------------------------------------------------
function resolveBundledBinary(name) {
  // electron-builder extraResources lands in process.resourcesPath in prod.
  // In dev we just rely on system PATH.
  if (isDev) return null;
  const platform = process.platform;
  const ext = platform === 'win32' ? '.exe' : '';
  const candidates = [
    path.join(process.resourcesPath, 'bin', `${name}${ext}`),
    path.join(process.resourcesPath, `${name}${ext}`),
  ];
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch {}
  }
  return null;
}

function resolveServerEntry() {
  // In dev: project root server.js; in prod: extraResources copy.
  const devEntry = path.join(__dirname, '..', 'server.js');
  if (isDev || fs.existsSync(devEntry)) return devEntry;
  return path.join(process.resourcesPath, 'server.js');
}

function resolveLibraryDir() {
  // Persist user data outside the app bundle in prod.
  if (isDev) return path.join(__dirname, '..', 'library');
  return path.join(app.getPath('userData'), 'library');
}

function resolvePublicDir() {
  // server.js still wants a PUBLIC_DIR (legacy static mount); we point it at
  // an empty dir or the dist if present so it doesn't crash.
  if (isDev) return path.join(__dirname, '..', 'public');
  const distDir = path.join(process.resourcesPath, 'dist');
  if (fs.existsSync(distDir)) return distDir;
  return path.join(__dirname, '..', 'public');
}

// ----------------------------------------------------------------
// Backend lifecycle
// ----------------------------------------------------------------
function startServer() {
  const entry = resolveServerEntry();
  if (!fs.existsSync(entry)) {
    console.error('[wax] server.js not found at', entry);
    return;
  }

  const env = {
    ...process.env,
    PORT: SERVER_PORT,
    WAX_LIBRARY_DIR: resolveLibraryDir(),
    WAX_PUBLIC_DIR: resolvePublicDir(),
  };
  const ytDlp = resolveBundledBinary('yt-dlp');
  if (ytDlp) env.WAX_YT_DLP = ytDlp;
  const ffmpeg = resolveBundledBinary('ffmpeg');
  if (ffmpeg) env.WAX_FFMPEG = ffmpeg;

  // Ensure library dir exists so server.js mkdir doesn't blow up.
  try { fs.mkdirSync(env.WAX_LIBRARY_DIR, { recursive: true }); } catch {}

  serverProc = fork(entry, [], {
    env,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });

  serverProc.on('error', (err) => {
    console.error('[wax] server fork error:', err);
  });
  serverProc.on('exit', (code, signal) => {
    if (code !== 0 && !app.isQuiting) {
      console.warn(`[wax] server exited code=${code} signal=${signal}`);
    }
  });
}

function stopServer() {
  if (!serverProc) return;
  try { serverProc.kill('SIGTERM'); } catch {}
  serverProc = null;
}

// ----------------------------------------------------------------
// Window
// ----------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 600,
    backgroundColor: '#0d0d10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Open external links in the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('file://')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(VITE_URL);
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
    const fallback = path.join(process.resourcesPath, 'dist', 'index.html');
    const target = fs.existsSync(indexHtml) ? indexHtml : fallback;
    mainWindow.loadFile(target).catch((err) => {
      dialog.showErrorBox('Wax', `Cannot load UI: ${err.message}`);
    });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ----------------------------------------------------------------
// App boot
// ----------------------------------------------------------------
app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
  stopServer();
});

process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); process.exit(0); });
process.on('SIGTERM', () => { stopServer(); process.exit(0); });
