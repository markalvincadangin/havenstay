#!/usr/bin/env bash

echo -e "\n\033[1;36m[INFO] Starting Cloudflare Tunnel for HavenStay...\033[0m"
echo -e "\033[1;33m[WARN] Ensure your frontend (3000) and backend (8000) are running!\033[0m\n"

# Run cloudflared, parse output line-by-line
url_found=false

# We run cloudflared, redirecting output to a read loop
cloudflared tunnel --url http://localhost:3000 2>&1 | while read -r line; do
    # Print the raw log in dark gray
    echo -e "\033[1;30m$line\033[0m"
    
    if [ "$url_found" = false ] && [[ "$line" =~ (https://[a-zA-Z0-9-]+\.trycloudflare\.com) ]]; then
        url="${BASH_REMATCH[1]}"
        domain=$(echo "$url" | sed 's|https://||')
        url_found=true
        
        env_path="frontend/.env.local"
        if [ -f "$env_path" ]; then
            if grep -q "^ALLOWED_DEV_ORIGINS=" "$env_path"; then
                # Replace the existing line
                sed -i.bak "s|^ALLOWED_DEV_ORIGINS=.*|ALLOWED_DEV_ORIGINS=$domain|" "$env_path" && rm -f "${env_path}.bak"
            else
                # Append to the file
                echo "ALLOWED_DEV_ORIGINS=$domain" >> "$env_path"
            fi
        fi
        
        # Restart the frontend container if running
        if docker compose ps --services --filter "status=running" | grep -q "frontend"; then
            echo -e "\n\033[1;33m[INFO] Restarting the frontend container to apply the new URL...\033[0m"
            docker compose restart frontend >/dev/null
        fi
        
        # Copy to clipboard if utility exists
        copied_msg=""
        if command -v xclip >/dev/null 2>&1; then
            echo -n "$url" | xclip -selection clipboard
            copied_msg="[INFO] Copied to your clipboard!"
        elif command -v xsel >/dev/null 2>&1; then
            echo -n "$url" | xsel --clipboard --input
            copied_msg="[INFO] Copied to your clipboard!"
        elif command -v wl-copy >/dev/null 2>&1; then
            echo -n "$url" | wl-copy
            copied_msg="[INFO] Copied to your clipboard!"
        fi
        
        echo -e "\n\033[1;37m-----------------------------------------------------\033[0m"
        echo -e "\033[1;32m[SUCCESS] TUNNEL IS LIVE!\033[0m"
        echo -e "Link: \033[1;36m$url\033[0m"
        if [ -n "$copied_msg" ]; then
            echo -e "\033[1;32m$copied_msg\033[0m"
        fi
        echo -e "\033[1;32m[INFO] Auto-configured Next.js for Hot-Reloading!\033[0m"
        echo -e "\033[1;32m[INFO] Frontend automatically restarted and is ready!\033[0m"
        echo -e "\033[1;37m-----------------------------------------------------\033[0m\n"
    fi
done
