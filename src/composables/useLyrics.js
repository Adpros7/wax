// Lyrics fetcher — composable used by the player's lyrics button.
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { openLyricsModal, patchLyricsModal } from '@/lib/modal';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';

function guessArtistAndTitle(track) {
  const raw = track.title || '';
  const cleaned = raw
    .replace(/\s*[\[\(](?:slowed|reverb(?:ed)?|lyrics|official|audio|video|hq|4k|remaster|m\/v|mv|hd)[^)\]]*[\]\)]/gi, '')
    .trim();
  const m = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: track.uploader || '', title: cleaned };
}

export async function showLyrics() {
  const player = usePlayerStore();
  const lib = useLibraryStore();
  const trackId = player.queue[player.index];
  const track = lib.findById(trackId);
  if (!track) {
    showToast('Aucune piste en lecture', 'error');
    return;
  }
  const { artist, title } = guessArtistAndTitle(track);
  openLyricsModal({
    artist,
    title,
    status: 'loading',
    content: 'Recherche des paroles…',
  });
  try {
    const data = await api(`/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
    patchLyricsModal({ lyricsStatus: 'ok', lyricsContent: data.lyrics });
  } catch (e) {
    const msg = e.message === 'Paroles introuvables'
      ? `Pas de paroles trouvées pour cette piste.\n\nL'extraction artiste/titre depuis YouTube est imparfaite — la piste « ${artist} — ${title} » n'a peut-être pas été reconnue par lyrics.ovh.`
      : `Erreur : ${e.message}`;
    patchLyricsModal({ lyricsStatus: 'error', lyricsContent: msg });
  }
}
