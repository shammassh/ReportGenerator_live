# Enhanced Report Generator - Refactored

A clean, modular refactoring of the food safety audit report generator with separated concerns.

## 📁 Project Structure

```
enhanced-report-generator/
├── index.js                    # CLI entry point
├── report-generator.js         # Main orchestrator class
├── config/
│   └── config.js              # Configuration and section mappings
├── services/
│   ├── data-service.js        # SharePoint data fetching
│   ├── scoring-service.js     # Score calculations and performance
│   ├── image-service.js       # Image handling and base64 conversion
│   └── template-engine.js     # HTML template rendering
├── templates/
│   ├── main-layout.html       # Main HTML structure
│   ├── header.html            # Report header
│   ├── performance-banner.html # Pass/Fail banner
│   ├── audit-info.html        # Audit details section
│   ├── chart.html             # Chart container
│   ├── section.html           # Section template
│   ├── image-modal.html       # Image viewer modal
│   └── footer.html            # Report footer
├── styles/
│   └── report-styles.css      # All CSS styles (separated)
└── scripts/
    └── report-client.js       # Client-side JavaScript (separated)
```

## 🎯 Design Principles

### Separation of Concerns
- **CSS**: All styles in `styles/report-styles.css`
- **HTML**: Template files in `templates/`
- **JavaScript**: Client code in `scripts/report-client.js`
- **Business Logic**: Service classes in `services/`
- **Configuration**: Centralized in `config/config.js`

### Service Layer Architecture
Each service has a single responsibility:

1. **DataService** - Fetches and processes SharePoint data
2. **ScoringService** - Calculates scores and performance metrics
3. **ImageService** - Handles image download and conversion
4. **TemplateEngine** - Renders HTML templates with data

### Benefits of This Structure
- ✅ Easy to maintain and update
- ✅ Testable components
- ✅ Reusable services
- ✅ Clear separation between data, logic, and presentation
- ✅ Easy to modify CSS without touching JavaScript
- ✅ Easy to update templates without touching business logic

## 🚀 Usage

### Basic Usage
```bash
node enhanced-report-generator/index.js GMRL-FSACR-0048
```

### With Options
```bash
# Specify custom output directory
node enhanced-report-generator/index.js GMRL-FSACR-0048 --output ./my-reports

# Debug mode (read from debug folder)
node enhanced-report-generator/index.js GMRL-FSACR-0048 --debug

# Show help
node enhanced-report-generator/index.js --help
```

## 📝 Programmatic Usage

```javascript
const ReportGenerator = require('./enhanced-report-generator/report-generator');

// Get connector
const connector = ReportGenerator.getConnector({
    siteUrl: process.env.SHAREPOINT_SITE_URL
});

// Create generator
const generator = new ReportGenerator(connector, {
    outputDir: './reports'
});

// Generate report
const result = await generator.generateReport('GMRL-FSACR-0048');

if (result.success) {
    console.log('Report saved to:', result.filePath);
}
```

## 🔧 Configuration

Edit `config/config.js` to customize:

- Output directory
- Section mappings
- Report options (inline styles, image conversion, etc.)
- Authentication method

## 🎨 Customizing Styles

All styles are in `styles/report-styles.css`. Modify this file to change:
- Colors and themes
- Layout and spacing
- Table styles
- Modal appearance
- Responsive breakpoints

## 📄 Customizing Templates

HTML templates are in the `templates/` folder:

- `main-layout.html` - Overall page structure
- `header.html` - Report header
- `section.html` - Section layout
- `audit-info.html` - Audit details
- etc.

Templates use simple `{{variable}}` placeholders for data injection.

## 🔌 Extending Services

### Adding a New Service

1. Create service file in `services/`
2. Export a class with methods
3. Import and use in `report-generator.js`

Example:
```javascript
// services/my-service.js
class MyService {
    constructor(connector) {
        this.connector = connector;
    }
    
    async doSomething() {
        // Implementation
    }
}

module.exports = MyService;
```

### Using Custom Templates

```javascript
const generator = new ReportGenerator(connector, {
    templatesDir: './my-custom-templates'
});
```

## 🔍 Service APIs

### DataService
```javascript
await dataService.getSurveyData(documentNumber, lists)
await dataService.getCImages(documentNumber, lists)
await dataService.processSectionData(sectionConfig, documentNumber, lists)
await dataService.getHistoricalScoresForStore(storeName)
```

### ScoringService
```javascript
scoringService.calculateValue(selectedChoice, coeff)
scoringService.calculatePerformance(score)
scoringService.getScoreStatus(score)
scoringService.getScoreEmoji(score)
scoringService.calculateSectionScore(items)
```

### ImageService
```javascript
await imageService.downloadImageAsBase64(imageItem)
await imageService.convertImagesToBase64(images)
imageService.generateImageGallery(questionId, images)
```

### TemplateEngine
```javascript
await templateEngine.loadTemplate(templateName)
templateEngine.render(template, data)
await templateEngine.renderTemplate(templateName, data)
await templateEngine.buildDocument(reportData, options)
```

## 📊 Report Output

Generated reports are standalone HTML files with:
- ✅ Embedded CSS (no external stylesheets needed)
- ✅ Embedded JavaScript (no external scripts needed)
- ✅ Base64-encoded images (no external image files needed)
- ✅ Interactive charts (Chart.js)
- ✅ Image viewer modal
- ✅ Responsive design

## 🧪 Testing

The modular structure makes it easy to test individual components:

```javascript
const ScoringService = require('./services/scoring-service');
const scoringService = new ScoringService();

// Test scoring logic
const value = scoringService.calculateValue('Yes', 4);
console.assert(value === 4, 'Score calculation failed');

const performance = scoringService.calculatePerformance(85);
console.assert(performance === 'Pass ✅', 'Performance calculation failed');
```

## 🔄 Migration from Original File

The original `generate-enhanced-html-report.js` remains untouched. This refactored version:

1. **Maintains all functionality** from the original
2. **Improves code organization** with separation of concerns
3. **Makes it easier to modify** individual components
4. **Enables better testing** through isolated services
5. **Provides cleaner APIs** for programmatic use

## 📦 Dependencies

Same as the original file:
- Node.js 16+
- Microsoft Graph API client libraries
- Azure AD credentials (or interactive auth)
- dotenv for environment variables
- Chart.js (CDN) for charts

## 🤝 Contributing

When adding features:
1. Add business logic to appropriate service
2. Add templates to `templates/`
3. Add styles to `report-styles.css`
4. Add client scripts to `report-client.js`
5. Update `config.js` for configuration options

## 📝 License

Same as parent project.

## 🆘 Support

For issues or questions:
1. Check the original `generate-enhanced-html-report.js` for reference implementation
2. Review service APIs in this README
3. Check configuration in `config/config.js`
4. Run with `--help` flag for CLI options
