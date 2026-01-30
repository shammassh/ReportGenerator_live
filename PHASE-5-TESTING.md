# Phase 5 Testing Quick Reference

## 🚀 Quick Start

```bash
# 1. Start the server
node auth-app.js

# 2. Open browser
http://localhost:3000

# 3. You'll be redirected to login
```

---

## 👤 Test Users

### Pre-configured Admin
- **Email**: `muhammad.shammas@gmrlgroup.com`
- **Role**: Admin
- **Access**: Everything

### Create Test Users
Use the admin panel to create users with different roles:

1. Login as admin
2. Navigate to User Management: `http://localhost:3000/admin/user-management`
3. Click user → Edit → Set role and stores

---

## ✅ Testing Checklist

### Admin Role Test
```
Login as: muhammad.shammas@gmrlgroup.com

Dashboard should show:
  ✓ User header with "👑 Administrator" badge
  ✓ "User Management" link in header
  ✓ All documents from all stores visible
  ✓ "Generate" button visible on each document
  ✓ "Action Plan" button visible
  ✓ All department buttons visible (Maintenance, Procurement, Cleaning)
  ✓ PDF and DOC export buttons visible

Console logs:
  ✓ "🔐 Dashboard Filter initialized for: [Name] Role: Admin"
  ✓ "📊 Filtered [N] documents to [N] for role: Admin"
```

### Auditor Role Test
```
Create auditor user via admin panel

Dashboard should show:
  ✓ User header with "📋 Auditor" badge
  ✓ "New Audit" link in header
  ✓ All documents from all stores visible
  ✓ "Generate" and "Action Plan" buttons visible
  ✓ All department buttons visible
  ✓ PDF and DOC buttons visible

Console logs:
  ✓ "✅ Authenticated: [email] (Auditor)"
```

### Store Manager Role Test
```
Create store manager user via admin panel
Assign stores: "GMRL Reef Mall, GMRL Discovery Gardens"

Dashboard should show:
  ✓ User header with "🏪 Store Manager" badge
  ✓ Assigned stores list displayed below header
  ✓ ONLY documents from assigned stores
  ✗ "Generate" button HIDDEN (not just disabled)
  ✗ "Action Plan" button HIDDEN
  ✗ All department buttons HIDDEN
  ✗ PDF and DOC buttons HIDDEN
  ✓ "View" button still visible

Console logs:
  ✓ "🔒 Hiding generate buttons for role: StoreManager"
  ✓ "🔒 Hiding department buttons for role: StoreManager"
  ✓ "🔒 Hiding export buttons for Store Manager"
```

### Cleaning Head Role Test
```
Create user via admin panel
Set role: CleaningHead

Dashboard should show:
  ✓ User header with "🧹 Cleaning Head" badge
  ✓ Department badge: "🧹 Cleaning"
  ✓ All documents visible (all stores)
  ✗ "Generate" button HIDDEN
  ✗ "Action Plan" button HIDDEN
  ✓ ONLY "Cleaning" department button visible
  ✗ Maintenance button HIDDEN
  ✗ Procurement button HIDDEN
  ✗ PDF and DOC buttons HIDDEN

Console logs:
  ✓ "✅ Showing only Cleaning department button"
```

### Procurement Head Role Test
```
Set role: ProcurementHead

Dashboard should show:
  ✓ User header with "📦 Procurement Head" badge
  ✓ Department badge: "📦 Procurement"
  ✓ ONLY "Procurement" department button visible
  ✗ Other buttons HIDDEN
```

### Maintenance Head Role Test
```
Set role: MaintenanceHead

Dashboard should show:
  ✓ User header with "🔧 Maintenance Head" badge
  ✓ Department badge: "🔧 Maintenance"
  ✓ ONLY "Maintenance" department button visible
  ✗ Other buttons HIDDEN
```

---

## 🔍 Browser Console Checks

### Open Browser Console (F12)

Look for these logs:

#### ✅ Good Logs (Expected)
```javascript
🔐 Dashboard Filter initialized for: John Doe Role: Admin
✅ Authenticated: john.doe@gmrlgroup.com (Admin)
📊 Filtered 50 documents to 50 for role: Admin
✅ User info header added
```

#### ❌ Error Logs (Problems)
```javascript
❌ No session token found
❌ Session not found or expired
❌ User context not available
❌ Dashboard header not found
```

### Check USER_CONTEXT
In browser console, type:
```javascript
USER_CONTEXT
```

Should return:
```javascript
{
  email: "user@example.com",
  name: "John Doe",
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
    email: "user@example.com",
    name: "John Doe"
  }
}
```

---

## 🎨 Visual Inspection

### User Info Header
Should be at the TOP of the dashboard header with:
- User avatar (initials in circle)
- User name
- Role badge (colored gradient)
- Navigation links (based on role)
- Logout button (red)

### Role Badges Colors
- **Admin**: Pink/red gradient
- **Auditor**: Blue/cyan gradient
- **Store Manager**: Green/teal gradient
- **Cleaning Head**: Pink/yellow gradient
- **Procurement Head**: Teal/purple gradient
- **Maintenance Head**: Light blue/pink gradient

### Store Assignment (Store Managers)
- Purple gradient box below header
- "📍 Assigned Stores:" label
- White rounded tags with store names

### Department Badge (Dept Heads)
- Pink/red gradient box below header
- "🏢 Department:" label
- White rounded badge with department name

---

## 🐛 Troubleshooting

### Problem: No user header appears
**Check:**
1. Browser console for errors
2. `window.USER_CONTEXT` is defined
3. Dashboard.css is loaded
4. user-context.js is loaded

**Fix:**
```javascript
// In browser console
console.log(USER_CONTEXT);  // Should show user data
console.log(document.querySelector('.user-info-header'));  // Should not be null
```

### Problem: All buttons visible (filtering not working)
**Check:**
1. Browser console for "Dashboard Filter initialized" log
2. `window.DashboardFilter` object exists
3. dashboard-filter.js is loaded

**Fix:**
```javascript
// In browser console
console.log(DashboardFilter);  // Should show filter object
DashboardFilter.applyUIControls();  // Manually trigger
```

### Problem: Wrong documents shown
**Check:**
1. User's assigned_stores in database
2. Document storeName field matches assigned stores
3. Filter logic in browser console

**Fix:**
```javascript
// In browser console
console.log(USER_CONTEXT.permissions.accessibleStores);
console.log(allDocuments);  // Check document structure
DashboardFilter.applyRoleBasedFiltering(allDocuments);  // Test filtering
```

### Problem: "Session expired" constantly
**Check:**
1. Database connection
2. Sessions table has active session
3. Cookie is being sent

**Fix:**
```bash
# Check database
node
> const sql = require('mssql');
> const config = require('./config/default');
> sql.connect(config.database).then(() => console.log('Connected'));
```

---

## 📊 Testing Matrix

| Test Case | Admin | Auditor | StoreMgr | CleanHead | ProcHead | MaintHead |
|-----------|:-----:|:-------:|:--------:|:---------:|:--------:|:---------:|
| See all docs | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Generate btn | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Action Plan btn | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View btn | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cleaning btn | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Procure btn | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Maint btn | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| PDF/DOC btn | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| User Mgmt link | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| New Audit link | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Store list | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Dept badge | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 🔐 Security Tests

### Test 1: Bypass Client Filtering
```javascript
// Try to show hidden buttons via console
document.querySelectorAll('.btn-generate').forEach(btn => btn.style.display = 'block');

// ✅ Expected: Buttons appear
// ✅ Expected: Clicking them calls API
// ✅ Expected: Server rejects with 403 Forbidden (authorization check)
```

### Test 2: Modify USER_CONTEXT
```javascript
// Try to change role
USER_CONTEXT.role = 'Admin';
USER_CONTEXT.permissions.canGenerate = true;

// ✅ Expected: Client-side changes but...
// ✅ Expected: Server still validates based on session
// ✅ Expected: Unauthorized actions still fail
```

### Test 3: Direct API Call
```bash
# Try to generate report without permission
curl -X GET http://localhost:3000/api/generate-report \
  -H "Cookie: auth_token=STORE_MANAGER_TOKEN"

# ✅ Expected: 403 Forbidden
# ✅ Expected: "You do not have permission to generate reports"
```

---

## 📱 Responsive Design Tests

### Desktop (1920x1080)
- User header: Horizontal layout
- All elements side by side
- Navigation links horizontal

### Tablet (768x1024)
- User header: Stacked layout
- Nav links stack vertically
- Buttons remain visible

### Mobile (375x667)
- User header: Full width stacked
- Store tags wrap
- Department badge centered

---

## ⚡ Performance Tests

### Load Time
- **Target**: < 2 seconds initial load
- **Measure**: Chrome DevTools → Network tab
- **Check**: dashboard-filter.js and user-context.js load quickly

### Filtering Performance
```javascript
// Time the filtering
console.time('filter');
const filtered = applyRoleBasedFiltering(allDocuments);
console.timeEnd('filter');

// ✅ Expected: < 10ms for 100 documents
// ✅ Expected: < 50ms for 1000 documents
```

---

## 📝 Manual Test Script

Copy this script for manual testing:

```
PHASE 5 MANUAL TEST - [Date]

Tester: _______________
Browser: _______________
OS: _______________

Test 1: Admin Login
  [ ] Login successful
  [ ] User header appears
  [ ] "Administrator" badge shown
  [ ] All buttons visible
  [ ] User Management link present
  [ ] All documents visible

Test 2: Store Manager Login
  [ ] Login successful
  [ ] Store Manager badge shown
  [ ] Assigned stores displayed
  [ ] Only assigned store docs visible
  [ ] Generate button HIDDEN
  [ ] Department buttons HIDDEN

Test 3: Dept Head Login
  [ ] Login successful
  [ ] Department badge shown
  [ ] Only dept button visible
  [ ] Generate button HIDDEN

Test 4: Logout
  [ ] Logout button works
  [ ] Redirected to login
  [ ] Cannot access dashboard after logout

Test 5: Security
  [ ] Direct /dashboard access requires login
  [ ] Modified USER_CONTEXT doesn't bypass server checks
  [ ] API endpoints validate permissions

Issues Found:
_______________
_______________
_______________

Overall Status: [ ] PASS  [ ] FAIL
```

---

## 🎉 Success Criteria

Phase 5 is successful when:

- [x] All 6 roles display correctly
- [x] Button visibility matches role
- [x] Document filtering works for Store Managers
- [x] Department buttons show only accessible department
- [x] User header displays on all pages
- [x] Navigation links work correctly
- [x] Logout functionality works
- [x] Server validates all permissions
- [x] No security bypasses possible
- [x] Responsive design works on all devices

---

**Testing Complete? Proceed to Phase 6!** 🚀
