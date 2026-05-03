// Tiny reactive i18n. `t(key, params)` reads from the active locale's catalog
// (with English fallback). The locale lives on a reactive proxy, so any
// component that calls `t()` inside its render function re-renders when the
// locale changes.
//
// Conventions:
//   - Keys are namespaced ('common.cancel', 'player.shuffle', …).
//   - Values are either strings with `{name}` placeholders, or functions
//     taking a single arg (number for plurals, object for multiple params).
//   - Callers pass `{ name: value }` for placeholders; for plural-style
//     entries that take a number, pass the number directly.
import { reactive, watchEffect } from 'vue';

export const SUPPORTED_LOCALES = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

export const DEFAULT_LOCALE = 'en';

const messages = {
  en: {
    // Common
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.rename': 'Rename',
    'common.close': 'Close',
    'common.add': 'Add',
    'common.create': 'Create',
    'common.add_n': (n) => `Add ${n}`,
    'common.download': 'Download',
    'common.download_n': (n) => `Download ${n}`,
    'common.loading': 'Loading…',
    'common.all': 'All',
    'common.none': 'None',
    'common.error_prefix': (msg) => `Error: ${msg}`,
    'common.tracks': (n) => `${n} track${n === 1 ? '' : 's'}`,
    'common.selected_of': ({ n, total }) => `${n} selected of ${total}`,

    // Sidebar / nav
    'nav.search': 'Search',
    'nav.settings': 'Settings',
    'nav.your_library': 'Your library',
    'nav.new_playlist': 'New playlist',
    'support.label': 'Buy me a coffee',
    'support.tooltip': "If Wax saves you time, support the project — pure gratitude tip, no feature is gated.",

    // Library / smart
    'library.favorites': 'Favorites',
    'library.playlist_subtitle': (n) => `Playlist · ${n} track${n === 1 ? '' : 's'}`,

    // Search view
    'search.eyebrow': 'Search',
    'search.hero': 'What do you want to listen to?',
    'search.subtitle': 'Type a title, an artist',
    'search.placeholder': 'Chase Atlantic, Daft Punk Around the World, or a URL…',
    'search.no_results': (q) => `No results for "${q}"`,
    'search.youtube_playlist': 'YouTube playlist',
    'search.clear': 'Clear',
    'search.searching': 'Searching YouTube…',
    'search.failed': (msg) => `Search failed: ${msg}`,

    // Library view
    'library.hero': 'Favorites',
    'library.empty_hint': "No favorites yet. Tap the ❤ on any track to add it here.",

    // Mix view
    'mix.eyebrow': 'Mix',
    'mix.eyebrow_temp': 'Inspired mix · Temporary',
    'mix.hero': (title) => `Mix inspired by "${title}"`,
    'mix.save': 'Save',
    'mix.close_title': 'Close mix',
    'mix.unsaved': 'unsaved',

    // Discover
    'discover.title': 'Discover',
    'discover.inspired_by': (title) => `Inspired by ${title}`,
    'discover.top_today': "Today's Top Hits",
    'discover.top_subtitle': 'The hottest tracks on YouTube right now',
    'discover.inspired_by_label': 'Inspired by',
    'discover.refresh': 'Refresh',

    // Player
    'player.shuffle': 'Shuffle',
    'player.previous': 'Previous',
    'player.next': 'Next',
    'player.play_pause': 'Play / Pause',
    'player.repeat': (mode) => `Repeat: ${mode}`,
    'player.repeat_off': 'off',
    'player.repeat_one': 'track',
    'player.repeat_all': 'all',
    'player.add_to_favorites': 'Add to favorites',
    'player.remove_from_favorites': 'Remove from favorites',
    'player.lyrics': 'Lyrics',
    'player.crossfade': 'Crossfade',
    'player.queue': 'Queue',
    'player.mute': 'Mute',
    'player.loading': 'Loading…',
    'player.crossfade_on': (s) => `Crossfade on (${s} s)`,
    'player.crossfade_off': 'Crossfade off',

    // Track row
    'track.play': 'Play',
    'track.add_playlist': 'Add to a playlist',
    'track.rename': 'Rename',
    'track.download_offline': 'Download for offline listening',
    'track.add_queue': 'Add to queue',
    'track.mix_from': 'Mix inspired by this track',
    'track.remove_offline': 'Remove from offline',
    'track.not_downloaded': 'Not downloaded',
    'track.downloading_pct': (pct) => `Downloading ${pct}%`,
    'track.converting': 'Converting MP3…',
    'track.remove_from_playlist': 'Remove from playlist',
    'track.delete': 'Delete',

    // Queue panel
    'queue.title': 'Queue',
    'queue.empty': 'No upcoming tracks',
    'queue.empty_after': 'Nothing else after this one.',
    'queue.now_playing': 'Now playing',
    'queue.next_up': 'Up next',
    'queue.remove': 'Remove',

    // Playlist view
    'playlist.eyebrow': 'Playlist',
    'playlist.add': 'Add',
    'playlist.download_all': 'Download all',
    'playlist.rename': 'Rename',
    'playlist.delete': 'Delete',
    'playlist.play_all': 'Play all',
    'playlist.empty': 'This playlist is empty. Add tracks from your library.',

    // Artist view
    'artist.eyebrow': 'Artist',
    'artist.go_to': (name) => `View all tracks by ${name}`,
    'artist.empty': 'No tracks by this artist in your library yet.',

    // Settings — tabs
    'settings.title': 'Settings',
    'settings.tabs.appearance': 'Theme',
    'settings.tabs.equalizer': 'Equalizer',
    'settings.tabs.general': 'General',

    // Settings — appearance
    'settings.appearance.help': 'Pick a theme — dark or light, soft or bold.',
    'settings.appearance.dark': 'Dark',
    'settings.appearance.light': 'Light',

    // Theme display names (resolved at render time from THEMES[].labelKey)
    'theme.dark': 'Dark',
    'theme.ardoise': 'Slate',
    'theme.midnight': 'Midnight',
    'theme.vinyle': 'Vinyl',
    'theme.mocha': 'Mocha',
    'theme.bordeaux': 'Bordeaux',
    'theme.forest': 'Forest',
    'theme.studio': 'Studio',
    'theme.dracula': 'Dracula',
    'theme.nord': 'Nord',
    'theme.tokyo-night': 'Tokyo Night',
    'theme.rose-pine': 'Rose Pine',
    'theme.gruvbox': 'Gruvbox',
    'theme.neon': 'Neon',
    'theme.paper': 'Paper',
    'theme.lin': 'Linen',
    'theme.cream': 'Cream',
    'theme.sable': 'Sand',
    'theme.peche': 'Peach',
    'theme.mint': 'Mint',
    'theme.glacier': 'Glacier',
    'theme.lavende': 'Lavender',

    // Settings — EQ
    'settings.eq.title': 'Equalizer',
    'settings.eq.help': 'Adjust the audio output in real time (±12 dB).',
    'settings.eq.bass': 'Bass',
    'settings.eq.mid': 'Mid',
    'settings.eq.treble': 'Treble',
    'settings.eq.reset': 'Reset EQ',

    // Settings — crossfade
    'settings.crossfade.title': 'Crossfade',
    'settings.crossfade.help': 'Fades the next track in over the last few seconds.',
    'settings.crossfade.enable': 'Enable',
    'settings.crossfade.duration': 'Duration',

    // Settings — library cleanup
    'settings.library.title': 'Library',
    'settings.library.help': 'Tracks added automatically (via Mix) without belonging to a playlist accumulate silently.',
    'settings.library.orphans': (n) => `${n} orphan track${n === 1 ? '' : 's'}`,
    'settings.library.clean': 'Clean',
    'settings.library.cleaning': 'Cleaning…',
    'settings.library.clean_done': (n) => `${n} track${n === 1 ? '' : 's'} removed`,
    'settings.library.clean_nothing': 'Nothing to clean',

    // Settings — language
    'settings.language.title': 'Language',
    'settings.language.help': 'Restart not required — applies on the fly.',

    // Settings — data export / import
    'settings.data.title': 'Backup',
    'settings.data.help': 'Export everything (library, playlists, prefs) into a single JSON file, or restore from a previous backup. Audio files (MP3) aren\'t included — copy library/audio/ separately if you want offline files migrated.',
    'settings.data.export': 'Export',
    'settings.data.exporting': 'Exporting…',
    'settings.data.import': 'Import',
    'settings.data.importing': 'Importing…',
    'settings.data.export_done': ({ tracks, playlists }) => `Exported ${tracks} track${tracks === 1 ? '' : 's'} and ${playlists} playlist${playlists === 1 ? '' : 's'}`,
    'settings.data.import_done': ({ tracks, playlists }) => `Imported ${tracks} track${tracks === 1 ? '' : 's'} and ${playlists} playlist${playlists === 1 ? '' : 's'} — reloading…`,
    'settings.data.import_confirm.title': 'Replace all your data?',
    'settings.data.import_confirm.message': ({ tracks, playlists }) =>
      `This will overwrite your library and playlists with ${tracks} track${tracks === 1 ? '' : 's'} and ${playlists} playlist${playlists === 1 ? '' : 's'} from the backup. The app will reload.`,

    // Settings — factory reset
    'settings.reset.title': 'Reset',
    'settings.reset.help': 'Permanently delete all tracks, playlists, and offline MP3s. Your theme, language, and other UI preferences are kept. This cannot be undone.',
    'settings.reset.button': 'Reset everything',
    'settings.reset.wiping': 'Resetting…',
    'settings.reset.done': 'Library reset — reloading…',
    'settings.reset.confirm.title': 'Reset all your data?',
    'settings.reset.confirm.message': ({ tracks, playlists }) =>
      `This will permanently delete ${tracks} track${tracks === 1 ? '' : 's'}, ${playlists} playlist${playlists === 1 ? '' : 's'}, and every offline MP3 file. Your theme and other UI preferences are kept. The app will reload.`,

    // Modal labels
    'modal.add_to_playlist': 'Add to a playlist',
    'modal.add_to_named': (name) => `Add to "${name}"`,
    'modal.bulk_filter': 'Filter the library…',
    'modal.bulk_no_results': 'No results',
    'modal.no_playlists': 'No playlists yet. Create one from the sidebar (+ icon).',
    'modal.already_added': 'Already added',
    'toast.added_to_named_playlist': (name) => `Added to "${name}"`,

    // Job statuses
    'job.preparing': 'Preparing…',
    'job.downloading': 'Downloading',
    'job.converting': 'Converting',
    'job.success': 'Done',
    'job.error': 'Error',
    'job.queued': 'Queued',

    // Toasts
    'toast.added_to_favorites': 'Added to favorites',
    'toast.removed_from_favorites': 'Removed from favorites',
    'toast.already_in_favorites': 'Already in favorites',
    'toast.added_to_playlist': 'Added to playlist',
    'toast.already_in_playlist': 'Already in this playlist',
    'toast.added_to_queue': 'Added to queue',
    'toast.already_in_queue': 'Already in queue',
    'toast.added': 'Added',
    'toast.added_named': (title) => `Added: ${title}`,
    'toast.already_in_library': 'Already in library',
    'toast.local_file_removed': 'Local file removed',
    'toast.track_deleted': 'Track removed',
    'toast.fav_error': 'Favorites error',
    'toast.play_error_named': (title) => `Couldn't play "${title}"`,
    'toast.play_error': 'Playback error',
    'toast.dl_started_n': (n) => `Starting ${n} download${n === 1 ? '' : 's'}…`,
    'toast.no_track_selected': 'No track selected',
    'toast.dl_error': (msg) => `Download error: ${msg}`,
    'toast.available_offline': 'Available offline',
    'toast.all_already_here': 'All of your tracks are already in this playlist',
    'toast.all_already_offline': 'All tracks are already offline',
    'toast.tracks_added_n': (n) => `${n} track${n === 1 ? '' : 's'} added`,
    'toast.playlist_created': 'Playlist created',
    'toast.playlist_deleted': 'Playlist deleted',
    'toast.playlist_renamed': 'Playlist renamed',
    'toast.reorder_error': (msg) => `Reorder error: ${msg}`,
    'toast.mix_generating': 'Generating mix…',
    'toast.mix_empty': 'Empty mix',
    'toast.mix_no_ytid': 'No YouTube ID for this track',
    'toast.mix_error': (msg) => `Mix error: ${msg}`,
    'toast.mix_add_error': (msg) => `Add error: ${msg}`,
    'toast.mix_saved_n': (n) => `Saved as a playlist (${n} track${n === 1 ? '' : 's'})`,
    'toast.stream_unavailable': 'Stream unavailable',
    'toast.preview_unreadable': 'Preview unreadable',
    'toast.preview_unavailable': 'Preview unavailable',
    'toast.no_track_playing': 'No track playing',
    'toast.lyrics_error': 'Lyrics unavailable',
    'toast.youtube_playlist_loading': 'Loading the YouTube playlist…',
    'toast.youtube_enum_failed': (msg) => `Enumeration failed: ${msg}`,

    // Prompts / confirms
    'prompt.rename_track.title': 'Rename',
    'prompt.rename_track.confirm': 'Rename',
    'prompt.new_playlist.title': 'New playlist',
    'prompt.new_playlist.placeholder': 'My gems',
    'prompt.rename_playlist.title': 'Rename the playlist',
    'prompt.save_mix.title': 'Save the mix',
    'prompt.save_mix.placeholder': 'Mix name',
    'prompt.save_mix.help': 'The mix becomes a permanent playlist. Tracks stay streamable (no download). You can still download them one by one afterward.',
    'confirm.delete_playlist.title': (name) => `Delete "${name}"?`,
    'confirm.delete_playlist.message': () => 'The tracks stay in your library — only the playlist is removed.',
    'confirm.delete_track.title': 'Remove this track?',
    'confirm.delete_track.message': (title) => `"${title}" will be removed from your library and all playlists. The MP3 file will be deleted.`,
    'confirm.delete_track.fallback': 'The file will be removed from your library.',

    // Lyrics modal
    'lyrics.title': 'Lyrics',
    'lyrics.loading': 'Searching for lyrics…',
    'lyrics.not_found': 'No lyrics found.',
    'lyrics.not_found_detail': ({ artist, title }) =>
      `No lyrics found for this track.\n\nArtist/title extraction from YouTube is imperfect — "${artist} — ${title}" might not have been recognized by lyrics.ovh.`,
  },

  fr: {
    // Common
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.save': 'Sauvegarder',
    'common.delete': 'Supprimer',
    'common.rename': 'Renommer',
    'common.close': 'Fermer',
    'common.add': 'Ajouter',
    'common.create': 'Créer',
    'common.add_n': (n) => `Ajouter ${n}`,
    'common.download': 'Télécharger',
    'common.download_n': (n) => `Télécharger ${n}`,
    'common.loading': 'Chargement…',
    'common.all': 'Tout',
    'common.none': 'Aucun',
    'common.error_prefix': (msg) => `Erreur : ${msg}`,
    'common.tracks': (n) => `${n} titre${n > 1 ? 's' : ''}`,
    'common.selected_of': ({ n, total }) => `${n} sélectionnée${n > 1 ? 's' : ''} sur ${total}`,

    // Sidebar / nav
    'nav.search': 'Rechercher',
    'nav.settings': 'Paramètres',
    'nav.your_library': 'Ta bibliothèque',
    'nav.new_playlist': 'Nouvelle playlist',
    'support.label': 'Offrir un café',
    'support.tooltip': "Si Wax te fait gagner du temps, soutiens le projet — pur don de gratitude, aucune feature n'est verrouillée derrière.",

    // Library / smart
    'library.favorites': 'Favoris',
    'library.playlist_subtitle': (n) => `Playlist · ${n} titre${n > 1 ? 's' : ''}`,

    // Search view
    'search.eyebrow': 'Recherche',
    'search.hero': 'Que veux-tu écouter ?',
    'search.subtitle': 'Tape un titre, un artiste',
    'search.placeholder': 'Chase Atlantic, Daft Punk Around the World, ou une URL…',
    'search.no_results': (q) => `Aucun résultat pour « ${q} »`,
    'search.youtube_playlist': 'Playlist YouTube',
    'search.clear': 'Effacer',
    'search.searching': 'Recherche YouTube…',
    'search.failed': (msg) => `Recherche échouée : ${msg}`,

    'library.hero': 'Favoris',
    'library.empty_hint': "Aucun favori. Clique sur le ❤ d'un morceau pour l'ajouter ici.",

    // Mix view
    'mix.eyebrow': 'Mix',
    'mix.eyebrow_temp': 'Mix inspiré · Temporaire',
    'mix.hero': (title) => `Mix inspiré par « ${title} »`,
    'mix.save': 'Sauvegarder',
    'mix.close_title': 'Fermer le mix',
    'mix.unsaved': 'non sauvegardé',

    // Discover
    'discover.title': 'Découverte',
    'discover.inspired_by': (title) => `Inspiré par ${title}`,
    'discover.top_today': 'Top du moment',
    'discover.top_subtitle': 'Les hits du moment sur YouTube',
    'discover.inspired_by_label': 'Inspiré par',
    'discover.refresh': 'Régénérer',

    // Player
    'player.shuffle': 'Aléatoire',
    'player.previous': 'Précédent',
    'player.next': 'Suivant',
    'player.play_pause': 'Lecture/Pause',
    'player.repeat': (mode) => `Répéter : ${mode}`,
    'player.repeat_off': 'non',
    'player.repeat_one': 'piste',
    'player.repeat_all': 'tout',
    'player.add_to_favorites': 'Ajouter aux favoris',
    'player.remove_from_favorites': 'Retirer des favoris',
    'player.lyrics': 'Paroles',
    'player.crossfade': 'Crossfade',
    'player.queue': "File d'attente",
    'player.mute': 'Muet',
    'player.loading': 'Chargement…',
    'player.crossfade_on': (s) => `Crossfade activé (${s} s)`,
    'player.crossfade_off': 'Crossfade désactivé',

    // Track row
    'track.play': 'Lire',
    'track.add_playlist': 'Ajouter à une playlist',
    'track.rename': 'Renommer',
    'track.download_offline': "Télécharger pour l'écoute hors ligne",
    'track.add_queue': 'Ajouter à la queue',
    'track.mix_from': 'Mix inspiré par ce titre',
    'track.remove_offline': "Retirer de l'offline",
    'track.not_downloaded': 'Non téléchargé',
    'track.downloading_pct': (pct) => `Téléchargement ${pct}%`,
    'track.converting': 'Conversion MP3…',
    'track.remove_from_playlist': 'Retirer de la playlist',
    'track.delete': 'Supprimer',

    // Queue panel
    'queue.title': "File d'attente",
    'queue.empty': 'Aucun titre à venir',
    'queue.empty_after': 'Plus rien après celle-ci.',
    'queue.now_playing': 'En cours',
    'queue.next_up': 'À suivre',
    'queue.remove': 'Retirer',

    // Playlist view
    'playlist.eyebrow': 'Playlist',
    'playlist.add': 'Ajouter',
    'playlist.download_all': 'Tout télécharger',
    'playlist.rename': 'Renommer',
    'playlist.delete': 'Supprimer',
    'playlist.play_all': 'Tout lire',
    'playlist.empty': 'Cette playlist est vide. Ajoute des pistes depuis la bibliothèque.',

    // Artist view
    'artist.eyebrow': 'Artiste',
    'artist.go_to': (name) => `Voir toutes les pistes de ${name}`,
    'artist.empty': "Aucune piste de cet artiste dans ta bibliothèque pour l'instant.",

    // Settings — tabs
    'settings.title': 'Paramètres',
    'settings.tabs.appearance': 'Thème',
    'settings.tabs.equalizer': 'Égaliseur',
    'settings.tabs.general': 'Général',

    // Settings — appearance
    'settings.appearance.help': 'Sélectionne un thème — sombre ou clair, doux ou contrasté.',
    'settings.appearance.dark': 'Sombres',
    'settings.appearance.light': 'Clairs',

    // Theme display names (resolved at render time from THEMES[].labelKey)
    'theme.dark': 'Sombre',
    'theme.ardoise': 'Ardoise',
    'theme.midnight': 'Minuit',
    'theme.vinyle': 'Vinyle',
    'theme.mocha': 'Moka',
    'theme.bordeaux': 'Bordeaux',
    'theme.forest': 'Forêt',
    'theme.studio': 'Studio',
    'theme.dracula': 'Dracula',
    'theme.nord': 'Nord',
    'theme.tokyo-night': 'Tokyo Night',
    'theme.rose-pine': 'Rose Pine',
    'theme.gruvbox': 'Gruvbox',
    'theme.neon': 'Néon',
    'theme.paper': 'Papier',
    'theme.lin': 'Lin',
    'theme.cream': 'Crème',
    'theme.sable': 'Sable',
    'theme.peche': 'Pêche',
    'theme.mint': 'Menthe',
    'theme.glacier': 'Glacier',
    'theme.lavende': 'Lavande',

    // Settings — EQ
    'settings.eq.title': 'Égaliseur',
    'settings.eq.help': 'Ajuste le rendu audio en temps réel (±12 dB).',
    'settings.eq.bass': 'Basses',
    'settings.eq.mid': 'Médiums',
    'settings.eq.treble': 'Aigus',
    'settings.eq.reset': "Réinitialiser l'EQ",

    // Settings — crossfade
    'settings.crossfade.title': 'Crossfade',
    'settings.crossfade.help': 'Fond enchaîne la piste suivante sur les dernières secondes.',
    'settings.crossfade.enable': 'Activer',
    'settings.crossfade.duration': 'Durée',

    // Settings — library cleanup
    'settings.library.title': 'Bibliothèque',
    'settings.library.help': "Les pistes ajoutées automatiquement (via Mix) sans être dans une playlist s'accumulent silencieusement.",
    'settings.library.orphans': (n) => `${n} piste${n > 1 ? 's' : ''} orpheline${n > 1 ? 's' : ''}`,
    'settings.library.clean': 'Nettoyer',
    'settings.library.cleaning': 'Nettoyage…',
    'settings.library.clean_done': (n) => `${n} piste${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}`,
    'settings.library.clean_nothing': 'Rien à nettoyer',

    // Settings — language
    'settings.language.title': 'Langue',
    'settings.language.help': "Pas besoin de redémarrer — appliqué à la volée.",

    // Settings — data export / import
    'settings.data.title': 'Sauvegarde',
    'settings.data.help': "Exporte tout (bibliothèque, playlists, préférences) dans un seul fichier JSON, ou restaure depuis une sauvegarde précédente. Les fichiers audio (MP3) ne sont pas inclus — copie library/audio/ séparément si tu veux migrer les fichiers hors ligne.",
    'settings.data.export': 'Exporter',
    'settings.data.exporting': 'Export…',
    'settings.data.import': 'Importer',
    'settings.data.importing': 'Import…',
    'settings.data.export_done': ({ tracks, playlists }) => `${tracks} piste${tracks > 1 ? 's' : ''} et ${playlists} playlist${playlists > 1 ? 's' : ''} exportées`,
    'settings.data.import_done': ({ tracks, playlists }) => `${tracks} piste${tracks > 1 ? 's' : ''} et ${playlists} playlist${playlists > 1 ? 's' : ''} importées — rechargement…`,
    'settings.data.import_confirm.title': 'Remplacer toutes tes données ?',
    'settings.data.import_confirm.message': ({ tracks, playlists }) =>
      `Cela écrasera ta bibliothèque et tes playlists avec ${tracks} piste${tracks > 1 ? 's' : ''} et ${playlists} playlist${playlists > 1 ? 's' : ''} venant de la sauvegarde. L'app rechargera.`,

    // Settings — factory reset
    'settings.reset.title': 'Réinitialiser',
    'settings.reset.help': "Supprime définitivement toutes tes pistes, playlists et fichiers MP3 hors ligne. Ton thème, ta langue et tes autres préférences UI sont conservés. Action irréversible.",
    'settings.reset.button': 'Tout réinitialiser',
    'settings.reset.wiping': 'Réinitialisation…',
    'settings.reset.done': 'Bibliothèque réinitialisée — rechargement…',
    'settings.reset.confirm.title': 'Réinitialiser toutes tes données ?',
    'settings.reset.confirm.message': ({ tracks, playlists }) =>
      `Cela va supprimer définitivement ${tracks} piste${tracks > 1 ? 's' : ''}, ${playlists} playlist${playlists > 1 ? 's' : ''} et tous les fichiers MP3 hors ligne. Ton thème et tes préférences UI sont conservés. L'app rechargera.`,

    // Modal labels
    'modal.add_to_playlist': 'Ajouter à une playlist',
    'modal.add_to_named': (name) => `Ajouter à « ${name} »`,
    'modal.bulk_filter': 'Filtrer la bibliothèque…',
    'modal.bulk_no_results': 'Aucun résultat',
    'modal.no_playlists': 'Aucune playlist. Crée-en une depuis la sidebar (icône +).',
    'modal.already_added': 'Déjà ajouté',
    'toast.added_to_named_playlist': (name) => `Ajouté à « ${name} »`,

    // Job statuses
    'job.preparing': 'Préparation…',
    'job.downloading': 'Téléchargement',
    'job.converting': 'Conversion',
    'job.success': 'Terminé',
    'job.error': 'Erreur',
    'job.queued': 'En attente',

    // Toasts
    'toast.added_to_favorites': 'Ajouté aux favoris',
    'toast.removed_from_favorites': 'Retiré des favoris',
    'toast.already_in_favorites': 'Déjà dans les favoris',
    'toast.added_to_playlist': 'Ajouté à la playlist',
    'toast.already_in_playlist': 'Déjà dans cette playlist',
    'toast.added_to_queue': 'Ajouté à la queue',
    'toast.already_in_queue': 'Déjà dans la queue',
    'toast.added': 'Ajouté',
    'toast.added_named': (title) => `Ajouté : ${title}`,
    'toast.already_in_library': 'Déjà dans la bibliothèque',
    'toast.local_file_removed': 'Fichier local supprimé',
    'toast.track_deleted': 'Piste supprimée',
    'toast.fav_error': 'Erreur favoris',
    'toast.play_error_named': (title) => `Impossible de lire « ${title} »`,
    'toast.play_error': 'Erreur de lecture',
    'toast.dl_started_n': (n) => `Lancement de ${n} téléchargement${n > 1 ? 's' : ''}…`,
    'toast.no_track_selected': 'Aucune piste sélectionnée',
    'toast.dl_error': (msg) => `Erreur téléchargement : ${msg}`,
    'toast.available_offline': 'Disponible hors ligne',
    'toast.all_already_here': 'Toutes tes pistes sont déjà dans cette playlist',
    'toast.all_already_offline': 'Toutes les pistes sont déjà hors ligne',
    'toast.tracks_added_n': (n) => `${n} piste${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`,
    'toast.playlist_created': 'Playlist créée',
    'toast.playlist_deleted': 'Playlist supprimée',
    'toast.playlist_renamed': 'Playlist renommée',
    'toast.reorder_error': (msg) => `Erreur réorganisation : ${msg}`,
    'toast.mix_generating': 'Génération du mix…',
    'toast.mix_empty': 'Mix vide',
    'toast.mix_no_ytid': "Pas d'ID YouTube pour cette piste",
    'toast.mix_error': (msg) => `Erreur mix : ${msg}`,
    'toast.mix_add_error': (msg) => `Erreur ajout : ${msg}`,
    'toast.mix_saved_n': (n) => `Sauvegardé en playlist (${n} titre${n > 1 ? 's' : ''})`,
    'toast.stream_unavailable': 'Stream indisponible',
    'toast.preview_unreadable': 'Aperçu illisible',
    'toast.preview_unavailable': 'Aperçu indisponible',
    'toast.no_track_playing': 'Aucune piste en lecture',
    'toast.lyrics_error': 'Paroles indisponibles',
    'toast.youtube_playlist_loading': 'Lecture de la playlist YouTube…',
    'toast.youtube_enum_failed': (msg) => `Énumération impossible : ${msg}`,

    // Prompts / confirms
    'prompt.rename_track.title': 'Renommer',
    'prompt.rename_track.confirm': 'Renommer',
    'prompt.new_playlist.title': 'Nouvelle playlist',
    'prompt.new_playlist.placeholder': 'Mes pépites',
    'prompt.rename_playlist.title': 'Renommer la playlist',
    'prompt.save_mix.title': 'Sauvegarder le mix',
    'prompt.save_mix.placeholder': 'Nom du mix',
    'prompt.save_mix.help': 'Le mix devient une playlist permanente. Les pistes restent en streaming (pas de téléchargement). Tu pourras toujours en télécharger une par une après.',
    'confirm.delete_playlist.title': (name) => `Supprimer « ${name} » ?`,
    'confirm.delete_playlist.message': () => 'Les pistes resteront dans ta bibliothèque, seule la playlist sera supprimée.',
    'confirm.delete_track.title': 'Supprimer cette piste ?',
    'confirm.delete_track.message': (title) => `« ${title} » sera retirée de ta bibliothèque et de toutes les playlists. Le fichier MP3 sera supprimé.`,
    'confirm.delete_track.fallback': 'Le fichier sera retiré de ta bibliothèque.',

    // Lyrics modal
    'lyrics.title': 'Paroles',
    'lyrics.loading': 'Recherche des paroles…',
    'lyrics.not_found': 'Pas de paroles trouvées.',
    'lyrics.not_found_detail': ({ artist, title }) =>
      `Pas de paroles trouvées pour cette piste.\n\nL'extraction artiste/titre depuis YouTube est imparfaite — la piste « ${artist} — ${title} » n'a peut-être pas été reconnue par lyrics.ovh.`,
  },
};

export const i18nState = reactive({ locale: DEFAULT_LOCALE });

export function setLocale(loc) {
  if (messages[loc]) i18nState.locale = loc;
}

export function t(key, params) {
  const dict = messages[i18nState.locale] || messages[DEFAULT_LOCALE];
  let v = dict[key];
  if (v === undefined) v = messages[DEFAULT_LOCALE][key];
  if (v === undefined) return key;
  if (typeof v === 'function') return v(params);
  if (params && typeof params === 'object') {
    return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
  }
  return v;
}

// Reflect the locale on <html lang="…"> so screen readers + browser
// hyphenation pick up the change.
watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18nState.locale;
  }
});
