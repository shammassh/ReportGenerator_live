# PowerShell script to create FoodSafetyDB database
# This uses .NET SQL Client with Windows Authentication

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Creating FoodSafetyDB Database" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Connection string for master database (Windows Authentication)
$serverName = "PowerApps-Repor"
$masterConnectionString = "Server=$serverName;Database=master;Integrated Security=True;TrustServerCertificate=True;"

Write-Host "πŸ"Œ Connecting to SQL Server: $serverName" -ForegroundColor Yellow
Write-Host "πŸ"' Using Windows Authentication" -ForegroundColor Yellow
Write-Host ""

try {
    # Load SQL Client assembly
    Add-Type -AssemblyName "System.Data"
    
    # Create connection
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $masterConnectionString
    
    # Open connection
    $connection.Open()
    Write-Host "βœ… Connected to SQL Server successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Check if database exists
    $checkCmd = New-Object System.Data.SqlClient.SqlCommand
    $checkCmd.Connection = $connection
    $checkCmd.CommandText = "SELECT COUNT(*) FROM sys.databases WHERE name = 'FoodSafetyDB'"
    
    $dbExists = $checkCmd.ExecuteScalar()
    
    if ($dbExists -eq 0) {
        Write-Host "πŸ"¨ Creating database FoodSafetyDB..." -ForegroundColor Yellow
        
        # Create database
        $createCmd = New-Object System.Data.SqlClient.SqlCommand
        $createCmd.Connection = $connection
        $createCmd.CommandText = "CREATE DATABASE FoodSafetyDB"
        $createCmd.ExecuteNonQuery() | Out-Null
        
        Write-Host "βœ… Database FoodSafetyDB created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "πŸ"„ Next step: Run the schema.sql script to create tables" -ForegroundColor Cyan
        Write-Host "   You can use: .\database\run-schema.ps1" -ForegroundColor Gray
    }
    else {
        Write-Host "βœ"οΈ  Database FoodSafetyDB already exists!" -ForegroundColor Green
        Write-Host ""
        Write-Host "πŸ'' If you need to create tables, run: .\database\run-schema.ps1" -ForegroundColor Cyan
    }
    
    # Close connection
    $connection.Close()
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "βœ… Script completed successfully!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "πŸ'' Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Make sure SQL Server service is running" -ForegroundColor Gray
    Write-Host "   2. Check that you have Windows Authentication access" -ForegroundColor Gray
    Write-Host "   3. Verify server name: $serverName" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
finally {
    if ($connection.State -eq 'Open') {
        $connection.Close()
    }
}
