import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/models.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../theme.dart';
import 'track_actions.dart';

class TrackTile extends ConsumerWidget {
  final Track track;
  final List<Track> queue;
  final int index;
  const TrackTile({
    super.key,
    required this.track,
    required this.queue,
    required this.index,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(libraryProvider);
    final isFav = library.maybeWhen(
      data: (libs) => libs.any((x) => x.ytId == (track.ytId ?? track.id) && x.liked),
      orElse: () => false,
    );

    final api = ref.read(apiClientProvider);
    final handler = ref.read(audioHandlerProvider);

    return InkWell(
      onTap: () {
        handler.playFromList(
          queue,
          index,
          urlForTrack: (t) => t.file != null ? api.fileUrl(t.file!) : api.streamUrl(t.ytId ?? t.id),
        );
      },
      onLongPress: () => showTrackActions(context, ref, track),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: CachedNetworkImage(
                imageUrl: hd(track.thumbnail),
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(
                  width: 48, height: 48, color: kPanel2,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600, color: kText)),
                  const SizedBox(height: 2),
                  Text(track.uploader,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: kMuted)),
                ],
              ),
            ),
            IconButton(
              icon: Icon(
                isFav ? Icons.favorite : Icons.favorite_border,
                color: isFav ? kAccentBright : kMuted,
                size: 22,
              ),
              onPressed: () => ref.read(libraryProvider.notifier).toggleFav(track),
            ),
          ],
        ),
      ),
    );
  }
}
