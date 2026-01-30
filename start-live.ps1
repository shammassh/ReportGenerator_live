# Start LIVE Server
# ==========================================
# Environment: LIVE (Production)
# URL: http://fsaudit.gmrlapps.com
# Database: FoodSafetyDB_Live
# ==========================================

Write-Host "============================================" -ForegroundColor Red
Write-Host "  Starting FOOD SAFETY AUDIT - LIVE Server " -ForegroundColor Red
Write-Host "           ⚠️  PRODUCTION MODE ⚠️           " -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Red
Write-Host ""

# Check if running as Administrator (required for port 80)
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator!" -ForegroundColor Yellow
    Write-Host "Port 80 requires Administrator privileges." -ForegroundColor Yellow
    Write-Host "Please restart PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Confirmation prompt for production
Write-Host "You are about to start the PRODUCTION server!" -ForegroundColor Yellow
Write-Host "Database: FoodSafetyDB_Live" -ForegroundColor Yellow
$confirm = Read-Host "Type 'YES' to continue"

if ($confirm -ne "YES") {
    Write-Host "Cancelled." -ForegroundColor Red
    exit 0
}

# Set working directory
Set-Location "F:\ReportGenerator"

# Copy LIVE environment file to .env
Write-Host ""
Write-Host "Loading LIVE environment configuration..." -ForegroundColor Green
Copy-Item -Path ".env.live" -Destination ".env" -Force

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

Write-Host ""
Write-Host "Environment: LIVE (Production)" -ForegroundColor Red
Write-Host "URL: http://fsaudit.gmrlapps.com" -ForegroundColor Red
Write-Host "Database: FoodSafetyDB_Live" -ForegroundColor Red
Write-Host ""

# Start the server
node auth-app.js
