<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
# SharePoint Report Generator - Copilot Instructions

## Project Overview
This is a production-ready Node.js SharePoint Online Food Safety Audit Management System that processes real operational data using Microsoft Graph API integration. The system supports complete audit lifecycle from creation to reporting, with role-based access control, automated notifications, and comprehensive dashboard analytics.

## Key Components

### Main Application (`auth-app.js`)
The central Express.js server running on HTTPS port 3001 that integrates all subsystems:
- Authentication & authorization with role-based access control
- Dashboard with real-time audit statistics
- Report generation (HTML, PDF, DOC formats)
- Action plan management
- Email notification system
- Checklist template management
- Department-specific followup reports

### Core Services

#### Authentication System (`auth/`)
- **auth-server.js**: OAuth2 + SQL Server session management
- **Roles**: Admin, Auditor, SuperAuditor, StoreManager, Department Heads
- **Middleware**: `requireAuth`, `requireRole()` for protected routes
- **User Management**: Admin panel for user approval/role assignment
- Session-based authentication with automatic cleanup

#### SharePoint Connectors (`src/`)
- **simple-graph-connector.js**: Primary connector using Microsoft Graph API
- **graph-connector.js**: Advanced connector with GraphQL support
- Uses Azure AD App Registration with client credentials
- Interactive browser OAuth2 fallback
- Supports CRUD operations on SharePoint lists

#### Enhanced Report Generator (`enhanced-report-generator/`)
- **report-generator.js**: Main report generation orchestrator
- **services/config-service.js**: Dynamic threshold configuration from SharePoint
- **services/scoring-service.js**: Scoring calculations with dynamic thresholds
- **services/data-service.js**: SharePoint data fetching and processing
- **services/image-service.js**: Image download and base64 conversion
- **services/template-engine.js**: Mustache-based HTML templating
- **services/utilities.js**: Helper functions

#### Action Plan Service (`src/action-plan-service.js`)
- SQL Server-based action plan storage and retrieval
- CRUD operations for action items
- Support for images (base64 encoded)
- Status tracking (Open, In Progress, Completed)
- Assignment and deadline management

#### Department Followup Reports (`department-followup-reports/`)
- **Main Module**: `index.js` - Entry point for department report generation
- **Department Filtering**: Supports single or multiple departments (Maintenance, Procurement, Cleaning)
- **Data Service**: `services/followup-data-service.js` - Fetches action items by department from SQL
- **Image Service**: `services/image-service.js` - Retrieves corrective images from SharePoint CImages library
- **Template Generator**: `services/template-generator.js` - HTML report generation with color-coded sections
- **Department Mappings**: `config/department-mappings.js` - Maps action items to responsible departments
- **Features**:
  - Filters action plan items by department assignment
  - Groups items by priority (High, Medium, Low)
  - Includes corrective images with before/after comparison
  - Maps reference values to audit sections
  - Generates standalone HTML reports with base64 images
  - Color-coded by department (Maintenance: blue, Procurement: purple, Cleaning: green)

#### Email Notification Service (`services/email-notification-service.js`)
- Microsoft Graph API for sending emails
- Automatic recipient detection from SharePoint User Assignments
- Email templates with embedded HTML reports
- Support for Store Managers and Department Heads
- Notification history tracking

#### Checklist Management (`checklist/`)
- **services/checklist-service.js**: CRUD for 13 master section lists
- **services/version-control-service.js**: Change tracking in AuditLog table
- **pages/checklist-management-page.js**: Admin interface for question management
- Search, filter, pagination for questions
- Version history with rollback support

#### Checklist Template System (`checklist-template-integration.js`)
- **Schema Management**: Different audit types/schemas
- **Template Builder**: Create audit templates with custom sections
- **Section Management**: Reusable section definitions
- SQL Server stored procedures for efficient operations
- SuperAuditor role for template creation

### Current Capabilities
- ✅ Successfully processes 56+ survey responses
- ✅ Generates compliance reports with 65.4% accuracy
- ✅ Handles complex JSON survey data structures
- ✅ Outputs multiple report formats (JSON, CSV, HTML, PDF, DOC)
- ✅ Real-time data processing from live SharePoint lists
- ✅ Enhanced HTML reports with embedded images and fridge temperature monitoring tables
- ✅ Automatic base64 image conversion for standalone HTML viewing
- ✅ Role-based dashboard with filtering by user permissions
- ✅ Action plan tracking with email notifications
- ✅ Department-specific followup report generation
- ✅ Audit history and trend analysis with charts
- ✅ Dynamic scoring thresholds from SharePoint configuration

### Available API Endpoints

#### Authentication & Users
- `GET /auth/login` - Login page (public)
- `GET /auth/callback` - OAuth2 callback (public)
- `GET /auth/logout` - Logout (protected)
- `GET /auth/session` - Current session info (protected)
- `GET /api/admin/users` - User management API (admin only)
- `PATCH /api/admin/users/:id` - Update user role (admin only)
- `POST /api/admin/sync-graph` - Sync users from Microsoft Graph (admin only)

#### Dashboard & Documents
- `GET /dashboard` - Main dashboard (protected, role-filtered)
- `GET /api/documents` - List of audit documents (protected, role-filtered)
- `GET /api/thresholds` - Dynamic scoring thresholds (protected)

#### Report Generation
- `POST /api/generate-report` - Generate HTML audit report (admin/auditor)
- `POST /api/generate-action-plan` - Generate action plan report (admin/auditor)
- `POST /api/export-pdf` - Export report as PDF (admin/auditor)
- `POST /api/export-doc` - Export report as Word (admin/auditor)
- `GET /reports/:filename` - Serve generated reports (protected)

#### Action Plan Management
- `GET /api/action-plan/:documentNumber` - Get action plan items (protected)
- `GET /api/action-plan/:documentNumber/summary` - Get action plan summary (protected)
- `POST /api/action-plan/save` - Save action plan items (protected)
- `POST /api/action-plan/send-email` - Email action plan to recipients (protected)
- `POST /api/action-plan/submit-to-auditor` - Submit for auditor review (protected)

#### Department Reports
- `POST /api/generate-department-followup` - Generate department-specific reports (department heads)
- `GET /api/department-reports/:department` - Get department followup history (protected)

#### Notifications
- `GET /api/notifications` - Notification history (admin/auditor)
- `GET /api/notifications/statistics` - Notification stats (admin/auditor)
- `GET /api/notifications/recent` - Recent notifications (admin/auditor)
- `POST /api/notifications/get-recipients` - Get email recipients for store (admin/auditor)

#### Auditor Functions
- `GET /auditor/select` - Auditor store/checklist selection (admin/auditor)
- `GET /api/auditor/stores` - Available stores (admin/auditor)
- `GET /api/auditor/checklists` - Available checklists (admin/auditor)
- `GET /api/auditor/recent-audits` - Recent audit history (admin/auditor)
- `GET /api/auditor/statistics` - Audit statistics (admin/auditor)
- `POST /api/auditor/start-audit` - Start new audit (admin/auditor)

#### Checklist Management
- `GET /admin/checklist-management` - Checklist management UI (admin only)
- Multiple API endpoints for CRUD operations on master checklists

#### Checklist Templates
- `GET /admin/checklist-templates` - Template management UI (admin/superauditor)
- Schema, section, and template API endpoints

### Database Schema (SQL Server - FoodSafetyDB)

#### Core Tables
- **Users**: User accounts with roles and approval status
- **UserRoles**: Role definitions (Admin, Auditor, etc.)
- **UserAssignments**: Store assignments for users
- **ActionPlanItems**: Action plan item storage with images
- **NotificationHistory**: Email notification tracking
- **SavedReports**: Generated report metadata
- **AuditLog**: Change tracking for checklist questions

#### Checklist Template Tables
- **ChecklistSchemas**: Schema/audit type definitions
- **ChecklistSections**: Reusable section definitions
- **ChecklistTemplates**: Template metadata
- **ChecklistTemplateItems**: Individual questions in templates
- **ChecklistTemplateSections**: Template-section associations

### Dependencies
- Node.js 16+ with native fetch support
- Microsoft Graph API client libraries
- Azure AD App Registration credentials
- SQL Server (local or GMRLINTERNAL)
- SharePoint Online access

## Development Notes
- All authentication uses Microsoft Graph API for reliable execution
- JSON parsing handles complex nested survey response structures
- Reports are saved to ./reports/ directory with timestamped filenames
- Pure Node.js implementation with no external shell dependencies
- HTTPS enabled with Let's Encrypt certificates for production
- Session cleanup runs hourly to remove expired sessions

## Production Status
✅ **FULLY OPERATIONAL** - Successfully generating real business reports from Spinneys SharePoint data

**Production URL**: https://pappreports.gmrlapps.com:3001

**User Roles in Production**:
- Admin: Full system access, user management, all features
- Auditor: Create audits, generate reports, manage action plans
- SuperAuditor: Template management + Auditor permissions
- StoreManager: View reports for assigned stores, action plan responses
- Department Heads (Maintenance/Procurement/Cleaning): Department-specific followup reports

## Dynamic Configuration System
- **ConfigService** (`enhanced-report-generator/services/config-service.js`): Reads scoring thresholds from SharePoint
- **SharePoint Configuration List**: `fs system setting` stores OverallPassingScore, SectionPassingScore, CategoryPassingScore
- **Threshold Usage**: All scoring components (reports, dashboard, charts) use dynamic thresholds instead of hardcoded values
- **API Endpoint**: `/api/thresholds` provides threshold values to client-side applications
- **2-Color Scoring**: Dashboard uses only green (PASS ✅) and red (FAIL ❌) based on dynamic threshold
- **Caching**: ConfigService caches thresholds for 5 minutes to reduce SharePoint API calls
- **Fallback**: Defaults to 83% if SharePoint unavailable

---

# 🍽 FS Survey – Spec & Logic (for Copilot)

## 0) Goal
Implement a multi-section audit where:
- **Default questions** live in *section master lists* (one list per section).
- **Answers** live in *section response lists* (one list per section) and are stored as both flat fields (Title, Document Number) and a canonical `ResponseJSON: AuditItem[]`.
- **FS Survey** stores one row per audit (document) with overall and per-section scores.

---

## 1) Lists & Columns

### A) Master (default questions) lists — one per section
Each contains the default checklist for that section.

Common schema (example: **Food Storage & Dry Storage**):
- `Title` (text) — question text
- `Coeff` (number) — weight (e.g., 2, 4)
- `Answer` (text) — allowed answers enum as string (e.g., `Yes,Partially,No,NA`)
- `cr` (multiline) — criterion/requirement text
- `ReferenceValue` (text)

Master lists and their corresponding response lists:

| Master (Questions) | Response (Answers) |
|---|---|
| 🥫 Food Storage & Dry Storage | Survey Responses List |
| ❄️ Fridges and Freezers | SRA Fridges |
| 🍽️ Utensils and Equipment | SRA Utensils and Equipment |
| 👨‍🍳 Food Handling | SRA Food Handling |
| 🧹 Cleaning and Disinfection | SRA Cleaning and Disinfection |
| 🧼 Personal Hygiene | SRA Personal Hygiene |
| 🚻 Restrooms | SRA Restrooms |
| 🗑️ Garbage Storage & Disposal | SRA Garbage Storage and Disposal |
| 🛠️ Maintenance | SRA Maintenance |
| 🧪 Chemicals Available | SRA Chemicals Available |
| 📋 Monitoring Sheets | SRA Monitoring Sheets are Properly Filled, Documents Present |
| 🏛️ Food Safety Culture | SRA Culture |
| 📜 Policies & Procedures | SRA Policies, Procedures & Posters |

> Copilot: maintain a mapping dictionary to pair master → response list names.

### B) FS Survey (one row per audit document)
Columns:
- `Title` (text) — typically store name + date or a human label
- `Document Number` (text/number) — unique audit id
- `Status` (choice) — e.g., Draft/In Review/Approved
- `Score` (number) — **total** audit score
- Per-section scores (number):  
  `FoodScore, FridgesScore, UtensilsScore, FoodHScore, CNDScore, HygScore, RestroomScore, GarScore, MaintScore, ChemScore, MonitScore, PolScore`

### C) Section Response Lists (answers)
Columns:
- `Title` (text) — section name (or question text if needed)
- `Document Number` (text/number) — FK to FS Survey
- `ResponseJSON` (multiline text) — JSON string of `AuditItem[]`

### D) Canonical `AuditItem` (stored inside `ResponseJSON`)
```ts
export interface AuditItem {
  Title: string;                  // checklist question
  Coeff: number;                  // weight
  Answer: string;                 // allowed enum list: "Yes,Partially,No,NA"
  SelectedChoice: string;         // "Yes" | "Partially" | "No" | "NA" | ""
  Value: number | null;           // numeric score computed from SelectedChoice & Coeff
  cr: string;                     // criterion text
  ReferenceValue: string | null;  // optional reference
  Finding: string | null;         // free text note
  comment: string;                // free text
  correctedaction: string;        // suggested corrective action
  Priority: string;               // e.g., "High" | "Medium" | "Low" | ""
  Picture: string;                // "1" if picture exists, else ""
  SelectedCr: string;             // if you store selected requirement variation
  Id: number | string | null;     // optional, can be null
}
```
- The full payload per section is `AuditItem[]` serialized to the list's `ResponseJSON`.

---

## 2) Creation Flow – "New Document"

**Trigger:** user creates a new FS Survey document (generate and store `Document Number`).

**For each section:**
1. Read all rows from the **master list**.
2. Map each row to an `AuditItem`.
3. Serialize the array to JSON and **create one item** in the **section response list**:
   - `Title` = section name
   - `Document Number` = FS Survey.`Document Number`
   - `ResponseJSON` = stringified `AuditItem[]`

---

## 3) Updating Answers & Scoring

### A) Choice → Value function
```ts
function scoreChoice(choice: string, coeff: number): number {
  switch (choice) {
    case "Yes":       return 1 * coeff;
    case "Partially": return 0.5 * coeff;
    case "No":        return 0 * coeff;
    case "NA":        return 0 * coeff;
    default:          return 0;
  }
}
```

### B) Section scoring
- Update answers in `ResponseJSON`.
- Recompute `Value` per item.
- Compute **section score** as sum of values.
- Write section score to FS Survey (per-section field).

### C) Total score
- FS Survey.`Score` = sum of all per-section scores.

---

## 4) Action Plan Extraction

Build report by flattening issues from all sections for a given `Document Number`.

Include entry when:
- `SelectedChoice` is "No" or "Partially"
- OR `Priority`, `Finding`, `correctedaction`, or `Picture` set.

**Columns in report:**
- Section
- ReferenceValue
- Title
- Finding
- correctedaction
- Priority
- Picture
- Editable fields: Action taken, Deadline, Person In Charge, Status, Pictures

---

## 5) Section Mapping Dictionary

```ts
const SectionLists = {
  "Food Storage & Dry Storage": {
    master: "Food Storage & Dry Storage",
    response: "Survey Responses List",
    scoreField: "FoodScore"
  },
  "Fridges and Freezers": {
    master: "Fridges and Freezers",
    response: "SRA Fridges",
    scoreField: "FridgesScore"
  },
  "Utensils and Equipment": {
    master: "Utensils and Equipment",
    response: "SRA Utensils and Equipment",
    scoreField: "UtensilsScore"
  },
  "Food Handling": {
    master: "Food Handling",
    response: "SRA Food Handling",
    scoreField: "FoodHScore"
  },
  "Cleaning and Disinfection": {
    master: "Cleaning and Disinfection",
    response: "SRA Cleaning and Disinfection",
    scoreField: "CNDScore"
  },
  "Personal Hygiene": {
    master: "Personal Hygiene",
    response: "SRA Personal Hygiene",
    scoreField: "HygScore"
  },
  "Restrooms": {
    master: "Restrooms",
    response: "SRA Restrooms",
    scoreField: "RestroomScore"
  },
  "Garbage Storage & Disposal": {
    master: "Garbage Storage & Disposal",
    response: "SRA Garbage Storage and Disposal",
    scoreField: "GarScore"
  },
  "Maintenance": {
    master: "Maintenance",
    response: "SRA Maintenance",
    scoreField: "MaintScore"
  },
  "Chemicals Available": {
    master: "Chemicals Available",
    response: "SRA Chemicals Available",
    scoreField: "ChemScore"
  },
  "Monitoring Sheets": {
    master: "Monitoring Sheets",
    response: "SRA Monitoring Sheets are Properly Filled, Documents Present",
    scoreField: "MonitScore"
  },
  "Food Safety Culture": {
    master: "Food Safety Culture",
    response: "SRA Culture",
    scoreField: "CultScore"
  },
  "Policies & Procedures": {
    master: "Policies & Procedures",
    response: "SRA Policies, Procedures & Posters",
    scoreField: "PolScore"
  }
} as const;
```

---

## 6) Key Operations (pseudo-code)

### Create New Audit
```ts
async function createAudit(fsSurveyItem) {
  await sp.fsSurvey.add(fsSurveyItem);
  for (const [sectionName, cfg] of Object.entries(SectionLists)) {
    const masterRows = await sp.list(cfg.master).getAll();
    const items = masterRows.map(q => ({
      Title: q.Title,
      Coeff: q.Coeff,
      Answer: q.Answer,
      cr: q.cr,
      ReferenceValue: q.ReferenceValue ?? null,
      SelectedChoice: "",
      Value: null,
      Finding: null,
      comment: "",
      correctedaction: "",
      Priority: "",
      Picture: "",
      SelectedCr: "",
      Id: null
    }));
    await sp.list(cfg.response).add({
      Title: sectionName,
      "Document Number": fsSurveyItem.DocumentNumber,
      ResponseJSON: JSON.stringify(items)
    });
  }
}
```

### Save Section Answers + Recompute Scores
```ts
async function saveSectionAnswers(documentNumber, sectionName, updatedItems) {
  for (const it of updatedItems) {
    it.Value = it.SelectedChoice ? scoreChoice(it.SelectedChoice, it.Coeff) : null;
  }
  const cfg = SectionLists[sectionName];
  await sp.list(cfg.response)
    .itemBy({ "Document Number": documentNumber })
    .update({ ResponseJSON: JSON.stringify(updatedItems) });

  const sectionScore = updatedItems.reduce((sum, it) => sum + (it.Value ?? 0), 0);
  await sp.fsSurvey.itemBy({ "Document Number": documentNumber }).update({ [cfg.scoreField]: sectionScore });
  await recomputeTotalScore(documentNumber);
}
```

### Build Action Plan Report
```ts
async function buildActionPlan(documentNumber) {
  const findings = [];
  for (const [sectionName, cfg] of Object.entries(SectionLists)) {
    const row = await sp.list(cfg.response).itemBy({ "Document Number": documentNumber }).get();
    const arr = JSON.parse(row.ResponseJSON || "[]");
    for (const it of arr) {
      const isIssue =
        it.SelectedChoice === "No" ||
        it.SelectedChoice === "Partially" ||
        !!it.Priority || !!it.Finding || !!it.correctedaction || it.Picture === "1";
      if (isIssue) {
        findings.push({
          Section: sectionName,
          ReferenceValue: it.ReferenceValue ?? "",
          Title: it.Title,
          Finding: it.Finding ?? "",
          SuggestedAction: it.correctedaction ?? "",
          Priority: it.Priority ?? "",
          Picture: it.Picture === "1"
        });
      }
    }
  }
  return findings;
}
```

---

## 7) Fridge Temperature Monitoring Tables

### Data Structure
Three SharePoint lists are involved in fridge temperature monitoring:

1. **SRA Fridges** (Section Response List)
   - Contains `Document_x0020_Number` (FK to FS Survey)
   - Contains `ResponseJSON` field with array of audit questions
   - Each item in ResponseJSON has:
     - `Title`: Question text
     - `ReferenceValue`: Question reference (e.g., "2.1", "2.26")
     - `SelectedChoice`: Audit response
   - Key question for temperature monitoring: ReferenceValue "2.26" - "Air temperature of fridges and freezers..."

2. **Fridges Good** (Compliant Temperature Records)
   - `goodid`: Format "DOCUMENT_NUMBER-SEQUENTIAL" (e.g., "GMRL-FSACR-0048-66")
   - `Unit`: Unit temperature
   - `Display`: Display temperature
   - `Probe`: Probe temperature
   - `Picture`: JSON string with image metadata
   - `Attachments`: Boolean indicating if images exist

3. **Fridges finding** (Non-Compliant Temperature Records)
   - `fridgeid`: Format "DOCUMENT_NUMBER-SEQUENTIAL" (e.g., "GMRL-FSACR-0048-67")
   - `key`: Numeric key field
   - `Unit/key`: Unit temperature (alternate field)
   - `Display/Value`: Display temperature (alternate field)
   - `Probe`: Probe temperature
   - `Issue`: Description of issue found
   - `Picture`: JSON string with image metadata
   - `Attachments`: Boolean indicating if images exist

### Table Generation Logic

```ts
async function generateFridgesTables(documentNumber: string) {
  // 1. Fetch SRA Fridges ResponseJSON to get ReferenceValue
  const sraFridges = await getListItems('SRA Fridges', {
    filter: `Document_x0020_Number eq '${documentNumber}'`
  });
  const sraFridgeItems = JSON.parse(sraFridges[0].ResponseJSON);
  
  // 2. Find the temperature monitoring question (ReferenceValue "2.26")
  const tempMonitoringItem = sraFridgeItems.find(item => 
    item.Title?.toLowerCase().includes('air temperature of fridges and freezers')
  );
  const temperatureReferenceValue = tempMonitoringItem?.ReferenceValue || '2.26';
  
  // 3. Fetch temperature records
  const findingItems = await getListItems('Fridges finding', {
    filter: `substringof('${documentNumber}', fridgeid)`
  });
  const goodItems = await getListItems('Fridges Good', {
    filter: `substringof('${documentNumber}', goodid)`
  });
  
  // 4. Assign ReferenceValue to all temperature records
  const enrichedFindingItems = findingItems.map(item => ({
    ...item,
    ReferenceValue: temperatureReferenceValue
  }));
  const enrichedGoodItems = goodItems.map(item => ({
    ...item,
    ReferenceValue: temperatureReferenceValue
  }));
  
  // 5. Download and convert images to base64 for standalone HTML viewing
  // 6. Generate HTML tables with columns:
  //    Findings: # | Unit (°C) | Display (°C) | Probe (°C) | Issue | Pictures
  //    Good: # | Unit (°C) | Display (°C) | Probe (°C) | Pictures
}
```

### Important Rules
- ❌ **NO "Document Number" column** in tables
- ✅ **Use ReferenceValue from SRA Fridges** in the `#` column (typically "2.26")
- ✅ **NOT** the sequential number extracted from goodid/fridgeid
- ✅ All temperature records for a document use the **same** ReferenceValue
- ✅ Images are converted to base64 for standalone HTML viewing
- ✅ Both "Findings" and "Good" tables are generated when data exists

### Table Structure

**Fridges with Findings:**
```html
<table>
  <tr>
    <th>#</th>
    <th>Unit (°C)</th>
    <th>Display (°C)</th>
    <th>Probe (°C)</th>
    <th>Issue</th>
    <th>Pictures</th>
  </tr>
  <tr>
    <td>2.26</td> <!-- ReferenceValue from SRA Fridges -->
    <td>{Unit}</td>
    <td>{Display or Value}</td>
    <td>{Probe}</td>
    <td>{Issue}</td>
    <td>{base64 images}</td>
  </tr>
</table>
```

**Compliant Fridges:**
```html
<table>
  <tr>
    <th>#</th>
    <th>Unit (°C)</th>
    <th>Display (°C)</th>
    <th>Probe (°C)</th>
    <th>Pictures</th>
  </tr>
  <tr>
    <td>2.26</td> <!-- ReferenceValue from SRA Fridges -->
    <td>{Unit}</td>
    <td>{Display}</td>
    <td>{Probe}</td>
    <td>{base64 images}</td>
  </tr>
</table>
```

---

## 8) UX Notes
- Bind gallery to `ResponseJSON` per section.
- Auto recompute scores on save.
- Flatten Action Plan issues for printing/export.

---

## 9) Validation
- Handle NA choices.
- Centralize master→response mapping.
- Guard JSON parsing/stringifying.
- Update scoring logic in one place if rubric changes.

---

## 10) Dynamic Scoring Thresholds

### Configuration Source
All scoring thresholds are read from SharePoint `fs system setting` list with columns:
- `OverallPassingScore` (number) - Threshold for overall audit pass/fail
- `SectionPassingScore` (number) - Threshold for section-level scoring
- `CategoryPassingScore` (number) - Threshold for category-level chart colors

### ConfigService Implementation
```ts
// enhanced-report-generator/services/config-service.js
class ConfigService {
  async getScoringThresholds() {
    // Reads from SharePoint with 5-minute cache
    // Returns: { overall, section, category }
    // Falls back to defaults if SharePoint unavailable
  }
}
```

### Usage in Components

**Report Generation:**
```ts
const thresholds = await configService.getScoringThresholds();
const performance = calculatePerformance(score, thresholds.overall);
```

**Dashboard (Client-Side):**
```ts
const thresholds = await fetch('/api/thresholds').then(r => r.json());
const scoreClass = score >= thresholds.overall ? 'score-pass' : 'score-fail';
```

**Chart Colors:**
```ts
// Only 2 colors: green (pass) or red (fail)
const color = score >= threshold ? '#10b981' : '#ef4444';
```

### Important Rules
- ✅ **Always use dynamic thresholds** - Never hardcode 83 or any threshold value
- ✅ **2 colors only** - Green for pass, red for fail (no yellow/orange intermediates)
- ✅ **Cache thresholds** - ConfigService caches for 5 minutes to reduce SharePoint calls
- ✅ **Fallback defaults** - If SharePoint fails, use { overall: 83, section: 83, category: 83 }

---

## 11) Multi-Schema Architecture (Future)

### Current State
- Single schema: "Food Safety Audit" for all stores
- 13 sections with fixed SharePoint list names
- Config in `enhanced-report-generator/config/config.js`

### Multi-Schema Support Plan
When implementing support for different store types/schemas:

1. **Schema Registry** - Create configuration file or SharePoint list mapping:
   ```ts
   schemas = {
     'FoodSafety': {
       surveyList: 'FS Survey',
       documentPrefix: 'GMRL-FSACR',
       sections: { /* 13 sections */ }
     },
     'QualityAudit': {
       surveyList: 'QA Survey',
       documentPrefix: 'GMRL-QACR',
       sections: { /* different sections */ }
     }
   }
   ```

2. **Schema Detection** - Determine schema from:
   - Document number prefix
   - Store type metadata
   - Survey list name

3. **Dynamic Section Loading** - Modify report generator to:
   - Accept schema parameter
   - Load appropriate section mappings
   - Use schema-specific list names

### Implementation Considerations
- Same SharePoint site, different list names per schema
- Same report generation logic, different list mappings
- Same authentication and user roles
- Dashboard needs schema filter/selector