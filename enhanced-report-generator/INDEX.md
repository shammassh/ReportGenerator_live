# Enhanced Report Generator - Refactored Version

## 🎉 Welcome to the Refactored Codebase!

This folder contains a **clean, modular refactoring** of `generate-enhanced-html-report.js` with proper separation of concerns.

## 📚 Documentation

Start here to understand the refactored structure:

1. **[README.md](./README.md)** - Complete usage guide and API reference
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture explanation with diagrams
3. **[../REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md)** - Overview of what was refactored
4. **[../BEFORE_AND_AFTER.md](../BEFORE_AND_AFTER.md)** - Side-by-side comparison

## 🚀 Quick Start

### Generate a Report
```bash
node index.js GMRL-FSACR-0048
```

### Show Help
```bash
node index.js --help
```

### With Options
```bash
node index.js GMRL-FSACR-0048 --output ./my-reports
```

## 📁 Folder Structure

```
enhanced-report-generator/
├── 📄 index.js                    # CLI entry point - START HERE
├── 📄 report-generator.js         # Main orchestrator class
├── 📄 README.md                   # Usage documentation
├── 📄 ARCHITECTURE.md             # Architecture details
├── 📄 INDEX.md                    # This file
├── config/
│   └── 📄 config.js              # Configuration & section mappings
├── services/
│   ├── 📄 data-service.js        # SharePoint data operations
│   ├── 📄 scoring-service.js     # Scoring calculations
│   ├── 📄 image-service.js       # Image handling & conversion
│   └── 📄 template-engine.js     # HTML template rendering
├── templates/
│   ├── 📄 main-layout.html       # Overall page structure
│   ├── 📄 header.html            # Report header
│   ├── 📄 performance-banner.html # Pass/Fail banner
│   ├── 📄 audit-info.html        # Audit information
│   ├── 📄 chart.html             # Chart container
│   ├── 📄 section.html           # Section template
│   ├── 📄 image-modal.html       # Image viewer modal
│   └── 📄 footer.html            # Report footer
├── styles/
│   └── 📄 report-styles.css      # All CSS (separated from JS)
└── scripts/
    └── 📄 report-client.js       # Client-side JavaScript
```

## 🎯 Key Features

### ✅ Complete Separation of Concerns
- **CSS** → `styles/report-styles.css` (no inline styles)
- **HTML** → `templates/*.html` (no template literals)
- **JavaScript** → `scripts/report-client.js` (client code separated)
- **Business Logic** → `services/*.js` (modular services)
- **Configuration** → `config/config.js` (centralized)

### ✅ Modular Architecture
- **DataService** - Fetches SharePoint data
- **ScoringService** - Calculates scores and performance
- **ImageService** - Handles image conversion
- **TemplateEngine** - Renders HTML templates

### ✅ Easy to Maintain
- Each file has ONE purpose
- Easy to locate and fix issues
- Changes don't affect unrelated code

### ✅ Well Documented
- Comprehensive README
- Architecture documentation
- Inline code comments
- Usage examples

## 🔧 Customization

### Change Styles
```bash
# Edit the CSS file
code styles/report-styles.css
```

### Modify Layout
```bash
# Edit HTML templates
code templates/section.html
```

### Update Configuration
```bash
# Edit configuration
code config/config.js
```

### Add Business Logic
```bash
# Extend services
code services/data-service.js
```

## 💻 Programmatic Usage

```javascript
const ReportGenerator = require('./enhanced-report-generator/report-generator');

// Get SharePoint connector
const connector = ReportGenerator.getConnector();

// Create generator instance
const generator = new ReportGenerator(connector, {
    outputDir: './reports'
});

// Generate report
const result = await generator.generateReport('GMRL-FSACR-0048');

if (result.success) {
    console.log('✅ Report saved:', result.filePath);
    console.log('📊 Score:', result.data.overallScore);
} else {
    console.error('❌ Error:', result.error);
}
```

## 📊 Service APIs

### DataService
```javascript
const dataService = new DataService(connector);

// Fetch survey data
const survey = await dataService.getSurveyData(documentNumber, lists);

// Get images
const images = await dataService.getCImages(documentNumber, lists);

// Process section
const data = await dataService.processSectionData(config, documentNumber, lists);
```

### ScoringService
```javascript
const scoringService = new ScoringService();

// Calculate value
const value = scoringService.calculateValue('Yes', 4); // Returns 4

// Get performance
const perf = scoringService.calculatePerformance(85); // Returns "Pass ✅"

// Get status
const status = scoringService.getScoreStatus(85); // Returns "PASS"
```

### ImageService
```javascript
const imageService = new ImageService(connector);

// Convert to base64
const base64 = await imageService.downloadImageAsBase64(imageItem);

// Convert all images
const converted = await imageService.convertImagesToBase64(images);

// Generate gallery HTML
const html = imageService.generateImageGallery(questionId, images);
```

### TemplateEngine
```javascript
const templateEngine = new TemplateEngine();

// Load template
const template = await templateEngine.loadTemplate('header');

// Render with data
const html = templateEngine.render(template, { title: 'Report' });

// Build complete document
const document = await templateEngine.buildDocument(reportData);
```

## 🧪 Testing

The modular structure makes testing easy:

```javascript
// Test scoring service
const ScoringService = require('./services/scoring-service');
const scoringService = new ScoringService();

console.assert(
    scoringService.calculateValue('Yes', 4) === 4,
    'Score calculation failed'
);

console.assert(
    scoringService.calculatePerformance(85) === 'Pass ✅',
    'Performance calculation failed'
);

console.log('✅ All tests passed!');
```

## 🎓 Learning Path

### For New Developers
1. Read [README.md](./README.md) for overview
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for design
3. Check [../BEFORE_AND_AFTER.md](../BEFORE_AND_AFTER.md) to understand refactoring
4. Explore `index.js` to see the entry point
5. Study `report-generator.js` to see orchestration
6. Dive into individual services as needed

### For Maintenance
1. **CSS changes** → Edit `styles/report-styles.css`
2. **Layout changes** → Edit files in `templates/`
3. **Logic changes** → Edit files in `services/`
4. **Config changes** → Edit `config/config.js`

### For Extension
1. **New service** → Create in `services/` folder
2. **New template** → Create in `templates/` folder
3. **New feature** → Update relevant service
4. **New section** → Add to `config/config.js`

## 📦 Dependencies

Same as the original file:
- Node.js 16+
- Microsoft Graph API libraries
- Azure AD credentials (or interactive auth)
- dotenv
- Chart.js (CDN)
- chartjs-plugin-datalabels (CDN)

## 🔄 Migration from Original

The original `generate-enhanced-html-report.js` remains **unchanged and functional**. You can:

1. Use both versions in parallel during transition
2. Test the refactored version thoroughly
3. Gradually move to the refactored version
4. Eventually deprecate the original

## ✅ What's Different?

### Original File (`generate-enhanced-html-report.js`)
- 2,658 lines in one file
- CSS inline in JavaScript strings
- HTML in template literals
- Client code mixed with server code
- All logic in one class

### Refactored Version (This Folder)
- 16 well-organized files
- CSS in separate `.css` file
- HTML in separate `.html` files
- Client code in separate `.js` file
- Logic distributed across focused services

## 🎯 Benefits

✅ **Separation of Concerns** - CSS, HTML, JS properly separated
✅ **Modularity** - Reusable, focused services
✅ **Maintainability** - Easy to modify and extend
✅ **Testability** - Services can be tested independently
✅ **Readability** - Self-documenting structure
✅ **Professional** - Follows industry best practices
✅ **Documented** - Comprehensive documentation
✅ **No Breaking Changes** - Original file preserved

## 📞 Support

For questions or issues:
1. Check [README.md](./README.md) for usage
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for design
3. Compare with original in [../BEFORE_AND_AFTER.md](../BEFORE_AND_AFTER.md)
4. Run with `--help` for CLI options

## 🎉 Enjoy!

This refactored version provides a clean, professional, maintainable codebase that's a pleasure to work with!

Happy coding! 🚀
