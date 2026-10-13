#!/bin/sh
# Inline the prototype into one self-contained file (repo copy) and an artifact fragment.
D=$(dirname "$0")
OUT="$D/../index.html"
{
  cat "$D/head.html"
  echo "<script>"; cat "$D/engine.js" "$D/payoff.js" "$D/chart.js" "$D/app.js"; echo "</script>"
  echo "</body>"; echo "</html>"
} > "$OUT"
# Artifact copy: the host adds the document skeleton.
sed -e '/^<!doctype html>$/d' -e '/^<html lang="en">$/d' -e '/^<head>$/d' -e '/^<meta charset="utf-8">$/d' -e '/^<meta name="viewport"/d' -e '/^<\/head>$/d' -e '/^<body>$/d' -e '/^<\/body>$/d' -e '/^<\/html>$/d' "$OUT" > "${ARTIFACT_OUT:-/dev/null}"
wc -c "$OUT" "${ARTIFACT_OUT:-/dev/null}"
