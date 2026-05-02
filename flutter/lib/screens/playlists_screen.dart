import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/models.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../theme.dart';
import 'playlist_detail_screen.dart';

class PlaylistsScreen extends ConsumerWidget {
  const PlaylistsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playlists = ref.watch(playlistsProvider);
    return Stack(
      children: [
        RefreshIndicator(
          color: kAccentBright,
          backgroundColor: kPanel,
          onRefresh: () => ref.read(playlistsProvider.notifier).reload(),
          child: playlists.when(
            loading: () => const Center(
                child: CircularProgressIndicator(color: kAccentBright)),
            error: (e, _) => Center(
                child:
                    Text('Erreur : $e', style: const TextStyle(color: kMuted))),
            data: (list) => ListView(
              children: [
                const _Header(),
                if (list.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 80),
                    child: Text(
                      'Aucune playlist. Tape sur + en bas à droite pour en créer une.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: kMuted),
                    ),
                  )
                else
                  ...list.map((p) => _PlaylistTile(playlist: p)),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            backgroundColor: kAccent,
            foregroundColor: Colors.white,
            elevation: 4,
            onPressed: () => _promptCreate(context, ref),
            child: const Icon(Icons.add),
          ),
        ),
      ],
    );
  }

  static Future<void> _promptCreate(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final name = await showDialog<String?>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kPanel,
        title: const Text('Nouvelle playlist', style: TextStyle(color: kText)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: kText),
          decoration: const InputDecoration(
            hintText: 'Nom de la playlist',
            hintStyle: TextStyle(color: kMuted),
          ),
          onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Annuler', style: TextStyle(color: kMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Créer', style: TextStyle(color: kAccentBright)),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await ref.read(playlistsProvider.notifier).create(name);
    }
  }
}

class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF2A1342), kBg],
        ),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TES COLLECTIONS',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.6,
                  fontWeight: FontWeight.w800,
                  color: kText)),
          SizedBox(height: 6),
          Text('Playlists',
              style: TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w800, color: kText)),
        ],
      ),
    );
  }
}

class _PlaylistTile extends ConsumerWidget {
  final Playlist playlist;
  const _PlaylistTile({required this.playlist});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      onTap: () {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => PlaylistDetailScreen(playlist: playlist),
        ));
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                width: 56, height: 56,
                child: playlist.cover != null && playlist.cover!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: hd(playlist.cover!),
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(color: kPanel2),
                      )
                    : Container(
                        color: kAccent.withValues(alpha: 0.18),
                        alignment: Alignment.center,
                        child: const Icon(Icons.playlist_play, color: kAccentBright),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(playlist.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600, color: kText)),
                  const SizedBox(height: 2),
                  Text('${playlist.trackIds.length} titres',
                      style: const TextStyle(fontSize: 12, color: kMuted)),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.more_vert, color: kMuted),
              onPressed: () => _showMenu(context, ref),
            ),
          ],
        ),
      ),
    );
  }

  void _showMenu(BuildContext context, WidgetRef ref) {
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
            ListTile(
              leading: const Icon(Icons.edit, color: kText),
              title: const Text('Renommer', style: TextStyle(color: kText)),
              onTap: () {
                Navigator.of(ctx).pop();
                _promptRename(context, ref);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
              title: const Text('Supprimer',
                  style: TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.of(ctx).pop();
                _confirmDelete(context, ref);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _promptRename(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: playlist.name);
    final name = await showDialog<String?>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kPanel,
        title: const Text('Renommer', style: TextStyle(color: kText)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: kText),
          onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Annuler', style: TextStyle(color: kMuted))),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Valider',
                style: TextStyle(color: kAccentBright)),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty && name != playlist.name) {
      await ref.read(playlistsProvider.notifier).rename(playlist.id, name);
    }
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kPanel,
        title: const Text('Supprimer la playlist ?',
            style: TextStyle(color: kText)),
        content: Text(
          '« ${playlist.name} » sera supprimée. Les morceaux restent dans tes favoris.',
          style: const TextStyle(color: kMuted),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Annuler', style: TextStyle(color: kMuted))),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Supprimer',
                  style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(playlistsProvider.notifier).delete(playlist.id);
    }
  }
}
