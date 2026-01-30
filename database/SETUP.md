# Quick Start: Create FoodSafetyDB Database

Follow these steps to create and set up your database:

## Method 1: Using SQL Server Management Studio (SSMS) - RECOMMENDED

### Step 1: Open SSMS
1. Open **SQL Server Management Studio (SSMS)**
2. Connect to your server: `localhost` (or `(local)`)
3. Use **Windows Authentication** (user: `PowerApps-Repor\gmrladmin`)

### Step 2: Create Database
1. **Option A - Using GUI:**
   - Right-click on "Databases" folder
   - Select "New Database..."
   - Database name: `FoodSafetyDB`
   - Click OK

2. **Option B - Using Script:**
   - Open a New Query window
   - Copy and paste content from `database/create-database.sql`
   - Click Execute (F5)

### Step 3: Create Tables and Stored Procedures
1. Make sure you're connected to `FoodSafetyDB` database
2. Open a New Query window
3. Open the file `database/schema.sql`
4. Click Execute (F5)
5. You should see success messages

### Step 4: Verify Setup
Run this query to check everything was created:

```sql
-- Check tables
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Check stored procedures  
SELECT ROUTINE_NAME
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;
```

**Expected Results:**
- Tables: `ActionPlanAuditLog`, `ActionPlanResponses`
- Procedures: `sp_GetActionPlanResponses`, `sp_GetActionPlanSummary`, `sp_SaveActionPlanResponse`

---

## Method 2: Using Azure Data Studio

1. Open **Azure Data Studio**
2. Connect to `localhost` with Windows Auth (user: `PowerApps-Repor\gmrladmin`)
3. Click "New Query"
4. Open and run `database/create-database.sql`
5. Open and run `database/schema.sql`

---

## Method 3: Using Command Line (sqlcmd)

```powershell
# Create database
sqlcmd -S "localhost" -E -i "database\create-database.sql"

# Create tables and procedures
sqlcmd -S "localhost" -d FoodSafetyDB -E -i "database\schema.sql"
```

---

## After Setup: Test Connection

Run this from your project folder:

```bash
node test-sql-connection.js
```

You should see:
```
βœ… Connection successful!
βœ… Sample data inserted successfully!
βœ… All Tests Passed! Database is ready for Action Plan.
```

---

## Troubleshooting

### "Cannot open database FoodSafetyDB"
**Solution:** Database doesn't exist yet. Run `create-database.sql` first.

### "Login failed for user"
**Solution:** Make sure you're using Windows Authentication in your connection.

### "SQL Server does not exist or access denied"
**Solution:** 
- Check SQL Server service is running
- Verify server name: Use `localhost` or `(local)` or `.\SQLEXPRESS`
- Windows user `PowerApps-Repor\gmrladmin` should have access

### Check if SQL Server is running:
```powershell
Get-Service | Where-Object {$_.Name -like "*SQL*"}
```

The service should show as "Running".

---

## Quick Test Without Creating Database

If you want to test connection without database:

1. Open SSMS
2. Connect to `localhost` (Windows Auth as `PowerApps-Repor\gmrladmin`)
3. Run this simple query:
   ```sql
   SELECT @@VERSION;
   ```

If this works, your SQL Server is running and you can proceed with database creation.
