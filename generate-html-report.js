#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Choose connector based on AUTH_METHOD
function getConnector(config = {}) {
    const authMethod = process.env.AUTH_METHOD || 'auto';
    
    switch (authMethod) {
        case 'graph':
            const SimpleGraphConnector = require('./src/simple-graph-connector.js');
            return new SimpleGraphConnector(config);
        case 'interactive':
            const TruePersistentConnector = require('./src/true-persistent-connector.js');
            return new TruePersistentConnector(config);
        case 'auto':
        default:
            // Auto-detect: use graph if Azure credentials available
            if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
                const SimpleGraphConnector = require('./src/simple-graph-connector.js');
                return new SimpleGraphConnector(config);
            } else {
                const TruePersistentConnector = require('./src/true-persistent-connector.js');
                return new TruePersistentConnector(config);
            }
    }
}
const SimpleGraphConnector = require('./src/simple-graph-connector.js');
require('dotenv').config();

/**
 * HTML Report Generator for Food Safety Audit Reports
 * Based on PowerApps HTML template structure
 */
class HTMLReportGenerator {
    constructor(config = {}) {
        this.config = {
            outputDir: config.outputDir || './reports',
            siteUrl: process.env.SHAREPOINT_SITE_URL || 'https://spinneysleb.sharepoint.com/operations/',
            ...config
        };
        
        this.connector = config.connector || getConnector(this.config);
        
        // Section mappings based on actual SharePoint list names found
        this.sectionMappings = {
            'Food': { listName: 'Food Storage and Dry Storage', icon: '🥫', title: 'Food And Storage' },
            'Fridges': { listName: 'SRA Fridges', icon: '❄️', title: 'Fridges Section' },
            'Utensils': { listName: 'SRA Utensils and Equipment', icon: '🍽️', title: 'Utensil Section' },
            'Food Handling': { listName: 'SRA Food Handling', icon: '🍽️', title: 'Food Handling Section' },
            'CND': { listName: 'SRA Cleaning and Disinfection', icon: '🧹', title: 'Cleaning Section' },
            'Hygiene': { listName: 'SRA Personal Hygiene', icon: '🧼', title: 'Hygiene Section' },
            'Restroom': { listName: 'SRA Restrooms', icon: '🚻', title: 'Restroom Section' },
            'Garbage': { listName: 'SRA Garbage Storage and Disposal', icon: '🗑️', title: 'Garbage Section' },
            'Maintenance': { listName: 'SRA Maintenance', icon: '🛠️', title: 'Maintenance Section' },
            'Chemicals': { listName: 'SRA Chemicals Available', icon: '🧪', title: 'Chemicals Section' },
            'Monitoring': { listName: 'SRA Monitoring Sheets are Properly Filled/ Documents Present', icon: '📄', title: 'Monitoring Sheets Section' },
            'Policies': { listName: 'SRA Policies, Procedures & Posters', icon: '📑', title: 'Policy and Procedure Section' },
            'Culture': { listName: 'SRA Culture', icon: '🍱', title: 'Culture Section' }
        };
    }

    /**
     * Generate comprehensive HTML audit report
     */
    async generateHTMLReport(options = {}) {
        try {
            console.log('🚀 Starting HTML Report Generation...');
            
            // Validate document number
            const documentNumber = options.documentNumber;
            if (!documentNumber) {
                throw new Error('Document number is required. Please provide options.documentNumber');
            }
            
            console.log(`📄 Generating report for Document Number: ${documentNumber}`);
            
            // Connect to SharePoint
            await this.connector.connectToSharePoint();
            console.log('✅ Connected to SharePoint');
            
            // Get all available lists
            const lists = await this.connector.getSharePointLists();
            console.log(`📋 Found ${lists.length} SharePoint lists`);
            
            // Collect data for all sections
            const reportData = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    siteUrl: this.config.siteUrl,
                    reportType: 'Food Safety Audit Report',
                    documentNumber: documentNumber
                },
                sections: {},
                scores: {},
                overallScore: 0,
                auditDetails: {
                    documentNumber: documentNumber,
                    dateOfAudit: options.dateOfAudit || new Date().toLocaleDateString(),
                    auditor: options.auditor || 'System Generated',
                    accompaniedBy: options.accompaniedBy || '',
                    timeOfAudit: options.timeOfAudit || new Date().toLocaleTimeString(),
                    timeIn: options.timeIn || new Date().toLocaleTimeString(),
                    timeOut: options.timeOut || '',
                    cycle: options.cycle || 'Current',
                    storeName: options.storeName || 'Default Store'
                }
            };
            
            // Process each section
            for (const [sectionKey, sectionConfig] of Object.entries(this.sectionMappings)) {
                console.log(`📊 Processing ${sectionConfig.title}...`);
                
                try {
                    const sectionData = await this.processSectionData(sectionConfig.listName, lists, documentNumber);
                    reportData.sections[sectionKey] = {
                        ...sectionConfig,
                        data: sectionData,
                        score: this.calculateSectionScore(sectionData)
                    };
                    reportData.scores[sectionKey] = reportData.sections[sectionKey].score;
                } catch (error) {
                    console.warn(`⚠️ Could not process ${sectionConfig.title}: ${error.message}`);
                    reportData.sections[sectionKey] = {
                        ...sectionConfig,
                        data: { checklist: [], findings: [] },
                        score: 0
                    };
                    reportData.scores[sectionKey] = 0;
                }
            }
            
            // Calculate overall score
            const scores = Object.values(reportData.scores);
            reportData.overallScore = scores.length > 0 ? 
                Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
            
            // Generate HTML
            const html = this.generateHTML(reportData);
            
            // Save report
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `Food_Safety_Audit_Report_${documentNumber}_${timestamp}.html`;
            const filepath = path.join(this.config.outputDir, filename);
            
            await fs.mkdir(this.config.outputDir, { recursive: true });
            await fs.writeFile(filepath, html, 'utf8');
            
            console.log(`💾 HTML report saved to: ${filepath}`);
            console.log(`📊 Overall Score: ${reportData.overallScore}%`);
            
            return {
                reportPath: filepath,
                data: reportData,
                overallScore: reportData.overallScore
            };
            
        } catch (error) {
            console.error('❌ Error generating HTML report:', error);
            throw error;
        } finally {
            await this.connector.disconnect();
        }
    }
    
    /**
     * Process data for a specific section
     */
    async processSectionData(listName, allLists, documentNumber) {
        const list = allLists.find(l => l.Title === listName);
        if (!list || list.ItemCount === 0) {
            return { checklist: [], findings: [] };
        }
        
        try {
            // Get list items with common fields including document number fields
            const items = await this.connector.getListItems(listName, [
                'Title', 'ID', 'Created', 'Modified',
                'comment', 'Finding', 'Priority', 'Picture',
                'Coeff', 'Value', 'SelectedChoice', 'ReferenceValue',
                'correctedaction', 'cr', 'DocumentNumber', 'DocNumber', 
                'AuditNumber', 'InspectionNumber', 'RequestNumber'
            ]);
            
            // Filter items by document number
            const filteredItems = items.filter(item => {
                const itemDocNumber = this.getDocumentNumber(item);
                return itemDocNumber === documentNumber;
            });
            
            console.log(`📋 Found ${filteredItems.length} items for document ${documentNumber} in ${listName}`);
            
            const checklist = [];
            const findings = [];
            
            for (const item of filteredItems) {
                try {
                    // Safely extract values with null checks
                    const title = this.safeString(item.Title);
                    const id = this.safeNumber(item.ID);
                    const referenceValue = this.safeString(item.ReferenceValue) || id.toString();
                    const coefficient = this.safeNumber(item.Coeff, 0);
                    const value = this.safeNumber(item.Value);
                    const selectedChoice = this.safeString(item.SelectedChoice);
                    const comment = this.safeString(item.comment);
                    const finding = this.safeString(item.Finding);
                    const priority = this.safeString(item.Priority);
                    const picture = this.safeString(item.Picture);
                    const correctiveAction = this.safeString(item.correctedaction) || this.safeString(item.cr);
                    
                    // Build checklist item
                    const checklistItem = {
                        id: id,
                        title: title,
                        referenceValue: referenceValue,
                        coefficient: coefficient,
                        answer: this.formatAnswer(value, selectedChoice),
                        comments: comment,
                        picture: picture,
                        created: this.safeString(item.Created),
                        modified: this.safeString(item.Modified)
                    };
                    checklist.push(checklistItem);
                    
                    // Check for findings (non-conformances)
                    if (finding && finding.trim() !== '') {
                        findings.push({
                            id: id,
                            title: title,
                            referenceValue: referenceValue,
                            finding: finding,
                            priority: priority,
                            picture: picture,
                            correctiveAction: correctiveAction,
                            created: this.safeString(item.Created)
                        });
                    }
                } catch (itemError) {
                    console.warn(`⚠️ Error processing item ${item.ID} in ${listName}:`, itemError.message);
                    // Continue processing other items
                }
            }
            
            return { checklist, findings };
            
        } catch (error) {
            console.error(`❌ Error processing section data for ${listName}:`, error.message);
            // Return empty data instead of throwing
            return { checklist: [], findings: [] };
        }
    }
    
    /**
     * Calculate section score based on responses
     */
    calculateSectionScore(sectionData) {
        if (!sectionData.checklist || sectionData.checklist.length === 0) {
            return 0;
        }
        
        let totalPoints = 0;
        let maxPoints = 0;
        
        for (const item of sectionData.checklist) {
            const coeff = item.coefficient || 1;
            maxPoints += coeff;
            
            if (item.answer === 'Yes' || item.answer === '2') {
                totalPoints += coeff;
            } else if (item.answer === 'Partially' || item.answer === '1') {
                totalPoints += coeff * 0.5;
            }
            // 'No' or '0' gets 0 points
        }
        
        return maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
    }
    
    /**
     * Format answer display
     */
    formatAnswer(value, choice) {
        if (choice === 'NA') return 'NA';
        if (choice) return choice;
        if (value === 2) return 'Yes';
        if (value === 1) return 'Partially';
        if (value === 0) return 'No';
        return value !== null && value !== undefined ? value.toString() : '';
    }
    
    /**
     * Safely extract string value
     */
    safeString(value, defaultValue = '') {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            // Handle complex objects that might be in SharePoint fields
            try {
                return JSON.stringify(value);
            } catch {
                return value.toString();
            }
        }
        return value.toString();
    }
    
    /**
     * Safely extract number value
     */
    safeNumber(value, defaultValue = null) {
        if (value === null || value === undefined) return defaultValue;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }
    
    /**
     * Extract document number from SharePoint item
     */
    getDocumentNumber(item) {
        // Try different field names that might contain the document number
        const docFields = [
            'DocumentNumber', 'DocNumber', 'AuditNumber', 
            'InspectionNumber', 'RequestNumber', 'Document_x0020_Number',
            'Reference', 'ReferenceNumber', 'ID'
        ];
        
        for (const field of docFields) {
            const value = this.safeString(item[field]);
            if (value && value.trim() !== '') {
                return value.trim();
            }
        }
        
        // Fallback to ID if no document number field found
        return this.safeString(item.ID);
    }
    
    /**
     * Generate complete HTML report
     */
    generateHTML(reportData) {
        const css = this.generateCSS();
        const headerSection = this.generateHeaderSection(reportData);
        const summarySection = this.generateSummarySection(reportData);
        const chartSection = this.generateChartSection(reportData);
        const detailSections = this.generateDetailSections(reportData);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Food Safety Audit Report - ${reportData.auditDetails.dateOfAudit}</title>
    <style>${css}</style>
</head>
<body>
    <div class="page-container">
        ${headerSection}
        ${summarySection}
        ${chartSection}
        ${detailSections}
    </div>
</body>
</html>`;
    }
    
    /**
     * Generate CSS styles
     */
    generateCSS() {
        return `
            :root {
                --primary-color: #2554C7;
                --header-text-color: #FFFFFF;
                --border-color: #333333;
                --font-family: 'Segoe UI', Arial, sans-serif;
                --background-color: #FAFAFA;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: var(--font-family);
                background-color: var(--background-color);
                line-height: 1.4;
            }
            
            .page-container {
                padding: 20px;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            h2 {
                color: var(--primary-color);
                font-size: 22px;
                font-weight: 700;
                margin: 25px 0 10px 0;
                border-bottom: 3px solid var(--primary-color);
                padding-bottom: 8px;
            }
            
            h3 {
                color: var(--primary-color);
                font-size: 20px;
                font-weight: 600;
                margin: 20px 0 10px 0;
                border-bottom: 2px solid var(--primary-color);
                padding-bottom: 6px;
            }
            
            .summary-grid {
                width: 100%;
                height: 400px;
                border: 2px solid black;
                border-collapse: collapse;
                text-align: center;
            }
            
            .summary-cell {
                width: 50%;
                height: 200px;
                border: 2px solid black;
                vertical-align: middle;
                padding: 20px;
                font-size: 18px;
            }
            
            .cell-1 { background-color: #e6f7ff; }
            .cell-2 { background-color: #fff3e6; }
            .cell-3 { background-color: #f9f6ff; }
            .cell-4 { background-color: #e8ffe6; }
            
            .audit-details {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin: 20px 0;
            }
            
            .audit-detail-box {
                flex: 1 1 45%;
                border: 1px solid #ccc;
                padding: 8px;
                background: white;
            }
            
            .data-table {
                border-collapse: collapse;
                width: 100%;
                margin-top: 12px;
                border: 1px solid var(--border-color);
                box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                background: white;
            }
            
            .data-table th {
                background-color: var(--primary-color);
                color: var(--header-text-color);
                padding: 12px;
                text-align: left;
                border: 1px solid var(--border-color);
                font-size: 14px;
            }
            
            .data-table td {
                padding: 10px;
                border: 1px solid var(--border-color);
                font-size: 13px;
                vertical-align: top;
            }
            
            .section-header {
                background-color: #FF0000;
                color: white;
                padding: 10px;
                border-radius: 6px;
                font-size: 18px;
                font-weight: bold;
                margin: 20px 0;
            }
            
            .finding-image {
                max-width: 120px;
                height: auto;
                display: block;
                border: 1px solid var(--border-color);
                border-radius: 6px;
            }
            
            .score-badge {
                background: var(--primary-color);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
            }
            
            .performance-badge {
                font-size: 24px;
                margin: 10px 0;
            }
            
            @media print {
                .page-container {
                    padding: 10px;
                }
                
                .summary-grid {
                    page-break-inside: avoid;
                }
                
                .section {
                    page-break-before: auto;
                    page-break-inside: avoid;
                }
            }
        `;
    }
    
    /**
     * Generate header section
     */
    generateHeaderSection(reportData) {
        const performanceBadge = this.getPerformanceBadge(reportData.overallScore);
        
        return `
            <table class="summary-grid">
                <tr>
                    <td class="summary-cell cell-1">
                        <h3>Section 1</h3>
                        <p>Food Safety Department</p>
                    </td>
                    <td class="summary-cell cell-2">
                        <h3>Section 2</h3>
                        <p><span class="score-badge">${reportData.overallScore}%</span></p>
                    </td>
                </tr>
                <tr>
                    <td class="summary-cell cell-3">
                        <h3>Section 3</h3>
                        <p>Performance Rating</p>
                    </td>
                    <td class="summary-cell cell-4">
                        <h3>Section 4</h3>
                        <div class="performance-badge">${performanceBadge}</div>
                    </td>
                </tr>
            </table>
        `;
    }
    
    /**
     * Generate summary section with audit details
     */
    generateSummarySection(reportData) {
        return `
            <h2>📋 Audit Report - Document #${reportData.auditDetails.documentNumber}</h2>
            
            <h3>PREMISES DETAILS</h3>
            <div class="audit-details">
                <div class="audit-detail-box">
                    <b><u>Document Number:</u></b> ${reportData.auditDetails.documentNumber}<br>
                    <b><u>Date of Audit:</u></b> ${reportData.auditDetails.dateOfAudit}<br>
                    <b><u>Auditor:</u></b> ${reportData.auditDetails.auditor}
                </div>
                <div class="audit-detail-box">
                    <b><u>Accompanied by:</u></b> ${reportData.auditDetails.accompaniedBy}<br>
                    <b><u>Time of Audit:</u></b> ${reportData.auditDetails.timeOfAudit}<br>
                    <b><u>Store Name:</u></b> ${reportData.auditDetails.storeName}
                </div>
            </div>
            
            <h3>AUDIT DETAILS</h3>
            <div class="audit-details">
                <div class="audit-detail-box">
                    <u>Time In:</u> ${reportData.auditDetails.timeIn}<br>
                    <u>Time Out:</u> ${reportData.auditDetails.timeOut}
                </div>
                <div class="audit-detail-box">
                    <u>Cycle:</u> ${reportData.auditDetails.cycle}<br>
                    <u>Overall Score:</u> <span class="score-badge">${reportData.overallScore}%</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate chart/data table section
     */
    generateChartSection(reportData) {
        let chartRows = '';
        let index = 1;
        
        for (const [sectionKey, section] of Object.entries(reportData.sections)) {
            chartRows += `
                <tr>
                    <td style="width:30px; text-align:center;">${index}</td>
                    <td>${section.title}</td>
                    <td>${section.score}%</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                </tr>
            `;
            index++;
        }
        
        return `
            <h3>📊 Data Table</h3>
            <table class="data-table">
                <tr>
                    <th>#</th>
                    <th>Category</th>
                    <th>Current Score</th>
                    <th>C1 Score</th>
                    <th>C2 Score</th>
                    <th>C3 Score</th>
                    <th>C4 Score</th>
                </tr>
                ${chartRows}
            </table>
        `;
    }
    
    /**
     * Generate detailed sections for each category
     */
    generateDetailSections(reportData) {
        let sectionsHtml = '';
        
        for (const [sectionKey, section] of Object.entries(reportData.sections)) {
            sectionsHtml += this.generateSectionHTML(section);
        }
        
        return sectionsHtml;
    }
    
    /**
     * Generate HTML for individual section
     */
    generateSectionHTML(section) {
        const checklistRows = section.data.checklist.map((item, index) => `
            <tr>
                <td>${item.referenceValue || index + 1}</td>
                <td><span style="color:black; font-weight:bold;">${item.title}</span></td>
                <td>${item.answer !== 'NA' ? `<span style="color:black; font-weight:bold;">${item.coefficient}</span>` : ''}</td>
                <td>${item.answer}</td>
                <td><span style="color:black;">${item.comments}</span></td>
                <td>${item.picture ? `<img src="${item.picture}" class="finding-image" alt="Evidence">` : ''}</td>
            </tr>
        `).join('');
        
        const findingRows = section.data.findings.map((finding, index) => `
            <tr>
                <td>${finding.referenceValue || index + 1}</td>
                <td>${finding.finding}</td>
                <td>${finding.priority}</td>
                <td>${finding.picture ? `<img src="${finding.picture}" class="finding-image" alt="Finding">` : ''}</td>
                <td>${finding.correctiveAction}</td>
            </tr>
        `).join('');
        
        return `
            <div class="section">
                <h3>${section.icon} ${section.title} - Score: ${section.score}%</h3>
                
                <table class="data-table">
                    <tr>
                        <th>#</th>
                        <th>Criteria</th>
                        <th>Coef</th>
                        <th>Answer</th>
                        <th>Comments</th>
                        <th>Picture</th>
                    </tr>
                    ${checklistRows}
                </table>
                
                ${section.data.findings.length > 0 ? `
                    <div class="section-header">
                        ⚠️ REQUIRED ACTIONS - ${section.title}
                    </div>
                    
                    <table class="data-table">
                        <tr>
                            <th>#</th>
                            <th>Finding</th>
                            <th>Severity</th>
                            <th>Picture</th>
                            <th>Corrective Action</th>
                        </tr>
                        ${findingRows}
                    </table>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Get performance badge based on score
     */
    getPerformanceBadge(score) {
        if (score === 100) return '🏆 Perfect Champion!';
        if (score >= 90) return '🥇 Gold Medal';
        if (score >= 80) return '🥈 Silver Medal';
        if (score >= 70) return '🥉 Bronze Medal';
        return '🎖️ Keep Improving';
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        console.log('🚀 Starting HTML Food Safety Audit Report Generator...');
        
        // Get document number from command line arguments
        const documentNumber = process.argv[2];
        if (!documentNumber) {
            console.error('❌ Document number is required!');
            console.log('Usage: npm run generate-html-report [DOCUMENT_NUMBER]');
            console.log('Example: npm run generate-html-report DOC-001');
            process.exit(1);
        }
        
        const generator = new HTMLReportGenerator({
            outputDir: './reports'
        });
        
        // Generate report with document number and audit details
        const result = await generator.generateHTMLReport({
            documentNumber: documentNumber,
            auditor: 'Food Safety Inspector',
            accompaniedBy: 'Store Manager',
            dateOfAudit: new Date().toLocaleDateString(),
            timeOfAudit: new Date().toLocaleTimeString(),
            timeIn: '09:00 AM',
            timeOut: '11:30 AM',
            cycle: 'Q4 2025',
            storeName: 'Operations Store'
        });
        
        console.log('✅ HTML report generation completed successfully!');
        console.log(`📄 Report Path: ${result.reportPath}`);
        console.log(`� Document Number: ${documentNumber}`);
        console.log(`�📊 Overall Score: ${result.overallScore}%`);
        console.log(`🔍 Sections Processed: ${Object.keys(result.data.sections).length}`);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error generating HTML report:', error);
        
        if (error.message.includes('Document number is required')) {
            console.log('\n💡 Usage Examples:');
            console.log('   npm run generate-html-report DOC-001');
            console.log('   npm run generate-html-report AUDIT-2025-001');
            console.log('   npm run generate-html-report 12345');
        }
        
        process.exit(1);
    }
}

// Export for use as module
module.exports = HTMLReportGenerator;

// Run if called directly
if (require.main === module) {
    main();
}