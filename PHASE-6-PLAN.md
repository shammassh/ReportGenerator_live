# Phase 6: Checklist Management - Implementation Plan

## 🎯 Objective
Create an admin interface to manage master checklist questions across all 13 section lists, allowing admins to:
- View all questions from all sections
- Edit existing questions (Title, Coeff, Answer options, Criterion, ReferenceValue)
- Add new questions to any section
- Activate/deactivate questions without deleting them
- Bulk operations on multiple questions
- Version control for checklist changes

---

## 📋 Current Checklist Architecture

### 13 Master Lists (Questions)
1. 🥫 Food Storage & Dry Storage
2. ❄️ Fridges and Freezers
3. 🍽️ Utensils and Equipment
4. 👨‍🍳 Food Handling
5. 🧹 Cleaning and Disinfection
6. 🧼 Personal Hygiene
7. 🚻 Restrooms
8. 🗑️ Garbage Storage & Disposal
9. 🛠️ Maintenance
10. 🧪 Chemicals Available
11. 📋 Monitoring Sheets
12. 🏛️ Food Safety Culture
13. 📜 Policies & Procedures

### Question Schema (Master Lists)
```javascript
{
  Title: string,              // Question text
  Coeff: number,              // Weight (2, 4, etc.)
  Answer: string,             // "Yes,Partially,No,NA"
  cr: string,                 // Criterion/requirement text
  ReferenceValue: string,     // Reference number (e.g., "1.1", "2.5")
  IsActive: boolean           // NEW FIELD - Active/Inactive
}
```

---

## 🏗️ Phase 6 Architecture

### Backend Components (5 files)

#### 1. **`checklist/services/checklist-service.js`**
Master service for checklist CRUD operations
- `getAllSections()` - Get all 13 section names
- `getSectionQuestions(sectionName)` - Get all questions from a section
- `getQuestionById(sectionName, questionId)` - Get single question
- `addQuestion(sectionName, questionData)` - Add new question
- `updateQuestion(sectionName, questionId, questionData)` - Update question
- `toggleQuestionStatus(sectionName, questionId, isActive)` - Activate/deactivate
- `deleteQuestion(sectionName, questionId)` - Soft delete
- `bulkUpdateQuestions(operations)` - Bulk operations

#### 2. **`checklist/services/version-control-service.js`**
Track changes to checklists
- `logChange(user, section, action, before, after)` - Log changes
- `getChangeHistory(filters)` - Get change history
- `rollbackToVersion(versionId)` - Rollback to previous version

#### 3. **`checklist/pages/checklist-management-page.js`**
Serve the checklist management interface
- `serveChecklistManagement(req, res)` - Serve main page
- Admin-only access

#### 4. **`checklist/middleware/checklist-auth.js`**
Authorization middleware
- `requireAdmin` - Ensure only admins can access

### Frontend Components (5 files)

#### 5. **`checklist/pages/checklist-management.html`**
Main management interface (or integrate into existing admin panel)

#### 6. **`checklist/scripts/checklist-manager.js`**
Client-side management logic
- Section selection
- Question list display
- Edit modal
- Add question modal
- Bulk operations
- Search/filter

#### 7. **`checklist/scripts/question-editor.js`**
Question editing component
- Form validation
- Answer options management
- Coefficient validation
- Reference value management

#### 8. **`checklist/scripts/version-history.js`**
Version control UI
- Display change history
- Rollback functionality
- Diff viewer

#### 9. **`checklist/styles/checklist-management.css`**
Styling for checklist management interface

---

## 🎨 UI Design

### Main Interface Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Checklist Management                           [+ Add New]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Section: [Food Storage & Dry Storage ▼]  🔍 Search questions   │
│                                                                  │
├──┬─────────────────────────────────────────────────────────────┤
│# │ Question                          Coeff  Ref   Status  Actions│
├──┼─────────────────────────────────────────────────────────────┤
│1 │ Food stored off the floor         4      1.1   ✅     [Edit] │
│2 │ FIFO system implemented           2      1.2   ✅     [Edit] │
│3 │ Temperature monitoring present    4      1.3   ❌     [Edit] │
│  │                                                                │
├──┴─────────────────────────────────────────────────────────────┤
│ [Bulk Actions ▼]  Selected: 0       📜 Version History         │
└─────────────────────────────────────────────────────────────────┘
```

### Edit Question Modal

```
┌─────────────────────────────────────────────────┐
│ ✏️ Edit Question                         [X]    │
├─────────────────────────────────────────────────┤
│                                                  │
│ Section: Food Storage & Dry Storage (read-only) │
│                                                  │
│ Reference Value:                                 │
│ [1.1         ]                                   │
│                                                  │
│ Question Text: *                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ Food stored off the floor                 │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Coefficient: * [4 ▼]  (2, 4)                   │
│                                                  │
│ Answer Options: *                                │
│ ☑ Yes  ☑ Partially  ☑ No  ☑ NA                │
│                                                  │
│ Criterion/Requirement:                           │
│ ┌───────────────────────────────────────────┐   │
│ │ All food items must be stored at least    │   │
│ │ 15cm off the floor on shelves or pallets  │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Status: [Active ▼]  (Active, Inactive)         │
│                                                  │
├─────────────────────────────────────────────────┤
│              [Cancel]  [Save Changes]           │
└─────────────────────────────────────────────────┘
```

### Add New Question Modal

```
┌─────────────────────────────────────────────────┐
│ ➕ Add New Question                      [X]    │
├─────────────────────────────────────────────────┤
│                                                  │
│ Section: * [Food Storage & Dry Storage ▼]      │
│                                                  │
│ Reference Value:                                 │
│ [1.10        ]  (auto-increment suggested)      │
│                                                  │
│ Question Text: *                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ [Enter question text...]                  │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Coefficient: * [4 ▼]  (2, 4)                   │
│                                                  │
│ Answer Options: *                                │
│ ☑ Yes  ☑ Partially  ☑ No  ☑ NA                │
│                                                  │
│ Criterion/Requirement:                           │
│ ┌───────────────────────────────────────────┐   │
│ │ [Enter criterion text...]                 │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Status: [Active ▼]                              │
│                                                  │
├─────────────────────────────────────────────────┤
│              [Cancel]  [Add Question]           │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Workflow

### Adding a New Question
1. Admin clicks "+ Add New"
2. Modal opens with empty form
3. Admin selects section
4. System suggests next reference value (e.g., if last is 1.9, suggest 1.10)
5. Admin fills in question details
6. Admin saves → Question added to master list
7. System logs change to version history
8. **Future audits will include this question**

### Editing a Question
1. Admin clicks "Edit" on a question
2. Modal opens with current values
3. Admin modifies any field
4. Admin saves → Question updated in master list
5. System logs change (before/after)
6. **Existing audits are NOT affected** (historical integrity)
7. **New audits use updated question**

### Deactivating a Question
1. Admin changes status to "Inactive"
2. Question remains in master list but marked inactive
3. **New audits will NOT include this question**
4. **Existing audits are NOT affected**
5. Can be reactivated later

---

## 🗄️ Database Changes

### New Table: ChecklistVersions
```sql
CREATE TABLE ChecklistVersions (
    id INT PRIMARY KEY IDENTITY(1,1),
    section_name NVARCHAR(255) NOT NULL,
    question_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'ADD', 'UPDATE', 'DEACTIVATE', 'ACTIVATE', 'DELETE'
    before_state NVARCHAR(MAX),   -- JSON of question before change
    after_state NVARCHAR(MAX),    -- JSON of question after change
    changed_by_user_id INT,
    changed_by_email NVARCHAR(255),
    changed_at DATETIME2 DEFAULT GETDATE(),
    reason NVARCHAR(MAX),         -- Optional reason for change
    FOREIGN KEY (changed_by_user_id) REFERENCES Users(id)
);
```

### SharePoint List Changes
Add new column to all 13 master lists:
- **IsActive** (Yes/No) - Default: Yes

---

## 🔒 Security & Permissions

### Access Control
- **Admin Only**: Can manage all checklists
- **Auditor**: Can view but NOT edit
- **Others**: No access

### Audit Trail
- Every change logged with:
  - Who made the change
  - When
  - What changed (before/after)
  - Which section/question
  - Reason (optional)

### Data Integrity
- Questions can be deactivated but NOT deleted (soft delete)
- Existing audit responses are NEVER modified
- Version history is immutable

---

## 📊 Implementation Steps

### Step 1: Database Setup (15 min)
- [ ] Create ChecklistVersions table
- [ ] Add IsActive column to master lists (via SharePoint or SQL if using SQL)

### Step 2: Backend Services (60 min)
- [ ] Create checklist-service.js
- [ ] Create version-control-service.js
- [ ] Create checklist-management-page.js
- [ ] Create checklist-auth.js middleware

### Step 3: Frontend UI (90 min)
- [ ] Create checklist-management.html (or integrate into admin panel)
- [ ] Create checklist-manager.js
- [ ] Create question-editor.js
- [ ] Create version-history.js
- [ ] Create checklist-management.css

### Step 4: Integration (30 min)
- [ ] Add routes to auth-app.js
- [ ] Add navigation link in admin panel
- [ ] Test CRUD operations

### Step 5: Testing (45 min)
- [ ] Test adding questions
- [ ] Test editing questions
- [ ] Test deactivating/activating
- [ ] Test version history
- [ ] Test permissions
- [ ] Test with existing audits

---

## 🎯 Success Criteria

- [x] Admins can view all questions from all sections
- [x] Admins can add new questions
- [x] Admins can edit existing questions
- [x] Admins can activate/deactivate questions
- [x] Changes are logged in version history
- [x] Existing audits are not affected by changes
- [x] New audits use updated checklist
- [x] Non-admins cannot access checklist management
- [x] UI is intuitive and professional
- [x] All operations are validated

---

## 🚀 Future Enhancements (Phase 6.5)

- [ ] Import/export checklists (Excel, JSON)
- [ ] Template management (copy from one section to another)
- [ ] Question reordering (drag-and-drop)
- [ ] Multi-language support
- [ ] Question dependencies (conditional questions)
- [ ] Advanced search with filters
- [ ] Bulk import via CSV
- [ ] Question library (reusable questions)

---

## 📝 Notes

### Important Considerations
1. **Historical Integrity**: Never modify questions in existing audits
2. **Reference Values**: Must be unique within a section
3. **Coefficient**: Only 2 or 4 allowed
4. **Answer Options**: Must include at least "Yes" and "No"
5. **IsActive**: Default to true for new questions

### SharePoint Integration
Since master lists are in SharePoint:
- Use existing Graph API connector
- Add IsActive column to SharePoint lists
- Filter by IsActive when creating new audits

---

**Ready to implement Phase 6?** Let me know and I'll start building! 🚀
