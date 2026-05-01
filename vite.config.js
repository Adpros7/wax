import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// In Electron we serve files from disk via file://, so use relative base.
export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward API + audio + previews + jobs SSE to the Express backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/audio': 'http://localhost:3000',
      '/preview-files': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
  },
});
