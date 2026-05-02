// AudioPlayerHandler bridges just_audio with audio_service so iOS gets
// real lock-screen / Control Center / CarPlay metadata + transport
// controls automatically. We expose the raw just_audio player for things
// like seeking from the UI; audio_service handles the OS integration.
import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';
import '../api/models.dart';

class WaxAudioHandler extends BaseAudioHandler with SeekHandler {
  final AudioPlayer player = AudioPlayer();

  // Active queue + index in our own bookkeeping (we mirror it onto the
  // audio_service queue but keep a typed copy for the UI).
  final List<Track> tracks = [];
  int index = -1;

  WaxAudioHandler() {
    _wirePlaybackState();
    _wireQueueAdvance();
    _configureAudioSession();
  }

  Future<void> _configureAudioSession() async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());
  }

  // Forward just_audio playback events to audio_service's PlaybackState
  // so the lock screen + Control Center stay in sync.
  void _wirePlaybackState() {
    player.playbackEventStream.listen((event) {
      final processing = {
        ProcessingState.idle: AudioProcessingState.idle,
        ProcessingState.loading: AudioProcessingState.loading,
        ProcessingState.buffering: AudioProcessingState.buffering,
        ProcessingState.ready: AudioProcessingState.ready,
        ProcessingState.completed: AudioProcessingState.completed,
      }[player.processingState]!;

      playbackState.add(playbackState.value.copyWith(
        controls: [
          MediaControl.skipToPrevious,
          if (player.playing) MediaControl.pause else MediaControl.play,
          MediaControl.skipToNext,
        ],
        systemActions: const {
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
        },
        androidCompactActionIndices: const [0, 1, 2],
        processingState: processing,
        playing: player.playing,
        updatePosition: player.position,
        bufferedPosition: player.bufferedPosition,
        speed: player.speed,
        queueIndex: index >= 0 ? index : null,
      ));
    });
  }

  // When a track finishes, automatically move to the next one in our queue.
  void _wireQueueAdvance() {
    player.processingStateStream.listen((s) {
      if (s == ProcessingState.completed) {
        skipToNext();
      }
    });
  }

  /// Replace the queue and start playing at [startIndex].
  Future<void> playFromList(List<Track> list, int startIndex,
      {required String Function(Track) urlForTrack}) async {
    tracks
      ..clear()
      ..addAll(list);
    index = startIndex.clamp(0, tracks.isEmpty ? 0 : tracks.length - 1);

    // Mirror onto audio_service queue for OS metadata.
    queue.add(tracks.map(_toMediaItem).toList());
    if (tracks.isEmpty) return;

    await _setSourceAndPlay(urlForTrack);
  }

  Future<void> _setSourceAndPlay(String Function(Track) urlForTrack) async {
    final t = tracks[index];
    mediaItem.add(_toMediaItem(t));
    try {
      await player.setUrl(urlForTrack(t));
      await player.play();
    } catch (e, st) {
      // Swallow but log — caller (UI) should surface a toast.
      // ignore: avoid_print
      print('audio setUrl failed: $e\n$st');
    }
  }

  MediaItem _toMediaItem(Track t) => MediaItem(
        id: t.id,
        title: t.title,
        artist: t.uploader,
        duration: Duration(milliseconds: (t.duration * 1000).round()),
        artUri: t.thumbnail.isEmpty ? null : Uri.parse(t.thumbnail),
      );

  // ============================================================
  // BaseAudioHandler overrides — wired to OS controls / lock screen.
  // ============================================================
  @override
  Future<void> play() => player.play();

  @override
  Future<void> pause() => player.pause();

  @override
  Future<void> seek(Duration position) => player.seek(position);

  @override
  Future<void> stop() async {
    await player.stop();
    await super.stop();
  }

  @override
  Future<void> skipToNext() async {
    if (tracks.isEmpty) return;
    index = (index + 1) % tracks.length;
    // Caller passes urlForTrack via playFromList; for skip we re-derive:
    final t = tracks[index];
    mediaItem.add(_toMediaItem(t));
    final url = _resolveStreamUrl?.call(t);
    if (url == null) return;
    await player.setUrl(url);
    await player.play();
  }

  @override
  Future<void> skipToPrevious() async {
    if (tracks.isEmpty) return;
    if (player.position > const Duration(seconds: 3)) {
      await player.seek(Duration.zero);
      return;
    }
    index = (index - 1 + tracks.length) % tracks.length;
    final t = tracks[index];
    mediaItem.add(_toMediaItem(t));
    final url = _resolveStreamUrl?.call(t);
    if (url == null) return;
    await player.setUrl(url);
    await player.play();
  }

  // The handler is constructed before we have access to ApiClient; the UI
  // injects this resolver after the ProviderScope is built.
  String Function(Track)? _resolveStreamUrl;
  set urlResolver(String Function(Track) fn) => _resolveStreamUrl = fn;
}
