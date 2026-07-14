#!/usr/bin/env bash
# Backwards-compatible entry point used by the server's existing cron job.
set -Eeuo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/server-auto-update.sh"
