#!/usr/bin/env bash
# stop.sh — stop the dev server started by start.sh.
set -uo pipefail
pkill -f "vite.*mesh-portal" || true
printf 'stopped (if it was running)\n'
