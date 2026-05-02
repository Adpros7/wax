import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../screens/now_playing_screen.dart';
import '../theme.dart';

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final media = ref.watch(mediaItemProvider).value;
    final state = ref.watch(playbackStateProvider).value;
    final position = ref.watch(positionProvider).value ?? Duration.zero;
    if (media == null) return const SizedBox.shrink();

    final dur = media.duration ?? Duration.zero;
    final pct = dur.inMilliseconds == 0
        ? 0.0
        : (position.inMilliseconds / dur.inMilliseconds).clamp(0.0, 1.0);
    final playing = state?.playing ?? false;
    final isFav = ref.watch(isCurrentFavoriteProvider);
    final handler = ref.read(audioHandlerProvider);

    return GestureDetector(
      onTap: () => Navigator.of(context).push(PageRouteBuilder(
        opaque: true,
        pageBuilder: (_, __, ___) => const NowPlayingScreen(),
        transitionsBuilder: (_, anim, __, child) => SlideTransition(
          position: Tween(begin: const Offset(0, 1), end: Offset.zero)
              .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: child,
        ),
      )),
      child: Container(
        height: 60,
        decoration: const BoxDecoration(
          color: kPanel,
          border: Border(top: BorderSide(color: kBorder)),
        ),
        child: Column(
          children: [
            // Hairline progress
            SizedBox(
              height: 2,
              child: LinearProgressIndicator(
                value: pct,
                backgroundColor: const Color(0x14FFFFFF),
                valueColor: const AlwaysStoppedAnimation(kAccentBright),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: CachedNetworkImage(
                        imageUrl: hd(media.artUri?.toString() ?? ''),
                        width: 44, height: 44, fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(width: 44, height: 44, color: kPanel2),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(media.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w600, color: kText)),
                          Text(media.artist ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, color: kMuted)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        isFav ? Icons.favorite : Icons.favorite_border,
                        color: isFav ? kAccentBright : kMuted,
                        size: 22,
                      ),
                      onPressed: () => toggleCurrentFavorite(ref),
                    ),
                    IconButton(
                      icon: Icon(playing ? Icons.pause : Icons.play_arrow,
                          color: kText, size: 28),
                      onPressed: () => playing ? handler.pause() : handler.play(),
                    ),
                    IconButton(
                      icon: const Icon(Icons.skip_next, color: kText, size: 28),
                      onPressed: () => handler.skipToNext(),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
