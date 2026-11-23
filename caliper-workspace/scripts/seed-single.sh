#!/usr/bin/env bash
# Compatibility wrapper → full E2E seed
exec "$(cd "$(dirname "$0")" && pwd)/seed-single-full.sh" "$@"
