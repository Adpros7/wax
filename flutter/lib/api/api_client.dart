// Single Dio client + endpoint helpers. Backend base URL is injected at
// build time via --dart-define=API_BASE=http://192.168.1.102:3000 so each
// build can target a different server without touching the source.
import 'package:dio/dio.dart';
import 'models.dart';

class ApiClient {
  static const String _envBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://localhost:3000',
  );

  final Dio _dio;

  ApiClient() : _dio = Dio(BaseOptions(
          baseUrl: _envBase,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json'},
        ));

  String get baseUrl => _envBase;

  // Direct stream URL the audio player can hit. The backend proxies the
  // YouTube audio bytes through this endpoint after extracting via yt-dlp.
  String streamUrl(String ytId) => '$_envBase/api/stream/$ytId';

  // Fully-qualified URL for an offline-downloaded track served from /audio.
  String fileUrl(String filePath) =>
      filePath.startsWith('http') ? filePath : '$_envBase$filePath';

  Future<List<Track>> fetchLibrary() async {
    final r = await _dio.get('/api/library');
    final list = (r.data['tracks'] as List).cast<Map<String, dynamic>>();
    return list.map(Track.fromLibrary).toList();
  }

  Future<List<Track>> search(String q) async {
    if (q.trim().isEmpty) return [];
    final r = await _dio.get('/api/search', queryParameters: {'q': q});
    final list = (r.data['results'] as List).cast<Map<String, dynamic>>();
    return list.map(Track.fromSearch).toList();
  }

  Future<List<Track>> trending() async {
    final r = await _dio.get('/api/trending');
    final list = (r.data['tracks'] as List).cast<Map<String, dynamic>>();
    return list.map(Track.fromSearch).toList();
  }

  Future<Track?> addToLibrary(Track t, {bool liked = true}) async {
    final r = await _dio.post('/api/library/add', data: {
      'ytId': t.ytId ?? t.id,
      'title': t.title,
      'uploader': t.uploader,
      'duration': t.duration,
      'thumbnail': t.thumbnail,
      'url': 'https://www.youtube.com/watch?v=${t.ytId ?? t.id}',
      'liked': liked,
    });
    final data = r.data['track'];
    return data == null ? null : Track.fromLibrary(data as Map<String, dynamic>);
  }

  Future<void> setLiked(String trackId, bool liked) async {
    await _dio.patch('/api/library/$trackId', data: {'liked': liked});
  }

  Future<void> removeFromLibrary(String trackId) async {
    await _dio.delete('/api/library/$trackId');
  }

  Future<List<Playlist>> fetchPlaylists() async {
    final r = await _dio.get('/api/playlists');
    final list = (r.data['playlists'] as List).cast<Map<String, dynamic>>();
    return list.map(Playlist.fromJson).toList();
  }

  Future<Playlist> createPlaylist(String name) async {
    final r = await _dio.post('/api/playlists', data: {'name': name});
    return Playlist.fromJson(r.data['playlist'] as Map<String, dynamic>);
  }

  Future<Playlist> renamePlaylist(String id, String name) async {
    final r = await _dio.put('/api/playlists/$id', data: {'name': name});
    return Playlist.fromJson(r.data['playlist'] as Map<String, dynamic>);
  }

  Future<void> deletePlaylist(String id) async {
    await _dio.delete('/api/playlists/$id');
  }

  Future<void> addTrackToPlaylist(String plId, String trackId) async {
    await _dio.post('/api/playlists/$plId/tracks', data: {'trackId': trackId});
  }

  Future<void> removeTrackFromPlaylist(String plId, String trackId) async {
    await _dio.delete('/api/playlists/$plId/tracks/$trackId');
  }
}
