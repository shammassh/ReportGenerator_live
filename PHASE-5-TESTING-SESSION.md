# Phase 5 Testing Session - Quick Start

## ⚠️ Prerequisites Check

Before testing Phase 5, ensure these are set up:

### 1. Database Configuration
```javascript
// config/default.js should have:
database: {
    server: 'localhost',
    database: 'FoodSafetyDB',
    authentication: {
        type: 'default',
        options: {
            userName: 'sa',
            password: 'YourActualPassword'  // UPDATE THIS!
        }
    }
}
```

### 2. SQL Server Running
```powershell
# Check if SQL Server is running
Get-Service | Where-Object {$_.Name -like '*SQL*'}
```

### 3. Database Exists
```sql
-- In SQL Server, run:
USE FoodSafetyDB;
GO

-- Check tables exist:
SELECT name FROM sys.tables WHERE name IN ('Users', 'Sessions', 'AuditLog');
```

### 4. Admin User Seeded
```sql
-- Check admin user:
SELECT email, role, is_active, is_approved 
FROM Users 
WHERE email = 'muhammad.shammas@gmrlgroup.com';
```

---

## 🚀 Testing Steps

### Step 1: Update Database Password
```powershell
# Edit config/default.js
# Update the password field with your actual SQL Server sa password
```

### Step 2: Verify Database Connection
```powershell
# Test database connection
node test-sql-connection.js
```

Expected output:
```
✅ Database connection successful
✅ Users table found
✅ Sessions table found
✅ AuditLog table found
```

### Step 3: Start the Server
```powershell
node auth-app.js
```

Expected output:
```
============================================================
🚀 FOOD SAFETY AUDIT SYSTEM
============================================================
✅ Server running on http://localhost:3000

📋 Available Routes:
   🔓 Login:           http://localhost:3000/auth/login
   🔐 Dashboard:       http://localhost:3000/dashboard
   👤 Admin Panel:     http://localhost:3000/admin/users
   📊 Auditor Select:  http://localhost:3000/auditor/select
   🚪 Logout:          http://localhost:3000/auth/logout

📌 Default Admin: muhammad.shammas@gmrlgroup.com
============================================================
```

### Step 4: Open Browser
```
http://localhost:3000
```

Should redirect to:
```
http://localhost:3000/auth/login
```

### Step 5: Login
- Click "Sign in with Microsoft"
- Login with admin account: `muhammad.shammas@gmrlgroup.com`
- Should redirect to dashboard

### Step 6: Verify Phase 5 Features

✅ **User Info Header**
- [ ] Avatar with initials appears
- [ ] Name displayed
- [ ] "👑 Administrator" badge visible
- [ ] Navigation links present
- [ ] Logout button visible

✅ **Dashboard Access**
- [ ] Dashboard loads successfully
- [ ] All documents visible (Admin sees all)
- [ ] All buttons visible

✅ **Browser Console**
Open F12 → Console:
```javascript
// Should see:
🔐 Dashboard Filter initialized for: [Your Name] Role: Admin
📊 Filtered [N] documents to [N] for role: Admin
✅ User info header added
```

✅ **Check USER_CONTEXT**
In console, type:
```javascript
USER_CONTEXT
```

Should show:
```javascript
{
  email: "your.email@gmrlgroup.com",
  name: "Your Name",
  role: "Admin",
  permissions: {
    canGenerate: true,
    canViewMain: true,
    canViewActionPlan: true,
    canViewDepartment: true,
    canAccessAdmin: true,
    canAccessAuditorSelection: false,
    accessibleStores: ["ALL"],
    accessibleDepartment: null,
    role: "Admin",
    email: "your.email@gmrlgroup.com",
    name: "Your Name"
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module 'cookie-parser'"
```powershell
npm install cookie-parser
```

### Issue 2: "EADDRINUSE: port 3000 already in use"
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual)
taskkill /F /PID <PID>
```

### Issue 3: "Cannot read properties of undefined (reading 'port')"
**Solution**: Database configuration missing or incorrect in `config/default.js`

### Issue 4: "Login failed" or "ELOGIN"
**Solution**: Check database credentials in `config/default.js`

### Issue 5: "User not found" after login
**Solution**: Run seed-admin.sql to create admin user:
```powershell
cd database
sqlcmd -S localhost -U sa -P YourPassword -i seed-admin.sql
```

### Issue 6: User header not appearing
**Check:**
1. Open browser console (F12)
2. Look for JavaScript errors
3. Verify `window.USER_CONTEXT` is defined
4. Check if dashboard-filter.js and user-context.js are loaded

**Fix:**
```javascript
// In browser console
console.log(USER_CONTEXT);  // Should show user data
console.log(document.querySelector('.user-info-header'));  // Should not be null
```

---

## 📋 Quick Test Checklist

### Admin User Test (5 min)
- [ ] Login works
- [ ] User header visible with Admin badge
- [ ] All documents visible
- [ ] All buttons visible (Generate, Action Plan, Dept buttons)
- [ ] User Management link works
- [ ] Logout works

### Create Test Users (10 min)
- [ ] Navigate to User Management
- [ ] Create Auditor user
- [ ] Create Store Manager (assign stores)
- [ ] Create Cleaning Head
- [ ] Logout

### Test Other Roles (15 min)
- [ ] Login as Auditor → see all, has "New Audit" link
- [ ] Login as Store Manager → see only assigned stores, no generate buttons
- [ ] Login as Cleaning Head → see only Cleaning button

---

## 🎯 Success Criteria

Phase 5 testing is successful when:

✅ **Server Starts**
- Server runs without errors
- All routes registered
- Database connected

✅ **Authentication Works**
- Login redirects to Microsoft
- Session created after login
- Dashboard accessible after auth

✅ **Phase 5 Features Work**
- User header appears with role badge
- Documents filtered by role
- Buttons hidden/shown correctly
- Navigation links based on role

✅ **Security Works**
- Cannot access dashboard without login
- Cannot bypass role restrictions
- Server validates all permissions

---

## 📊 Testing Timeline

### Quick Test (15 minutes)
1. Update database config (2 min)
2. Start server (1 min)
3. Login as admin (2 min)
4. Verify Phase 5 features (5 min)
5. Test logout (1 min)
6. Document results (4 min)

### Full Test (45 minutes)
1. Quick test above (15 min)
2. Create test users via admin panel (10 min)
3. Test each role (15 min)
4. Security testing (5 min)

### Complete Test (2 hours)
1. Full test above (45 min)
2. UI/UX testing on different browsers (30 min)
3. Responsive design testing (15 min)
4. Performance testing (15 min)
5. Documentation of findings (15 min)

---

## 📝 Next Steps After Testing

### If All Tests Pass ✅
1. Document test results
2. Create test user accounts for team
3. Schedule Phase 6 planning meeting
4. Begin Checklist Management design

### If Issues Found ❌
1. Document each issue
2. Check browser console for errors
3. Check server logs
4. Review Phase 5 code
5. Fix issues
6. Re-test

---

## 💡 Pro Tips

1. **Use Chrome DevTools**: F12 → Console tab for debugging
2. **Keep Server Logs Visible**: Watch for authentication logs
3. **Test in Incognito**: Avoid cookie/cache issues
4. **Take Screenshots**: Document what you see for each role
5. **Use Multiple Browsers**: Test login with different Microsoft accounts

---

**Ready to test? Update the database password in config/default.js and start!** 🚀
