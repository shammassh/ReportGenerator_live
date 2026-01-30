# 🎯 Checklist Template System - Quick Reference

## 🚀 1-Minute Overview

**What it does**: Allows Admin/SuperAuditor to create dynamic checklist templates  
**Technology**: Node.js + Express + SQL Server  
**Port**: 3005  
**Status**: ✅ Production Ready  

---

## 📁 File Structure

```
checklist-template-api.js              ← Main API server
│
├── sql/
│   ├── schema-checklist-template-v2.sql         ← Database tables
│   └── stored-procedures/
│       ├── sp-schemas.sql              (5 procedures)
│       ├── sp-sections.sql             (5 procedures)
│       ├── sp-templates.sql            (7 procedures)
│       └── sp-template-items.sql       (7 procedures)
│
├── src/checklist/
│   ├── services/                       ← Business Logic
│   │   ├── schema-service.js
│   │   ├── section-service.js
│   │   ├── template-service.js
│   │   └── item-service.js
│   │
│   ├── routes/                         ← API Endpoints
│   │   ├── schema-routes.js
│   │   ├── section-routes.js
│   │   ├── template-routes.js
│   │   └── item-routes.js
│   │
│   └── middleware/
│       └── auth-check.js               ← Security
│
├── test-checklist-template-system.js   ← Tests
├── README-CHECKLIST-TEMPLATE.md        ← Full Docs
├── DEPLOYMENT-GUIDE-CHECKLIST-TEMPLATE.md
└── CHECKLIST-TEMPLATE-COMPLETE-SUMMARY.md
```

---

## 🗄️ Database (6 Tables)

```
ChecklistSchemas          ← Store categories ("Signature", "Express")
    ↓
ChecklistTemplates        ← Master templates
    ↓
TemplateSections          ← Template ↔ Section mapping
    ↓
ChecklistSections         ← 13 default audit sections
ChecklistTemplateItems    ← Individual checklist items
UserRoles                 ← Admin + SuperAuditor
```

---

## 🎯 Workflow

```
1. Create Schema
   POST /api/schemas
   { "schemaName": "Signature Stores" }
   
2. Get Sections
   GET /api/sections
   → Returns 13 default sections
   
3. Create Template
   POST /api/templates
   { "templateName": "Signature Audit", "schemaId": 1 }
   
4. Add Section to Template
   POST /api/templates/1/sections
   { "sectionId": 1 }
   
5. Add Items (Batch)
   POST /api/templates/1/items/batch
   {
     "sectionId": 1,
     "items": [
       { "ReferenceValue": "1.1", "Title": "...", "Coeff": 2, ... }
     ]
   }
   
6. Get Complete Template
   GET /api/templates/1/full
   → Returns nested structure with all items
```

---

## 📡 API Endpoints (30+)

### Schemas
```
GET    /api/schemas           List all
GET    /api/schemas/:id       Get by ID
POST   /api/schemas           Create
PUT    /api/schemas/:id       Update
DELETE /api/schemas/:id       Deactivate
```

### Sections
```
GET    /api/sections          List all
GET    /api/sections/:id      Get by ID
POST   /api/sections          Create
PUT    /api/sections/:id      Update
DELETE /api/sections/:id      Deactivate
```

### Templates
```
GET    /api/templates                      List all
GET    /api/templates/:id                  Get basic
GET    /api/templates/:id/full             Get with items
GET    /api/templates/:id/sections         Get sections
POST   /api/templates                      Create
POST   /api/templates/:id/sections         Add section
DELETE /api/templates/:id/sections/:sid    Remove section
PUT    /api/templates/:id                  Update
DELETE /api/templates/:id                  Deactivate
```

### Items
```
GET    /api/templates/:tid/items                    List all
GET    /api/templates/:tid/items/grouped            By section
GET    /api/items/:id                               Get by ID
GET    /api/templates/:tid/sections/:sid/next-ref   Auto-number
POST   /api/templates/:tid/items                    Add single
POST   /api/templates/:tid/items/batch              Batch add
PUT    /api/items/:id                               Update
DELETE /api/items/:id                               Delete
```

### System
```
GET    /health                Health check
GET    /api                   Documentation
```

---

## 🔑 Item Structure

```javascript
{
  "ReferenceValue": "1.1",      // Section.Item (1.1, 1.2, 2.1...)
  "Title": "Storage clean",     // Question text
  "Coeff": 2,                   // Weight (2 or 4)
  "Answer": "Yes,Partially,No,NA", // Allowed choices
  "cr": "Must be clean"         // Criterion/requirement
}
```

---

## 🥫 13 Default Sections

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

---

## 🚀 Quick Commands

```bash
# Start API
npm run checklist-template-api

# Run tests
npm run test-checklist-template

# Health check
curl http://localhost:3005/health

# API docs
curl http://localhost:3005/api

# Database setup
sqlcmd -S SERVER -d FoodSafetyDB -i sql/schema-checklist-template-v2.sql
sqlcmd -S SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-schemas.sql
sqlcmd -S SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-sections.sql
sqlcmd -S SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-templates.sql
sqlcmd -S SERVER -d FoodSafetyDB -i sql/stored-procedures/sp-template-items.sql
```

---

## 🔐 Security

**Authentication**: Session-based  
**Authorization**: Admin + SuperAuditor only  
**Middleware Chain**: `requireAuth → requireChecklistAccess`  

```sql
-- Grant access
INSERT INTO UserRoles (UserID, RoleName)
VALUES (1, 'SuperAuditor');
```

---

## 🧪 Testing

```bash
npm run test-checklist-template
```

**Tests:**
- ✅ Schema CRUD
- ✅ Section CRUD
- ✅ Template CRUD
- ✅ Item CRUD (single + batch)
- ✅ Full template retrieval
- ✅ Cleanup

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| **Files Created** | 20 |
| **Database Tables** | 6 |
| **Stored Procedures** | 24 |
| **Service Modules** | 4 |
| **Route Modules** | 4 |
| **API Endpoints** | 30+ |
| **Lines of Code** | 5,100+ |
| **Default Sections** | 13 |
| **Test Scenarios** | 12 |

---

## 🆘 Troubleshooting

### Can't connect to database
```bash
# Test connection
node -e "const SQLConnector = require('./src/sql-connector'); new SQLConnector().connect().then(() => console.log('✅')).catch(e => console.error('❌', e.message))"
```

### Port already in use
```env
# Change in .env
CHECKLIST_API_PORT=3006
```

### Unauthorized error
```sql
-- Check user role
SELECT * FROM UserRoles WHERE UserID = YOUR_ID;

-- Add role
INSERT INTO UserRoles (UserID, RoleName) VALUES (YOUR_ID, 'SuperAuditor');
```

---

## 📚 Documentation Links

- **Full API Docs**: [README-CHECKLIST-TEMPLATE.md](./README-CHECKLIST-TEMPLATE.md)
- **Deployment**: [DEPLOYMENT-GUIDE-CHECKLIST-TEMPLATE.md](./DEPLOYMENT-GUIDE-CHECKLIST-TEMPLATE.md)
- **Summary**: [CHECKLIST-TEMPLATE-COMPLETE-SUMMARY.md](./CHECKLIST-TEMPLATE-COMPLETE-SUMMARY.md)
- **Progress**: [BUILD-PROGRESS.md](./BUILD-PROGRESS.md)

---

## ✅ Deployment Checklist

- [ ] Database schema installed
- [ ] Stored procedures installed
- [ ] .env configured (SQL credentials, port, session secret)
- [ ] User roles assigned (SuperAuditor)
- [ ] Tests passing
- [ ] API running on port 3005
- [ ] Health check responding

---

## 🎉 Status

**✅ PRODUCTION READY**

All components built, tested, and documented.

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Support**: Food Safety IT Team
