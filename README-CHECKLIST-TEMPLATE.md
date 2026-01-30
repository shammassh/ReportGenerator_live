# 📋 Checklist Template Management System

## Overview
A fully modular Node.js system for Admin and SuperAuditor roles to create and manage dynamic checklist templates. The system supports hierarchical template creation with schemas, sections, and individual checklist items.

## 🎯 Features

- ✅ **Schema Management**: Create dynamic store categories (e.g., "Signature Stores", "Express Stores")
- ✅ **Section Library**: 13 default sections with emoji icons + ability to add custom sections
- ✅ **Template Builder**: Create templates by selecting schemas and sections
- ✅ **Item Management**: Add checklist items with reference values, coefficients, and criteria
- ✅ **Batch Operations**: Add multiple items at once for faster template creation
- ✅ **Role-Based Access**: Admin and SuperAuditor roles only
- ✅ **Modular Architecture**: Independent services for each entity type
- ✅ **RESTful API**: Clean, documented endpoints
- ✅ **Reference Auto-numbering**: Automatic 1.1, 1.2... 2.1, 2.2... format

## 📁 Architecture

```
checklist-template-api.js          # Main API server
├── src/checklist/
│   ├── services/                  # Business logic layer
│   │   ├── schema-service.js      # Schema CRUD operations
│   │   ├── section-service.js     # Section CRUD operations
│   │   ├── template-service.js    # Template management
│   │   └── item-service.js        # Item management
│   ├── routes/                    # API route handlers
│   │   ├── schema-routes.js       # /api/schemas endpoints
│   │   ├── section-routes.js      # /api/sections endpoints
│   │   ├── template-routes.js     # /api/templates endpoints
│   │   └── item-routes.js         # /api/templates/:id/items endpoints
│   └── middleware/
│       └── auth-check.js          # Authentication & authorization
└── sql/
    ├── schema-checklist-template-v2.sql    # Database schema
    └── stored-procedures/
        ├── sp-schemas.sql         # Schema stored procedures
        ├── sp-sections.sql        # Section stored procedures
        ├── sp-templates.sql       # Template stored procedures
        └── sp-template-items.sql  # Item stored procedures
```

## 🗄️ Database Schema

### Tables
1. **ChecklistSchemas** - Store categories (e.g., "Signature Stores")
2. **ChecklistSections** - Audit sections (13 defaults: Food Storage, Fridges, etc.)
3. **ChecklistTemplates** - Master templates
4. **TemplateSections** - Many-to-many: templates ↔ sections
5. **ChecklistTemplateItems** - Individual checklist questions
6. **UserRoles** - User role assignments (includes SuperAuditor)

### Default Sections (13)
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

## 🚀 Installation

### 1. Database Setup
```bash
# Run database schema
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/schema-checklist-template-v2.sql

# Run stored procedures
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-schemas.sql
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-sections.sql
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-templates.sql
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-template-items.sql
```

### 2. Environment Configuration
Add to `.env`:
```env
# SQL Server Configuration
SQL_SERVER=YOUR_SERVER
SQL_DATABASE=FoodSafetyDB
SQL_USER=YOUR_USERNAME
SQL_PASSWORD=YOUR_PASSWORD

# API Port
CHECKLIST_API_PORT=3005

# Session Secret
SESSION_SECRET=your-secure-secret-key-change-in-production
```

### 3. Install Dependencies
```bash
npm install
```

## 🎮 Usage

### Start API Server
```bash
npm run checklist-template-api
```

The server will start on port 3005 (or your configured port).

### Run Tests
```bash
npm run test-checklist-template
```

## 📡 API Reference

### Base URL
```
http://localhost:3005
```

### Authentication
All endpoints require:
- Valid session (session-based authentication)
- Admin or SuperAuditor role

---

## 📋 Schemas API

### Get All Schemas
```http
GET /api/schemas
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "SchemaID": 1,
      "SchemaName": "Signature Stores",
      "Description": "Full-service stores with complete audit",
      "IsActive": true,
      "CreatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### Create Schema
```http
POST /api/schemas
Content-Type: application/json

{
  "schemaName": "Express Stores",
  "description": "Quick-service stores with simplified audit"
}
```

### Update Schema
```http
PUT /api/schemas/:id
Content-Type: application/json

{
  "schemaName": "Updated Name",
  "description": "Updated description"
}
```

### Deactivate Schema
```http
DELETE /api/schemas/:id
```

---

## 📑 Sections API

### Get All Sections
```http
GET /api/sections
```

### Get Section by ID
```http
GET /api/sections/:id
```

### Create Section
```http
POST /api/sections
Content-Type: application/json

{
  "sectionName": "Food Safety Culture",
  "emoji": "🏛️",
  "sectionNumber": 12
}
```

---

## 📝 Templates API

### Get All Templates
```http
GET /api/templates
```

### Get Template (Basic)
```http
GET /api/templates/:id
```

### Get Template (Full with Items)
```http
GET /api/templates/:id/full
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templateId": 1,
    "templateName": "Signature Store Audit",
    "schemaName": "Signature Stores",
    "sections": [
      {
        "sectionId": 1,
        "sectionName": "Food Storage & Dry Storage",
        "sectionNumber": 1,
        "emoji": "🥫",
        "items": [
          {
            "itemId": 1,
            "referenceValue": "1.1",
            "title": "Dry storage area is clean and organized",
            "coeff": 2,
            "answer": "Yes,Partially,No,NA",
            "cr": "Storage areas must be maintained in sanitary condition"
          }
        ]
      }
    ]
  }
}
```

### Create Template
```http
POST /api/templates
Content-Type: application/json

{
  "templateName": "Signature Store Audit",
  "schemaId": 1,
  "description": "Complete audit for signature stores"
}
```

### Add Section to Template
```http
POST /api/templates/:id/sections
Content-Type: application/json

{
  "sectionId": 1
}
```

### Remove Section from Template
```http
DELETE /api/templates/:id/sections/:sectionId
```

---

## 🔧 Items API

### Get All Items for Template
```http
GET /api/templates/:templateId/items
GET /api/templates/:templateId/items?sectionId=1  # Filter by section
```

### Get Items Grouped by Section
```http
GET /api/templates/:templateId/items/grouped
```

### Get Next Reference Value
```http
GET /api/templates/:templateId/sections/:sectionId/next-reference
```

**Response:**
```json
{
  "success": true,
  "nextReferenceValue": "1.5"
}
```

### Add Single Item
```http
POST /api/templates/:templateId/items
Content-Type: application/json

{
  "sectionId": 1,
  "referenceValue": "1.1",
  "title": "Dry storage area is clean and organized",
  "coeff": 2,
  "answer": "Yes,Partially,No,NA",
  "cr": "Storage areas must be maintained in sanitary condition"
}
```

### Batch Add Items
```http
POST /api/templates/:templateId/items/batch
Content-Type: application/json

{
  "sectionId": 1,
  "items": [
    {
      "ReferenceValue": "1.1",
      "Title": "Storage area cleanliness",
      "Coeff": 2,
      "Answer": "Yes,Partially,No,NA",
      "cr": "Storage must be clean"
    },
    {
      "ReferenceValue": "1.2",
      "Title": "Proper labeling",
      "Coeff": 4,
      "Answer": "Yes,No,NA",
      "cr": "All items must be labeled"
    }
  ]
}
```

### Update Item
```http
PUT /api/items/:itemId
Content-Type: application/json

{
  "referenceValue": "1.1",
  "title": "Updated title",
  "coeff": 4,
  "answer": "Yes,No,NA",
  "cr": "Updated criterion"
}
```

### Delete Item
```http
DELETE /api/items/:itemId
```

---

## 🔑 Item Fields Reference

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `ReferenceValue` | string | Section.Item format | "1.1", "2.5" |
| `Title` | string | Question text | "Storage area is clean" |
| `Coeff` | number | Weight/coefficient | 2, 4 |
| `Answer` | string | Allowed choices (comma-separated) | "Yes,Partially,No,NA" |
| `cr` | string | Criterion/requirement text | "Must maintain sanitary condition" |

---

## 🎨 Reference Value Format

Reference values follow the pattern: `{SectionNumber}.{ItemNumber}`

Examples:
- Section 1: `1.1`, `1.2`, `1.3`... `1.9`, `1.10`, `1.11`
- Section 2: `2.1`, `2.2`, `2.3`... `2.9`, `2.10`, `2.11`

**Note:** NO zero-padding (use `1.10` not `1.010`)

---

## 🔒 Authorization

### Roles with Access
- ✅ **Admin**: Full access to all operations
- ✅ **SuperAuditor**: Full access to all operations

### Middleware Chain
```javascript
requireAuth → requireChecklistAccess
```

1. `requireAuth`: Validates session exists
2. `requireChecklistAccess`: Checks user has Admin or SuperAuditor role

---

## 🧪 Testing

### Automated Test Suite
```bash
npm run test-checklist-template
```

**Tests include:**
- ✅ Schema CRUD operations
- ✅ Section CRUD operations
- ✅ Template CRUD operations
- ✅ Item CRUD operations (single + batch)
- ✅ Full template retrieval with nested data
- ✅ Cleanup and deactivation

### Manual Testing with curl

**Create Schema:**
```bash
curl -X POST http://localhost:3005/api/schemas \
  -H "Content-Type: application/json" \
  -d '{"schemaName": "Test Schema", "description": "Test description"}'
```

**Create Template:**
```bash
curl -X POST http://localhost:3005/api/templates \
  -H "Content-Type: application/json" \
  -d '{"templateName": "Test Template", "schemaId": 1, "description": "Test"}'
```

---

## 📊 Workflow Example

### Creating a Complete Template

**1. Create a Schema**
```javascript
POST /api/schemas
{
  "schemaName": "Signature Stores",
  "description": "Full-service stores"
}
// Response: { schemaId: 1 }
```

**2. Get Available Sections**
```javascript
GET /api/sections
// Returns 13 default sections
```

**3. Create Template**
```javascript
POST /api/templates
{
  "templateName": "Signature Store Audit",
  "schemaId": 1,
  "description": "Complete audit template"
}
// Response: { templateId: 10 }
```

**4. Add Sections to Template**
```javascript
POST /api/templates/10/sections
{ "sectionId": 1 }  // Food Storage

POST /api/templates/10/sections
{ "sectionId": 2 }  // Fridges
```

**5. Add Items to Each Section**
```javascript
POST /api/templates/10/items/batch
{
  "sectionId": 1,
  "items": [
    {
      "ReferenceValue": "1.1",
      "Title": "Storage area is clean",
      "Coeff": 2,
      "Answer": "Yes,Partially,No,NA",
      "cr": "Must be maintained"
    },
    {
      "ReferenceValue": "1.2",
      "Title": "Items properly labeled",
      "Coeff": 4,
      "Answer": "Yes,No,NA",
      "cr": "Labels required"
    }
  ]
}
```

**6. Retrieve Complete Template**
```javascript
GET /api/templates/10/full
// Returns complete nested structure
```

---

## 🛠️ Troubleshooting

### Connection Issues
```bash
# Test SQL connection
node -e "const SQLConnector = require('./src/sql-connector'); new SQLConnector().connect().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e.message))"
```

### Permission Issues
Check user has correct role:
```sql
SELECT * FROM UserRoles WHERE UserID = YOUR_USER_ID;
```

Add SuperAuditor role:
```sql
INSERT INTO UserRoles (UserID, RoleName)
VALUES (YOUR_USER_ID, 'SuperAuditor');
```

### Port Already in Use
Change port in `.env`:
```env
CHECKLIST_API_PORT=3006
```

---

## 📈 Performance Notes

- **Batch Operations**: Use `/items/batch` endpoint for adding 10+ items
- **Pagination**: Not yet implemented (future enhancement)
- **Caching**: Not yet implemented (future enhancement)

---

## 🔮 Future Enhancements

- [ ] Web UI for template creation
- [ ] Template cloning/duplication
- [ ] Version control for templates
- [ ] Import/export templates (JSON)
- [ ] Template preview mode
- [ ] Audit trail for all changes
- [ ] Bulk template operations
- [ ] Template search and filtering

---

## 📝 License
Internal use only - Spinneys Food Safety System

## 👥 Support
For issues or questions, contact the Food Safety IT team.

---

## 🎉 Quick Start Example

```bash
# 1. Setup database
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/schema-checklist-template-v2.sql

# 2. Start API
npm run checklist-template-api

# 3. Run tests
npm run test-checklist-template

# 4. Access API docs
curl http://localhost:3005/api
```

**System is now ready for use! 🚀**
