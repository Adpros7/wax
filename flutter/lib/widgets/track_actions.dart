// Bottom sheet shown on long-press of a TrackTile. Currently just exposes
// "Add to playlist" but is the natural place to grow more contextual actions.
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/models.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../theme.dart';

void showTrackActions(BuildContext context, WidgetRef ref, Track track) {
  showModalBottomSheet(
    context: context,
    backgroundColor: kPanel,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: CachedNetworkImage(
                  imageUrl: hd(track.thumbnail),
                  width: 40, height: 40, fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(width: 40, height: 40, color: kPanel2),
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
                            color: kText, fontWeight: FontWeight.w600)),
                    Text(track.uploader,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: kMuted, fontSize: 12)),
                  ],
                ),
              ),
            ]),
          ),
          const Divider(height: 1, color: kBorder),
          ListTile(
            leading: const Icon(Icons.playlist_add, color: kText),
            title: const Text('Ajouter à une playlist',
                style: TextStyle(color: kText)),
            onTap: () {
              Navigator.of(ctx).pop();
              _showPlaylistPicker(context, ref, track);
            },
          ),
        ],
      ),
    ),
  );
}

void _showPlaylistPicker(BuildContext context, WidgetRef ref, Track track) {
  showModalBottomSheet(
    context: context,
    backgroundColor: kPanel,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Consumer(
          builder: (consumerCtx, consumerRef, _) {
            final playlists = consumerRef.watch(playlistsProvider);
            return playlists.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(color: kAccentBright),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(20),
                child: Text('Erreur : $e', style: const TextStyle(color: kMuted)),
              ),
              data: (list) {
                if (list.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'Aucune playlist. Crée-en une depuis l\'onglet Playlists.',
                      style: TextStyle(color: kMuted),
                      textAlign: TextAlign.center,
                    ),
                  );
                }
                return ListView.builder(
                  shrinkWrap: true,
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final p = list[i];
                    return ListTile(
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: SizedBox(
                          width: 40, height: 40,
                          child: p.cover != null && p.cover!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: hd(p.cover!),
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) =>
                                      Container(color: kPanel2),
                                )
                              : Container(
                                  color: kAccent.withValues(alpha: 0.18),
                                  alignment: Alignment.center,
                                  child: const Icon(Icons.playlist_play,
                                      color: kAccentBright, size: 20),
                                ),
                        ),
                      ),
                      title: Text(p.name, style: const TextStyle(color: kText)),
                      subtitle: Text('${p.trackIds.length} titres',
                          style: const TextStyle(color: kMuted, fontSize: 12)),
                      onTap: () async {
                        Navigator.of(ctx).pop();
                        await consumerRef
                            .read(playlistsProvider.notifier)
                            .addTrack(p.id, track);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            backgroundColor: kPanel2,
                            content: Text('Ajouté à « ${p.name} »',
                                style: const TextStyle(color: kText)),
                            duration: const Duration(seconds: 2),
                          ));
                        }
                      },
                    );
                  },
                );
              },
            );
          },
        ),
      );
    },
  );
}
