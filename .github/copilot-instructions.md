<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
# Food Safety Audit System - Copilot Instructions

## Project Overview
This is a production-ready Node.js **SQL Server-based** Food Safety Audit Management System. The system supports complete audit lifecycle from creation to reporting, with role-based access control, automated notifications, and comprehensive dashboard analytics.

**IMPORTANT: This system is 100% SQL Server-based. SharePoint lists are NOT used for data storage.**

## Architecture

### Data Storage
- **Primary Database**: SQL Server (`FoodSafetyDB_Live`)
- **All audit data**: Stored in SQL tables (AuditInstances, AuditResponses, AuditPictures, etc.)
- **Images**: Stored as binary data in `AuditPictures` table
- **NO SharePoint lists used** for audit data, responses, or images

### Microsoft Graph API Usage (Email Only)
- Microsoft Graph API is used ONLY for:
  - OAuth2 authentication
  - Sending email notifications via user's mailbox
- NOT used for data storage or retrieval

## Key Components

### Main Application (`auth-app.js`)
The central Express.js server running on HTTPS port 3001 that integrates all subsystems:
- Authentication & authorization with role-based access control
- Dashboard with real-time audit statistics
- Report generation (HTML, PDF formats)
- Action plan management
- Email notification system
- Checklist template management
- Department-specific reports

### Core Services

#### Authentication System (`auth/`)
- **auth-server.js**: OAuth2 + SQL Server session management
- **Roles**: Admin, Auditor, SuperAuditor, StoreManager, Department Heads
- **Middleware**: `requireAuth`, `requireRole()` for protected routes
- **User Management**: Admin panel for user approval/role assignment
- Session-based authentication with automatic cleanup

#### Report Generator (`audit-app/report-generator/`)
- **index.js**: Main report generation orchestrator (SQL-based)
- **services/data-service.js**: SQL Server data fetching
- **services/scoring-service.js**: Score calculations
- **services/template-engine.js**: HTML templating
- **templates/**: HTML report templates
- All data comes from SQL tables, NOT SharePoint

#### Audit Service (`audit-app/services/audit-service.js`)
- Complete audit CRUD operations
- Section scores management
- Department report generation
- All SQL Server-based queries

#### Action Plan Service (`src/action-plan-service.js`)
- SQL Server-based action plan storage and retrieval
- CRUD operations for action items
- Support for images (base64 encoded)
- Status tracking (Open, In Progress, Completed)
- Assignment and deadline management

#### Email Notification Service (`services/email-notification-service.js`)
- Microsoft Graph API for sending emails (user's mailbox)
- Recipient data from SQL `StoreManagerAssignments` table
- Email templates with embedded HTML reports
- Notification history in SQL `Notifications` table

#### Checklist Management (`checklist/`)
- **services/checklist-service.js**: CRUD for audit sections
- **services/version-control-service.js**: Change tracking in AuditLog table
- All stored in SQL Server

#### Checklist Template System
- **Schema Management**: Different audit types/schemas (SQL `AuditSchemas` table)
- **Template Builder**: Create audit templates with custom sections
- **Section Management**: Reusable section definitions
- SQL Server stored procedures for efficient operations

### Database Schema (SQL Server - FoodSafetyDB_Live)

#### Core Audit Tables
- **AuditInstances**: Main audit records (DocumentNumber, StoreName, TotalScore, Auditors, etc.)
- **AuditResponses**: Individual question responses with findings
- **AuditPictures**: Binary image storage (Finding/Corrective pictures)
- **AuditSectionScores**: Per-section scores for each audit
- **AuditSchemas**: Audit type definitions (Food Safety, CK, etc.)
- **AuditSections**: Section definitions per schema

#### User & Permission Tables
- **Users**: User accounts with roles and approval status
- **UserRoles**: Role definitions (Admin, Auditor, etc.)
- **StoreManagerAssignments**: Store assignments for users
- **Stores**: Store definitions with schema assignments

#### Action Plan Tables
- **ActionPlanResponses**: Action plan item responses
- **ActionPlanAuditLog**: Change tracking

#### Notification Tables
- **Notifications**: Email notification history
- **SavedReports**: Generated report metadata
- **DepartmentReports**: Saved department reports

### Available API Endpoints

#### Authentication & Users
- `GET /auth/login` - Login page (public)
- `GET /auth/callback` - OAuth2 callback (public)
- `GET /auth/logout` - Logout (protected)
- `GET /auth/session` - Current session info (protected)
- `GET /api/admin/users` - User management API (admin only)
- `PATCH /api/admin/users/:id` - Update user role (admin only)

#### Dashboard & Documents
- `GET /dashboard` - Main dashboard (protected, role-filtered)
- `GET /api/documents` - List of audit documents from SQL (protected)
- `GET /api/thresholds` - Dynamic scoring thresholds (protected)

#### Report Generation (SQL-based)
- `GET /api/audits/:auditId/report` - Generate HTML audit report
- `GET /api/audits/:auditId/action-plan` - Generate action plan
- `GET /api/audits/:auditId/export-pdf` - Export report as PDF
- `GET /api/audits/:auditId/department-report/:department` - Department report
- `GET /reports/:filename` - Serve generated reports (protected)

#### Action Plan Management
- `GET /api/action-plan/:documentNumber` - Get action plan items
- `GET /api/action-plan/:documentNumber/summary` - Get summary
- `POST /api/action-plan/save` - Save action plan items
- `POST /api/action-plan/send-email` - Email action plan

#### Auditor Functions
- `GET /auditor/select` - Store/checklist selection
- `GET /api/auditor/stores` - Available stores (from SQL)
- `GET /api/auditor/checklists` - Available checklists (from SQL)
- `POST /api/auditor/start-audit` - Start new audit

#### Department Reports
- `GET /api/audits/:auditId/department-report/:department` - Get department report
- `GET /api/department-reports/list/:department` - List saved reports

### Dependencies
- Node.js 16+ with native fetch support
- Microsoft Graph API client libraries (for email only)
- Azure AD App Registration credentials
- SQL Server (FoodSafetyDB_Live)
- mssql package for database connectivity

## Development Notes
- **NO SharePoint data access** - All data from SQL Server
- Microsoft Graph API used ONLY for OAuth2 and email sending
- Reports are saved to ./reports/ directory with timestamped filenames
- Pure Node.js implementation
- HTTPS enabled with Let's Encrypt certificates for production
- Session cleanup runs hourly to remove expired sessions

## Production Status
✅ **FULLY OPERATIONAL** - SQL Server-based audit system

**Production URL**: https://fsaudit.gmrlapps.com

**User Roles in Production**:
- Admin: Full system access, user management, all features
- Auditor: Create audits, generate reports, manage action plans
- SuperAuditor: Template management + Auditor permissions
- StoreManager: View reports for assigned stores, action plan responses
- Department Heads (Maintenance/Procurement/Cleaning): Department-specific reports

## Scoring Configuration
- Scoring thresholds stored in `AuditSchemas` table
- Default passing threshold: 83%
- 2-Color system: Green (PASS) / Red (FAIL)

## Multi-Schema Architecture
The system supports multiple audit schemas (e.g., Food Safety, CK):
- Each schema has its own sections and questions
- Stored in `AuditSchemas` and `AuditSections` tables
- Schema selected when creating new audit
- Reports and scoring adapt to schema structure

## Key SQL Tables Reference

### AuditInstances
```sql
AuditID, DocumentNumber, StoreID, StoreCode, StoreName, SchemaID,
AuditDate, TimeIn, TimeOut, Cycle, Year, Auditors, AccompaniedBy,
Status, TotalScore, CreatedAt, CreatedBy, CompletedAt
```

### AuditResponses
```sql
ResponseID, AuditID, SectionID, SectionName, SectionNumber,
ReferenceValue, Title, Answer, SelectedChoice, Value, Coeff,
Finding, CorrectiveAction, Priority, Escalate, Department, CR
```

### AuditPictures
```sql
PictureID, ResponseID, FileName, FileData (varbinary), ContentType,
PictureType (Finding/Corrective/Good), CreatedAt
```

## Archived Legacy Code
The following SharePoint-based code has been archived to `archive/legacy-sharepoint-generators/`:
- `enhanced-report-generator/` - Old SharePoint-based report generator
- `department-followup-reports/` - Old SharePoint-based department reports
- `generate-enhanced-html-report.js` - Old SharePoint report script
- `generate-action-plan-report.js` - Old SharePoint action plan script
- `dashboard-server.js` - Old SharePoint dashboard server

**Do NOT use these archived files** - they reference deleted SharePoint lists.
