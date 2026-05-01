#!/usr/bin/env bash
# Fetch standalone yt-dlp + ffmpeg into build/bin/<os>/<arch>/ so dist:linux
# and dist:win produce installers that work without external dependencies.
#
# macOS bundling is skipped: unsigned/un-notarized binaries are blocked by
# XProtect on Sequoia (~10 s delay per spawn), making it unusable. Mac users
# install via `brew install yt-dlp ffmpeg`; the Electron main augments PATH
# so they're picked up at launch.
#
# Usage: ./scripts/fetch-bin.sh

set -e
cd "$(dirname "$0")/.."

mkdir -p build/bin/linux/x64 build/bin/linux/arm64 build/bin/win/x64

YT_DLP_BASE="https://github.com/yt-dlp/yt-dlp/releases/latest/download"
FFMPEG_LINUX_BASE="https://johnvansickle.com/ffmpeg/releases"
FFMPEG_WIN="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

dl() {
  local url=$1 out=$2
  if [ -s "$out" ]; then
    echo "  ✓ $out (skip, exists)"
    return
  fi
  echo "  ↓ $url"
  curl -fSL --retry 3 -A "wax-fetch-bin" -o "$out" "$url"
}

echo "→ yt-dlp"
dl "$YT_DLP_BASE/yt-dlp_linux"           build/bin/linux/x64/yt-dlp
dl "$YT_DLP_BASE/yt-dlp_linux_aarch64"   build/bin/linux/arm64/yt-dlp
dl "$YT_DLP_BASE/yt-dlp.exe"             build/bin/win/x64/yt-dlp.exe
chmod +x build/bin/linux/{x64,arm64}/yt-dlp

echo "→ ffmpeg (Linux)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for arch in x64 arm64; do
  pkg=$([ "$arch" = "x64" ] && echo amd64 || echo arm64)
  if [ ! -s "build/bin/linux/$arch/ffmpeg" ]; then
    dl "$FFMPEG_LINUX_BASE/ffmpeg-release-$pkg-static.tar.xz" "$TMP/ff-$arch.tar.xz"
    mkdir -p "$TMP/ff-$arch"
    tar -xJf "$TMP/ff-$arch.tar.xz" -C "$TMP/ff-$arch"
    cp "$TMP/ff-$arch"/*/ffmpeg "build/bin/linux/$arch/ffmpeg"
    chmod +x "build/bin/linux/$arch/ffmpeg"
  else
    echo "  ✓ build/bin/linux/$arch/ffmpeg (skip)"
  fi
done

echo "→ ffmpeg (Windows)"
if [ ! -s "build/bin/win/x64/ffmpeg.exe" ]; then
  dl "$FFMPEG_WIN" "$TMP/ffmpeg-win.zip"
  unzip -j -o "$TMP/ffmpeg-win.zip" '*/bin/ffmpeg.exe' -d build/bin/win/x64/ > /dev/null
else
  echo "  ✓ build/bin/win/x64/ffmpeg.exe (skip)"
fi

echo
echo "Done. Bundled binaries:"
ls -lh build/bin/*/*/{yt-dlp,yt-dlp.exe,ffmpeg,ffmpeg.exe} 2>/dev/null | awk '{print "  " $5, $9}'
