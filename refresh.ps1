[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n[ACTION] Refreshing HavenStay Database..." -ForegroundColor Cyan

$dockerRunning = $false

# Silently check if the backend docker container is running
try {
    $dockerOutput = docker ps -f "name=backend" --format "{{.Names}}" 2>$null
    if ($dockerOutput -match "backend") {
        $dockerRunning = $true
    }
} catch {
    # Docker isn't installed or running, which is fine
}

if ($dockerRunning) {
    Write-Host "[INFO] Detected Docker environment. Executing inside container..." -ForegroundColor Yellow
    
    Write-Host "[ACTION] Wiping and seeding database..." -ForegroundColor DarkGray
    docker compose exec backend php artisan migrate:fresh --seed
    
    Write-Host "[ACTION] Purging backend cache..." -ForegroundColor DarkGray
    docker compose exec backend php artisan optimize:clear
    
    Write-Host "[ACTION] Clearing old logs..." -ForegroundColor DarkGray
    if (Test-Path "backend\storage\logs\*.log") {
        Remove-Item -Path "backend\storage\logs\*.log" -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[INFO] No Docker container detected. Executing local PHP environment..." -ForegroundColor Yellow
    Set-Location -Path "backend"
    
    # Check if PHP exists in the system
    if (Get-Command "php" -ErrorAction SilentlyContinue) {
        Write-Host "[ACTION] Wiping and seeding database..." -ForegroundColor DarkGray
        php artisan migrate:fresh --seed
        
        Write-Host "[ACTION] Purging backend cache..." -ForegroundColor DarkGray
        php artisan optimize:clear
        
        Write-Host "[ACTION] Clearing old logs..." -ForegroundColor DarkGray
        if (Test-Path "storage\logs\*.log") {
            Remove-Item -Path "storage\logs\*.log" -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "[ERROR] PHP is not installed or not in your PATH. Cannot refresh database." -ForegroundColor Red
    }
    
    Set-Location -Path ".."
}

Write-Host "`n[SUCCESS] Database successfully wiped and seeded with demo data!" -ForegroundColor Green
