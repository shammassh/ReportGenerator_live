# Image Download Issue - Root Cause Analysis

## Problem
Images are not showing in the refactored report generator.

## Root Cause
The `SimpleGraphConnector.getListItems()` method doesn't properly handle the CImages structure.

### CImages is a DOCUMENT LIBRARY, not a List
- Document libraries store files with metadata
- Files have `FileRef` (server-relative path like "/operations/CImages/image.jpg")
- Files have `FileLeafRef` (filename)
- Files have metadata fields like `ImageID`, `Iscorrective`

### Current Issue
The refactored `data-service.js` calls:
```javascript
await this.connector.getListItems('CImages', {
    filter: `substringof('${documentNumber}', ImageID)`,
    expand: 'AttachmentFiles'  // ❌ Document libraries don't have AttachmentFiles!
});
```

This results in a 400 Bad Request error because:
1. Document libraries don't have AttachmentFiles
2. The query structure is wrong for a document library

## Original Working Code
```javascript
// From generate-enhanced-html-report.js line 433-436
const url = `${this.config.siteUrl}/_api/Web/Lists(guid'abb703bc-835c-4671-bad0-2f89956e3b74')/Items?$select=Id,ImageID,Iscorrective,FileLeafRef,FileRef,File_x0020_Type,Created&$filter=FSObjType eq 0&$top=1000`;
```

Key points:
- Uses GUID to identify the CImages library: `abb703bc-835c-4671-bad0-2f89956e3b74`
- Selects file-specific fields: `FileRef`, `FileLeafRef`
- Filters by `FSObjType eq 0` (files only, not folders)
- Then constructs REST API URLs using FileRef:
  ```javascript
  const restApiUrl = `${this.config.siteUrl}/_api/Web/GetFileByServerRelativeUrl('${encodeURIComponent(image.FileRef)}')/$value`;
  ```

## Solution Options

### Option 1: Add getDocumentLibraryFiles method to connector
Add a specialized method in `SimpleGraphConnector` for fetching files from document libraries:

```javascript
async getDocumentLibraryFiles(libraryNameOrGuid, options = {}) {
    // Implementation that uses proper document library query
}
```

### Option 2: Use direct REST API call in data-service.js
Bypass the connector's `getListItems` and make a direct REST API call for CImages:

```javascript
async getCImages(documentNumber) {
    const url = `${this.config.siteUrl}/_api/Web/Lists(guid'abb703bc-835c-4671-bad0-2f89956e3b74')/Items?$select=Id,ImageID,Iscorrective,FileLeafRef,FileRef,File_x0020_Type,Created&$filter=FSObjType eq 0 and substringof('${documentNumber}', ImageID)&$top=1000`;
    
    const token = await this.connector.getAccessToken();
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json;odata=verbose'
        }
    });
    // ... process response
}
```

### Option 3: Check if CImages is actually a list with attachments (less likely)
Some SharePoint sites might have CImages as a regular list where images are stored as attachments.

## Recommended Approach
Use **Option 2** for immediate fix - it's the most direct translation of the working original code.

## Implementation Steps
1. Update `data-service.js getCImages()` to use direct REST API call with GUID
2. Ensure proper FileRef extraction
3. Build restApiUrl using `GetFileByServerRelativeUrl`
4. Test with document GMRL-FSACR-0001

## Testing Checklist
- [ ] Images fetch successfully from CImages
- [ ] restApiUrl is properly constructed
- [ ] Images download and convert to base64
- [ ] Images display in detailed section tables (before photos)
- [ ] Images display in corrective actions tables (after photos)
- [ ] Fridge temperature images work
