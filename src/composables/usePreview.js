// Search-result preview audio (12s snippet via /api/preview/:videoId).
// Singleton: only one preview plays at a time, and starting one stops the
// main player.
import { reactive } from 'vue';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { usePlayerStore } from '@/stores/player';
import { usePrefsStore } from '@/stores/prefs';

const previewState = reactive({
  audio: null,
  videoId: null,
  loadingId: null,
});

export function stopPreview() {
  if (previewState.audio) {
    try { previewState.audio.pause(); } catch {}
    previewState.audio = null;
  }
  previewState.videoId = null;
  previewState.loadingId = null;
}

export async function togglePreview(videoId) {
  if (previewState.videoId === videoId) {
    stopPreview();
    return;
  }
  stopPreview();
  const player = usePlayerStore();
  if (player.audioEl && !player.audioEl.paused) player.audioEl.pause();
  previewState.loadingId = videoId;
  try {
    const { url } = await api(`/api/preview/${videoId}`);
    if (previewState.loadingId !== videoId) return;
    const prefs = usePrefsStore();
    const audio = new Audio(url);
    audio.volume = prefs.volume * 0.7;
    audio.addEventListener('ended', () => {
      if (previewState.audio === audio) {
        previewState.audio = null;
        previewState.videoId = null;
      }
    });
    audio.addEventListener('error', () => {
      if (previewState.audio === audio) {
        previewState.audio = null;
        previewState.videoId = null;
      }
      showToast('Aperçu illisible', 'error');
    });
    await audio.play();
    previewState.audio = audio;
    previewState.videoId = videoId;
    previewState.loadingId = null;
  } catch (e) {
    if (previewState.loadingId === videoId) previewState.loadingId = null;
    showToast('Aperçu indisponible', 'error');
  }
}

export function usePreviewState() {
  return previewState;
}
