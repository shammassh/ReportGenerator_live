# Verify FoodSafetyDB Schema
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Verifying FoodSafetyDB Schema" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Add-Type -AssemblyName System.Data

$conn = New-Object System.Data.SqlClient.SqlConnection
$conn.ConnectionString = 'Server=PowerApps-Repor;Database=FoodSafetyDB;Integrated Security=True;TrustServerCertificate=True;'

try {
    $conn.Open()
    Write-Host "βœ… Connected to FoodSafetyDB" -ForegroundColor Green
    Write-Host ""
    
    # Check tables
    Write-Host "πŸ"‹ Tables:" -ForegroundColor Yellow
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    $reader = $cmd.ExecuteReader()
    
    $tableCount = 0
    while ($reader.Read()) {
        Write-Host "   βœ"" $reader["TABLE_NAME"] -ForegroundColor Green
        $tableCount++
    }
    $reader.Close()
    
    if ($tableCount -eq 0) {
        Write-Host "   ❌ No tables found!" -ForegroundColor Red
    }
    Write-Host ""
    
    # Check stored procedures  
    Write-Host "πŸ"§ Stored Procedures:" -ForegroundColor Yellow
    $cmd.CommandText = "SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME"
    $reader = $cmd.ExecuteReader()
    
    $procCount = 0
    while ($reader.Read()) {
        Write-Host "   βœ"" $reader["ROUTINE_NAME"] -ForegroundColor Green
        $procCount++
    }
    $reader.Close()
    
    if ($procCount -eq 0) {
        Write-Host "   ❌ No stored procedures found!" -ForegroundColor Red
    }
    Write-Host ""
    
    # Summary
    Write-Host "============================================" -ForegroundColor Cyan
    if ($tableCount -gt 0 -and $procCount -gt 0) {
        Write-Host "βœ… Schema verification successful!" -ForegroundColor Green
        Write-Host "   Tables: $tableCount" -ForegroundColor Gray
        Write-Host "   Stored Procedures: $procCount" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️  Schema incomplete!" -ForegroundColor Yellow
    }
    Write-Host "============================================" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
finally {
    if ($conn.State -eq 'Open') {
        $conn.Close()
    }
}
