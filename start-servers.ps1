# Food Safety Dashboard - Start Both Servers
# This script starts both the Dashboard frontend and Action Plan API backend

Write-Host "[START] Starting Food Safety Dashboard System..." -ForegroundColor Cyan
Write-Host ""

# Check if SQL Server is running
Write-Host "[CHECK] Checking SQL Server status..." -ForegroundColor Yellow
$sqlService = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue

if ($sqlService -and $sqlService.Status -eq "Running") {
    Write-Host "[OK] SQL Server is running" -ForegroundColor Green
} else {
    Write-Host "[WARNING] SQL Server is not running. Action Plan save will not work." -ForegroundColor Red
    Write-Host "   To start: Start-Service MSSQLSERVER" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[START] Starting servers..." -ForegroundColor Cyan
Write-Host ""

# Start Action Plan API in a new window
Write-Host "[1] Starting Action Plan API (Backend) on port 3001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '[API] Action Plan API Server' -ForegroundColor Cyan; node action-plan-api.js"

# Wait a moment for the first server to start
Start-Sleep -Seconds 2

# Start Dashboard Server in a new window
Write-Host "[2] Starting Dashboard Server (Frontend) on port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host '[DASHBOARD] Dashboard Server' -ForegroundColor Cyan; node dashboard-server.js"

# Wait for servers to initialize
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[OK] Both servers are starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "[WEB] Access Points:" -ForegroundColor Cyan
Write-Host "   Dashboard:        http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "   Action Plan API:  http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "[API] Available Endpoints:" -ForegroundColor Cyan
Write-Host "   Dashboard (Port 3000):" -ForegroundColor Yellow
Write-Host "      GET  /dashboard              - Main dashboard UI" -ForegroundColor White
Write-Host "      GET  /api/documents          - List all documents" -ForegroundColor White
Write-Host "      POST /api/generate-report    - Generate audit report" -ForegroundColor White
Write-Host "      POST /api/generate-action-plan - Generate action plan" -ForegroundColor White
Write-Host ""
Write-Host "   Action Plan API (Port 3001):" -ForegroundColor Yellow
Write-Host "      POST /api/action-plan/save   - Save action plan to MSSQL" -ForegroundColor White
Write-Host "      GET  /api/action-plan/:doc   - Get saved action plan" -ForegroundColor White
Write-Host "      GET  /health                 - Health check" -ForegroundColor White
Write-Host ""
Write-Host "[STOP] To stop: Close the PowerShell windows or press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Open dashboard in browser after a delay
Start-Sleep -Seconds 2
Write-Host "[BROWSER] Opening dashboard..." -ForegroundColor Cyan
Start-Process "http://localhost:3000/dashboard"

Write-Host ""
Write-Host "[READY] System is ready!" -ForegroundColor Green
Write-Host ""
