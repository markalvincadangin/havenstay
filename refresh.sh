#!/usr/bin/env bash
# Backward-compatibility wrapper — canonical script is in scripts/refresh.sh
exec "$(dirname "$0")/scripts/refresh.sh" "$@"
