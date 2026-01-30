Add-Type -AssemblyName System.Data
$conn = New-Object System.Data.SqlClient.SqlConnection
$conn.ConnectionString = 'Server=PowerApps-Repor;Database=master;Integrated Security=True;TrustServerCertificate=True;'
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = ''FoodSafetyDB'') CREATE DATABASE FoodSafetyDB'
$cmd.ExecuteNonQuery()
$conn.Close()
Write-Host 'Database created successfully!'
