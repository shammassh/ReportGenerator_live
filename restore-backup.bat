@echo off
echo ============================================
echo FOOD SAFETY DB - RESTORE FROM BACKUP
echo ============================================
echo.
echo This will REPLACE the current FoodSafetyDB with the backup!
echo All current data will be LOST!
echo.
echo Backup file: FoodSafetyDB_GoLive_20260113.bak
echo.
echo Press CTRL+C to cancel, or
pause

echo.
echo Restoring database...
sqlcmd -S PowerApps-Repor -d master -U sa -P "Kokowawa123@@" -Q "ALTER DATABASE [FoodSafetyDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [FoodSafetyDB] FROM DISK = 'C:\ReportGenerator\backups\FoodSafetyDB_GoLive_20260113.bak' WITH REPLACE; ALTER DATABASE [FoodSafetyDB] SET MULTI_USER;"

echo.
echo ============================================
echo Restore complete! Press any key to close...
pause
