import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/models.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class PlaylistDetailScreen extends ConsumerWidget {
  final Playlist playlist;
  const PlaylistDetailScreen({super.key, required this.playlist});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final libAsync = ref.watch(libraryProvider);
    return Scaffold(
      backgroundColor: kBg,
      body: libAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: kAccentBright)),
        error: (e, _) => Center(
            child: Text('Erreur : $e', style: const TextStyle(color: kMuted))),
        data: (allTracks) {
          final byId = {for (final t in allTracks) t.id: t};
          final ordered = playlist.trackIds
              .map(byId.containsKey)
              .toList(); // retains order, but I need actual tracks:
          final tracks = playlist.trackIds
              .map((id) => byId[id])
              .whereType<Track>()
              .toList();
          // Use ordered to silence unused — actually drop it.
          // ignore: unused_local_variable
          final _ = ordered;

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: 280,
                backgroundColor: const Color(0xFF1F0E2E),
                iconTheme: const IconThemeData(color: kText),
                flexibleSpace: FlexibleSpaceBar(
                  background: _Header(playlist: playlist, count: tracks.length),
                  centerTitle: true,
                  title: Text(playlist.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 16, color: kText)),
                ),
              ),
              SliverList.builder(
                itemCount: tracks.length,
                itemBuilder: (_, i) {
                  final t = tracks[i];
                  return Dismissible(
                    key: ValueKey('${playlist.id}:${t.id}'),
                    direction: DismissDirection.endToStart,
                    background: Container(
                      color: Colors.redAccent.withValues(alpha: 0.18),
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20),
                      child: const Icon(Icons.delete_outline,
                          color: Colors.redAccent),
                    ),
                    onDismissed: (_) {
                      ref
                          .read(playlistsProvider.notifier)
                          .removeTrack(playlist.id, t.id);
                    },
                    child: TrackTile(track: t, queue: tracks, index: i),
                  );
                },
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Playlist playlist;
  final int count;
  const _Header({required this.playlist, required this.count});
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF2A1342), kBg],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 80, 20, 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 140, height: 140,
              child: playlist.cover != null && playlist.cover!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: hd(playlist.cover!),
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(color: kPanel2),
                    )
                  : Container(
                      color: kAccent.withValues(alpha: 0.2),
                      alignment: Alignment.center,
                      child: const Icon(Icons.playlist_play,
                          color: kAccentBright, size: 48),
                    ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('PLAYLIST',
                    style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 1.6,
                        fontWeight: FontWeight.w800,
                        color: kText)),
                const SizedBox(height: 6),
                Text(playlist.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 24, fontWeight: FontWeight.w800, color: kText)),
                const SizedBox(height: 4),
                Text('$count titres',
                    style: const TextStyle(fontSize: 12, color: kMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
