#!/usr/bin/env bash
# ============================================================
# HavenStay BHMS — Automated Environment Setup Script
# ============================================================
set -e

COLOR_CYAN="\033[1;36m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_RESET="\033[0m"

echo -e "\n${COLOR_CYAN}======================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}🏢 HavenStay BHMS — Dev Environment Initialization${COLOR_RESET}"
echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}\n"

# Step 1: Verify prerequisites
echo -e "${COLOR_YELLOW}[Step 1/4] Verifying system prerequisites...${COLOR_RESET}"
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${COLOR_RED}[ERROR] Docker is not installed or not in PATH.${COLOR_RESET}"
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo -e "${COLOR_RED}[ERROR] Docker Compose (v2) is required.${COLOR_RESET}"
    exit 1
fi
echo -e "${COLOR_GREEN}✓ Docker and Docker Compose detected.${COLOR_RESET}"

# Step 2: Initialize environment variable files
echo -e "\n${COLOR_YELLOW}[Step 2/4] Setting up environment files...${COLOR_RESET}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${COLOR_GREEN}✓ Created .env from .env.example${COLOR_RESET}"
else
    echo -e "  .env already exists, keeping current settings."
fi

if [ ! -f backend/.env ]; then
    cp backend/.env.docker backend/.env
    echo -e "${COLOR_GREEN}✓ Created backend/.env from backend/.env.docker${COLOR_RESET}"
else
    echo -e "  backend/.env already exists, keeping current settings."
fi

# Step 3: Build & start Docker containers
echo -e "\n${COLOR_YELLOW}[Step 3/4] Building and launching Docker Compose cluster...${COLOR_RESET}"
docker compose up -d --build

# Step 4: Verification
echo -e "\n${COLOR_YELLOW}[Step 4/4] Verifying running services...${COLOR_RESET}"
docker compose ps

echo -e "\n${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}✓ HavenStay environment is running!${COLOR_RESET}"
echo -e "${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "  Frontend UI:       ${COLOR_CYAN}http://localhost:3000${COLOR_RESET}"
echo -e "  Backend API:      ${COLOR_CYAN}http://localhost:8000/api/health${COLOR_RESET}"
echo -e "  MySQL Primary:    ${COLOR_CYAN}localhost:3306${COLOR_RESET}"
echo -e "  MySQL Replica:    ${COLOR_CYAN}localhost:3307${COLOR_RESET}"
echo -e "\nTo view live logs:    ${COLOR_YELLOW}make logs${COLOR_RESET}"
echo -e "To reset demo data:   ${COLOR_YELLOW}make refresh${COLOR_RESET}\n"
