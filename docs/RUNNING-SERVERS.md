# 🚀 Running the Food Safety Dashboard System

## Overview
The Food Safety Dashboard system consists of two servers:
1. **Dashboard Server** (Port 3000) - Frontend UI and report generation
2. **Action Plan API** (Port 3001) - Backend for saving action plans to MSSQL

## Quick Start

### Option 1: One-Command Startup (Recommended)
```powershell
npm run dev
```
This will:
- ✅ Check SQL Server status
- ✅ Start Action Plan API on port 3001
- ✅ Start Dashboard Server on port 3000
- ✅ Open the dashboard in your browser

### Option 2: Start Servers Individually

**Terminal 1 - Action Plan API (Backend):**
```powershell
npm run action-plan-api
```

**Terminal 2 - Dashboard (Frontend):**
```powershell
npm run dashboard
```

### Option 3: Manual PowerShell Script
```powershell
.\start-servers.ps1
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (User)                          │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             ▼                                ▼
┌────────────────────────┐       ┌────────────────────────────┐
│  Dashboard Server      │       │  Action Plan API           │
│  Port: 3000            │       │  Port: 3001                │
│                        │       │                            │
│  - UI Dashboard        │◄──────┤  - Save action plans       │
│  - Generate reports    │       │  - Retrieve saved data     │
│  - List documents      │       │  - Summary statistics      │
└────────┬───────────────┘       └────────┬───────────────────┘
         │                                │
         ▼                                ▼
┌─────────────────────┐         ┌─────────────────────────────┐
│  SharePoint Online  │         │  SQL Server (MSSQL)         │
│  - Audit Data       │         │  - ActionPlanResponses      │
│  - Survey Lists     │         │  - ActionPlanAuditLog       │
└─────────────────────┘         └─────────────────────────────┘
```

## Access Points

Once both servers are running:

### Dashboard Server (Port 3000)
- **Dashboard UI**: http://localhost:3000/dashboard
- **API Documentation**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

### Action Plan API (Port 3001)
- **Health Check**: http://localhost:3001/health
- **Save Action Plan**: POST http://localhost:3001/api/action-plan/save
- **Get Action Plan**: GET http://localhost:3001/api/action-plan/:documentNumber

## Features by Server

### Dashboard Server Features
- 📊 View all audit documents
- 📝 Generate audit reports (HTML with embedded images)
- 🎯 Generate action plan reports
- 📋 Browse existing reports
- 🔍 Search and filter documents

### Action Plan API Features
- 💾 Save action plan responses to database
- 📖 Retrieve saved action plans
- 📈 Get summary statistics
- 🔍 Audit trail of all changes
- 🔄 Update existing responses

## Workflow

### 1. Generate an Action Plan Report
```bash
# Via Dashboard UI
http://localhost:3000/dashboard
# Click "Generate Action Plan" for any document

# Or via CLI
node generate-action-plan-report.js GMRL-FSACR-0001
```

### 2. Fill Out Action Plan
- Open the generated HTML report
- Fill in:
  - Action Taken
  - Deadline
  - Person in Charge
  - Status
  - Upload Pictures

### 3. Save to Database
- Click "💾 Save Data" button in the report
- Data is sent to Action Plan API (port 3001)
- Saved to MSSQL database
- Backup JSON file is downloaded

### 4. Verify Saved Data
```sql
SELECT * FROM ActionPlanResponses 
WHERE DocumentNumber = 'GMRL-FSACR-0001'
ORDER BY Priority, ReferenceValue;
```

## Environment Variables

Create a `.env` file with:

```env
# SharePoint Configuration
SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/operations
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_SECRET=your-client-secret

# SQL Server Configuration
DB_SERVER=localhost
DB_DATABASE=FoodSafetyActionPlan
DB_USER=sa
DB_PASSWORD=your-password
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Server Ports (optional)
DASHBOARD_PORT=3000
ACTION_PLAN_API_PORT=3001
```

## Prerequisites

### Required Services
1. **SQL Server** - Must be running for action plan save functionality
   ```powershell
   # Check status
   Get-Service MSSQLSERVER
   
   # Start if needed
   Start-Service MSSQLSERVER
   ```

2. **SharePoint Access** - Azure AD app registration with permissions

3. **Node.js** - Version 16+ with native fetch support

### Database Setup
```powershell
# Create database and schema
sqlcmd -S localhost -i database/schema.sql
```

## Troubleshooting

### Port Already in Use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F
```

### SQL Server Not Running
```powershell
# Start SQL Server
Start-Service MSSQLSERVER

# Or run TCP/IP configuration
# See: database/ENABLE-TCPIP.md
```

### Cannot Save Action Plan
1. ✅ Verify Action Plan API is running (port 3001)
2. ✅ Check SQL Server is running
3. ✅ Verify database connection in `.env`
4. ✅ Check browser console for errors
5. ✅ Verify API health: http://localhost:3001/health

### CORS Errors
If opening HTML reports from file system:
```javascript
// In action-plan-api.js, update CORS config:
app.use(cors({
    origin: ['http://localhost:3000', 'file://']
}));
```

## API Endpoints

### Dashboard Server (3000)

#### GET /dashboard
Returns the main dashboard HTML UI

#### GET /api/documents
Returns list of all available audit documents
```json
{
  "success": true,
  "count": 56,
  "documents": [...]
}
```

#### POST /api/generate-report
Generate an audit report
```json
{
  "documentNumber": "GMRL-FSACR-0001",
  "reportType": "enhanced"
}
```

#### POST /api/generate-action-plan
Generate an action plan report
```json
{
  "documentNumber": "GMRL-FSACR-0001"
}
```

### Action Plan API (3001)

#### POST /api/action-plan/save
Save action plan data
```json
{
  "documentNumber": "GMRL-FSACR-0001",
  "updatedBy": "Store Manager",
  "actions": [...]
}
```

#### GET /api/action-plan/:documentNumber
Get saved action plan

#### GET /api/action-plan/:documentNumber/summary
Get summary statistics

## Logs

Both servers log to console:
- 📥 Incoming requests
- ✅ Successful operations
- ❌ Errors and failures
- 📊 Data processing

Monitor the server windows to track activity.

## Stopping Servers

### If started with `npm run dev`
Close the PowerShell windows that were opened

### If started individually
Press `Ctrl+C` in each terminal

## Development

### Hot Reload
For development with auto-restart:
```powershell
npm install -g nodemon

# Dashboard
nodemon dashboard-server.js

# Action Plan API
nodemon action-plan-api.js
```

### Testing
```powershell
# Test Action Plan API
curl http://localhost:3001/health

# Test Dashboard
curl http://localhost:3000/health
```

## Production Deployment

For production:
1. Use a process manager (PM2)
2. Enable HTTPS
3. Add authentication
4. Configure CORS properly
5. Use environment-specific configs
6. Enable SQL Server encryption
7. Set up proper logging
8. Implement rate limiting

## Support Files

- **Database Schema**: `database/schema.sql`
- **API Documentation**: `docs/ACTION-PLAN-API.md`
- **App Registration**: `docs/app-registration-setup.md`
- **SQL Setup**: `database/SETUP.md`

## Quick Commands Reference

```powershell
# Start both servers
npm run dev

# Start dashboard only
npm run dashboard

# Start action plan API only
npm run action-plan-api

# Generate action plan report
node generate-action-plan-report.js GMRL-FSACR-0001

# List available documents
node list-document-numbers.js

# Check SQL Server
Get-Service MSSQLSERVER
```

---

**Need Help?**
- Check server console logs
- Verify environment variables in `.env`
- Ensure SQL Server is running
- Test endpoints with `curl` or browser
- Check firewall settings for ports 3000 and 3001
