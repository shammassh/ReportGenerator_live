# 🚀 Checklist Management System - Deployment Guide

Complete step-by-step guide for deploying the Checklist Management module.

## 📋 Pre-Deployment Checklist

- [ ] SQL Server access credentials
- [ ] FoodSafetyDB database exists
- [ ] Node.js 16+ installed
- [ ] npm dependencies installed
- [ ] .env file configured

## 🗄️ Step 1: Deploy Database Schema

### Option A: Using SQL Server Management Studio (SSMS)

1. Open SQL Server Management Studio
2. Connect to your SQL Server instance
3. Open the file: `sql/schema-checklist-tables.sql`
4. Ensure you're connected to `FoodSafetyDB` database
5. Click **Execute** (F5)

Expected output:
```
✅ Table Checklists created successfully
✅ Table ChecklistItems created successfully
✅ Stored procedure sp_CreateChecklist created successfully
✅ Stored procedure sp_AddChecklistItem created successfully
... (all stored procedures)
✅ Checklist Management Schema Deployment Complete!
```

### Option B: Using sqlcmd (Command Line)

```powershell
# Windows Authentication
sqlcmd -S YOUR_SERVER_NAME -d FoodSafetyDB -i sql/schema-checklist-tables.sql

# SQL Server Authentication
sqlcmd -S YOUR_SERVER_NAME -d FoodSafetyDB -U your_username -P your_password -i sql/schema-checklist-tables.sql
```

### Option C: Using Azure Data Studio

1. Open Azure Data Studio
2. Connect to your SQL Server
3. Right-click on `FoodSafetyDB` → **New Query**
4. Copy contents of `sql/schema-checklist-tables.sql`
5. Paste and **Run** (F5)

### Verify Deployment

Run this query in SSMS/Azure Data Studio:

```sql
USE FoodSafetyDB;
GO

-- Check tables
SELECT 'Checklists' AS TableName, COUNT(*) AS RecordCount FROM Checklists
UNION ALL
SELECT 'ChecklistItems', COUNT(*) FROM ChecklistItems;

-- Check stored procedures
SELECT name, create_date, modify_date 
FROM sys.procedures 
WHERE name LIKE 'sp_%Checklist%'
ORDER BY name;
```

Expected results:
- 2 tables with 0 records
- 8 stored procedures starting with `sp_`

## ⚙️ Step 2: Configure Environment

### Update .env File

Add or verify these settings in your `.env` file:

```env
# SQL Server Configuration (existing)
SQL_SERVER=your_server_name
SQL_DATABASE=FoodSafetyDB
SQL_USER=your_username          # Optional for Windows Auth
SQL_PASSWORD=your_password      # Optional for Windows Auth
SQL_ENCRYPT=false               # Set to true for Azure SQL
SQL_TRUST_CERT=true             # Set to false for production with valid cert
SQL_INSTANCE=                   # Optional, for named instances like SQLEXPRESS

# Checklist API Configuration (new)
CHECKLIST_API_PORT=3003         # Default 3003, change if needed
```

### Test Configuration

```powershell
# Test environment variables
node -e "require('dotenv').config(); console.log('SQL Server:', process.env.SQL_SERVER, '\nDatabase:', process.env.SQL_DATABASE)"
```

## 🧪 Step 3: Test the System

### Run Complete Test Suite

```powershell
npm run test-checklist
```

This will:
1. ✅ Test database connection
2. ✅ Create a test checklist
3. ✅ Add single item
4. ✅ Add multiple items (batch)
5. ✅ Retrieve checklists
6. ✅ Calculate scores
7. ✅ Update items
8. ✅ Delete items
9. ✅ Deactivate checklist

Expected output:
```
🧪 CHECKLIST MANAGEMENT SYSTEM - TEST SUITE
================================================================================

📡 Test 1: Database Connection
--------------------------------------------------------------------------------
✅ Connection successful!
   SQL Server Version: Microsoft SQL Server 2019...

📋 Test 2: Create Checklist
--------------------------------------------------------------------------------
✅ Checklist created successfully! ID: 1

... (all tests passing)

================================================================================
✅ ALL TESTS COMPLETED SUCCESSFULLY!
================================================================================
```

### Manual Connection Test

```powershell
# Quick connection test
node -e "const ChecklistService = require('./src/checklist-service'); new ChecklistService().testConnection().then(r => console.log(r))"
```

## 🚀 Step 4: Start the API Server

### Development Mode

```powershell
# Start API server on port 3003
npm run checklist-api
```

Expected output:
```
============================================================
📋 Checklist Management API Server Started
============================================================
🌐 Server running on: http://localhost:3003
📊 Health check: http://localhost:3003/health
🔍 Test connection: http://localhost:3003/api/test-connection
```

### Test API Endpoints

```powershell
# Health check
curl http://localhost:3003/health

# Database connection test
curl http://localhost:3003/api/test-connection
```

### Production Mode (with PM2)

Install PM2 if not already installed:
```powershell
npm install -g pm2
```

Start with PM2:
```powershell
# Start API server
pm2 start checklist-api.js --name "checklist-api"

# View logs
pm2 logs checklist-api

# Monitor
pm2 monit

# Stop
pm2 stop checklist-api

# Restart
pm2 restart checklist-api
```

## 🎨 Step 5: Access Web Interface

### Option A: Direct File Access

1. Ensure API server is running (`npm run checklist-api`)
2. Open `checklist-manager.html` in your browser:
   ```powershell
   # Windows
   start checklist-manager.html
   
   # Or double-click the file
   ```

### Option B: Serve with Express

Add this to `checklist-api.js` after line 15:

```javascript
// Serve static files
app.use(express.static('.'));

// Serve UI
app.get('/ui', (req, res) => {
    res.sendFile(__dirname + '/checklist-manager.html');
});
```

Then access: `http://localhost:3003/ui`

### Option C: Nginx/IIS (Production)

For IIS:
1. Copy `checklist-manager.html` to IIS wwwroot
2. Update API_BASE URL in the HTML file:
   ```javascript
   const API_BASE = 'https://your-domain.com/api';
   ```

## 🔐 Step 6: Security Configuration (Production Only)

### Add Authentication Middleware

Install dependencies:
```powershell
npm install passport passport-local express-validator
```

Update `checklist-api.js`:

```javascript
const session = require('express-session');
const passport = require('passport');

// Add session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true }
}));

// Add authentication middleware to protected routes
app.use('/api/checklists', authenticateUser);
```

### Enable HTTPS

For production, use HTTPS:

```javascript
const https = require('https');
const fs = require('fs');

const httpsOptions = {
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(httpsOptions, app).listen(3003);
```

### Configure CORS

Update CORS settings for production:

```javascript
app.use(cors({
    origin: ['https://your-domain.com', 'https://www.your-domain.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## 📊 Step 7: Create Sample Data (Optional)

### Using SQL Script

Uncomment sample data section in `sql/schema-checklist-tables.sql` and re-run.

### Using API

```powershell
# Create sample checklist
curl -X POST http://localhost:3003/api/checklists ^
  -H "Content-Type: application/json" ^
  -d "{\"checklistName\":\"Food Storage\",\"storeCategory\":\"Happy Stores\",\"description\":\"Food storage compliance\",\"createdBy\":\"Admin\"}"
```

### Using Web UI

1. Open `checklist-manager.html`
2. Click **Create New** tab
3. Fill in form and submit

## 🔍 Step 8: Verify Installation

### Database Verification

```sql
USE FoodSafetyDB;
GO

-- Check checklist count
SELECT COUNT(*) AS ChecklistCount FROM Checklists WHERE IsActive = 1;

-- Check items count
SELECT COUNT(*) AS ItemCount FROM ChecklistItems;

-- View all checklists with items
SELECT 
    c.ChecklistName,
    c.StoreCategory,
    COUNT(ci.ItemID) AS ItemCount
FROM Checklists c
LEFT JOIN ChecklistItems ci ON c.ChecklistID = ci.ChecklistID
WHERE c.IsActive = 1
GROUP BY c.ChecklistName, c.StoreCategory;
```

### API Verification

```powershell
# Get all checklists
curl http://localhost:3003/api/checklists

# Get specific checklist
curl http://localhost:3003/api/checklists/1
```

### UI Verification

1. Open `checklist-manager.html`
2. Verify you can:
   - ✅ See existing checklists
   - ✅ Create new checklist
   - ✅ Add items to checklist
   - ✅ View item details

## 🎯 Step 9: Integration with Existing System

### Update Dashboard

Add checklist management link to `dashboard.html`:

```html
<div class="card">
    <h3>📋 Checklist Management</h3>
    <p>Create and manage custom audit checklists</p>
    <a href="checklist-manager.html" class="btn">Manage Checklists</a>
</div>
```

### Update start-servers.ps1

Add checklist API to the startup script:

```powershell
# Start Checklist API Server
Write-Host "Starting Checklist API Server..." -ForegroundColor Cyan
Start-Process -FilePath "node" -ArgumentList "checklist-api.js" -NoNewWindow

Start-Sleep -Seconds 2
Write-Host "✓ Checklist API Server started on http://localhost:3003" -ForegroundColor Green
```

## 🐛 Troubleshooting

### Issue: Cannot connect to database

**Solution:**
```powershell
# Test SQL connection
node test-sql-connection.js

# Check environment variables
node -e "require('dotenv').config(); console.log(process.env)"
```

### Issue: Port 3003 already in use

**Solution:**
```powershell
# Change port in .env
echo CHECKLIST_API_PORT=3004 >> .env

# Or kill existing process
netstat -ano | findstr :3003
taskkill /PID <process_id> /F
```

### Issue: CORS errors

**Solution:**
Update `checklist-api.js`:
```javascript
app.use(cors({
    origin: '*', // Allow all origins (development only)
    credentials: true
}));
```

### Issue: Stored procedures not found

**Solution:**
Re-run schema script:
```powershell
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/schema-checklist-tables.sql
```

## 📈 Monitoring & Maintenance

### Database Maintenance

Run weekly:
```sql
-- Check for inactive checklists
SELECT * FROM Checklists WHERE IsActive = 0;

-- Check orphaned items (shouldn't exist due to FK)
SELECT * FROM ChecklistItems ci
LEFT JOIN Checklists c ON ci.ChecklistID = c.ChecklistID
WHERE c.ChecklistID IS NULL;

-- View usage statistics
SELECT 
    c.StoreCategory,
    COUNT(DISTINCT c.ChecklistID) AS ChecklistCount,
    COUNT(ci.ItemID) AS TotalItems
FROM Checklists c
LEFT JOIN ChecklistItems ci ON c.ChecklistID = ci.ChecklistID
WHERE c.IsActive = 1
GROUP BY c.StoreCategory;
```

### API Monitoring

Using PM2:
```powershell
# View logs
pm2 logs checklist-api --lines 100

# Monitor resources
pm2 monit

# Save configuration
pm2 save
pm2 startup
```

### Backup

```sql
-- Backup checklists
BACKUP DATABASE FoodSafetyDB 
TO DISK = 'C:\Backups\FoodSafetyDB_Backup.bak'
WITH FORMAT, INIT, NAME = 'Full Backup of FoodSafetyDB';
```

## ✅ Post-Deployment Checklist

- [ ] Database schema deployed successfully
- [ ] All stored procedures created
- [ ] Test suite passes (npm run test-checklist)
- [ ] API server starts without errors
- [ ] Health check endpoint responds
- [ ] Web UI loads and connects to API
- [ ] Can create checklist via UI
- [ ] Can add items to checklist
- [ ] Can calculate scores
- [ ] Integrated with dashboard (if applicable)
- [ ] Startup script updated (if applicable)
- [ ] Documentation reviewed by team
- [ ] Backup procedure established
- [ ] Monitoring configured

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs checklist-api`
2. Review test output: `npm run test-checklist`
3. Verify database: Check SQL Server logs
4. Contact development team

## 📚 Next Steps

After successful deployment:

1. **Train Users** - Review README-CHECKLIST.md with team
2. **Create Templates** - Set up common checklists for each store category
3. **Integration** - Connect with SharePoint sync if needed
4. **Monitoring** - Set up alerts for system health
5. **Feedback** - Gather user feedback for improvements

---

**Deployment Version:** 1.0.0  
**Last Updated:** November 25, 2025  
**Status:** Production Ready ✅
