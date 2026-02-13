# Architecture Overview

## 🏗️ Refactored Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry Point                         │
│                         (index.js)                              │
│  - Parses command line arguments                               │
│  - Displays help and usage information                         │
│  - Orchestrates report generation                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Report Generator                             │
│                  (report-generator.js)                          │
│  - Main orchestrator class                                     │
│  - Coordinates all services                                    │
│  - Builds report data structure                                │
│  - Manages SharePoint connection                               │
└───────┬──────────┬──────────┬──────────┬───────────────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  Data    │ │ Scoring  │ │  Image   │ │  Template    │
│ Service  │ │ Service  │ │ Service  │ │  Engine      │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘
     │            │            │              │
     │            │            │              │
     ▼            ▼            ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│SharePoint│ │Score Calc│ │Base64    │ │HTML Templates│
│ Data     │ │& Status  │ │Conversion│ │ (7 files)    │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

## 📦 Component Breakdown

### 1. **index.js** (Entry Point)
- Command-line interface
- Argument parsing
- User interaction
- Process coordination

### 2. **report-generator.js** (Orchestrator)
- Initializes all services
- Coordinates workflow
- Builds report data structure
- Saves final HTML

### 3. **config/config.js** (Configuration)
- Section mappings
- SharePoint list names
- Output settings
- Report options

### 4. **services/** (Business Logic)

#### data-service.js
```javascript
✓ getSurveyData()
✓ getCImages()
✓ processSectionData()
✓ getHistoricalScoresForStore()
✓ parseSharePointDate()
```

#### scoring-service.js
```javascript
✓ calculateValue()
✓ calculatePerformance()
✓ getScoreStatus()
✓ getScoreEmoji()
✓ getFormattedScore()
✓ calculateSectionScore()
```

#### image-service.js
```javascript
✓ downloadImageAsBase64()
✓ convertImagesToBase64()
✓ generateImageGallery()
✓ hasImages()
```

#### template-engine.js
```javascript
✓ loadTemplate()
✓ render()
✓ buildDocument()
✓ buildSections()
✓ buildDataTable()
```

### 5. **templates/** (HTML Structure)
```
main-layout.html       → Overall page structure
header.html            → Report header
performance-banner.html → Pass/Fail indicator
audit-info.html        → Audit metadata
chart.html             → Chart container
section.html           → Section template
image-modal.html       → Image viewer
footer.html            → Report footer
```

### 6. **styles/report-styles.css** (Presentation)
- All CSS in one file
- No inline styles in HTML
- Organized by component
- Responsive design rules

### 7. **scripts/report-client.js** (Interactivity)
- Chart initialization
- Image modal functionality
- Event handlers
- Client-side logic

## 🔄 Data Flow

```
1. CLI Arguments
   └─> index.js
       │
2. Initialize Generator
   └─> report-generator.js
       │
3. Connect to SharePoint
   │
4. Fetch Data
   └─> data-service.js
       ├─> Survey Data
       ├─> Section Data
       └─> Images
       │
5. Process Data
   └─> scoring-service.js
       ├─> Calculate Scores
       ├─> Determine Status
       └─> Get Performance
       │
6. Convert Images
   └─> image-service.js
       └─> Base64 Encoding
       │
7. Render HTML
   └─> template-engine.js
       ├─> Load Templates
       ├─> Inject Data
       └─> Build Document
       │
8. Save Report
   └─> File System
       └─> reports/Food_Safety_Audit_Report_XXX.html
```

## 🎯 Benefits of This Architecture

### Maintainability
✅ Each file has a single responsibility
✅ Easy to locate and fix bugs
✅ Changes don't affect unrelated code

### Testability
✅ Services can be tested independently
✅ Mock data can be injected easily
✅ Unit tests are straightforward

### Extensibility
✅ Add new services without modifying existing ones
✅ Add new templates without touching logic
✅ Add new sections via configuration

### Reusability
✅ Services can be used in other projects
✅ Templates can be reused
✅ Styles can be shared

### Readability
✅ Clear file organization
✅ Self-documenting structure
✅ Easy for new developers to understand

## 🔧 Customization Points

### To Change Styles
→ Edit `styles/report-styles.css`

### To Change Layout
→ Edit templates in `templates/`

### To Add Business Logic
→ Add methods to services in `services/`

### To Add New Section
→ Update `config/config.js`

### To Change Data Source
→ Modify `services/data-service.js`

### To Modify Scoring
→ Update `services/scoring-service.js`

## 📊 Comparison with Original

| Aspect | Original File | Refactored |
|--------|--------------|------------|
| **Total Lines** | ~2,658 lines | Distributed across 16 files |
| **CSS** | Inline (500+ lines) | Separate file |
| **HTML** | Inline templates | 7 template files |
| **JavaScript** | Inline client code | Separate file |
| **Services** | All in one class | 4 service classes |
| **Configuration** | Hardcoded | Separate config file |
| **Testability** | Difficult | Easy |
| **Maintainability** | Challenging | Simple |

## 🎓 Learning the Codebase

### For New Developers
1. Start with `README.md`
2. Read `config/config.js` to understand structure
3. Review `index.js` to see the entry point
4. Explore `report-generator.js` for orchestration
5. Dive into individual services as needed

### For Maintenance
1. CSS changes → `styles/report-styles.css`
2. Layout changes → `templates/`
3. Logic changes → `services/`
4. Configuration → `config/config.js`

### For Extension
1. New service → Create in `services/`
2. New template → Create in `templates/`
3. New feature → Update relevant service
4. New section → Add to config
