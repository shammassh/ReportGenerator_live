# 🚀 Checklist Template System - Deployment Guide

## Overview
Step-by-step guide to deploy the Checklist Template Management System to production.

---

## 📋 Pre-Deployment Checklist

- [ ] SQL Server accessible (FoodSafetyDB database exists)
- [ ] Node.js 16+ installed on server
- [ ] SQL Server credentials ready
- [ ] Session secret generated
- [ ] Port 3005 available (or alternative configured)
- [ ] Admin/SuperAuditor users identified

---

## 🗄️ Step 1: Database Setup

### 1.1 Create Main Schema
```bash
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/schema-checklist-template-v2.sql
```

**What this does:**
- Creates 6 tables
- Inserts 13 default sections
- Adds SuperAuditor role to UserRoles
- Sets up indexes and foreign keys

**Verify:**
```sql
-- Check tables exist
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME LIKE 'Checklist%';

-- Check default sections
SELECT * FROM ChecklistSections;

-- Should return 13 rows with emojis
```

### 1.2 Install Stored Procedures

```bash
# Schemas procedures (5 SPs)
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-schemas.sql

# Sections procedures (5 SPs)
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-sections.sql

# Templates procedures (7 SPs)
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-templates.sql

# Items procedures (7 SPs)
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-template-items.sql
```

**Verify:**
```sql
-- Check stored procedures
SELECT name FROM sys.procedures 
WHERE name LIKE 'sp_%Checklist%' OR name LIKE 'sp_%Template%';

-- Should return 24 procedures
```

---

## ⚙️ Step 2: Environment Configuration

### 2.1 Create/Update .env File

```bash
# Create .env in project root
cd c:\Users\gmrladmin\ReportGenerator
```

Add the following (replace placeholders):

```env
# SQL Server Configuration
SQL_SERVER=YOUR_SQL_SERVER_NAME
SQL_DATABASE=FoodSafetyDB
SQL_USER=YOUR_SQL_USERNAME
SQL_PASSWORD=YOUR_SQL_PASSWORD

# API Configuration
CHECKLIST_API_PORT=3005
NODE_ENV=production

# Session Security
SESSION_SECRET=GENERATE_A_SECURE_RANDOM_STRING_HERE

# CORS (if needed)
ALLOWED_ORIGINS=http://your-frontend-domain.com
```

### 2.2 Generate Secure Session Secret

**Option 1 - Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Option 2 - PowerShell:**
```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object {Get-Random -Maximum 256}))
```

Copy the output to `SESSION_SECRET` in `.env`

### 2.3 Verify Configuration
```bash
# Test database connection
node -e "require('dotenv').config(); const SQLConnector = require('./src/sql-connector'); new SQLConnector().connect().then(() => console.log('✅ DB Connected')).catch(e => console.error('❌ Error:', e.message))"
```

---

## 👥 Step 3: User Role Assignment

### 3.1 Identify Users

Find user IDs for Admin/SuperAuditor:
```sql
-- List all users
SELECT UserID, Username, Email FROM Users;
```

### 3.2 Assign SuperAuditor Role

```sql
-- Add SuperAuditor role to specific users
INSERT INTO UserRoles (UserID, RoleName)
VALUES 
  (1, 'SuperAuditor'),    -- Replace 1 with actual UserID
  (5, 'SuperAuditor'),    -- Add more as needed
  (12, 'SuperAuditor');

-- Verify role assignment
SELECT u.UserID, u.Username, ur.RoleName
FROM Users u
INNER JOIN UserRoles ur ON u.UserID = ur.UserID
WHERE ur.RoleName IN ('Admin', 'SuperAuditor');
```

### 3.3 Check Existing Admin Roles

```sql
-- List all admins
SELECT u.UserID, u.Username, u.Email
FROM Users u
INNER JOIN UserRoles ur ON u.UserID = ur.UserID
WHERE ur.RoleName = 'Admin';
```

---

## 📦 Step 4: Install Dependencies

```bash
# Navigate to project directory
cd c:\Users\gmrladmin\ReportGenerator

# Install Node.js packages
npm install

# Verify critical dependencies
npm list express express-session mssql dotenv
```

**Expected output:**
```
├── express@4.x.x
├── express-session@1.x.x
├── mssql@12.x.x
└── dotenv@16.x.x
```

---

## 🧪 Step 5: Run Tests

### 5.1 Update Test User ID

Edit `test-checklist-template-system.js`:
```javascript
// Line 9: Update with real user ID
const TEST_USER_ID = 1; // ← Change to your actual UserID
```

### 5.2 Execute Test Suite

```bash
npm run test-checklist-template
```

**Expected output:**
```
📋 CHECKLIST TEMPLATE SYSTEM TEST SUITE
==========================================================
Testing Schema Service
✅ Schema created with ID: X
✅ Retrieved Y schemas
✅ Schema found: Test Store Category
✅ Schema updated successfully

Testing Section Service
✅ Retrieved 13 sections
...

🎉 ALL TESTS PASSED SUCCESSFULLY!
```

### 5.3 Verify Database State

```sql
-- Check test data was created and cleaned up
SELECT COUNT(*) as ActiveSchemas FROM ChecklistSchemas WHERE IsActive = 1;
SELECT COUNT(*) as ActiveTemplates FROM ChecklistTemplates WHERE IsActive = 1;
SELECT COUNT(*) as TotalItems FROM ChecklistTemplateItems;
```

---

## 🚀 Step 6: Start the API Server

### 6.1 Test Run (Foreground)

```bash
npm run checklist-template-api
```

**Expected output:**
```
============================================================
📋 Checklist Template Management API
============================================================
✅ Server running on port 3005
📡 Health check: http://localhost:3005/health
📚 API documentation: http://localhost:3005/api
============================================================
```

### 6.2 Health Check

Open browser or use curl:
```bash
curl http://localhost:3005/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "Checklist Template API",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 6.3 API Documentation

```bash
curl http://localhost:3005/api
```

Should return full API documentation JSON.

---

## 🔄 Step 7: Production Deployment

### Option A: Windows Service (Recommended)

**Using PM2:**

```bash
# Install PM2 globally
npm install -g pm2

# Start service
pm2 start checklist-template-api.js --name "checklist-api"

# Configure auto-start on reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs checklist-api
```

### Option B: Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task:
   - **Name**: Checklist Template API
   - **Trigger**: At system startup
   - **Action**: Start a program
   - **Program**: `C:\Program Files\nodejs\node.exe`
   - **Arguments**: `checklist-template-api.js`
   - **Start in**: `c:\Users\gmrladmin\ReportGenerator`

### Option C: Screen (Linux/Unix)

```bash
# Start in detached screen
screen -dmS checklist-api npm run checklist-template-api

# Reattach to view logs
screen -r checklist-api

# Detach: Ctrl+A, D
```

---

## 🔐 Step 8: Security Hardening

### 8.1 Update CORS Settings

Edit `checklist-template-api.js`:

```javascript
// Replace wildcard CORS with specific origins
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://your-frontend.com',
    'https://your-frontend.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  // ... rest of CORS setup
});
```

### 8.2 Enable HTTPS (Production)

```javascript
// Add to checklist-template-api.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(options, app).listen(3005);
```

### 8.3 Secure Session Configuration

Verify in `checklist-template-api.js`:

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,        // ← Only over HTTPS in production
    httpOnly: true,      // ← Prevent XSS
    maxAge: 8 * 60 * 60 * 1000  // 8 hours
  }
}));
```

### 8.4 Environment Variables Security

```bash
# Restrict .env file permissions (Linux/Unix)
chmod 600 .env

# Windows: Right-click .env → Properties → Security → Remove all except system admins
```

---

## 📊 Step 9: Monitoring & Logging

### 9.1 Setup Log Directory

```bash
mkdir logs
```

### 9.2 Configure Winston Logger (Optional)

```bash
npm install winston
```

Create `src/logger.js`:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

module.exports = logger;
```

### 9.3 Monitor API Health

Create monitoring script `monitor-api.js`:

```javascript
const http = require('http');

setInterval(() => {
  http.get('http://localhost:3005/health', (res) => {
    if (res.statusCode !== 200) {
      console.error(`❌ API unhealthy: ${res.statusCode}`);
      // Send alert email/notification
    }
  }).on('error', (err) => {
    console.error(`❌ API down: ${err.message}`);
    // Send alert email/notification
  });
}, 60000); // Check every minute
```

---

## ✅ Step 10: Verification Checklist

### 10.1 Functional Tests

- [ ] Health endpoint responds: `GET /health`
- [ ] API docs accessible: `GET /api`
- [ ] Create schema: `POST /api/schemas`
- [ ] List sections: `GET /api/sections`
- [ ] Create template: `POST /api/templates`
- [ ] Add items: `POST /api/templates/:id/items/batch`
- [ ] Retrieve full template: `GET /api/templates/:id/full`

### 10.2 Security Tests

- [ ] Unauthenticated requests rejected (401)
- [ ] Non-admin users rejected (403)
- [ ] Session expires after inactivity
- [ ] CORS only allows whitelisted origins
- [ ] SQL injection attempts blocked (by stored procedures)

### 10.3 Performance Tests

```bash
# Install Apache Bench (optional)
# Test 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3005/health
```

---

## 🆘 Troubleshooting

### Issue: "Cannot connect to SQL Server"

**Solutions:**
1. Check SQL Server is running
2. Verify credentials in `.env`
3. Test connection:
   ```bash
   sqlcmd -S YOUR_SERVER -U YOUR_USER -P YOUR_PASSWORD -d FoodSafetyDB -Q "SELECT 1"
   ```

### Issue: "Port 3005 already in use"

**Solutions:**
1. Change port in `.env`:
   ```env
   CHECKLIST_API_PORT=3006
   ```
2. Or kill existing process:
   ```bash
   # Windows
   netstat -ano | findstr :3005
   taskkill /PID <PID> /F
   ```

### Issue: "Unauthorized" on all requests

**Solutions:**
1. Check user is logged in (session exists)
2. Verify user has Admin or SuperAuditor role:
   ```sql
   SELECT * FROM UserRoles WHERE UserID = YOUR_USER_ID;
   ```
3. Check session middleware is configured

### Issue: Stored procedure not found

**Solutions:**
```sql
-- Re-run stored procedure installation
-- Check procedure exists
SELECT name FROM sys.procedures WHERE name LIKE '%Template%';
```

---

## 📈 Performance Tuning

### Database Indexes

Already included in schema, but verify:

```sql
-- Check indexes exist
SELECT 
  i.name as IndexName,
  t.name as TableName,
  c.name as ColumnName
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name LIKE 'Checklist%';
```

### API Caching (Future Enhancement)

Consider adding Redis for frequently accessed templates:

```bash
npm install redis
```

---

## 🎉 Deployment Complete!

### Post-Deployment Steps

1. ✅ Notify Admin/SuperAuditor users
2. ✅ Provide API documentation URL
3. ✅ Schedule regular database backups
4. ✅ Setup monitoring alerts
5. ✅ Document any custom configurations

### Support Contacts

- **Technical Issues**: Food Safety IT Team
- **User Training**: System Administrator
- **Emergency**: [Contact Info]

---

## 📚 Additional Resources

- [README-CHECKLIST-TEMPLATE.md](./README-CHECKLIST-TEMPLATE.md) - Full API documentation
- [BUILD-PROGRESS.md](./BUILD-PROGRESS.md) - Development history
- [test-checklist-template-system.js](./test-checklist-template-system.js) - Test examples

**System Status: ✅ Production Ready**

Last Updated: January 2025
