// Riverpod providers — wires the API client, audio handler, and screen state.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audio_service/audio_service.dart';
import 'api/api_client.dart';
import 'api/models.dart';
import 'audio/audio_handler.dart';

// =============================================================
// Singletons
// =============================================================
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

// Initialized once in main() before runApp via initAudioService(ref).
late final WaxAudioHandler audioHandlerInstance;
final audioHandlerProvider = Provider<WaxAudioHandler>((ref) => audioHandlerInstance);

Future<void> initAudioService(ProviderContainer container) async {
  audioHandlerInstance = await AudioService.init(
    builder: () => WaxAudioHandler(),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.dylan.wax.audio',
      androidNotificationChannelName: 'Wax playback',
      androidNotificationOngoing: true,
    ),
  );
  // Inject the URL resolver so the handler's skipNext/Previous work.
  final api = container.read(apiClientProvider);
  audioHandlerInstance.urlResolver = (Track t) =>
      t.file != null ? api.fileUrl(t.file!) : api.streamUrl(t.ytId ?? t.id);
}

// =============================================================
// Library / search async state
// =============================================================
final libraryProvider =
    AsyncNotifierProvider<LibraryNotifier, List<Track>>(LibraryNotifier.new);

class LibraryNotifier extends AsyncNotifier<List<Track>> {
  @override
  Future<List<Track>> build() async {
    return ref.read(apiClientProvider).fetchLibrary();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(apiClientProvider).fetchLibrary());
  }

  Future<void> toggleFav(Track t) async {
    final api = ref.read(apiClientProvider);
    final current = state.value ?? const <Track>[];
    final existing = current.where((x) => x.ytId == (t.ytId ?? t.id)).firstOrNull;
    if (existing != null) {
      // Optimistic flip via remove. Backend is the source of truth.
      try {
        await api.setLiked(existing.id, !existing.liked);
        await reload();
      } catch (_) {/* swallow — UI still shows old state */}
    } else {
      try {
        await api.addToLibrary(t);
        await reload();
      } catch (_) {}
    }
  }

  bool isFavorite(Track t) {
    return (state.value ?? const <Track>[])
        .any((x) => x.ytId == (t.ytId ?? t.id) && x.liked);
  }
}

// Search query + debounced results.
class SearchQuery extends Notifier<String> {
  @override
  String build() => '';
  // ignore: use_setters_to_change_properties
  void set(String v) => state = v;
}

final searchQueryProvider = NotifierProvider<SearchQuery, String>(SearchQuery.new);

final searchResultsProvider = FutureProvider<List<Track>>((ref) async {
  final q = ref.watch(searchQueryProvider).trim();
  if (q.length < 2) return [];
  // Manual debounce via Future.delayed; if the query changed during the
  // delay, ref.read will be stale and we bail out.
  await Future.delayed(const Duration(milliseconds: 350));
  if (ref.read(searchQueryProvider).trim() != q) return [];
  return ref.read(apiClientProvider).search(q);
});

final trendingProvider = FutureProvider<List<Track>>((ref) async {
  return ref.read(apiClientProvider).trending();
});

final playlistsProvider =
    AsyncNotifierProvider<PlaylistsNotifier, List<Playlist>>(
        PlaylistsNotifier.new);

class PlaylistsNotifier extends AsyncNotifier<List<Playlist>> {
  @override
  Future<List<Playlist>> build() async {
    return ref.read(apiClientProvider).fetchPlaylists();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(apiClientProvider).fetchPlaylists());
  }

  Future<Playlist> create(String name) async {
    final p = await ref.read(apiClientProvider).createPlaylist(name);
    final cur = state.value ?? const <Playlist>[];
    state = AsyncData([p, ...cur]);
    return p;
  }

  Future<void> rename(String id, String name) async {
    final updated = await ref.read(apiClientProvider).renamePlaylist(id, name);
    final cur = state.value ?? const <Playlist>[];
    state = AsyncData([for (final p in cur) p.id == id ? updated : p]);
  }

  Future<void> delete(String id) async {
    await ref.read(apiClientProvider).deletePlaylist(id);
    final cur = state.value ?? const <Playlist>[];
    state = AsyncData(cur.where((p) => p.id != id).toList());
  }

  /// Adds [track] to the given playlist. If [track] is a stream (not yet in
  /// the library), it's silently added to the library first so the playlist
  /// has a stable id to reference.
  Future<void> addTrack(String plId, Track track) async {
    final api = ref.read(apiClientProvider);
    var trackId = track.id;
    if (track.isStream) {
      final libTracks = ref.read(libraryProvider).value ?? const <Track>[];
      final existing = libTracks
          .where((t) => t.ytId == (track.ytId ?? track.id))
          .cast<Track?>()
          .firstWhere((_) => true, orElse: () => null);
      if (existing != null) {
        trackId = existing.id;
      } else {
        final added = await api.addToLibrary(track, liked: false);
        if (added == null) return;
        trackId = added.id;
        // Refresh library so the heart UI on tiles stays accurate.
        await ref.read(libraryProvider.notifier).reload();
      }
    }
    await api.addTrackToPlaylist(plId, trackId);
    // Mutate local copy so the count updates without a full reload.
    final cur = state.value ?? const <Playlist>[];
    state = AsyncData([
      for (final p in cur)
        p.id == plId
            ? Playlist(
                id: p.id,
                name: p.name,
                cover: p.cover,
                trackIds: [...p.trackIds, trackId],
              )
            : p,
    ]);
  }

  Future<void> removeTrack(String plId, String trackId) async {
    await ref.read(apiClientProvider).removeTrackFromPlaylist(plId, trackId);
    final cur = state.value ?? const <Playlist>[];
    state = AsyncData([
      for (final p in cur)
        p.id == plId
            ? Playlist(
                id: p.id,
                name: p.name,
                cover: p.cover,
                trackIds: p.trackIds.where((id) => id != trackId).toList(),
              )
            : p,
    ]);
  }
}

// Lookup: is the currently-playing media item favorited? Drives the heart
// state on the mini + full player without each widget needing custom logic.
final isCurrentFavoriteProvider = Provider<bool>((ref) {
  final media = ref.watch(mediaItemProvider).value;
  if (media == null) return false;
  final lib = ref.watch(libraryProvider).value ?? const <Track>[];
  // mediaItem.id is the library track id for downloads, or ytId for streams.
  // Match either way.
  return lib.any((t) =>
      t.liked && (t.id == media.id || t.ytId == media.id));
});

// Toggle favorite for the currently-playing track. Resolves the right Track
// (or builds a synthetic one from the MediaItem if it's a fresh stream).
Future<void> toggleCurrentFavorite(WidgetRef ref) async {
  final media = ref.read(mediaItemProvider).value;
  if (media == null) return;
  final notifier = ref.read(libraryProvider.notifier);
  final lib = ref.read(libraryProvider).value ?? const <Track>[];
  final existing = lib.where((t) => t.id == media.id || t.ytId == media.id).cast<Track?>().firstWhere((_) => true, orElse: () => null);
  final track = existing ?? Track(
    id: media.id,
    ytId: media.id,
    title: media.title,
    uploader: media.artist ?? '',
    duration: (media.duration ?? Duration.zero).inMilliseconds / 1000.0,
    thumbnail: media.artUri?.toString() ?? '',
  );
  await notifier.toggleFav(track);
}

// =============================================================
// Player state — exposed as streams from the audio_service.
// =============================================================
final mediaItemProvider = StreamProvider<MediaItem?>(
    (ref) => ref.read(audioHandlerProvider).mediaItem);
final playbackStateProvider = StreamProvider<PlaybackState>(
    (ref) => ref.read(audioHandlerProvider).playbackState);
final positionProvider = StreamProvider<Duration>(
    (ref) => ref.read(audioHandlerProvider).player.positionStream);

// Helper extension: firstOrNull on Iterable
extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
