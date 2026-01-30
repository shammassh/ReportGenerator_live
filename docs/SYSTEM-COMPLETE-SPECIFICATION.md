# 🎯 AUTHENTICATION SYSTEM - COMPLETE SPECIFICATION

**Date:** November 21, 2025  
**Status:** 80% Complete - Need Q8 & Q9 answers to start building

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN PAGE                                    │
│              (Microsoft Graph OAuth2)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
            Check user in database
                     │
        ┌────────────┴────────────┐
        │                         │
    Exists                    New User
    Load role              role = 'Pending'
        │                         │
        └────────┬────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │   Role-Based       │
        │   Navigation       │
        └────────────────────┘
                 │
    ┌────────────┼────────────┬────────────┬────────────┐
    │            │            │            │            │
    ▼            ▼            ▼            ▼            ▼
┌───────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐
│ Admin │  │ Auditor  │  │  Store  │  │ Cleaning │  │Pending  │
│       │  │          │  │ Manager │  │ /Proc/   │  │Approval │
│       │  │          │  │         │  │  Maint   │  │         │
└───────┘  └──────────┘  └─────────┘  └──────────┘  └─────────┘
    │            │            │            │              │
    ▼            ▼            ▼            ▼              ▼
Dashboard   Selection   Dashboard    Dashboard    "Wait for
 (All)       Page        (Store)     (Dept)       Admin"
           (Store+      Filtered     Filtered
           Checklist)
```

---

## 👥 User Roles & Permissions

### **1. Admin** 👑
```
Full System Access
├─ View ALL documents (all stores)
├─ Generate reports (all stores)
├─ Manage users (assign roles)
│  ├─ Fetch users from Microsoft Graph API
│  ├─ Assign roles to users
│  └─ Assign stores to Store Managers
├─ Assign department heads (via auditor)
├─ Manage checklists (SharePoint master lists)
└─ View audit logs
```

**After Login:** → Dashboard (no filtering)

---

### **2. Auditor** 🔍
```
Report Generation & Management
├─ View ALL documents (all stores)
├─ Generate reports
│  └─ Via Selection Page:
│     ├─ Choose store (dropdown)
│     └─ Choose checklist type (checkboxes)
├─ Assign department heads
│  ├─ Select Cleaning Head (email)
│  ├─ Select Procurement Head (email)
│  └─ Select Maintenance Head (email)
└─ Edit action plans
```

**After Login:** → **Selection Page** → Choose store + checklist → Generate

---

### **3. Store Manager** 🏪
```
View Only (Assigned Store)
├─ View documents (assigned store ONLY)
├─ View reports (assigned store ONLY)
├─ View action plans (assigned store ONLY)
└─ ❌ Cannot generate reports
```

**After Login:** → Dashboard (filtered to assigned store)

**Store Assignment:**
- Admin assigns via dropdown
- Store names extracted from existing documents

---

### **4. Department Heads** 🧹📦🔧
```
View Department Follow-up Reports
├─ Cleaning Head
│  └─ View cleaning follow-up reports (all stores)
├─ Procurement Head
│  └─ View procurement follow-up reports (all stores)
└─ Maintenance Head
   └─ View maintenance follow-up reports (all stores)
```

**After Login:** → Dashboard (filtered to department reports)

**Assignment:**
- Auditor selects department head by email
- Uses existing `department-followup-reports/` system

---

### **5. Pending** ⏳
```
Awaiting Admin Approval
└─ Show "Pending Approval" page
```

**After Login:** → "Contact administrator for access"

---

## 🗄️ Database Schema (SQL Server - FoodSafetyDB)

```sql
-- =============================================
-- Users Table
-- =============================================
CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1),
    
    -- From Microsoft Graph API
    azure_user_id NVARCHAR(255) UNIQUE NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    display_name NVARCHAR(255),
    photo_url NVARCHAR(500),
    job_title NVARCHAR(255),
    department NVARCHAR(255),
    
    -- Role & Assignment
    role NVARCHAR(50) DEFAULT 'Pending',
    -- Roles: 'Admin', 'Auditor', 'StoreManager', 
    --        'CleaningHead', 'ProcurementHead', 'MaintenanceHead', 'Pending'
    
    assigned_stores NVARCHAR(MAX),  -- JSON: ["GMRL", "AJMAN"] for StoreManagers
    assigned_department NVARCHAR(50), -- For dept heads: 'Cleaning', 'Procurement', 'Maintenance'
    
    -- Status
    is_active BIT DEFAULT 1,
    is_approved BIT DEFAULT 0,
    
    -- Tracking
    last_login DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    created_by NVARCHAR(255)  -- Admin who assigned role
);

-- =============================================
-- Sessions Table
-- =============================================
CREATE TABLE Sessions (
    id INT PRIMARY KEY IDENTITY(1,1),
    session_token NVARCHAR(500) UNIQUE NOT NULL,
    user_id INT FOREIGN KEY REFERENCES Users(id),
    
    -- Microsoft tokens (encrypted)
    azure_access_token NVARCHAR(MAX),
    azure_refresh_token NVARCHAR(MAX),
    
    -- Expiration (24 hours)
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    last_activity DATETIME DEFAULT GETDATE()
);

-- =============================================
-- Audit Log Table
-- =============================================
CREATE TABLE AuditLog (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT FOREIGN KEY REFERENCES Users(id),
    user_email NVARCHAR(255),
    
    action NVARCHAR(100),
    -- Actions: 'LOGIN', 'LOGOUT', 'ASSIGN_ROLE', 'GENERATE_REPORT', 
    --          'VIEW_REPORT', 'EDIT_CHECKLIST', 'ASSIGN_DEPARTMENT_HEAD'
    
    target_type NVARCHAR(50),  -- 'User', 'Report', 'Document', 'Checklist'
    target_id NVARCHAR(255),   -- Document Number, User ID, etc.
    details NVARCHAR(MAX),     -- JSON with additional info
    
    ip_address NVARCHAR(50),
    user_agent NVARCHAR(500),
    timestamp DATETIME DEFAULT GETDATE()
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX idx_users_email ON Users(email);
CREATE INDEX idx_users_azure_id ON Users(azure_user_id);
CREATE INDEX idx_users_role ON Users(role);
CREATE INDEX idx_sessions_token ON Sessions(session_token);
CREATE INDEX idx_sessions_expires ON Sessions(expires_at);
CREATE INDEX idx_audit_user ON AuditLog(user_id);
CREATE INDEX idx_audit_timestamp ON AuditLog(timestamp);
CREATE INDEX idx_audit_action ON AuditLog(action);

-- =============================================
-- Pre-configure Admin
-- =============================================
INSERT INTO Users (
    azure_user_id, 
    email, 
    display_name, 
    role, 
    is_active, 
    is_approved
) VALUES (
    'PLACEHOLDER_AZURE_ID',  -- Will be updated on first login
    'muhammad.shammas@gmrlgroup.com',
    'Muhammad Shammas',
    'Admin',
    1,
    1
);
```

---

## 📁 Modular File Structure

```
ReportGenerator/
├── auth/                           # Authentication system
│   ├── login.html                  # Microsoft login page
│   ├── login-handler.js            # OAuth callback handler
│   ├── session-manager.js          # 24-hour session management
│   ├── role-verifier.js            # Check user role after login
│   └── middleware/
│       ├── require-auth.js         # Check if authenticated
│       └── require-role.js         # Check if user has role
│
├── admin/                          # Admin-only pages
│   ├── user-management.html        # Manage users + assign roles
│   ├── user-management.js          # User management logic
│   ├── graph-users-api.js          # Fetch users from Graph API
│   ├── checklist-management.html   # Manage SharePoint checklists
│   ├── checklist-management.js     # Checklist CRUD logic
│   └── audit-logs.html             # View system audit logs
│
├── auditor/                        # Auditor-only pages
│   ├── selection-page.html         # Choose store + checklist
│   ├── selection-page.js           # Selection page logic
│   └── department-assignment.html  # Assign dept heads
│
├── dashboard/                      # Existing dashboard (enhanced)
│   ├── dashboard.html              # Main dashboard (role-protected)
│   ├── dashboard-server.js         # Enhanced with auth
│   └── filters/
│       ├── admin-filter.js         # No filtering
│       ├── auditor-filter.js       # No filtering
│       ├── store-filter.js         # Filter by assigned store
│       └── department-filter.js    # Filter by department
│
├── shared/                         # Shared components
│   ├── navigation.js               # Role-based nav menu
│   ├── user-profile-widget.js      # User info display
│   └── permission-checker.js       # Check user permissions
│
└── database/
    └── auth-schema.sql             # Users, Sessions, AuditLog tables
```

**Each page is a SEPARATE file with its own logic!** ✅

---

## 🔐 Authentication Flow (Detailed)

### **Step 1: User Opens App**
```
http://localhost:3001
   ↓
Check if session cookie exists
   ↓
   ├─ YES → Validate session → Load user → Dashboard
   └─ NO → Redirect to /auth/login
```

### **Step 2: Login Page**
```html
┌─────────────────────────────────────────┐
│   🏪 Food Safety Audit System          │
│                                         │
│   Please sign in to continue           │
│                                         │
│   [ 🔐 Sign in with Microsoft ]        │
│                                         │
└─────────────────────────────────────────┘
```

### **Step 3: Microsoft OAuth2**
```
User clicks "Sign in with Microsoft"
   ↓
Redirect to Microsoft login
   ↓
User enters Microsoft credentials
   ↓
Microsoft redirects back: /auth/callback?code=...
   ↓
Exchange code for access token
   ↓
Fetch user profile from Graph API:
   - email
   - name
   - photo
   - job title
   - department
```

### **Step 4: Check Database**
```sql
SELECT * FROM Users WHERE email = 'user@gmrlgroup.com'
```

**If user exists:**
- Load `role` from database
- Create session (24 hours)
- Set session cookie

**If new user:**
- Insert into Users with role='Pending'
- Create session
- Show "Pending Approval" page

### **Step 5: Role-Based Navigation**

```javascript
switch (user.role) {
    case 'Admin':
        redirect('/dashboard');
        break;
    
    case 'Auditor':
        redirect('/auditor/selection');  // Choose store + checklist
        break;
    
    case 'StoreManager':
        redirect('/dashboard?store=' + user.assigned_stores[0]);
        break;
    
    case 'CleaningHead':
    case 'ProcurementHead':
    case 'MaintenanceHead':
        redirect('/dashboard?department=' + user.assigned_department);
        break;
    
    case 'Pending':
    default:
        redirect('/auth/pending-approval');
        break;
}
```

---

## 🎨 Admin User Management Interface

**Need to choose from `FINAL-CLARIFICATION-QUESTIONS.md`:**
- Option A: Table with inline dropdowns
- Option B: Modal popup (click to edit)
- Option C: Bulk selection

**Waiting for Q9 answer** 🔴

---

## 📝 Admin Checklist Management

**Need to know exactly what admin can do:**
- [ ] Edit existing questions?
- [ ] Add new questions?
- [ ] Delete questions?
- [ ] Create new master lists?
- [ ] Reorder questions?
- [ ] Activate/deactivate questions?

**Waiting for Q8 answer** 🔴

---

## ✅ Implementation Checklist

### **Phase 1: Foundation** (2-3 days)
- [ ] Create SQL schema script
- [ ] Run schema on FoodSafetyDB
- [ ] Pre-configure admin account (muhammad.shammas@gmrlgroup.com)
- [ ] Create login page (Microsoft OAuth2)
- [ ] Implement session management (24 hours)
- [ ] Create authentication middleware

### **Phase 2: Admin Features** (2-3 days)
- [ ] Build user management page (UI depends on Q9)
- [ ] Fetch users from Microsoft Graph API
- [ ] Assign roles to users
- [ ] Assign stores to Store Managers
- [ ] Create audit log viewer

### **Phase 3: Auditor Features** (2 days)
- [ ] Build selection page (choose store + checklist)
- [ ] Build department head assignment page
- [ ] Integrate with existing report generation

### **Phase 4: Role-Based Access** (2 days)
- [ ] Protect dashboard with authentication
- [ ] Filter documents by role
- [ ] Hide/show buttons based on permissions
- [ ] Create access denied page

### **Phase 5: Checklist Management** (2-3 days - depends on Q8)
- [ ] Build checklist management interface
- [ ] Implement CRUD operations
- [ ] Sync with SharePoint master lists

### **Phase 6: Testing** (2 days)
- [ ] Test all role scenarios
- [ ] Test session expiration (24 hours)
- [ ] Test unauthorized access blocking
- [ ] Test department filtering
- [ ] Test store filtering

**Total: ~12-15 days**

---

## 🚀 Ready to Start?

### **Need from you:**
1. ✅ Answer **Q8** in `FINAL-CLARIFICATION-QUESTIONS.md`
2. ✅ Answer **Q9** in `FINAL-CLARIFICATION-QUESTIONS.md`

### **Then I will:**
1. ✅ Create SQL schema
2. ✅ Build authentication system
3. ✅ Create admin interface
4. ✅ Implement role-based filtering
5. ✅ Test everything
6. ✅ Deliver professional auth system

---

**All files created:**
- `AUTH-IMPLEMENTATION-INSTRUCTIONS.md` - Full technical specs
- `UPDATED-REQUIREMENTS-SUMMARY.md` - Summary of answers
- `FINAL-CLARIFICATION-QUESTIONS.md` - Q8 & Q9 details
- `SYSTEM-COMPLETE-SPECIFICATION.md` - This file (overview)

**👉 Please check `FINAL-CLARIFICATION-QUESTIONS.md` and answer Q8 & Q9!** 🚀
