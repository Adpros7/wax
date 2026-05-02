// YouTube serves thumbnails at several quality tiers under the same path —
// our backend persists the tiny `mqdefault.jpg` (320×180) which looks pixelated
// on phone covers. These helpers swap the suffix client-side.
//
//   mqdefault.jpg  →   320×180 (default from server)
//   hqdefault.jpg  →   480×360 (always available, good for tiles)
//   maxresdefault.jpg → 1280×720 (only on HD uploads — falls back transparently
//                                  via the URL caching but may 404, see below)

const _ytHost = 'ytimg.com';

String hd(String url) {
  if (!url.contains(_ytHost)) return url;
  return url.replaceAll(RegExp(r'(mqdefault|sddefault)\.jpg'), 'hqdefault.jpg');
}

String maxres(String url) {
  if (!url.contains(_ytHost)) return url;
  return url.replaceAll(
      RegExp(r'(mqdefault|hqdefault|sddefault)\.jpg'), 'maxresdefault.jpg');
}
