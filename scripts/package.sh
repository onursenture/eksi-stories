#!/bin/sh
# Chrome Web Store'a yüklenecek zip'i üretir: yalnızca manifest.json ve src/.
set -eu
cd "$(dirname "$0")/.."
VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync('manifest.json', 'utf8')).version")
OUT="dist/eksi-stories-${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"
zip -r -X -q "$OUT" manifest.json src -x '*.DS_Store'
echo "$OUT"
