# 📋 Checklist Management System

A complete, modular system for creating and managing custom audit checklists in the Food Safety application.

## 🎯 Overview

This module allows auditors and administrators to:
- Create custom checklists with metadata (name, store category, schema)
- Add checklist items with reference values, titles, coefficients, and guidance
- Calculate scores based on audit responses
- Manage checklists through REST API or web interface

## 📁 Module Structure

```
ReportGenerator/
├── src/
│   ├── checklist-service.js      # Core business logic
│   └── sql-connector.js           # Database connection (shared)
├── sql/
│   └── schema-checklist-tables.sql # Database schema
├── checklist-api.js               # REST API server (Express)
├── checklist-manager.html         # Web UI for management
├── test-checklist-system.js       # Complete test suite
└── README-CHECKLIST.md            # This file
```

## 🗄️ Database Schema

### Tables

#### `Checklists`
Stores checklist templates with metadata.

| Column | Type | Description |
|--------|------|-------------|
| ChecklistID | INT (PK) | Auto-increment primary key |
| ChecklistName | NVARCHAR(200) | Name of the checklist |
| StoreCategory | NVARCHAR(100) | Category (Happy Stores, Signature Stores, etc.) |
| Description | NVARCHAR(MAX) | Optional description |
| IsActive | BIT | Active status (soft delete) |
| CreatedBy | NVARCHAR(100) | Creator name |
| CreatedDate | DATETIME | Creation timestamp |
| ModifiedBy | NVARCHAR(100) | Last modifier |
| ModifiedDate | DATETIME | Last modification timestamp |

#### `ChecklistItems`
Stores individual checklist items with scoring information.

| Column | Type | Description |
|--------|------|-------------|
| ItemID | INT (PK) | Auto-increment primary key |
| ChecklistID | INT (FK) | Parent checklist reference |
| ReferenceValue | NVARCHAR(20) | Code (e.g., 1.1, 1.2, 2.3) |
| Title | NVARCHAR(MAX) | The control to check |
| Coeff | INT | Weight/importance (2, 4, etc.) |
| Answer | NVARCHAR(100) | Allowed answers: 'Yes,Partially,No,NA' |
| Cr | NVARCHAR(MAX) | Guidance/corrective actions |
| SortOrder | INT | Custom ordering (optional) |
| CreatedDate | DATETIME | Creation timestamp |
| ModifiedDate | DATETIME | Last modification timestamp |

### Stored Procedures

- `sp_CreateChecklist` - Create new checklist
- `sp_AddChecklistItem` - Add item to checklist
- `sp_GetChecklists` - Get all checklists
- `sp_GetChecklistById` - Get checklist with items
- `sp_GetChecklistsByCategory` - Get checklists by store category
- `sp_UpdateChecklistItem` - Update checklist item
- `sp_DeleteChecklistItem` - Delete checklist item
- `sp_DeactivateChecklist` - Deactivate checklist (soft delete)

## 🚀 Installation & Setup

### 1. Deploy Database Schema

Run the SQL schema script against your `FoodSafetyDB` database:

```bash
# Using sqlcmd
sqlcmd -S YOUR_SERVER -d FoodSafetyDB -i sql/schema-checklist-tables.sql

# Or execute in SQL Server Management Studio (SSMS)
```

### 2. Configure Environment Variables

Ensure your `.env` file has SQL Server credentials:

```env
SQL_SERVER=your_server_name
SQL_DATABASE=FoodSafetyDB
SQL_USER=your_username          # Optional for Windows Auth
SQL_PASSWORD=your_password      # Optional for Windows Auth
SQL_ENCRYPT=false
SQL_TRUST_CERT=true
CHECKLIST_API_PORT=3003         # Optional, defaults to 3003
```

### 3. Install Dependencies

Dependencies are already in package.json:

```bash
npm install
# mssql, express, cors are already installed
```

### 4. Test the System

```bash
# Run comprehensive test suite
node test-checklist-system.js
```

## 📡 API Usage

### Start API Server

```bash
node checklist-api.js
```

Server runs on `http://localhost:3003` (or custom port from env)

### API Endpoints

#### Health Check
```http
GET /health
```

#### Database Connection Test
```http
GET /api/test-connection
```

#### Create Checklist
```http
POST /api/checklists
Content-Type: application/json

{
  "checklistName": "Food Storage & Dry Storage",
  "storeCategory": "Happy Stores",
  "description": "Standard checklist for food storage compliance",
  "createdBy": "Admin User"
}
```

#### Get All Checklists
```http
GET /api/checklists?activeOnly=true
```

#### Get Checklist by ID
```http
GET /api/checklists/:id
```

#### Get Checklists by Category
```http
GET /api/checklists/category/Happy%20Stores
```

#### Add Item to Checklist
```http
POST /api/checklists/:id/items
Content-Type: application/json

{
  "referenceValue": "1.1",
  "title": "Properly stored chemicals",
  "coeff": 4,
  "answer": "Yes,Partially,No,NA",
  "cr": "Ensure all chemicals are stored properly...",
  "sortOrder": 1
}
```

#### Add Multiple Items (Batch)
```http
POST /api/checklists/:id/items/batch
Content-Type: application/json

{
  "items": [
    {
      "referenceValue": "1.1",
      "title": "Item 1",
      "coeff": 4,
      "answer": "Yes,Partially,No,NA",
      "cr": "Guidance text"
    },
    {
      "referenceValue": "1.2",
      "title": "Item 2",
      "coeff": 2,
      "answer": "Yes,Partially,No,NA",
      "cr": "Guidance text"
    }
  ]
}
```

#### Update Item
```http
PUT /api/items/:itemId
Content-Type: application/json

{
  "title": "Updated title",
  "coeff": 6
}
```

#### Delete Item
```http
DELETE /api/items/:itemId
```

#### Deactivate Checklist
```http
DELETE /api/checklists/:id
```

#### Calculate Score
```http
POST /api/checklists/:id/calculate-score
Content-Type: application/json

{
  "responses": [
    { "referenceValue": "1.1", "selectedChoice": "Yes" },
    { "referenceValue": "1.2", "selectedChoice": "Partially" },
    { "referenceValue": "1.3", "selectedChoice": "No" },
    { "referenceValue": "1.4", "selectedChoice": "NA" }
  ]
}
```

## 🎨 Web UI Usage

### Start Web Interface

1. Start the API server:
   ```bash
   node checklist-api.js
   ```

2. Open `checklist-manager.html` in a web browser:
   ```bash
   # Windows
   start checklist-manager.html
   
   # Or open directly: http://localhost:3003 (if served)
   ```

### Features

- ✅ **Create Checklist** - Set name, category, and description
- ✅ **View All Checklists** - Browse all checklists with item counts
- ✅ **Add Items** - Add individual items with reference values, titles, coefficients
- ✅ **Batch Add** - Add multiple items at once
- ✅ **Edit Items** - Update item properties
- ✅ **Delete Items** - Remove items from checklist
- ✅ **Real-time Updates** - See changes immediately

## 🧮 Scoring Logic

The system uses a coefficient-based scoring system:

### Formula

```javascript
// For each item:
switch (selectedChoice) {
    case 'Yes':       itemScore = coeff × 1.0
    case 'Partially': itemScore = coeff × 0.5
    case 'No':        itemScore = 0
    case 'NA':        itemScore = 0 (excluded from maxScore)
}

totalScore = sum(allItemScores)
maxScore = sum(allCoefficients) - sum(NACoefficients)
percentage = (totalScore / maxScore) × 100
```

### Example

```javascript
const responses = [
  { referenceValue: '1.1', selectedChoice: 'Yes' },      // Coeff: 4 → Score: 4
  { referenceValue: '1.2', selectedChoice: 'Partially' }, // Coeff: 4 → Score: 2
  { referenceValue: '1.3', selectedChoice: 'No' },        // Coeff: 4 → Score: 0
  { referenceValue: '1.4', selectedChoice: 'NA' }         // Coeff: 2 → Score: 0 (excluded)
];

// Result:
// totalScore = 6
// maxScore = 12 (4+4+4, excluding NA)
// percentage = 50%
```

## 📦 Programmatic Usage

### Node.js Example

```javascript
const ChecklistService = require('./src/checklist-service');

async function example() {
    const service = new ChecklistService();
    
    try {
        // Create checklist
        const result = await service.createChecklist({
            checklistName: 'My Checklist',
            storeCategory: 'Happy Stores',
            description: 'Test checklist',
            createdBy: 'Admin'
        });
        
        const checklistId = result.checklistId;
        
        // Add items
        await service.addChecklistItem({
            checklistId,
            referenceValue: '1.1',
            title: 'Check item',
            coeff: 4,
            answer: 'Yes,Partially,No,NA',
            cr: 'Guidance text'
        });
        
        // Get checklist with items
        const checklist = await service.getChecklistById(checklistId);
        console.log(checklist);
        
        // Calculate score
        const score = service.calculateScore(
            [{ referenceValue: '1.1', selectedChoice: 'Yes' }],
            checklist.checklist.items
        );
        console.log(`Score: ${score.percentage}%`);
        
    } finally {
        await service.close();
    }
}

example();
```

## 🔗 Integration with Existing System

This module integrates seamlessly with the existing Food Safety system:

### SharePoint Integration

Checklists can be used to create section master lists:

```javascript
// Export checklist to SharePoint
const checklist = await checklistService.getChecklistById(checklistId);

for (const item of checklist.checklist.items) {
    await sp.list('Food Storage & Dry Storage').add({
        Title: item.Title,
        ReferenceValue: item.ReferenceValue,
        Coeff: item.Coeff,
        Answer: item.Answer,
        cr: item.Cr
    });
}
```

### Audit Document Creation

Use checklists as templates for new audits:

```javascript
// Create new audit from checklist
const checklist = await checklistService.getChecklistById(checklistId);
const documentNumber = generateDocumentNumber();

// Create FS Survey entry
await sp.fsSurvey.add({
    Title: checklist.checklist.ChecklistName,
    DocumentNumber: documentNumber,
    StoreCategory: checklist.checklist.StoreCategory
});

// Initialize responses
const items = checklist.checklist.items.map(item => ({
    Title: item.Title,
    ReferenceValue: item.ReferenceValue,
    Coeff: item.Coeff,
    Answer: item.Answer,
    cr: item.Cr,
    SelectedChoice: '',
    Value: null
}));

await sp.list('Survey Responses List').add({
    Title: 'Food Storage',
    DocumentNumber: documentNumber,
    ResponseJSON: JSON.stringify(items)
});
```

## 🧪 Testing

### Run All Tests

```bash
node test-checklist-system.js
```

### Test Coverage

- ✅ Database connection
- ✅ Create checklist
- ✅ Add single item
- ✅ Add multiple items (batch)
- ✅ Get all checklists
- ✅ Get checklist by ID
- ✅ Get checklists by category
- ✅ Calculate score
- ✅ Update item
- ✅ Delete item
- ✅ Deactivate checklist

## 🛠️ Troubleshooting

### Connection Issues

```bash
# Test database connection
node -e "require('./src/checklist-service').testConnection()"
```

### Port Already in Use

Change port in `.env`:
```env
CHECKLIST_API_PORT=3004
```

### CORS Issues

If accessing from different domain, update CORS settings in `checklist-api.js`:

```javascript
app.use(cors({
    origin: 'https://your-domain.com',
    credentials: true
}));
```

## 📊 Store Categories

Pre-defined categories:
- Happy Stores
- Signature Stores
- Premium Stores
- Express Stores
- All Stores

Add custom categories by updating the dropdown in `checklist-manager.html`.

## 🔒 Security Considerations

- ✅ SQL injection prevention (parameterized queries)
- ✅ Input validation on all endpoints
- ✅ Soft delete (IsActive flag) preserves data
- ✅ Foreign key constraints maintain referential integrity
- ⚠️ Add authentication middleware for production use

## 📝 Future Enhancements

- [ ] User authentication & authorization
- [ ] Checklist versioning
- [ ] Import/export checklist templates
- [ ] Duplicate checklist functionality
- [ ] Audit trail for all changes
- [ ] Advanced search & filtering
- [ ] Mobile-responsive UI improvements
- [ ] Real-time collaboration

## 📄 License

Part of the Food Safety Report Generator system.

## 👥 Support

For issues or questions, contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** November 25, 2025  
**Status:** ✅ Production Ready
