# 🚀 Checklist Management - Quick Start Guide

Get up and running in **5 minutes**!

---

## ⚡ Prerequisites

✅ SQL Server 2016+ installed  
✅ FoodSafetyDB database exists  
✅ Node.js 16+ installed  
✅ npm packages installed (`npm install`)  

---

## 📝 Step 1: Deploy Database (2 minutes)

Open PowerShell and run:

```powershell
# Navigate to project folder
cd C:\Users\gmrladmin\ReportGenerator

# Deploy schema
sqlcmd -S YOUR_SERVER_NAME -d FoodSafetyDB -i sql/schema-checklist-tables.sql
```

**Expected Output:**
```
✅ Table Checklists created successfully
✅ Table ChecklistItems created successfully
✅ Stored procedure sp_CreateChecklist created successfully
...
✅ Checklist Management Schema Deployment Complete!
```

**Windows Authentication:**
```powershell
sqlcmd -S localhost -d FoodSafetyDB -i sql/schema-checklist-tables.sql
```

**SQL Authentication:**
```powershell
sqlcmd -S localhost -d FoodSafetyDB -U your_user -P your_password -i sql/schema-checklist-tables.sql
```

---

## ⚙️ Step 2: Configure Environment (30 seconds)

Ensure your `.env` file has these settings:

```env
# SQL Server Configuration
SQL_SERVER=localhost
SQL_DATABASE=FoodSafetyDB
SQL_USER=                    # Leave empty for Windows Auth
SQL_PASSWORD=                # Leave empty for Windows Auth
SQL_ENCRYPT=false
SQL_TRUST_CERT=true

# API Configuration
CHECKLIST_API_PORT=3003
```

---

## 🧪 Step 3: Test System (1 minute)

```powershell
npm run test-checklist
```

**Expected Output:**
```
🧪 CHECKLIST MANAGEMENT SYSTEM - TEST SUITE
================================================================================

📡 Test 1: Database Connection
✅ Connection successful!

📋 Test 2: Create Checklist
✅ Checklist created successfully! ID: 1

... (all 11 tests pass)

✅ ALL TESTS COMPLETED SUCCESSFULLY!
```

**If tests fail:** Check your SQL Server connection in `.env`

---

## 🚀 Step 4: Start API Server (30 seconds)

```powershell
npm run checklist-api
```

**Expected Output:**
```
============================================================
📋 Checklist Management API Server Started
============================================================
🌐 Server running on: http://localhost:3003
📊 Health check: http://localhost:3003/health
```

**Keep this window open!**

---

## 🎨 Step 5: Open Web Interface (1 minute)

In a new PowerShell window:

```powershell
# Open the web interface
start checklist-manager.html
```

Or double-click `checklist-manager.html` in File Explorer.

**Your browser should open with the Checklist Management interface!**

---

## ✅ Verify Installation

### Test 1: Health Check

Open browser and go to:
```
http://localhost:3003/health
```

Should see:
```json
{
  "status": "OK",
  "service": "Checklist Management API",
  "timestamp": "2025-11-25T..."
}
```

### Test 2: Create Your First Checklist

1. In the web UI, fill out the form:
   - **Checklist Name**: "My First Checklist"
   - **Store Category**: Select "Happy Stores"
   - **Description**: "Testing the system"
   - **Created By**: Your name

2. Click "✅ Create Checklist"

3. You should see a success message!

### Test 3: Add an Item

1. Click on your newly created checklist
2. In the "Add New Item" form:
   - **Reference Value**: "1.1"
   - **Title**: "Test item - Ensure proper storage"
   - **Coefficient**: 4
   - **Guidance**: "This is a test item"

3. Click "➕ Add Item"

4. You should see the item appear in the table below!

---

## 🎯 Quick Usage Examples

### Create a Checklist via API

```powershell
# Using curl
curl -X POST http://localhost:3003/api/checklists `
  -H "Content-Type: application/json" `
  -d '{\"checklistName\":\"Food Storage\",\"storeCategory\":\"Happy Stores\",\"description\":\"Test\",\"createdBy\":\"Admin\"}'
```

### Get All Checklists

```powershell
curl http://localhost:3003/api/checklists
```

### Add Item to Checklist

```powershell
curl -X POST http://localhost:3003/api/checklists/1/items `
  -H "Content-Type: application/json" `
  -d '{\"referenceValue\":\"1.1\",\"title\":\"Test Item\",\"coeff\":4,\"answer\":\"Yes,Partially,No,NA\",\"cr\":\"Guidance text\"}'
```

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to database"

**Solution:**
```powershell
# Test SQL connection
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -Q "SELECT @@VERSION"
```

### Problem: "Port 3003 already in use"

**Solution:**
```powershell
# Change port in .env
echo CHECKLIST_API_PORT=3004 >> .env

# Restart API server
npm run checklist-api
```

### Problem: "CORS error in browser"

**Solution:** Make sure API server is running (`npm run checklist-api`)

### Problem: "Stored procedures not found"

**Solution:** Re-run the schema script:
```powershell
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/schema-checklist-tables.sql
```

---

## 📚 What's Next?

### Explore the Documentation

- **README-CHECKLIST.md** - Complete user guide and API reference
- **CHECKLIST-DEPLOYMENT.md** - Full deployment guide with production setup
- **CHECKLIST-STANDALONE.md** - Detailed system overview
- **CHECKLIST-ARCHITECTURE.md** - Technical architecture diagrams

### Create Your First Real Checklist

1. Open the web interface
2. Create a checklist for your store category
3. Add all your checklist items
4. Test the scoring functionality

### Query the Database

```sql
USE FoodSafetyDB;

-- View all checklists
SELECT * FROM Checklists WHERE IsActive = 1;

-- View items for a specific checklist
SELECT * FROM ChecklistItems WHERE ChecklistID = 1;

-- Get checklist with item count
SELECT 
    c.ChecklistName,
    c.StoreCategory,
    COUNT(ci.ItemID) AS ItemCount
FROM Checklists c
LEFT JOIN ChecklistItems ci ON c.ChecklistID = ci.ChecklistID
GROUP BY c.ChecklistName, c.StoreCategory;
```

---

## 🎉 Success!

You now have a fully functional checklist management system running!

### What You Can Do:

✅ Create unlimited checklists  
✅ Add unlimited items to each checklist  
✅ Calculate audit scores automatically  
✅ Manage everything through the web UI  
✅ Access data via REST API  
✅ Query SQL Server directly  

### What You Don't Need:

❌ SharePoint  
❌ Microsoft Graph API  
❌ PnP Libraries  
❌ Azure AD  

---

## 📞 Need Help?

- Check **CHECKLIST-DEPLOYMENT.md** for detailed troubleshooting
- Review test output: `npm run test-checklist`
- Check API logs in the terminal where you ran `npm run checklist-api`
- Query SQL Server to verify data

---

## 🚀 Production Deployment

For production deployment with PM2, HTTPS, and authentication, see:
**CHECKLIST-DEPLOYMENT.md** (Step 6: Security Configuration)

---

**Quick Start Time:** ~5 minutes ⏱️  
**Status:** ✅ Ready to Use  
**SharePoint Required:** ❌ NO  

Enjoy your new checklist management system! 🎊
