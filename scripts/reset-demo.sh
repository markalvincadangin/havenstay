#!/usr/bin/env bash
# ============================================================
# HavenStay BHMS — Sandbox Demo Data Reset Script
# ============================================================
# Calls refresh.sh to re-migrate and seed baseline demo records.
# Suitable for automated nightly cron jobs.
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/refresh.sh" "$@"
