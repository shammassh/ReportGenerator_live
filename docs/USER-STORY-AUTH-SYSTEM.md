# User Story: Authentication & Authorization System

## 📋 Current Understanding

### Your Requirements:
1. **Two pages before dashboard access:**
   - Login page (using Microsoft Graph API authentication)
   - Role assignment/verification page

2. **Three User Roles:**
   - **Admin**: Full system access
   - **Auditor**: Generate and view reports
   - **StoreManager**: View reports only (read-only)

3. **Admin Capabilities:**
   - Add/manage stores
   - Add/edit checklists
   - Generate roles/manage users
   - Generate reports
   - Full CRUD operations

4. **Session Persistence:**
   - currentUser (Azure profile)
   - currentRole (Admin, Auditor, StoreManager, None)
   - Role checks on every page refresh/navigation

5. **Access Control:**
   - Unauthorized access → "Access Denied" or redirect
   - Role-based page visibility

---

## ❓ Clarification Questions

### 1. **User Role Assignment**
- **Q:** How should roles be assigned initially?
  - Option A: Admin manually assigns roles to users after first login
  - Option B: Users request a role during first login (pending admin approval)
  - Option C: Auto-assign based on email domain/pattern (e.g., `admin@spinneys.com` = Admin)
  - **Your preference?** _______________

### 2. **Role Storage**
- **Q:** Where should user roles be stored?
  - Option A: SQL Server database (recommended for production)
  - Option B: SharePoint list (integrates with existing setup)
  - Option C: Azure AD App Roles (requires Azure AD configuration)
  - **Your preference?** _______________

### 3. **First-Time User Experience**
- **Q:** What happens when a new user logs in for the first time (no role assigned)?
  - Option A: Show "Pending Approval" page, notify admin
  - Option B: Assign default "StoreManager" role (lowest privilege)
  - Option C: Block access until admin assigns role
  - **Your preference?** _______________

### 4. **Store Manager Scope**
- **Q:** Should Store Managers only see reports for THEIR store?
  - Option A: Yes, filter by assigned store(s)
  - Option B: No, see all store reports (but can't edit)
  - **Your preference?** _______________

### 5. **Multiple Roles**
- **Q:** Can a user have multiple roles?
  - Example: User is both Auditor AND StoreManager
  - Option A: Yes, user can have multiple roles (highest privilege wins)
  - Option B: No, one role per user only
  - **Your preference?** _______________

### 6. **Admin User Management Page**
- **Q:** What features should the admin user management page have?
  - [ ] List all users with their roles
  - [ ] Search/filter users
  - [ ] Assign/change user roles
  - [ ] Deactivate/activate users
  - [ ] View user login history
  - [ ] Assign specific stores to Store Managers
  - **Which features do you need?** _______________

### 7. **Store Management**
- **Q:** What information should be stored for each store?
  - Store Name: _______________
  - Store Code: _______________
  - Location: _______________
  - Store Manager(s): _______________
  - Status (Active/Inactive): _______________
  - **Other fields?** _______________

### 8. **Checklist Management**
- **Q:** For "Add Checklist" - do you mean:
  - Option A: Create NEW audit templates (new master lists)
  - Option B: Edit EXISTING master list questions
  - Option C: Both create and edit
  - **Your preference?** _______________

### 9. **Session Timeout**
- **Q:** How long should user sessions last?
  - Option A: 8 hours (work day)
  - Option B: 24 hours
  - Option C: Use Microsoft token expiration (typically 1 hour, auto-refresh)
  - **Your preference?** _______________

### 10. **Audit Trail**
- **Q:** Should the system log user actions?
  - [ ] Login/logout events
  - [ ] Report generation
  - [ ] Role changes
  - [ ] Data modifications
  - **Which actions to log?** _______________

---

## 📱 Proposed Page Structure

### **Page 1: Login Page** (`/login`)
- Microsoft authentication button
- Company logo/branding
- "Sign in with Microsoft" flow
- Redirect to role verification after successful auth

### **Page 2: Role Verification/Welcome** (`/verify-role`)
- Display user info (name, email, photo from Azure)
- Show assigned role
- If no role: show "Pending Admin Approval" message
- "Continue to Dashboard" button (if authorized)

### **Page 3: Dashboard** (`/dashboard`)
- Role-based navigation menu
- Quick stats/widgets based on role
- Access to allowed features only

### **Admin Pages:**
- `/admin/users` - User management
- `/admin/stores` - Store management
- `/admin/checklists` - Checklist management
- `/admin/roles` - Role assignment

### **Auditor Pages:**
- `/auditor/generate-report` - Report generation
- `/auditor/reports` - View all reports
- `/auditor/action-plans` - Manage action plans

### **Store Manager Pages:**
- `/store/reports` - View reports (read-only)
- `/store/action-plans` - View action plans (read-only)

---

## 🔐 Technical Implementation Plan

### **1. Database Schema (SQL Server)**

```sql
-- Users table
CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1),
    azure_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'None', -- Admin, Auditor, StoreManager, None
    assigned_stores VARCHAR(MAX), -- JSON array for StoreManagers
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- Stores table
CREATE TABLE Stores (
    id INT PRIMARY KEY IDENTITY(1,1),
    store_code VARCHAR(50) UNIQUE NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);

-- Audit log table
CREATE TABLE AuditLog (
    id INT PRIMARY KEY IDENTITY(1,1),
    user_id INT FOREIGN KEY REFERENCES Users(id),
    action VARCHAR(100),
    details VARCHAR(MAX),
    ip_address VARCHAR(50),
    timestamp DATETIME DEFAULT GETDATE()
);
```

### **2. Authentication Flow**

```
User clicks "Login" 
  ↓
Microsoft Graph OAuth2 flow
  ↓
Get user profile (email, name, photo)
  ↓
Check if user exists in SQL database
  ↓
  ├─ Exists → Load role from database
  └─ New → Create user with role='None'
  ↓
Store session (JWT or session storage)
  ↓
Redirect to /verify-role
  ↓
  ├─ Role = 'None' → Show "Pending Approval"
  ├─ Role = 'Admin' → Redirect to /dashboard (full access)
  ├─ Role = 'Auditor' → Redirect to /dashboard (auditor view)
  └─ Role = 'StoreManager' → Redirect to /dashboard (read-only)
```

### **3. Route Protection Middleware**

```javascript
function requireAuth(req, res, next) {
  if (!req.session.currentUser) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.session.currentRole)) {
      return res.status(403).render('access-denied');
    }
    next();
  };
}

// Usage:
app.get('/admin/users', requireAuth, requireRole('Admin'), userManagementController);
app.get('/auditor/generate', requireAuth, requireRole('Admin', 'Auditor'), generateReportController);
app.get('/store/reports', requireAuth, requireRole('Admin', 'Auditor', 'StoreManager'), viewReportsController);
```

---

## 🎨 UI/UX Considerations

### **Design Elements:**
- Professional login page with Spinneys branding
- Responsive design (mobile + desktop)
- Clear role indicators (badges/tags)
- Intuitive navigation based on role
- Loading states during authentication
- Error handling (network issues, denied access)

### **User Feedback:**
- "Welcome back, [Name]!" messages
- "Access Denied" with clear explanation
- "Pending approval" status updates
- Success/error toasts for actions

---

## 📊 Success Metrics

- [ ] Users can log in with Microsoft credentials
- [ ] Roles are correctly assigned and persisted
- [ ] Admin can manage users, stores, and checklists
- [ ] Auditors can generate and view reports
- [ ] Store Managers can only view (no edit/delete)
- [ ] Unauthorized access is blocked
- [ ] Sessions persist across page refreshes
- [ ] Role checks work on every navigation

---

## 🚀 Implementation Priority

### Phase 1: Core Authentication (Week 1)
1. Login page with Microsoft Graph
2. User database setup
3. Session management
4. Basic role verification

### Phase 2: Role-Based Access (Week 1-2)
1. Route protection middleware
2. Role-based navigation
3. Access denied pages
4. Dashboard with role-specific views

### Phase 3: Admin Features (Week 2-3)
1. User management page
2. Store management page
3. Role assignment interface
4. Audit logging

### Phase 4: Polish & Testing (Week 3-4)
1. UI/UX improvements
2. Error handling
3. Testing all role scenarios
4. Documentation

---

## ✅ Next Steps

**Please answer the 10 questions above, then I will:**

1. Create detailed technical specifications
2. Design database schema
3. Build authentication pages
4. Implement role-based access control
5. Create admin management interfaces
6. Set up comprehensive testing

**Would you like me to:**
- [ ] Start with the login page first?
- [ ] Set up the database schema first?
- [ ] Create wireframes/mockups?
- [ ] Build a prototype with dummy data?

---

## 📝 Notes & Assumptions

- Using existing Microsoft Graph API integration
- SQL Server for user/role storage (already in project)
- Express.js backend with session management
- HTML/CSS/JavaScript frontend (or React if preferred)
- Secure token storage (httpOnly cookies or secure session)

---

**Date Created:** November 21, 2025  
**Status:** Awaiting Client Feedback  
**Next Review:** After questions are answered
