# Start UAT Server
# ==========================================
# Environment: UAT (User Acceptance Testing)
# URL: http://fsaudit-uat.gmrlapps.com
# Database: FoodSafetyDB
# ==========================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Starting FOOD SAFETY AUDIT - UAT Server  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
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

# Set working directory
Set-Location "F:\ReportGenerator"

# Copy UAT environment file to .env
Write-Host "Loading UAT environment configuration..." -ForegroundColor Green
Copy-Item -Path ".env.uat" -Destination ".env" -Force

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

Write-Host ""
Write-Host "Environment: UAT" -ForegroundColor Cyan
Write-Host "URL: http://fsaudit-uat.gmrlapps.com" -ForegroundColor Cyan
Write-Host "Database: FoodSafetyDB" -ForegroundColor Cyan
Write-Host ""

# Start the server
node auth-app.js
