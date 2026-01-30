# Enable TCP/IP for SQL Server

The Node.js `mssql` library requires TCP/IP to be enabled for SQL Server connections.

## Check if TCP/IP is Enabled

1. Open **SQL Server Configuration Manager**
   - Press `Win + R`
   - Type: `SQLServerManager16.msc` (or `SQLServerManager15.msc` for SQL 2019)
   - Press Enter

2. Navigate to:
   - **SQL Server Network Configuration** β†' **Protocols for MSSQLSERVER**

3. Check **TCP/IP** status:
   - If it says "Disabled", you need to enable it

## Enable TCP/IP

1. Right-click **TCP/IP** β†' **Properties**

2. On the **IP Addresses** tab:
   - Scroll to **IPALL**
   - Set **TCP Port** to: `1433`

3. Click **OK**

4. **Restart SQL Server Service**:
   - Go to **SQL Server Services**
   - Right-click **SQL Server (MSSQLSERVER)**
   - Click **Restart**

## Verify Connection

After enabling TCP/IP and restarting:

```powershell
node test-sql-connection.js
```

Should now connect successfully!

## Alternative: Use PowerShell Instead

If you can't enable TCP/IP, we can use PowerShell for database operations:

```powershell
# The database is already created and schema is applied!
# You can verify with:
.\database\verify-schema.ps1
```

## Update .env for TCP/IP

Once TCP/IP is enabled, update `.env`:

```bash
SQL_SERVER=localhost
# or
SQL_SERVER=PowerApps-Repor
```

Both should work with TCP/IP enabled on port 1433.
