import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final libraryAsync = ref.watch(libraryProvider);
    return RefreshIndicator(
      color: kAccentBright,
      backgroundColor: kPanel,
      onRefresh: () => ref.read(libraryProvider.notifier).reload(),
      child: libraryAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: kAccentBright)),
        error: (e, _) => Center(child: Text('Erreur : $e', style: const TextStyle(color: kMuted))),
        data: (tracks) {
          final favorites = tracks.where((t) => t.liked).toList();
          if (favorites.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              _Header(count: 0),
              SizedBox(height: 60),
              Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 32),
                  child: Text(
                    'Aucun favori. Tape sur le ♥ d\'un morceau pour l\'ajouter ici.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: kMuted),
                  ),
                ),
              ),
            ]);
          }
          return ListView.builder(
            itemCount: favorites.length + 1,
            itemBuilder: (_, i) => i == 0
                ? _Header(count: favorites.length)
                : TrackTile(
                    track: favorites[i - 1],
                    queue: favorites,
                    index: i - 1,
                  ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final int count;
  const _Header({required this.count});
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('TES FAVORIS',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.6,
                  fontWeight: FontWeight.w800,
                  color: kText)),
          const SizedBox(height: 6),
          const Text('Favoris',
              style: TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w800, color: kText)),
          Text('$count titres', style: const TextStyle(fontSize: 14, color: kMuted)),
        ],
      ),
    );
  }
}
