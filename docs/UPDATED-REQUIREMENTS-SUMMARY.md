# ✅ Updated Requirements Summary

**Date:** November 21, 2025  
**Status:** Awaiting Final Clarifications

---

## 🎯 What I Now Understand (CONFIRMED)

### **1. User Management Flow**
- ❌ **NO manual user creation by admin**
- ✅ Admin fetches ALL users from **Microsoft Graph API**
- ✅ Admin sees list of organization users
- ✅ Admin **selects** users and **assigns roles**
- ✅ Selected users + roles stored in **SQL Server (FoodSafetyDB)**

### **2. Authentication**
- ✅ Microsoft Graph OAuth2 (already implemented in project)
- ✅ Users login with Microsoft credentials
- ✅ 24-hour session timeout
- ✅ Session persists across page refresh

### **3. Role Structure**
```
Admin
  ├─ Full access to everything
  ├─ Generate reports (all stores)
  ├─ View all reports
  ├─ Manage users (assign roles)
  ├─ Manage checklists (SharePoint master lists)
  └─ View audit logs

Auditor
  ├─ Generate reports (all stores)
  ├─ View all reports
  └─ Edit action plans

StoreManager
  ├─ View reports (assigned store only)
  └─ View action plans (assigned store only)

CleaningManager
  ├─ View cleaning-related reports (all stores)
  └─ View cleaning action plans

ProcurementManager
  ├─ View procurement-related reports (all stores)
  └─ View procurement action plans

MaintenanceManager
  ├─ View maintenance-related reports (all stores)
  └─ View maintenance action plans
```

### **4. Current System Integration**
- ✅ **Checklists:** Created in Power Apps, stored in SharePoint
- ✅ **Report Generation:** Already working in dashboard.html
- ✅ **Follow-up System:** "Checklist FollowUps" SharePoint list exists
- ✅ **Dashboard:** Existing dashboard.html will be role-protected

### **5. File Structure Requirement**
- ⚠️ **CRITICAL:** Each page must be in separate JS file
- ✅ No monolithic files
- ✅ Each module has its own render function
- ✅ Easy to edit individual files

### **6. Database**
- ✅ Use existing SQL Server: **FoodSafetyDB**
- ✅ Add new tables: Users, Sessions, AuditLog, (Stores?)

---

## ✅ ANSWERS RECEIVED (Updated)

### **Q1: Department Manager Report Access** ✅
**ANSWER:** Department heads see **department-specific follow-up reports**
- **Cleaning Manager** → Sees Cleaning follow-up reports
- **Procurement Manager** → Sees Procurement follow-up reports  
- **Maintenance Manager** → Sees Maintenance follow-up reports
- **Auditor assigns department heads** by selecting their email
- Uses existing `department-followup-reports/` system
- Filters by Department field in "Checklist FollowUps" list

---

### **Q2: Store Manager Store Assignment** ✅
**ANSWER:** Create admin page to assign Store Manager + Store Name
- Get store names from **dashboard/documents** (existing checklists)
- Admin selects:
  1. User from Microsoft Graph API
  2. Store name from dropdown (extracted from existing documents)
- Store Manager sees **only their assigned store's checklists/reports**

---

### **Q3: User List Source** ✅
**ANSWER:** Fetch **only users** from Microsoft Graph API
- Filter: `userType eq 'Member'` (real users only, no guests)
- NOT groups, NOT external contacts

---

### **Q4: User Navigation After Login** ✅
**ANSWER:** Different navigation based on role

| Role | After Login → |
|------|---------------|
| **Admin** | Dashboard (see everything) |
| **Auditor** | **Selection Page** (choose store + checklist to generate) |
| **Store Manager** | Dashboard (filtered to their store only) |
| **Department Head** | Dashboard (filtered to their department reports only) |

**Auditor Selection Page:**
- Dropdown: Select store (or "All Stores")
- Checkboxes: Select checklist types (FS Survey, Cleaning, Maintenance, All)
- Button: Generate Report

---

### **Q5: Dashboard Structure** ⏸️
**ANSWER:** Will discuss later

---

### **Q6: Report Generation Permissions** ✅
**ANSWER:** Only Admin and Auditor can generate reports
- ✅ **Admin:** Generate reports
- ✅ **Auditor:** Generate reports
- ❌ **Store Manager:** View only (cannot generate)
- ❌ **Department Heads:** View only (cannot generate)

---

### **Q7: Store Data Source** ✅
**ANSWER:** Get store names from dashboard documents
- NOT from "Checklist FollowUps" list (that has Department field)
- Extract store names from existing audit documents in dashboard

---

### **Q8: Checklist Management** � AWAITING SPECIFIC FEATURES
**ANSWER:** Need detailed explanation → See `Q8-CHECKLIST-MANAGEMENT-DETAILED.md`

**ACTION REQUIRED:** Check boxes for which features you want:
- [ ] A: Edit existing questions (text, weight, reference, criterion)
- [ ] B: Add new questions to existing sections
- [ ] C: Delete questions (permanent removal)
- [ ] D: Create new sections (new master list)
- [ ] E: Reorder questions (drag-and-drop or arrows)
- [ ] F: Activate/deactivate questions (temporary hide/show)

**Recommendation:** Start with A, B, F (essentials). Add E later. Avoid C, D initially.

---

### **Q9: Role Assignment UI** ✅ ANSWERED
**ANSWER:** **Option B - Modal Popup (Click User → Edit)**

**Implementation Details:**
- Main page shows simple table of users
- Click [Edit] → Modal popup opens
- Modal contains:
  - User info (name, email)
  - Role selection (radio buttons)
  - Conditional fields:
    - If Store Manager → Store dropdown
    - If Dept Head → Department (auto-set)
  - Save/Cancel buttons
- After save, modal closes and table refreshes

**Files to create:**
- `admin/user-management.html` - Main page with table
- `admin/user-management.js` - Logic for fetching users and updating roles
- `admin/components/edit-user-modal.html` - Modal component
- `admin/services/graph-users-service.js` - Fetch from Microsoft Graph API
- `admin/services/role-assignment-service.js` - Update user roles in SQL

---

### **Q10: Pre-configured Admin** ✅
**ANSWER:** muhammad.shammas@gmrlgroup.com
- This email will be pre-configured as Admin in database

---

## 📋 Implementation Phases (Once Questions Answered)

### **Phase 1: Foundation** (2-3 days)
- Create SQL schema (Users, Sessions, AuditLog, Stores?)
- Set up authentication middleware
- Create login page with Microsoft Graph
- Session management (24 hours)

### **Phase 2: Admin Features** (3-4 days)
- User management page
  - Fetch users from Graph API
  - Display in table
  - Assign roles
  - Assign stores (for Store Managers)
- Audit log viewer

### **Phase 3: Role-Based Access** (2-3 days)
- Protect dashboard with authentication
- Role-based button visibility
- Filter documents by role/store/department
- Access denied page

### **Phase 4: Department Views** (2 days)
- Cleaning manager view
- Procurement manager view
- Maintenance manager view

### **Phase 5: Testing & Polish** (2 days)
- Test all role scenarios
- Test session expiration
- Test unauthorized access blocking
- UI/UX improvements

**Total Estimated Time:** 11-14 days

---

## 🔧 Technical Stack (Confirmed)

- **Backend:** Node.js + Express.js (existing)
- **Database:** SQL Server - FoodSafetyDB (existing)
- **Authentication:** Microsoft Graph API OAuth2 (existing)
- **SharePoint:** Lists for checklists and follow-ups (existing)
- **Frontend:** HTML + Vanilla JavaScript (modular files)
- **Session:** JWT tokens with 24-hour expiration

---

## 📁 Proposed Modular File Structure

```
ReportGenerator/
├── auth/
│   ├── pages/
│   │   ├── login.js                    # Microsoft login page
│   │   ├── role-verify.js              # Post-login role check
│   │   └── access-denied.js            # Unauthorized access
│   ├── middleware/
│   │   ├── auth.js                     # Authentication check
│   │   ├── role-check.js               # Role validation
│   │   └── session.js                  # Session management
│   └── services/
│       ├── microsoft-auth.js           # Graph API auth
│       ├── user-service.js             # User CRUD
│       └── token-service.js            # JWT management
│
├── admin/
│   ├── pages/
│   │   ├── user-management.js          # Manage users + assign roles
│   │   ├── checklist-management.js     # Manage SharePoint lists
│   │   └── audit-logs.js               # View system logs
│   └── services/
│       ├── graph-users.js              # Fetch Graph API users
│       └── role-assignment.js          # Assign roles logic
│
├── dashboard/
│   ├── dashboard.html                  # Existing dashboard (protected)
│   ├── dashboard-server.js             # Existing server (enhanced)
│   └── filters/
│       ├── admin-filter.js             # Show all documents
│       ├── auditor-filter.js           # Show all documents
│       ├── store-filter.js             # Show assigned store only
│       └── department-filter.js        # Show dept-specific reports
│
├── shared/
│   ├── components/
│   │   ├── navigation.js               # Role-based nav menu
│   │   ├── user-profile.js             # User info widget
│   │   └── permissions.js              # Permission checker
│   └── utils/
│       └── role-utils.js               # Role helper functions
│
└── database/
    └── auth-schema.sql                 # New: Users, Sessions, AuditLog tables
```

---

## ✅ Next Steps

1. **YOU:** Answer the 10 questions above
2. **ME:** Update instructions with exact specifications
3. **ME:** Create SQL schema script
4. **ME:** Build authentication system (modular files)
5. **ME:** Create admin user management interface
6. **ME:** Implement role-based filtering
7. **ME:** Test everything
8. **YOU:** Review and provide feedback

---

**Let's get these 10 questions answered so I can start building! 🚀**
