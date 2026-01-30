# Phase 5 Architecture Flow Diagram

## User Authentication & Dashboard Access Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       USER AUTHENTICATION FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

1. USER LOGIN
   │
   ├─→ Browser: GET /auth/login
   │
   ├─→ Microsoft Graph OAuth2
   │
   ├─→ Session created in database
   │
   └─→ Cookie set (auth_token)

2. DASHBOARD ACCESS
   │
   ├─→ Browser: GET /dashboard
   │
   ├─→ requireAuth middleware
   │   ├─ Validates auth_token cookie
   │   ├─ Loads session from database
   │   ├─ Attaches req.currentUser
   │   └─ Continues to route handler
   │
   ├─→ DashboardPage.serveDashboard(req, res)
   │   ├─ Gets user: req.currentUser
   │   ├─ Calculates permissions: DashboardFilterService.getUserPermissions(user)
   │   ├─ Reads dashboard.html
   │   ├─ Injects USER_CONTEXT (with permissions)
   │   ├─ Injects dashboard-filter.js
   │   ├─ Injects user-context.js
   │   └─ Sends modified HTML to browser
   │
   └─→ Browser renders dashboard
       ├─ Loads window.USER_CONTEXT
       ├─ Runs dashboard-filter.js
       │  ├─ Filters documents by role
       │  └─ Hides/shows buttons
       └─ Runs user-context.js
          ├─ Creates user info header
          └─ Displays role badge

┌─────────────────────────────────────────────────────────────────────┐
│                     ROLE-BASED FILTERING LOGIC                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   ADMIN     │
│   AUDITOR   │
└──────┬──────┘
       │
       ├─ Filter: NONE (see all)
       ├─ Buttons: ALL visible
       ├─ Generate: ✅ Enabled
       └─ Navigation: Full access

┌─────────────┐
│ STORE MGR   │
└──────┬──────┘
       │
       ├─ Filter: assigned_stores = ["GMRL Reef Mall", "..."]
       │  └─→ Show only documents where storeName matches
       ├─ Buttons: Generate ❌, ActionPlan ❌, Dept ❌, Export ❌
       ├─ Generate: ❌ Hidden
       └─ UI: Show assigned stores list

┌─────────────┐
│ DEPT HEAD   │
│ (Cleaning)  │
│ (Procure)   │
│ (Maintain)  │
└──────┬──────┘
       │
       ├─ Filter: NONE (see all documents)
       ├─ Buttons: Only their department button visible
       │  └─→ CleaningHead: Show ONLY "Cleaning" button
       ├─ Generate: ❌ Hidden
       └─ UI: Show department badge

┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER-SIDE FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

auth-app.js
    │
    ├─→ app.get('/dashboard', requireAuth, async (req, res) => { ... })
    │
    └─→ DashboardPage.serveDashboard(req, res)
            │
            ├─ user = req.currentUser
            ├─ permissions = DashboardFilterService.getUserPermissions(user)
            │   │
            │   └─→ DashboardFilterService
            │       ├─ canGenerateReports(user)
            │       ├─ canViewReport(user, type, dept)
            │       ├─ getAccessibleStores(user)
            │       └─ getAccessibleDepartment(user)
            │
            ├─ Read: dashboard.html
            ├─ Inject: window.USER_CONTEXT = { email, name, role, permissions }
            ├─ Inject: <script src="/dashboard/scripts/dashboard-filter.js">
            ├─ Inject: <script src="/dashboard/scripts/user-context.js">
            ├─ Inject: <link rel="stylesheet" href="/dashboard/styles/dashboard.css">
            └─ Send: modified HTML to browser

┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT-SIDE FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

Browser loads dashboard
    │
    ├─→ window.USER_CONTEXT available
    │
    ├─→ dashboard-filter.js executes
    │   │
    │   ├─ applyRoleBasedFiltering(documents)
    │   │  │
    │   │  ├─ Admin/Auditor → return all
    │   │  ├─ StoreManager → filter by assigned stores
    │   │  └─ DeptHead → return all (button filtering)
    │   │
    │   ├─ applyUIControls()
    │   │  │
    │   │  ├─ if (!canGenerate) hideGenerateButtons()
    │   │  ├─ if (!canViewDepartment) hideDepartmentButtons()
    │   │  └─ if (role === StoreManager) hideExportButtons()
    │   │
    │   └─ Override displayDocuments() function
    │
    └─→ user-context.js executes
        │
        ├─ createUserInfoHeader()
        │  ├─ Avatar with initials
        │  ├─ Role badge
        │  └─ Navigation links
        │
        ├─ addStoreAssignmentInfo() (if StoreManager)
        │
        └─ addDepartmentInfo() (if DeptHead)

┌─────────────────────────────────────────────────────────────────────┐
│                      PERMISSION CALCULATION                          │
└─────────────────────────────────────────────────────────────────────┘

DashboardFilterService.getUserPermissions(user)
    │
    ├─→ canGenerate: user.role === 'Admin' || user.role === 'Auditor'
    │
    ├─→ canViewMain: Admin, Auditor, StoreManager = true
    │
    ├─→ canViewActionPlan: Admin, Auditor, StoreManager = true
    │
    ├─→ canViewDepartment: 
    │   ├─ Admin, Auditor = true (all departments)
    │   └─ DeptHead = true (their department only)
    │
    ├─→ accessibleStores:
    │   ├─ Admin, Auditor, DeptHead = ['ALL']
    │   └─ StoreManager = user.assignedStores array
    │
    ├─→ accessibleDepartment:
    │   ├─ CleaningHead = 'Cleaning'
    │   ├─ ProcurementHead = 'Procurement'
    │   └─ MaintenanceHead = 'Maintenance'
    │
    └─→ Returns: {
            canGenerate: boolean,
            canViewMain: boolean,
            canViewActionPlan: boolean,
            canViewDepartment: boolean,
            canAccessAdmin: boolean,
            canAccessAuditorSelection: boolean,
            accessibleStores: array,
            accessibleDepartment: string|null,
            role: string,
            email: string,
            name: string
        }

┌─────────────────────────────────────────────────────────────────────┐
│                      BUTTON VISIBILITY LOGIC                         │
└─────────────────────────────────────────────────────────────────────┘

dashboard-filter.js applies CSS to hide buttons:

hideGenerateButtons()
    └─→ Adds style: .btn-generate, .btn-action-plan { display: none !important; }

hideDepartmentButtons()
    └─→ Adds style: .btn-dept { display: none !important; }

showOnlyAccessibleDepartment('Cleaning')
    └─→ Adds style: 
        .btn-dept { display: none !important; }
        .btn-dept.btn-cleaning { display: inline-block !important; }

hideExportButtons()
    └─→ Adds style: .btn-pdf, .btn-doc { display: none !important; }

┌─────────────────────────────────────────────────────────────────────┐
│                     UI COMPONENT HIERARCHY                           │
└─────────────────────────────────────────────────────────────────────┘

dashboard-container
│
├─ dashboard-header
│  │
│  ├─ user-info-header (NEW - Phase 5)
│  │  │
│  │  ├─ user-details
│  │  │  ├─ user-avatar (initials)
│  │  │  └─ user-text
│  │  │     ├─ user-name
│  │  │     └─ role-badge
│  │  │
│  │  └─ user-actions
│  │     ├─ nav-links
│  │     │  ├─ User Management (Admin only)
│  │     │  ├─ New Audit (Auditor only)
│  │     │  └─ Dashboard (always)
│  │     └─ logout-btn
│  │
│  └─ dashboard-header (existing)
│     ├─ h1: Food Safety Audit Dashboard
│     └─ p: Manage and generate...
│
├─ store-assignment-info (StoreManager only - NEW)
│  ├─ info-label: Assigned Stores
│  └─ store-list
│     └─ store-tag (for each store)
│
├─ department-info (DeptHead only - NEW)
│  ├─ info-label: Department
│  └─ dept-badge
│
├─ controls-bar (existing)
│  ├─ search-input
│  ├─ cycle-filter
│  └─ refresh-btn
│
├─ stats-bar (existing)
│  └─ stats-items...
│
└─ documents-container (existing)
   └─ document cards
      └─ document-actions
         ├─ btn-view (always visible)
         ├─ btn-generate (Admin/Auditor only)
         ├─ btn-action-plan (Admin/Auditor only)
         ├─ btn-maintenance (Admin/Auditor/MaintenanceHead only)
         ├─ btn-procurement (Admin/Auditor/ProcurementHead only)
         ├─ btn-cleaning (Admin/Auditor/CleaningHead only)
         ├─ btn-pdf (Admin/Auditor only)
         └─ btn-doc (Admin/Auditor only)

┌─────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW DIAGRAM                            │
└─────────────────────────────────────────────────────────────────────┘

Database (FoodSafetyDB)
    ↓
    Users table (role, assigned_stores, assigned_department)
    ↓
    Sessions table (with user data)
    ↓
SessionManager.getSession(token)
    ↓
requireAuth middleware → req.currentUser = { role, assignedStores, ... }
    ↓
DashboardFilterService.getUserPermissions(user)
    ↓
window.USER_CONTEXT = { email, name, role, permissions }
    ↓
Client-side filtering (dashboard-filter.js)
    ↓
Filtered documents displayed
    ↓
UI controls applied (buttons hidden/shown)
    ↓
User sees role-appropriate dashboard

┌─────────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS DIAGRAM                          │
└─────────────────────────────────────────────────────────────────────┘

Layer 1: Server Authentication
    ├─ requireAuth middleware
    ├─ Session validation
    └─ Role check

Layer 2: Server Authorization
    ├─ DashboardFilterService.getUserPermissions()
    ├─ Permission calculation server-side
    └─ User context injection

Layer 3: Client Filtering
    ├─ applyRoleBasedFiltering() - filters documents
    ├─ Cannot be bypassed (server validates API calls)
    └─ Visual enforcement only

Layer 4: UI Controls
    ├─ CSS display: none for unauthorized buttons
    ├─ Prevents accidental clicks
    └─ Server validates actual actions

Result: Multi-layered security
    ├─ Server validates every request
    ├─ Client provides user-friendly restrictions
    └─ No security relies solely on client-side
```

## Module Dependencies

```
auth-app.js
    │
    ├── auth/auth-server.js
    │   └── auth/middleware/require-auth.js
    │       └── auth/services/session-manager.js
    │
    └── dashboard/pages/dashboard-page.js
        └── dashboard/services/dashboard-filter-service.js

Browser
    │
    ├── window.USER_CONTEXT (injected by server)
    │
    ├── dashboard/scripts/dashboard-filter.js
    │   └── Uses: window.USER_CONTEXT.permissions
    │
    └── dashboard/scripts/user-context.js
        └── Uses: window.USER_CONTEXT
```

## File Size Breakdown

```
Total: 947 lines across 6 files

Backend:
  dashboard-filter-service.js   221 lines  (23%)
  dashboard-page.js             105 lines  (11%)
  
Frontend:
  dashboard-filter.js           149 lines  (16%)
  user-context.js               169 lines  (18%)
  
Styling:
  dashboard.css                 303 lines  (32%)
```

## Performance Considerations

```
Server-Side:
  ✅ Minimal overhead - simple permission checks
  ✅ No database queries per request (uses session cache)
  ✅ Permissions calculated once per page load

Client-Side:
  ✅ Filters applied once on load
  ✅ No continuous polling
  ✅ CSS-based hiding (GPU accelerated)
  ✅ Lazy loading compatible
```

---

**Phase 5 Complete! Ready for Phase 6: Checklist Management** 🎉
