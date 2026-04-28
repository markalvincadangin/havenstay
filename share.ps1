[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n[INFO] Starting Cloudflare Tunnel for HavenStay..." -ForegroundColor Cyan
Write-Host "[WARN] Ensure your frontend (3000) and backend (8000) are running!`n" -ForegroundColor Yellow

$urlFound = $false

# Run cloudflared, redirect stderr to stdout (2>&1), and process line by line
cloudflared tunnel --url http://localhost:3000 2>&1 | ForEach-Object {
    # Print the raw log so you can see connection progress
    Write-Host $_ -ForegroundColor DarkGray
    
    # Check if the line contains the trycloudflare URL
    if (-not $urlFound -and $_ -match '(https://[a-zA-Z0-9-]+\.trycloudflare\.com)') {
        $url = $matches[1]
        $domain = $url -replace 'https://', ''
        $urlFound = $true
        
        $envPath = "frontend\.env.local"
        if (Test-Path $envPath) {
            $lines = Get-Content $envPath
            $updated = $false
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '^ALLOWED_DEV_ORIGINS=') {
                    $lines[$i] = "ALLOWED_DEV_ORIGINS=$domain"
                    $updated = $true
                    break
                }
            }
            if (-not $updated) {
                $lines += "ALLOWED_DEV_ORIGINS=$domain"
            }
            [IO.File]::WriteAllLines((Resolve-Path $envPath).Path, $lines)
        }

        # Restart the frontend container automatically
        Write-Host "`n[INFO] Restarting the frontend container to apply the new URL..." -ForegroundColor Yellow
        docker compose restart frontend
        
        # Copy to Windows clipboard
        Set-Clipboard -Value $url
        
        Write-Host "`n-----------------------------------------------------" -ForegroundColor White
        Write-Host "[SUCCESS] TUNNEL IS LIVE!" -ForegroundColor Green
        Write-Host "Link: $url" -ForegroundColor Cyan
        Write-Host "[INFO] Copied to your clipboard!" -ForegroundColor Green
        Write-Host "[INFO] Auto-configured Next.js for Hot-Reloading!" -ForegroundColor Green
        Write-Host "[INFO] Frontend automatically restarted and is ready!" -ForegroundColor Green
        Write-Host "-----------------------------------------------------`n" -ForegroundColor White
    }
}
