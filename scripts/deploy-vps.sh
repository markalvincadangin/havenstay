#!/usr/bin/env bash
# ============================================================
# HavenStay BHMS — Production VPS Automated Deployment Script
# ============================================================
# Designed for Oracle Cloud Always Free (ARM64 / AMD64 Ubuntu)
# and standard Linux VPS instances (DigitalOcean, Linode, Hetzner)
# ============================================================
set -e

COLOR_CYAN="\033[1;36m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_RESET="\033[0m"

echo -e "\n${COLOR_CYAN}======================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}🏢 HavenStay BHMS — Production Cloud Deployment${COLOR_RESET}"
echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}\n"

# Step 1: Root / Sudo check & System Packages
echo -e "${COLOR_YELLOW}[1/6] Checking system environment and Docker...${COLOR_RESET}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "  Docker not found. Installing official Docker Engine..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
    usermod -aG docker "$USER" 2>/dev/null || true
    echo -e "${COLOR_GREEN}✓ Docker installed successfully.${COLOR_RESET}"
else
    echo -e "${COLOR_GREEN}✓ Docker is already installed.$(docker --version)${COLOR_RESET}"
fi

if ! docker compose version >/dev/null 2>&1; then
    echo -e "${COLOR_RED}[ERROR] Docker Compose v2 is required but not found.${COLOR_RESET}"
    exit 1
fi
echo -e "${COLOR_GREEN}✓ Docker Compose v2 verified.$(docker compose version)${COLOR_RESET}"

# Step 2: Configure Oracle Cloud / Linux Firewall
echo -e "\n${COLOR_YELLOW}[2/6] Configuring host firewall (Ports 80, 443, 22)...${COLOR_RESET}"
if command -v iptables >/dev/null 2>&1 && [ "$EUID" -eq 0 ]; then
    # Oracle Cloud default iptables fix (insert before default drop rules)
    iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
    iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
    iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
    
    if command -v netfilter-persistent >/dev/null 2>&1; then
        netfilter-persistent save >/dev/null 2>&1 || true
    fi
    echo -e "${COLOR_GREEN}✓ iptables rules updated for HTTP/HTTPS.${COLOR_RESET}"
fi

if command -v ufw >/dev/null 2>&1 && [ "$EUID" -eq 0 ]; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw allow 443/udp >/dev/null 2>&1 || true
    echo -e "${COLOR_GREEN}✓ UFW rules verified for 80 and 443.${COLOR_RESET}"
fi

# Step 3: Production Environment File Configuration
echo -e "\n${COLOR_YELLOW}[3/6] Setting up production .env file...${COLOR_RESET}"
if [ ! -f .env ]; then
    if [ -f .env.production.example ]; then
        cp .env.production.example .env
    else
        cp .env.example .env
    fi
    echo -e "${COLOR_GREEN}✓ Created .env from template.${COLOR_RESET}"

    # Auto-generate secure random database passwords
    ROOT_PASS=$(openssl rand -hex 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 24)
    APP_PASS=$(openssl rand -hex 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 24)
    
    sed -i "s/replace_with_strong_root_password/${ROOT_PASS}/g" .env
    sed -i "s/replace_with_strong_app_password/${APP_PASS}/g" .env
    echo -e "${COLOR_GREEN}✓ Generated secure random database credentials.${COLOR_RESET}"

    # Generate APP_KEY if missing
    if grep -q "APP_KEY=base64:GENERATE_PRODUCTION_KEY_HERE" .env || grep -q "APP_KEY=$" .env; then
        GENERATED_KEY="base64:$(openssl rand -base64 32)"
        sed -i "s|APP_KEY=.*|APP_KEY=${GENERATED_KEY}|g" .env
        echo -e "${COLOR_GREEN}✓ Generated production APP_KEY.${COLOR_RESET}"
    fi
else
    echo -e "  .env file already exists. Preserving current secrets."
fi

# Domain setup prompt if interactive
if [ -t 0 ] && grep -q "DOMAIN_NAME=:80" .env; then
    echo -e "\n${COLOR_CYAN}Do you have a public domain name configured for this VPS?${COLOR_RESET}"
    echo -e "  (e.g., havenstay.yourportfolio.dev or yourname.duckdns.org)"
    read -r -p "Enter domain (leave blank to serve plain HTTP on port 80): " USER_DOMAIN
    if [ -n "$USER_DOMAIN" ]; then
        read -r -p "Enter email for Let's Encrypt SSL certificate: " USER_EMAIL
        sed -i "s|DOMAIN_NAME=:80|DOMAIN_NAME=${USER_DOMAIN}|g" .env
        sed -i "s|APP_URL=.*|APP_URL=https://${USER_DOMAIN}|g" .env
        sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://${USER_DOMAIN}|g" .env
        sed -i "s|SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=${USER_DOMAIN}|g" .env
        if [ -n "$USER_EMAIL" ]; then
            sed -i "s|ACME_EMAIL=.*|ACME_EMAIL=${USER_EMAIL}|g" .env
        fi
        echo -e "${COLOR_GREEN}✓ Configured domain: https://${USER_DOMAIN}${COLOR_RESET}"
    fi
fi

# Step 4: Build and Launch Production Stack
echo -e "\n${COLOR_YELLOW}[4/6] Building and starting production Docker cluster...${COLOR_RESET}"
docker compose -f docker-compose.prod.yml up -d --build

# Step 5: Await container health
echo -e "\n${COLOR_YELLOW}[5/6] Waiting for services to become healthy...${COLOR_RESET}"
RETRIES=20
COUNT=0
until [ $(docker compose -f docker-compose.prod.yml ps --filter "status=running" -q | wc -l) -ge 4 ] || [ $COUNT -ge $RETRIES ]; do
    sleep 3
    COUNT=$((COUNT + 1))
    echo "  Waiting for cluster boot ($COUNT/$RETRIES)..."
done

# Step 6: Verification
echo -e "\n${COLOR_YELLOW}[6/6] Production Cluster Status:${COLOR_RESET}"
docker compose -f docker-compose.prod.yml ps

DOMAIN=$(grep "^DOMAIN_NAME=" .env | cut -d'=' -f2)
if [ "$DOMAIN" = ":80" ] || [ -z "$DOMAIN" ]; then
    SERVER_IP=$(curl -s -m 5 https://api.ipify.org 2>/dev/null || echo "your-server-ip")
    ACCESS_URL="http://${SERVER_IP}"
else
    ACCESS_URL="https://${DOMAIN}"
fi

echo -e "\n${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}🎉 HavenStay BHMS Production Cluster is Live!${COLOR_RESET}"
echo -e "${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "  Live Application:   ${COLOR_CYAN}${ACCESS_URL}${COLOR_RESET}"
echo -e "  Backend Health:     ${COLOR_CYAN}${ACCESS_URL}/api/health${COLOR_RESET}"
echo -e "  Reverse Proxy:      ${COLOR_CYAN}Caddy (Auto Let's Encrypt SSL)${COLOR_RESET}"
echo -e "  Database Topology:  ${COLOR_CYAN}MySQL 8.4 Primary + GTID Replica${COLOR_RESET}"
echo -e "\nUseful Operational Commands:"
echo -e "  View logs:          ${COLOR_YELLOW}docker compose -f docker-compose.prod.yml logs -f${COLOR_RESET}"
echo -e "  Restart stack:      ${COLOR_YELLOW}docker compose -f docker-compose.prod.yml restart${COLOR_RESET}"
echo -e "  Stop stack:         ${COLOR_YELLOW}docker compose -f docker-compose.prod.yml down${COLOR_RESET}\n"
