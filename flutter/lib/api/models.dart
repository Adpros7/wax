// Shared models — match the Express backend's JSON shapes 1:1.

class Track {
  final String id; // server-side id (lib track) or ytId for streams
  final String title;
  final String uploader;
  final double duration;
  final String thumbnail;
  final String? ytId;
  final String? file; // /audio/<id>.mp3 if downloaded
  final bool liked;

  const Track({
    required this.id,
    required this.title,
    required this.uploader,
    required this.duration,
    required this.thumbnail,
    this.ytId,
    this.file,
    this.liked = true,
  });

  factory Track.fromLibrary(Map<String, dynamic> j) => Track(
        id: j['id'] as String,
        title: (j['title'] as String?) ?? '',
        uploader: (j['uploader'] as String?) ?? '',
        duration: (j['duration'] as num?)?.toDouble() ?? 0,
        thumbnail: (j['thumbnail'] as String?) ?? '',
        ytId: j['ytId'] as String?,
        file: j['file'] as String?,
        liked: j['liked'] != false,
      );

  // Search results from /api/search expose `id` as the YouTube videoId.
  factory Track.fromSearch(Map<String, dynamic> j) => Track(
        id: j['id'] as String,
        title: (j['title'] as String?) ?? '',
        uploader: (j['uploader'] as String?) ?? '',
        duration: (j['duration'] as num?)?.toDouble() ?? 0,
        thumbnail: (j['thumbnail'] as String?) ?? '',
        ytId: j['id'] as String,
      );

  bool get isStream => file == null && ytId != null;
}

class Playlist {
  final String id;
  final String name;
  final String? cover; // optional cover image URL
  final List<String> trackIds;

  const Playlist({
    required this.id,
    required this.name,
    this.cover,
    this.trackIds = const [],
  });

  factory Playlist.fromJson(Map<String, dynamic> j) => Playlist(
        id: j['id'] as String,
        name: (j['name'] as String?) ?? '',
        cover: j['cover'] as String?,
        trackIds: ((j['trackIds'] as List?) ?? const [])
            .whereType<String>()
            .toList(),
      );
}

