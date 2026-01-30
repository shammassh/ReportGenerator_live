@echo off
echo ============================================
echo FOOD SAFETY AUDIT - GO-LIVE CLEANUP
echo ============================================
echo.
echo This will DELETE all test audit data but KEEP:
echo   - Schemas, Sections, Categories, Items
echo   - Users and Store Assignments
echo   - System Settings
echo.
echo Press CTRL+C to cancel, or
pause

sqlcmd -S PowerApps-Repor -d FoodSafetyDB -U sa -P "Kokowawa123@@" -i "C:\ReportGenerator\sql\cleanup-for-golive.sql"

echo.
echo ============================================
echo Done! Press any key to close...
pause
