# SharePoint Report Generator

A Node.js application that connects to SharePoint Online using PnP PowerShell, reads survey and operational data from lists, and generates comprehensive compliance reports.

## 🎯 Features

- ✅ **SharePoint Online Integration**: Connect using PnP PowerShell with modern authentication
- ✅ **Survey Data Analysis**: Parse complex JSON survey responses and generate compliance reports
- ✅ **Multi-Format Reports**: Generate JSON summary, detailed analysis, and CSV reports
- ✅ **Real-Time Data**: Process live operational data from SharePoint lists
- ✅ **Compliance Tracking**: Calculate compliance rates and identify priority issues

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your SharePoint Online credentials:

**Option A: Username/Password (Development)**
```
SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/sites/your-site
SHAREPOINT_USERNAME=your-username@your-tenant.com
SHAREPOINT_PASSWORD=your-password
```

**Option B: App Registration (Production - Recommended)**
```
SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/sites/your-site
SHAREPOINT_CLIENT_ID=your-app-client-id
SHAREPOINT_CLIENT_SECRET=your-client-secret
SHAREPOINT_TENANT_ID=your-tenant-id
```

3. Test the proof of concept:
```bash
npm run test-poc
```

4. Run the application:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Project Structure

- `index.js` - Main application entry point
- `src/sharepoint-connector.js` - SharePoint connection and data retrieval
- `src/json-parser.js` - JSON parsing utilities
- `src/report-generator.js` - Report generation logic
- `config/` - Configuration files
- `reports/` - Generated reports output

## Configuration

The application can be configured through environment variables or the config files in the `config/` directory.

## Usage

The application will:
1. Connect to your SharePoint site
2. Retrieve all lists (or specified lists)
3. Extract JSON data from configured columns
4. Parse and correlate data using primary keys
5. Generate comprehensive reports

## Next Steps

- Configure specific lists to process
- Define JSON column mappings
- Set up primary key relationships
- Customize report output formats