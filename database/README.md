# SQL Server Setup Guide for Action Plan

This guide will help you set up the SQL Server database for storing Action Plan responses.

## Prerequisites

- SQL Server installed (SQL Server Express, Azure SQL Database, or full SQL Server)
- SQL Server Management Studio (SSMS) or Azure Data Studio
- Node.js project already set up with SharePoint connector

## Step 1: Create Database

### Option A: Using SQL Server Management Studio (SSMS)

1. **Connect to your SQL Server instance**
2. **Create a new database:**
   ```sql
   CREATE DATABASE FoodSafetyDB;
   ```

### Option B: Using Azure SQL Database

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new SQL Database
   - Name: `FoodSafetyDB`
   - Choose appropriate pricing tier (Basic or Standard for small workloads)
3. Note the server name, username, and password

## Step 2: Run Schema Script

1. **Open the schema file:**
   - `database/schema.sql`

2. **Execute in SSMS or Azure Data Studio:**
   - Connect to `FoodSafetyDB`
   - Open `schema.sql`
   - Execute the script (F5)

3. **Verify creation:**
   ```sql
   -- Check tables
   SELECT * FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_TYPE = 'BASE TABLE';
   
   -- Check stored procedures
   SELECT * FROM INFORMATION_SCHEMA.ROUTINES 
   WHERE ROUTINE_TYPE = 'PROCEDURE';
   ```

   You should see:
   - Tables: `ActionPlanResponses`, `ActionPlanAuditLog`
   - Procedures: `sp_SaveActionPlanResponse`, `sp_GetActionPlanResponses`, `sp_GetActionPlanSummary`

## Step 3: Configure Environment Variables

Add to your `.env` file:

### For Azure SQL Database:
```env
SQL_SERVER=your-server.database.windows.net
SQL_DATABASE=FoodSafetyDB
SQL_USER=your-username
SQL_PASSWORD=your-password
SQL_ENCRYPT=true
SQL_TRUST_CERT=false
```

### For Local SQL Server:
```env
SQL_SERVER=localhost\SQLEXPRESS
SQL_DATABASE=FoodSafetyDB
SQL_USER=sa
SQL_PASSWORD=your-password
SQL_ENCRYPT=false
SQL_TRUST_CERT=true
```

### For Windows Authentication (Local):
```env
SQL_SERVER=localhost\SQLEXPRESS
SQL_DATABASE=FoodSafetyDB
# Leave SQL_USER and SQL_PASSWORD empty for Windows Auth
SQL_ENCRYPT=false
SQL_TRUST_CERT=true
```

## Step 4: Test Connection

Create a test script `test-sql-connection.js`:

```javascript
const ActionPlanService = require('./src/action-plan-service');

async function testConnection() {
    const service = new ActionPlanService();
    
    try {
        console.log('🔍 Testing SQL Server connection...');
        const result = await service.testConnection();
        
        if (result.success) {
            console.log('✅ Connection successful!');
            console.log('   Database version:', result.version);
        } else {
            console.log('❌ Connection failed:', result.message);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await service.disconnect();
    }
}

testConnection();
```

Run test:
```bash
node test-sql-connection.js
```

## Step 5: Firewall Configuration (Azure SQL only)

If using Azure SQL Database:

1. Go to Azure Portal → Your SQL Server
2. Navigate to **Networking** or **Firewalls and virtual networks**
3. Add your client IP address:
   - Click "Add client IP"
   - Or add IP range: `0.0.0.0` to `255.255.255.255` (for testing only, not production!)
4. Check "Allow Azure services and resources to access this server"
5. Save changes

## Step 6: Test with Sample Data

Run this query to insert test data:

```sql
-- Insert sample action plan response
INSERT INTO ActionPlanResponses (
    DocumentNumber, ReferenceValue, Section, Finding, 
    SuggestedAction, Priority, CreatedBy, UpdatedBy
)
VALUES (
    'GMRL-FSACR-0001', 
    '1.1', 
    'Food Storage', 
    'Expired items found in dry storage', 
    'Remove all expired items and implement FIFO system', 
    'High', 
    'System', 
    'System'
);

-- Verify insertion
SELECT * FROM ActionPlanResponses;
```

## Troubleshooting

### Connection Timeouts

**Error:** `ConnectionError: Failed to connect to SQL Server: getaddrinfo ENOTFOUND`

**Solution:**
- Verify server name is correct
- Check firewall settings
- Ensure SQL Server is running
- For Azure: Verify firewall rules

### Authentication Failed

**Error:** `Login failed for user`

**Solution:**
- Verify username and password
- For Azure: Use SQL authentication, not Windows auth
- Check SQL Server allows mixed authentication mode

### Port Issues

**Error:** `Connection timeout`

**Solution:**
- Default SQL Server port: 1433
- Ensure port is open in firewall
- For local dev: Enable TCP/IP in SQL Server Configuration Manager

### SSL/TLS Errors

**Error:** `self signed certificate`

**Solution:**
- For local dev: Set `SQL_TRUST_CERT=true`
- For Azure: Set `SQL_ENCRYPT=true` and `SQL_TRUST_CERT=false`

## Database Maintenance

### Backup Database
```sql
BACKUP DATABASE FoodSafetyDB
TO DISK = 'C:\Backups\FoodSafetyDB.bak';
```

### View Audit Logs
```sql
SELECT TOP 100 *
FROM ActionPlanAuditLog
ORDER BY ChangedDate DESC;
```

### Clean up old records (optional)
```sql
-- Delete action plans older than 1 year
DELETE FROM ActionPlanResponses
WHERE CreatedDate < DATEADD(YEAR, -1, GETDATE());
```

## Security Best Practices

1. ✅ Use strong passwords
2. ✅ Enable SSL/TLS encryption for production
3. ✅ Limit database permissions (read/write only what's needed)
4. ✅ Regular backups
5. ✅ Monitor failed login attempts
6. ✅ Use firewall rules to restrict access
7. ✅ Consider Azure Key Vault for credentials in production

## Next Steps

After database setup is complete:
1. Test the connection using `test-sql-connection.js`
2. Generate an Action Plan report from the dashboard
3. Fill in the form and click "Save Data"
4. Verify data is saved in SQL Server

Your Action Plan data will now be stored in SQL Server instead of just downloading JSON files!
