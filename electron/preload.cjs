// Preload — currently a thin no-op. Exposed for forward-compat (we may want
// to hand the renderer some platform info or IPC channels later).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wax', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
