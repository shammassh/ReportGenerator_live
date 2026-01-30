# Action Plan API - MSSQL Integration

## Overview
The Action Plan API provides REST endpoints for saving and retrieving Food Safety Action Plan responses to/from MSSQL Server.

## Architecture

```
┌─────────────────────────────────────┐
│   HTML Action Plan Report          │
│   (generate-action-plan-report.js)  │
└────────────┬────────────────────────┘
             │ HTTP POST /api/action-plan/save
             ▼
┌─────────────────────────────────────┐
│   Action Plan API Server            │
│   (action-plan-api.js)              │
│   Port: 3001                        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Action Plan Service               │
│   (src/action-plan-service.js)      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   SQL Server Database               │
│   - ActionPlanResponses             │
│   - ActionPlanAuditLog              │
└─────────────────────────────────────┘
```

## Setup

### 1. Database Setup
Ensure SQL Server is running and the schema is created:

```powershell
# Check SQL Server status
Get-Service MSSQLSERVER

# Create database and schema
sqlcmd -S localhost -i database/schema.sql
```

### 2. Environment Variables
Add to `.env`:

```env
# SQL Server Configuration
DB_SERVER=localhost
DB_DATABASE=FoodSafetyActionPlan
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# API Configuration
ACTION_PLAN_API_PORT=3001
```

### 3. Install Dependencies
```bash
npm install
```

## Usage

### Start the API Server

```bash
# Using npm script
npm run action-plan-api

# Or directly
node action-plan-api.js
```

The server will start on `http://localhost:3001`

### Generate and Save Action Plans

1. **Generate an Action Plan Report:**
   ```bash
   node generate-action-plan-report.js GMRL-FSACR-0048
   ```

2. **Open the HTML report** in your browser (from `./reports/` folder)

3. **Fill in the action plan fields:**
   - Action Taken
   - Deadline
   - Person in Charge
   - Status
   - Upload Pictures (optional)

4. **Click "💾 Save Data" button**
   - Data is sent to API server
   - Saved to MSSQL database
   - Backup JSON file is downloaded
   - Confirmation message displayed

## API Endpoints

### Save Action Plan
**POST** `/api/action-plan/save`

Request body:
```json
{
  "documentNumber": "GMRL-FSACR-0048",
  "updatedBy": "Store Manager",
  "actions": [
    {
      "referenceValue": "2.26",
      "finding": "Temperature not within safe range",
      "section": "Fridges and Freezers",
      "priority": "Critical",
      "existingCorrectiveAction": "Adjust thermostat",
      "actionTaken": "Thermostat adjusted to 2°C, monitoring daily",
      "deadline": "2025-11-15",
      "personInCharge": "John Doe",
      "status": "In Progress",
      "pictures": ["fridge-temp-reading.jpg"]
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "message": "Successfully saved 1 actions",
  "data": {
    "success": true,
    "totalProcessed": 1,
    "successCount": 1,
    "errorCount": 0,
    "results": [...]
  }
}
```

### Get Action Plan Responses
**GET** `/api/action-plan/:documentNumber`

Response:
```json
{
  "success": true,
  "documentNumber": "GMRL-FSACR-0048",
  "actions": [
    {
      "ResponseID": 1,
      "DocumentNumber": "GMRL-FSACR-0048",
      "ReferenceValue": "2.26",
      "Section": "Fridges and Freezers",
      "Finding": "Temperature not within safe range",
      "Priority": "Critical",
      "ActionTaken": "Thermostat adjusted to 2°C",
      "Deadline": "2025-11-15",
      "PersonInCharge": "John Doe",
      "Status": "In Progress",
      "CreatedDate": "2025-11-11T10:30:00",
      "UpdatedDate": "2025-11-11T14:45:00"
    }
  ]
}
```

### Get Action Plan Summary
**GET** `/api/action-plan/:documentNumber/summary`

Response:
```json
{
  "success": true,
  "documentNumber": "GMRL-FSACR-0048",
  "summary": {
    "TotalActions": 5,
    "CriticalCount": 1,
    "HighCount": 2,
    "MediumCount": 2,
    "LowCount": 0,
    "CompletedCount": 0,
    "InProgressCount": 2,
    "PendingCount": 3
  }
}
```

### Health Check
**GET** `/health`

Response:
```json
{
  "status": "OK",
  "service": "Action Plan API",
  "timestamp": "2025-11-11T10:00:00.000Z"
}
```

## Database Schema

### ActionPlanResponses Table
```sql
CREATE TABLE ActionPlanResponses (
    ResponseID INT PRIMARY KEY IDENTITY(1,1),
    DocumentNumber NVARCHAR(50) NOT NULL,
    ReferenceValue NVARCHAR(20),
    Section NVARCHAR(100),
    Finding NVARCHAR(MAX),
    SuggestedAction NVARCHAR(MAX),
    Priority NVARCHAR(20),
    ActionTaken NVARCHAR(MAX),
    Deadline DATE,
    PersonInCharge NVARCHAR(100),
    Status NVARCHAR(50) DEFAULT 'Pending',
    PicturesPaths NVARCHAR(MAX),
    CreatedDate DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedDate DATETIME DEFAULT GETDATE(),
    UpdatedBy NVARCHAR(100)
);
```

### ActionPlanAuditLog Table
Tracks all changes to action plan responses for audit trail.

## Testing

### Test the API Server
```bash
# Start the server
npm run action-plan-api

# In another terminal, test health endpoint
curl http://localhost:3001/health
```

### Test Save Functionality
```bash
# Generate an action plan report
node generate-action-plan-report.js GMRL-FSACR-0048

# Open the HTML report and click Save Data button
```

### Verify Data in Database
```sql
-- Check saved responses
SELECT * FROM ActionPlanResponses 
WHERE DocumentNumber = 'GMRL-FSACR-0048';

-- Check audit log
SELECT * FROM ActionPlanAuditLog 
ORDER BY ChangedDate DESC;

-- Get summary
EXEC sp_GetActionPlanSummary 'GMRL-FSACR-0048';
```

## Features

### ✅ Implemented
- Save action plan responses to MSSQL
- Batch save multiple actions
- Retrieve saved responses
- Summary statistics
- Audit logging
- Update existing responses
- Fallback to JSON download if API unavailable
- Auto-save to localStorage (browser)

### 🚧 Future Enhancements
- File upload for pictures
- Email notifications for overdue actions
- Dashboard for action plan tracking
- Export to PDF/Excel
- Integration with SharePoint to update status

## Error Handling

The API includes comprehensive error handling:

1. **Connection Errors**: Falls back to JSON download
2. **Partial Saves**: Returns 207 status with details
3. **Validation Errors**: Returns 400 with message
4. **Server Errors**: Returns 500 with error details

## Security Considerations

- Enable CORS for specific origins in production
- Add authentication/authorization
- Validate and sanitize all inputs
- Use prepared statements (already implemented)
- Enable SQL Server encryption in production
- Implement rate limiting

## Troubleshooting

### API Server Not Starting
```bash
# Check if port 3001 is already in use
netstat -ano | findstr :3001

# Kill the process if needed
taskkill /PID <PID> /F

# Try a different port
set ACTION_PLAN_API_PORT=3002
npm run action-plan-api
```

### Cannot Save to Database
1. Check SQL Server is running
2. Verify database connection in `.env`
3. Check SQL Server TCP/IP is enabled
4. Verify schema is created
5. Check firewall settings

### CORS Errors
Add allowed origins in `action-plan-api.js`:
```javascript
app.use(cors({
    origin: ['http://localhost:3000', 'file://']
}));
```

## Logs

The API logs all operations:
- 📥 Incoming requests
- 💾 Save operations
- ✅ Successful operations
- ❌ Errors and failures

Monitor the console output when running the server.

## Support

For issues or questions:
1. Check the logs in the API server console
2. Verify database connectivity
3. Test with `curl` commands
4. Check browser console for client-side errors
