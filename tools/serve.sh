#!/usr/bin/env bash
# Local preview: http://localhost:${PORT:-8000}/ (the prototypes are at /prototypes/).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Serving $(pwd) at http://localhost:${PORT:-8000}/prototypes/"
exec python3 -I -m http.server "${PORT:-8000}" --bind 127.0.0.1
