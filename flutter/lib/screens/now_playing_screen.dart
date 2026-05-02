import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../theme.dart';

class NowPlayingScreen extends ConsumerWidget {
  const NowPlayingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final media = ref.watch(mediaItemProvider).value;
    final state = ref.watch(playbackStateProvider).value;
    final position = ref.watch(positionProvider).value ?? Duration.zero;
    final dur = media?.duration ?? Duration.zero;
    final handler = ref.read(audioHandlerProvider);
    final playing = state?.playing ?? false;
    final isFav = ref.watch(isCurrentFavoriteProvider);

    return Scaffold(
      backgroundColor: kBg,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1F0E2E), kBg],
            stops: [0, 0.6],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: Column(
              children: [
                _Header(uploader: media?.artist ?? ''),
                const Spacer(),
                _Cover(art: media?.artUri?.toString()),
                const SizedBox(height: 28),
                _Meta(title: media?.title ?? '', artist: media?.artist ?? ''),
                const SizedBox(height: 22),
                _Progress(position: position, duration: dur, onSeek: (d) => handler.seek(d)),
                const SizedBox(height: 22),
                _Controls(
                  playing: playing,
                  onPrev: handler.skipToPrevious,
                  onNext: handler.skipToNext,
                  onPlayPause: () => playing ? handler.pause() : handler.play(),
                ),
                const Spacer(),
                _BottomActions(isFav: isFav, onFav: () => toggleCurrentFavorite(ref)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String uploader;
  const _Header({required this.uploader});
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          icon: const Icon(Icons.keyboard_arrow_down, size: 28, color: kText),
          onPressed: () => Navigator.of(context).pop(),
        ),
        Expanded(
          child: Column(
            children: [
              const Text('EN LECTURE',
                  style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 1.8,
                      fontWeight: FontWeight.w800,
                      color: kMuted)),
              const SizedBox(height: 2),
              Text(uploader,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: kText)),
            ],
          ),
        ),
        const SizedBox(width: 48),
      ],
    );
  }
}

class _Cover extends StatelessWidget {
  final String? art;
  const _Cover({required this.art});
  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: art == null || art!.isEmpty
            ? Container(color: kPanel2)
            // maxresdefault may 404 on non-HD uploads — fallback chains via
            // CachedNetworkImage's error widget down to hqdefault.
            : CachedNetworkImage(
                imageUrl: maxres(art!),
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => CachedNetworkImage(
                  imageUrl: hd(art!),
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(color: kPanel2),
                ),
              ),
      ),
    );
  }
}

class _BottomActions extends StatelessWidget {
  final bool isFav;
  final VoidCallback onFav;
  const _BottomActions({required this.isFav, required this.onFav});

  @override
  Widget build(BuildContext context) {
    Widget action(IconData icon, String label, {VoidCallback? onTap, Color? color}) {
      return Expanded(
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              children: [
                Icon(icon, color: color ?? kMuted, size: 22),
                const SizedBox(height: 4),
                Text(label,
                    style: TextStyle(fontSize: 11, color: color ?? kMuted)),
              ],
            ),
          ),
        ),
      );
    }
    return Row(children: [
      action(Icons.lyrics_outlined, 'Paroles'),
      action(Icons.radio, 'Mix'),
      action(
        isFav ? Icons.favorite : Icons.favorite_border,
        isFav ? 'Aimé' : 'Favori',
        onTap: onFav,
        color: isFav ? kAccentBright : kMuted,
      ),
      action(Icons.queue_music, 'File'),
    ]);
  }
}

class _Meta extends StatelessWidget {
  final String title;
  final String artist;
  const _Meta({required this.title, required this.artist});
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: kText)),
        const SizedBox(height: 4),
        Text(artist,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14, color: kMuted)),
      ],
    );
  }
}

class _Progress extends StatelessWidget {
  final Duration position;
  final Duration duration;
  final ValueChanged<Duration> onSeek;
  const _Progress({required this.position, required this.duration, required this.onSeek});

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString();
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final max = duration.inMilliseconds.toDouble();
    final value = max == 0
        ? 0.0
        : position.inMilliseconds.toDouble().clamp(0.0, max);
    final remaining = duration - position;
    return Column(
      children: [
        SliderTheme(
          data: SliderThemeData(
            trackHeight: 4,
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
            overlayShape: SliderComponentShape.noOverlay,
            activeTrackColor: kText,
            inactiveTrackColor: kBorder,
            thumbColor: kText,
          ),
          child: Slider(
            value: value,
            max: max == 0 ? 1 : max,
            onChanged: (v) => onSeek(Duration(milliseconds: v.toInt())),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_fmt(position), style: const TextStyle(fontSize: 11, color: kMuted)),
              Text('-${_fmt(remaining < Duration.zero ? Duration.zero : remaining)}',
                  style: const TextStyle(fontSize: 11, color: kMuted)),
            ],
          ),
        ),
      ],
    );
  }
}

class _Controls extends StatelessWidget {
  final bool playing;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final VoidCallback onPlayPause;
  const _Controls({
    required this.playing,
    required this.onPrev,
    required this.onNext,
    required this.onPlayPause,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton(
          icon: const Icon(Icons.shuffle, color: kMuted, size: 22),
          onPressed: () {},
        ),
        IconButton(
          iconSize: 36,
          icon: const Icon(Icons.skip_previous, color: kText),
          onPressed: onPrev,
        ),
        Container(
          width: 68,
          height: 68,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: kText,
          ),
          child: IconButton(
            icon: Icon(playing ? Icons.pause : Icons.play_arrow,
                color: kBg, size: 32),
            onPressed: onPlayPause,
          ),
        ),
        IconButton(
          iconSize: 36,
          icon: const Icon(Icons.skip_next, color: kText),
          onPressed: onNext,
        ),
        IconButton(
          icon: const Icon(Icons.repeat, color: kMuted, size: 22),
          onPressed: () {},
        ),
      ],
    );
  }
}
