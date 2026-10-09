#!/usr/bin/env bash
# start.sh — dev server for mesh-portal (mirrors receipts-ocr shape).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
npm install
exec npm run dev
