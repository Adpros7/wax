// Download jobs store. Handles SSE progress streams from /api/jobs/:id/progress.
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useLibraryStore } from './library';

export const useJobsStore = defineStore('jobs', {
  state: () => ({
    items: [],                  // visible job placeholders
    activeDownloads: new Map(), // url -> { progress, phase, status }
  }),
  actions: {
    isActive(url) {
      return this.activeDownloads.has(url);
    },
    startDownload(url, quality, hint, onReady) {
      if (this.activeDownloads.has(url)) return;
      const placeholder = {
        id: 'tmp-' + Math.random().toString(36).slice(2),
        url,
        title: hint?.title || url,
        progress: 0,
        phase: 'starting',
        status: 'pending',
      };
      this.items.unshift(placeholder);
      const m = new Map(this.activeDownloads);
      m.set(url, { progress: 0, phase: 'starting', status: 'pending' });
      this.activeDownloads = m;
      api('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ url, quality }),
      }).then(({ id }) => {
        placeholder.id = id;
        this._listen(placeholder, onReady);
      }).catch((e) => {
        placeholder.status = 'error';
        placeholder.error = e.message;
        const m2 = new Map(this.activeDownloads);
        m2.delete(url);
        this.activeDownloads = m2;
      });
    },
    _listen(job, onReady) {
      const es = new EventSource(`/api/jobs/${job.id}/progress`);
      es.onmessage = async (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'progress') {
          job.progress = data.progress;
          job.phase = data.phase;
          job.status = 'downloading';
          const m = new Map(this.activeDownloads);
          m.set(job.url, { progress: data.progress, phase: data.phase, status: 'downloading' });
          this.activeDownloads = m;
        } else if (data.type === 'ready') {
          job.status = 'success';
          job.progress = 100;
          job.track = data.track;
          const m = new Map(this.activeDownloads);
          m.delete(job.url);
          this.activeDownloads = m;
          if (data.duplicate) showToast('Déjà dans la bibliothèque', 'success');
          else showToast(`Ajouté : ${data.track.title}`, 'success');
          const lib = useLibraryStore();
          await lib.fetch();
          if (onReady) onReady(data.track);
          es.close();
          setTimeout(() => {
            this.items = this.items.filter((j) => j !== job);
          }, 4000);
        } else if (data.type === 'error') {
          job.status = 'error';
          job.error = data.error;
          const m = new Map(this.activeDownloads);
          m.delete(job.url);
          this.activeDownloads = m;
          showToast('Erreur : ' + data.error, 'error');
          es.close();
        }
      };
      es.onerror = () => es.close();
    },
  },
});
