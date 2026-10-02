#!/usr/bin/env bash
# ============================================================
# HavenStay BHMS — Automated Smoke Test Suite
# ============================================================
set -e

COLOR_CYAN="\033[1;36m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_RESET="\033[0m"

echo -e "\n${COLOR_CYAN}======================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}🧪 HavenStay BHMS — Production & Dev Smoke Tests${COLOR_RESET}"
echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}\n"

PASS_COUNT=0
FAIL_COUNT=0

record_result() {
    local name="$1"
    local status="$2"
    local details="$3"

    if [ "$status" -eq 0 ]; then
        echo -e "  [${COLOR_GREEN}PASS${COLOR_RESET}] $name ${COLOR_CYAN}($details)${COLOR_RESET}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  [${COLOR_RED}FAIL${COLOR_RESET}] $name ${COLOR_RED}($details)${COLOR_RESET}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Test 1: Direct Backend API Health
if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    record_result "Backend API Direct Health" 0 "http://127.0.0.1:8000/api/health -> 200 OK"
else
    record_result "Backend API Direct Health" 1 "Failed to connect to backend on port 8000"
fi

# Test 2: Frontend Server
if curl -fsS -I http://127.0.0.1:3000 >/dev/null 2>&1; then
    record_result "Frontend Next.js Server" 0 "http://127.0.0.1:3000 -> 200 OK"
else
    record_result "Frontend Next.js Server" 1 "Failed to connect to frontend on port 3000"
fi

# Test 3: Next.js API Rewrite Proxy
PROXY_RESP=$(curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || echo "")
if [[ "$PROXY_RESP" =~ "havenstay-backend" ]]; then
    record_result "Next.js API Rewrite Proxy" 0 "http://127.0.0.1:3000/api/health -> proxied successfully"
else
    record_result "Next.js API Rewrite Proxy" 1 "Rewrite proxy failed: $PROXY_RESP"
fi

# Test 4: MySQL Primary Health
if docker compose exec -T db-primary mysqladmin ping -h 127.0.0.1 -u root -pchangeme_root_password >/dev/null 2>&1; then
    record_result "MySQL Primary Connectivity" 0 "Port 3306 mysqld alive"
else
    record_result "MySQL Primary Connectivity" 1 "Primary ping failed"
fi

# Test 5: MySQL Replica Health
if docker compose exec -T db-replica mysqladmin ping -h 127.0.0.1 -u root -pchangeme_root_password >/dev/null 2>&1; then
    record_result "MySQL Replica Connectivity" 0 "Port 3307 mysqld alive"
else
    record_result "MySQL Replica Connectivity" 1 "Replica ping failed"
fi

# Test 6: MySQL GTID Replication Status
REPLICA_STATUS=$(docker compose exec -T db-replica mysql -uroot -pchangeme_root_password -e "SHOW REPLICA STATUS\G" 2>/dev/null || true)
IO_RUNNING=$(echo "$REPLICA_STATUS" | grep "Replica_IO_Running:" | awk '{print $2}')
SQL_RUNNING=$(echo "$REPLICA_STATUS" | grep "Replica_SQL_Running:" | awk '{print $2}')
SEC_BEHIND=$(echo "$REPLICA_STATUS" | grep "Seconds_Behind_Source:" | awk '{print $2}')

if [ "$IO_RUNNING" = "Yes" ] && [ "$SQL_RUNNING" = "Yes" ]; then
    record_result "MySQL GTID Replication" 0 "IO: Yes, SQL: Yes, Lag: ${SEC_BEHIND}s"
else
    record_result "MySQL GTID Replication" 1 "IO: ${IO_RUNNING:-No}, SQL: ${SQL_RUNNING:-No}"
fi

# Summary
echo -e "\n${COLOR_CYAN}------------------------------------------------------${COLOR_RESET}"
echo -e "Total Tests: $((PASS_COUNT + FAIL_COUNT)) | Passed: ${COLOR_GREEN}${PASS_COUNT}${COLOR_RESET} | Failed: ${COLOR_RED}${FAIL_COUNT}${COLOR_RESET}"
echo -e "${COLOR_CYAN}------------------------------------------------------${COLOR_RESET}\n"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
