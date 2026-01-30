# Audit App - Folder Structure and Architecture

## Overview

The Audit App is a complete audit filling system that allows auditors to create, fill, and complete food safety audits. It integrates with the existing template system (AuditSchemas, AuditSections, AuditItems) and stores audit instances in SQL Server.

## Folder Structure

```
audit-app/
├── pages/                      # HTML Pages
│   ├── start-audit.html        # Start new audit form
│   ├── fill-audit.html         # Audit filling interface
│   └── store-management.html   # Store CRUD management
│
├── services/                   # Backend Services
│   ├── audit-service.js        # Audit CRUD operations
│   └── store-service.js        # Store CRUD operations
│
└── sql/                        # Database Scripts
    └── create-audit-tables.sql # AuditInstances, AuditResponses, AuditPictures
```

## Database Tables

### AuditInstances
Stores audit header information:
- `AuditID` (PK)
- `DocumentNumber` (e.g., GMRL-FSACR-0001)
- `StoreID`, `StoreCode`, `StoreName`
- `SchemaID` (FK to AuditSchemas)
- `AuditDate`, `TimeIn`, `TimeOut`
- `Cycle` (C1-C6), `Year`
- `Auditors`, `AccompaniedBy`
- `Status` (In Progress, Completed)
- `TotalScore`

### AuditResponses
Stores individual question responses:
- `ResponseID` (PK)
- `AuditID` (FK to AuditInstances)
- `SectionID`, `SectionNumber`, `SectionName`
- `ItemID`, `ReferenceValue`, `Title`, `Coeff`, `CR`
- `SelectedChoice` (Yes/Partially/No/NA)
- `Value` (calculated score)
- `Finding`, `Comment`, `CorrectiveAction`
- `Priority` (High/Medium/Low)
- `HasPicture`

### AuditPictures
Stores images for audit findings:
- `PictureID` (PK)
- `ResponseID` (FK)
- `AuditID`
- `FileName`, `FileData`, `ContentType`

## API Endpoints

### Store Management
- `GET /admin/store-management` - Store management page
- `GET /api/stores` - Get all stores
- `GET /api/stores/active` - Get active stores only
- `POST /api/stores` - Create store
- `PUT /api/stores/:storeId` - Update store
- `DELETE /api/stores/:storeId` - Delete store

### Audit Operations
- `GET /auditor/start-audit` - Start audit page
- `POST /api/audits/start` - Create new audit instance
- `GET /api/audits` - Get all audits
- `GET /api/audits/:auditId` - Get single audit with responses
- `PUT /api/audits/response/:responseId` - Update single response
- `POST /api/audits/:auditId/complete` - Complete audit and calculate scores
- `GET /auditor/fill-audit/:auditId` - Fill audit page

## User Flow

1. **Dashboard** → Click "Start Audit" button
2. **Start Audit Page** → Select store, date, cycle, auditors → Submit
3. **Fill Audit Page** → Answer questions section by section
4. **Complete** → Review and submit → Calculate final score
5. **Dashboard** → View completed audit

## Role Permissions

| Role | Start Audit | Fill Audit | Complete Audit | Store Management |
|------|-------------|------------|----------------|------------------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| SuperAuditor | ✅ | ✅ | ✅ | ✅ |
| Auditor | ✅ | ✅ | ✅ | ❌ |
| StoreManager | ❌ | ❌ | ❌ | ❌ |

## Cycle Options

| Code | Months |
|------|--------|
| C1 | January / February |
| C2 | March / April |
| C3 | May / June |
| C4 | July / August |
| C5 | September / October |
| C6 | November / December |

## Scoring Logic

```javascript
// Value calculation based on answer
switch (selectedChoice) {
    case 'Yes':       value = 1.0 * coeff; break;
    case 'Partially': value = 0.5 * coeff; break;
    case 'No':        value = 0; break;
    case 'NA':        value = null; break; // Excluded from score
}

// Section score = sum(values) / sum(coeffs) * 100
// Total score = sum(all values) / sum(all coeffs) * 100
```

## Integration Points

- **AuditSchemas** - Determines available audit templates per store
- **AuditSections** - Section definitions from template
- **AuditItems** - Question definitions from template
- **Stores** - Store list with schema assignment
