import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/thumbnails.dart';
import '../providers.dart';
import '../theme.dart';
import '../widgets/track_tile.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final showingTrending = query.trim().length < 2;

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: _Hero(controller: _controller),
        ),
        if (showingTrending) const _TrendingGrid() else const _SearchResults(),
        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ],
    );
  }
}

class _Hero extends ConsumerWidget {
  final TextEditingController controller;
  const _Hero({required this.controller});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
          const Text('RECHERCHE',
              style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.6,
                  fontWeight: FontWeight.w800,
                  color: kText)),
          const SizedBox(height: 6),
          const Text('Que veux-tu écouter ?',
              style: TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w800, color: kText)),
          const SizedBox(height: 4),
          const Text('Tape un titre, un artiste',
              style: TextStyle(fontSize: 14, color: kMuted)),
          const SizedBox(height: 18),
          TextField(
            controller: controller,
            style: const TextStyle(color: kText),
            decoration: InputDecoration(
              hintText: 'Chase Atlantic, Daft Punk Around the World…',
              hintStyle: const TextStyle(color: kMuted),
              prefixIcon: const Icon(Icons.search, color: kMuted),
              filled: true,
              fillColor: kPanel,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(40),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onChanged: (v) => ref.read(searchQueryProvider.notifier).set(v),
          ),
        ],
      ),
    );
  }
}

class _SearchResults extends ConsumerWidget {
  const _SearchResults();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final results = ref.watch(searchResultsProvider);
    return results.when(
      loading: () => const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: Center(child: CircularProgressIndicator(color: kAccentBright)),
        ),
      ),
      error: (e, _) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text('Erreur : $e', style: const TextStyle(color: kMuted)),
        ),
      ),
      data: (list) => SliverList.builder(
        itemCount: list.length,
        itemBuilder: (_, i) => TrackTile(track: list[i], queue: list, index: i),
      ),
    );
  }
}

class _TrendingGrid extends ConsumerWidget {
  const _TrendingGrid();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trending = ref.watch(trendingProvider);
    return trending.when(
      loading: () => const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.all(40),
          child: Center(child: CircularProgressIndicator(color: kAccentBright)),
        ),
      ),
      error: (e, _) => const SliverToBoxAdapter(child: SizedBox()),
      data: (list) => SliverPadding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 10,
            childAspectRatio: 0.7,
          ),
          delegate: SliverChildBuilderDelegate(
            childCount: list.length,
            (_, i) => _DiscoverCard(t: list[i], queue: list, index: i),
          ),
        ),
      ),
    );
  }
}

class _DiscoverCard extends ConsumerWidget {
  final dynamic t; // Track
  final List queue;
  final int index;
  const _DiscoverCard({required this.t, required this.queue, required this.index});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiClientProvider);
    final handler = ref.read(audioHandlerProvider);
    return GestureDetector(
      onTap: () {
        handler.playFromList(
          queue.cast(),
          index,
          urlForTrack: (t) => t.file != null ? api.fileUrl(t.file!) : api.streamUrl(t.ytId ?? t.id),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(hd(t.thumbnail), fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(color: kPanel2)),
            ),
          ),
          const SizedBox(height: 8),
          Text(t.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: kText)),
          Text(t.uploader,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: kMuted)),
        ],
      ),
    );
  }
}
