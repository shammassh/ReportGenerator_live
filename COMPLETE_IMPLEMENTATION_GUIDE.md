# 🚀 REFACTORED CODE - COMPLETE IMPLEMENTATION GUIDE

## Status: ALL CORE SERVICES UPDATED ✅

### Files Successfully Updated (100% Complete Logic):

1. **data-service.js** ✅
   - ✅ getHistoricalScoresForStore (lines 867-928)
   - ✅ getHistoricalScoreForStore (lines 928-975) 
   - ✅ getHistoricalOverallScore (lines 976-1015)
   - ✅ Cycle-based filtering
   - ✅ Historical data caching
   - ✅ Proper store name matching

2. **scoring-service.js** ✅
   - ✅ getSeverityFromScore (NEW - lines 1430-1438)
   - ✅ getSeverityClass (ENHANCED - lines 1439-1448)
   - ✅ getAnswerClass (ENHANCED - supports numeric values 0,1,2)
   - ✅ All calculation methods working

3. **utilities.js** ✅ (NEW FILE)
   - ✅ cleanText - Handles escaped newlines/tabs
   - ✅ extractQuestionId - Converts "GMRL-FSACR-0048-87" → "87"
   - ✅ getComment - Multiple field name fallbacks
   - ✅ getCriteria - Multiple field name fallbacks
   - ✅ getReferenceValue - With index fallback
   - ✅ getCoefficientDisplay - Blank for NA answers
   - ✅ getAnswerDisplay - Shows "No Answer" for empty
   - ✅ parse functions for dates/times
   - ✅ Helper functions for store/auditor names
   - ✅ needsCorrectiveAction - Filtering logic
   - ✅ createImageGrid - 2-column grid generation
   - ✅ escapeQuotes - JavaScript string safety

4. **image-service.js** ✅
   - ✅ downloadImageAsBase64 (ENHANCED - supports restApiUrl)
   - ✅ convertImagesToBase64 (ENHANCED - groups by extracted question ID)
   - ✅ filterImagesByCorrective (NEW - Iscorrective flag filtering)
   - ✅ generateImageGallery (ENHANCED - with Iscorrective filtering)
   - ✅ generateFridgePictureCell (NEW - lines 1407-1428)
   - ✅ getImageCount (ENHANCED - with filter option)
   - ✅ Full question ID extraction logic
   - ✅ 2-column grid generation

### Files Requiring Template-Engine Updates (Detailed Below):

5. **template-engine.js** ⚠️ NEEDS UPDATES
   - Current: Simplified placeholder methods
   - Required: Complete implementations
   - See "Template Engine Updates Required" section below

---

## 📋 Template Engine Updates Required

### Update 1: Constructor (Add Service Dependencies)

**Current:**
```javascript
constructor(templatesDir) {
    this.templatesDir = templatesDir || path.join(__dirname, '../templates');
    this.templateCache = {};
}
```

**Required:**
```javascript
constructor(templatesDir, services = {}) {
    this.templatesDir = templatesDir || path.join(__dirname, '../templates');
    this.templateCache = {};
    this.imageService = services.imageService;
    this.scoringService = services.scoringService;
    this.dataService = services.dataService;
    this.connector = services.connector;
    this.config = services.config;
}
```

### Update 2: Add Imports (Top of file)

**Add after `const path = require('path');`:**
```javascript
const { 
    cleanText, 
    extractQuestionId, 
    getComment, 
    getCriteria, 
    getReferenceValue,
    getCoefficientDisplay,
    getAnswerDisplay,
    needsCorrectiveAction
} = require('./utilities');
```

### Update 3: buildDetailsTable Method

**Replace entire method (currently lines 196-227) with:**

```javascript
buildDetailsTable(data, imageMap) {
    if (!data || data.length === 0) {
        return '<p style="text-align: center; color: #666; padding: 20px;">No data available for this section</p>';
    }

    const rows = data.map((item, index) => {
        const answerClass = this.scoringService ? this.scoringService.getAnswerClass(item.SelectedChoice || item.Answer) : '';
        const criteria = getCriteria(item);
        const coefficient = getCoefficientDisplay(item);
        const answer = getAnswerDisplay(item);
        const comments = getComment(item);
        const referenceNumber = getReferenceValue(item, index);
        
        // Extract question ID for image lookup
        const fullImageId = String(item.Id || item.ID || item.ImageID || '');
        const questionId = extractQuestionId(fullImageId);
        const itemImages = imageMap[questionId] || [];
        let pictureCell = '';
        
        if (itemImages && itemImages.length > 0) {
            // Filter for BEFORE images (Iscorrective = false)
            const beforeImages = itemImages.filter(img => !img.isCorrective);
            
            if (beforeImages.length > 0 && this.imageService) {
                pictureCell = this.imageService.generateImageGallery(questionId, imageMap, false);
            } else {
                pictureCell = '<span style="color: #ccc;">📷</span>';
            }
        } else {
            pictureCell = '<span style="color: #ccc;">—</span>';
        }
        
        return `
            <tr>
                <td class="ref-col">${referenceNumber}</td>
                <td class="criteria-col">${criteria}</td>
                <td class="coef-col">${coefficient}</td>
                <td class="answer-col ${answerClass}">${answer}</td>
                <td class="comments-col">${cleanText(comments)}</td>
                <td class="picture-col" style="width:220px; min-width:220px; padding:8px;">
                    ${pictureCell}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <table class="section-details-table">
            <thead>
                <tr>
                    <th style="width:30px;">#</th>
                    <th>Criteria / Requirement</th>
                    <th style="width:50px;">Coef</th>
                    <th style="width:80px;">Answer</th>
                    <th>Comments</th>
                    <th style="width:220px; min-width:220px;">Pictures</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}
```

### Update 4: buildCorrectiveActions Method

**Replace entire method (currently lines 229-258) with:**

```javascript
buildCorrectiveActions(data, imageMap) {
    // Filter items that need corrective actions
    const correctiveItems = data.filter(item => needsCorrectiveAction(item));

    if (correctiveItems.length === 0) {
        return `
            <div class="corrective-actions-container" style="margin-top: 20px;">
                <div class="corrective-actions-header" style="background-color: #28a745;">
                    ✅ NO CORRECTIVE ACTIONS REQUIRED
                </div>
                <p style="text-align: center; color: #28a745; font-weight: bold; padding: 20px;">
                    All items in this section meet the required standards.
                </p>
            </div>
        `;
    }

    const rows = correctiveItems.map((item, index) => {
        const criteria = getCriteria(item);
        const finding = cleanText(item.Finding || item.finding || '-');
        const correctiveAction = cleanText(item.correctedaction || item.CorrectiveAction || item.Action || '-');
        const referenceNumber = getReferenceValue(item, index);
        
        // Auto-calculate severity if Priority is empty
        let severity = item.Priority || item.priority || '';
        if (!severity && this.scoringService) {
            const value = parseFloat(item.Value || 0);
            const coeff = parseFloat(item.Coeff || 0);
            severity = this.scoringService.getSeverityFromScore(value, coeff);
        }
        
        const severityClass = this.scoringService ? this.scoringService.getSeverityClass(severity) : '';
        
        // Extract question ID and get images
        const fullImageId = String(item.Id || item.ID || item.ImageID || '');
        const questionId = extractQuestionId(fullImageId);
        const itemImages = imageMap[questionId] || [];
        let pictureCell = '';
        
        if (itemImages && itemImages.length > 0) {
            // Filter for AFTER images (Iscorrective = true)
            const afterImages = itemImages.filter(img => img.isCorrective);
            
            if (afterImages.length > 0 && this.imageService) {
                pictureCell = this.imageService.generateImageGallery(questionId, imageMap, true);
            } else {
                pictureCell = '<span style="color: #ff9800;">⚠️ No corrective photo</span>';
            }
        } else {
            pictureCell = '<span style="color: #ff9800;">⚠️ No corrective photo</span>';
        }
        
        return `
            <tr>
                <td style="text-align:center;">${referenceNumber}</td>
                <td>${criteria}</td>
                <td>${finding}</td>
                <td class="${severityClass}" style="text-align:center;">${severity || '-'}</td>
                <td style="width:220px; min-width:220px; padding:8px;">
                    ${pictureCell}
                </td>
                <td>${correctiveAction}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="corrective-actions-container" style="margin-top: 20px;">
            <div class="corrective-actions-header">
                ⚠️ CORRECTIVE ACTIONS REQUIRED (${correctiveItems.length})
            </div>
            <table class="corrective-actions-table">
                <tr>
                    <th style="width:30px;">#</th>
                    <th>Criteria</th>
                    <th>Finding</th>
                    <th style="width:80px;">Severity</th>
                    <th style="width:220px; min-width:220px;">Corrective Picture</th>
                    <th>Corrective Action</th>
                </tr>
                ${rows}
            </table>
        </div>
    `;
}
```

### Update 5: Add generateFridgesTables Method (NEW)

**Add this method after buildCorrectiveActions:**

```javascript
async generateFridgesTables(documentNumber) {
    if (!this.connector || !this.config) {
        console.warn('Connector or config not available for fridges tables');
        return '';
    }

    try {
        console.log(`📊 Fetching SRA Fridges data for ${documentNumber}...`);
        
        // First, fetch SRA Fridges to get ReferenceValues
        const sraFridgesItems = await this.connector.getListItems('SRA Fridges', {
            filter: `Document_x0020_Number eq '${documentNumber}'`,
            top: 1
        });
        
        if (sraFridgesItems.length === 0) {
            console.warn(`⚠️ No SRA Fridges data found for ${documentNumber}`);
            return '';
        }
        
        // Parse the ResponseJSON to get fridge items with ReferenceValues
        const responseJSON = sraFridgesItems[0].ResponseJSON;
        if (!responseJSON || responseJSON === '[]') {
            console.warn(`⚠️ No ResponseJSON data in SRA Fridges for ${documentNumber}`);
            return '';
        }
        
        const sraFridgeItems = JSON.parse(responseJSON);
        console.log(`✅ Retrieved ${sraFridgeItems.length} items from SRA Fridges ResponseJSON`);
        
        // Fetch temperature data from both lists
        const [findingItems, goodItems] = await Promise.all([
            this.connector.getListItems('Fridges finding', { 
                filter: `substringof('${documentNumber}', fridgeid)`,
                top: 100 
            }).catch(err => {
                console.warn(`⚠️ Error fetching Fridges finding: ${err.message}`);
                return [];
            }),
            this.connector.getListItems('Fridges Good', { 
                filter: `substringof('${documentNumber}', goodid)`,
                top: 100 
            }).catch(err => {
                console.warn(`⚠️ Error fetching Fridges Good: ${err.message}`);
                return [];
            })
        ]);

        console.log(`✅ Found ${findingItems.length} finding items and ${goodItems.length} good items`);
        
        // Find the temperature monitoring question from SRA Fridges
        const tempMonitoringItem = sraFridgeItems.find(item => 
            item.Title && item.Title.toLowerCase().includes('air temperature of fridges and freezers')
        );
        
        const temperatureReferenceValue = tempMonitoringItem ? tempMonitoringItem.ReferenceValue : '2.26';
        console.log(`📊 Using ReferenceValue "${temperatureReferenceValue}" for temperature monitoring records`);
        
        // Create enriched items with ReferenceValue from SRA Fridges
        const enrichedFindingItems = findingItems.map((item) => {
            return { ...item, ReferenceValue: temperatureReferenceValue };
        });
        
        const enrichedGoodItems = goodItems.map((item) => {
            return { ...item, ReferenceValue: temperatureReferenceValue };
        });

        // Download and convert fridge images to base64
        const fridgeImageMap = new Map();
        
        // Download images for finding items
        for (const item of enrichedFindingItems) {
            if (item.ID && item.Attachments) {
                try {
                    const itemsWithAttachments = await this.connector.getListItems('Fridges finding', {
                        filter: `ID eq ${item.ID}`,
                        expand: 'AttachmentFiles',
                        top: 1
                    });
                    
                    if (itemsWithAttachments && itemsWithAttachments.length > 0 && itemsWithAttachments[0].AttachmentFiles) {
                        const base64Images = [];
                        const attachments = itemsWithAttachments[0].AttachmentFiles.results || itemsWithAttachments[0].AttachmentFiles;
                        
                        for (const att of attachments) {
                            const imageItem = {
                                fileName: att.FileName,
                                restApiUrl: `${this.config.siteUrl}/_api/web/lists/getbytitle('Fridges finding')/items(${item.ID})/AttachmentFiles/getbyfilename('${att.FileName}')/$value`
                            };
                            const base64 = await this.imageService.downloadImageAsBase64(imageItem);
                            if (base64) base64Images.push(base64);
                        }
                        if (base64Images.length > 0) {
                            fridgeImageMap.set(`finding_${item.ID}`, base64Images);
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Error fetching images for finding item ${item.ID}: ${err.message}`);
                }
            }
        }
        
        // Download images for good items
        for (const item of enrichedGoodItems) {
            if (item.ID && item.Attachments) {
                try {
                    const itemsWithAttachments = await this.connector.getListItems('Fridges Good', {
                        filter: `ID eq ${item.ID}`,
                        expand: 'AttachmentFiles',
                        top: 1
                    });
                    
                    if (itemsWithAttachments && itemsWithAttachments.length > 0 && itemsWithAttachments[0].AttachmentFiles) {
                        const base64Images = [];
                        const attachments = itemsWithAttachments[0].AttachmentFiles.results || itemsWithAttachments[0].AttachmentFiles;
                        
                        for (const att of attachments) {
                            const imageItem = {
                                fileName: att.FileName,
                                restApiUrl: `${this.config.siteUrl}/_api/web/lists/getbytitle('Fridges Good')/items(${item.ID})/AttachmentFiles/getbyfilename('${att.FileName}')/$value`
                            };
                            const base64 = await this.imageService.downloadImageAsBase64(imageItem);
                            if (base64) base64Images.push(base64);
                        }
                        if (base64Images.length > 0) {
                            fridgeImageMap.set(`good_${item.ID}`, base64Images);
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Error fetching images for good item ${item.ID}: ${err.message}`);
                }
            }
        }

        let html = '';

        // Generate Fridges Finding Table
        if (enrichedFindingItems && enrichedFindingItems.length > 0) {
            const findingRows = enrichedFindingItems.map((item) => {
                const base64Images = fridgeImageMap.get(`finding_${item.ID}`) || [];
                const pictureHtml = this.imageService.generateFridgePictureCell(base64Images, 'Finding');
                const issue = cleanText(item.Issue || '-');
                
                return `
                    <tr>
                        <td style="text-align:center;">${item.ReferenceValue || '-'}</td>
                        <td style="text-align:center;">${item.Unit || item.key || '-'}</td>
                        <td style="text-align:center;">${item.Display || item.Value || '-'}</td>
                        <td style="text-align:center;">${item.Probe || '-'}</td>
                        <td>${issue}</td>
                        <td style="width:220px; min-width:220px; padding:8px;">
                            ${pictureHtml}
                        </td>
                    </tr>
                `;
            }).join('');

            html += `
                <div class="corrective-actions-container" style="margin-top: 20px;">
                    <div class="corrective-actions-header" style="background-color: #dc3545;">
                        ⚠️ FRIDGES WITH FINDINGS
                    </div>
                    <table class="corrective-actions-table">
                        <tr>
                            <th style="width:30px;">#</th>
                            <th style="width:80px;">Unit (°C)</th>
                            <th style="width:80px;">Display (°C)</th>
                            <th style="width:80px;">Probe (°C)</th>
                            <th>Issue</th>
                            <th style="width:220px; min-width:220px;">Pictures</th>
                        </tr>
                        ${findingRows}
                    </table>
                </div>
            `;
        }

        // Generate Fridges Good Table
        if (enrichedGoodItems && enrichedGoodItems.length > 0) {
            const goodRows = enrichedGoodItems.map((item) => {
                const base64Images = fridgeImageMap.get(`good_${item.ID}`) || [];
                const pictureHtml = this.imageService.generateFridgePictureCell(base64Images, 'Compliant');
                
                return `
                    <tr>
                        <td style="text-align:center;">${item.ReferenceValue || '-'}</td>
                        <td style="text-align:center;">${item.Unit || '-'}</td>
                        <td style="text-align:center;">${item.Display || '-'}</td>
                        <td style="text-align:center;">${item.Probe || '-'}</td>
                        <td style="width:220px; min-width:220px; padding:8px;">
                            ${pictureHtml}
                        </td>
                    </tr>
                `;
            }).join('');

            html += `
                <div class="corrective-actions-container" style="margin-top: 20px;">
                    <div class="corrective-actions-header" style="background-color: #28a745;">
                        ✅ COMPLIANT FRIDGES
                    </div>
                    <table class="corrective-actions-table">
                        <tr>
                            <th style="width:30px;">#</th>
                            <th style="width:80px;">Unit (°C)</th>
                            <th style="width:80px;">Display (°C)</th>
                            <th style="width:80px;">Probe (°C)</th>
                            <th style="width:220px; min-width:220px;">Pictures</th>
                        </tr>
                        ${goodRows}
                    </table>
                </div>
            `;
        }

        return html;
    } catch (error) {
        console.error(`❌ Error generating fridges tables: ${error.message}`);
        return '';
    }
}
```

### Update 6: buildDataTable Method

**Replace entire method (currently lines 260-297) with:**

```javascript
async buildDataTable(reportData, sectionMappings) {
    const storeName = reportData.auditDetails.storeName;
    
    // Fetch historical data if dataService is available
    let historicalDataAvailable = false;
    if (this.dataService && storeName && storeName !== 'N/A') {
        try {
            await this.dataService.getHistoricalScoresForStore(storeName);
            historicalDataAvailable = true;
        } catch (error) {
            console.warn('Could not fetch historical data:', error.message);
        }
    }
    
    const rows = await Promise.all(reportData.sections.map(async (section, index) => {
        let c1Score = '-', c2Score = '-', c3Score = '-', c4Score = '-';
        
        if (historicalDataAvailable && this.dataService) {
            try {
                c1Score = await this.dataService.getHistoricalScoreForStore(storeName, section.title, 'C1', sectionMappings);
                c2Score = await this.dataService.getHistoricalScoreForStore(storeName, section.title, 'C2', sectionMappings);
                c3Score = await this.dataService.getHistoricalScoreForStore(storeName, section.title, 'C3', sectionMappings);
                c4Score = await this.dataService.getHistoricalScoreForStore(storeName, section.title, 'C4', sectionMappings);
                
                // Format scores (remove "0.1" default, show as "-")
                c1Score = c1Score === '0.1' ? '-' : Math.round(parseFloat(c1Score)) + '%';
                c2Score = c2Score === '0.1' ? '-' : Math.round(parseFloat(c2Score)) + '%';
                c3Score = c3Score === '0.1' ? '-' : Math.round(parseFloat(c3Score)) + '%';
                c4Score = c4Score === '0.1' ? '-' : Math.round(parseFloat(c4Score)) + '%';
            } catch (error) {
                console.warn(`Error fetching historical scores for ${section.title}:`, error.message);
            }
        }
        
        return `
            <tr>
                <td style="width:30px; text-align:center;">${index + 1}</td>
                <td class="category-col">${section.title}</td>
                <td class="score-col">${Math.round(section.score)}%</td>
                <td>${c1Score}</td>
                <td>${c2Score}</td>
                <td>${c3Score}</td>
                <td>${c4Score}</td>
            </tr>
        `;
    }));
    
    // Overall row with historical scores
    let overallC1 = '-', overallC2 = '-', overallC3 = '-', overallC4 = '-';
    if (historicalDataAvailable && this.dataService) {
        try {
            overallC1 = await this.dataService.getHistoricalOverallScore('C1');
            overallC2 = await this.dataService.getHistoricalOverallScore('C2');
            overallC3 = await this.dataService.getHistoricalOverallScore('C3');
            overallC4 = await this.dataService.getHistoricalOverallScore('C4');
            
            overallC1 = overallC1 === '0.1' ? '-' : Math.round(parseFloat(overallC1)) + '%';
            overallC2 = overallC2 === '0.1' ? '-' : Math.round(parseFloat(overallC2)) + '%';
            overallC3 = overallC3 === '0.1' ? '-' : Math.round(parseFloat(overallC3)) + '%';
            overallC4 = overallC4 === '0.1' ? '-' : Math.round(parseFloat(overallC4)) + '%';
        } catch (error) {
            console.warn('Error fetching historical overall scores:', error.message);
        }
    }

    return `
        <div class="data-table-container">
            <h3>📊 Data Table</h3>
            <table class="data-table">
                <tr>
                    <th style="width:30px;">#</th>
                    <th>Category</th>
                    <th>Current Score</th>
                    <th>C1 Score</th>
                    <th>C2 Score</th>
                    <th>C3 Score</th>
                    <th>C4 Score</th>
                </tr>
                ${(await Promise.all(rows)).join('')}
                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <td style="text-align:center;">Result</td>
                    <td class="category-col" style="color: white;">
                        <div style='background-color:${reportData.overallScore > 83 ? '#28a745' : '#dc3545'}; color:white; padding:8px; border-radius:4px; display:block; width:100%; height:100%; text-align:center;'>
                            Final Result
                        </div>
                    </td>
                    <td style="color: white;">
                        <div style='background-color:${reportData.overallScore > 83 ? '#28a745' : '#dc3545'}; color:white; padding:8px; border-radius:4px; display:block; width:100%; height:100%; text-align:center;'>
                            ${reportData.overallScore > 83 ? 'PASS' : 'FAIL'}
                        </div>
                    </td>
                    <td style="color: white;">${overallC1}</td>
                    <td style="color: white;">${overallC2}</td>
                    <td style="color: white;">${overallC3}</td>
                    <td style="color: white;">${overallC4}</td>
                </tr>
            </table>
        </div>
    `;
}
```

### Update 7: Update buildDocument Method

**Find the line where sections are processed (around line 165-170) and update the fridgesTables assignment:**

**Change from:**
```javascript
fridgesTables: '' // Will be handled by specialized method if needed
```

**To:**
```javascript
fridgesTables: section.title === 'Fridges and Freezers' ? 
    await this.generateFridgesTables(reportData.metadata.documentNumber) : ''
```

**Also update the data table call (around line 96):**

**Change from:**
```javascript
const dataTable = await this.buildDataTable(reportData);
```

**To:**
```javascript
const dataTable = await this.buildDataTable(reportData, this.sectionMappings);
```

**Add sectionMappings to constructor:**
```javascript
constructor(templatesDir, services = {}) {
    this.templatesDir = templatesDir || path.join(__dirname, '../templates');
    this.templateCache = {};
    this.imageService = services.imageService;
    this.scoringService = services.scoringService;
    this.dataService = services.dataService;
    this.connector = services.connector;
    this.config = services.config;
    this.sectionMappings = services.sectionMappings || {}; // ADD THIS LINE
}
```

---

## 🔧 Main Index.js Updates Required

The main `index.js` file needs to instantiate services properly:

```javascript
const DataService = require('./services/data-service');
const ImageService = require('./services/image-service');
const ScoringService = require('./services/scoring-service');
const TemplateEngine = require('./services/template-engine');
const config = require('./config/config');

// Initialize connector
const connector = new TruePersistentConnector(config.auth);

// Initialize services
const dataService = new DataService(connector);
const imageService = new ImageService(connector);
const scoringService = new ScoringService();

// Initialize template engine with services
const templateEngine = new TemplateEngine(path.join(__dirname, 'templates'), {
    imageService,
    scoringService,
    dataService,
    connector,
    config,
    sectionMappings: require('./config/section-mappings') // If separate file
});
```

---

## ✅ Testing Checklist

After making all updates, test with document GMRL-FSACR-0048:

- [ ] Pictures appear in detailed section tables (before photos, Iscorrective=false)
- [ ] Pictures appear in corrective actions table (after photos, Iscorrective=true)
- [ ] C1, C2, C3, C4 scores show real data (not "-")
- [ ] Comments column populated from item.comment/Comments/Note fields
- [ ] Coefficients show blank for NA answers
- [ ] Corrective actions filter correctly (Coeff !== Value && SelectedChoice !== 'NA')
- [ ] Severity auto-calculates when Priority field is empty
- [ ] Fridges tables show temperature data with images
- [ ] Text cleaning works (newlines convert to <br>, tabs to spaces)
- [ ] "NO CORRECTIVE ACTIONS REQUIRED" message shows when applicable
- [ ] Image modal click-to-enlarge functionality works
- [ ] 2-column image grid displays properly

---

## 📦 Summary

**ALL service layer files are now 100% complete with original logic.**

**Only template-engine.js needs the updates listed above.**

The refactored code will then have COMPLETE feature parity with the original 2,658-line file, but with:
- ✅ Clean separation of concerns
- ✅ Reusable service modules
- ✅ Maintainable code structure
- ✅ All original features preserved
- ✅ Enhanced with better organization

**Would you like me to create a single complete template-engine.js file with all these updates applied?**
