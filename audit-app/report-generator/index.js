/**
 * Report Generator - Main Entry Point
 * Orchestrates all services to generate audit reports
 */

const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

// Import services
const ConfigService = require('./services/config-service');
const DataService = require('./services/data-service');
const ScoringService = require('./services/scoring-service');
const ImageService = require('./services/image-service');
const TemplateEngine = require('./services/template-engine');
const SchemaColorsService = require('../services/schema-colors-service');
const PDFExportService = require('./services/pdf-export-service');

class ReportGenerator {
    constructor(options = {}) {
        this.pool = options.pool || null;
        this.outputDir = options.outputDir || path.join(__dirname, '..', '..', 'reports');
        
        // Initialize services
        this.configService = new ConfigService(this.pool);
        this.dataService = new DataService(this.pool);
        this.scoringService = new ScoringService();
        this.imageService = new ImageService();
        this.templateEngine = new TemplateEngine();
        this.schemaColorsService = new SchemaColorsService(this.pool);
        this.pdfExportService = new PDFExportService({ outputDir: this.outputDir });
        
        // DB config for standalone use
        this.dbConfig = options.dbConfig || {
            server: process.env.SQL_SERVER || 'PowerApps-Repor',
            database: process.env.SQL_DATABASE || 'FoodSafetyDB',
            user: process.env.SQL_USER || 'sa',
            password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };
    }

    /**
     * Set database pool (for use with existing connection)
     * @param {Object} pool - SQL connection pool
     */
    setPool(pool) {
        this.pool = pool;
        this.configService.setPool(pool);
        this.dataService.setPool(pool);
        this.schemaColorsService.setPool(pool);
    }

    /**
     * Ensure database connection
     */
    async ensureConnection() {
        if (!this.pool) {
            console.log('🔌 Connecting to database...');
            this.pool = await sql.connect(this.dbConfig);
            this.configService.setPool(this.pool);
            this.dataService.setPool(this.pool);
            this.schemaColorsService.setPool(this.pool);
            console.log('   ✅ Database connected');
        }
        return this.pool;
    }

    /**
     * Generate complete audit report
     * @param {number} auditId - Audit ID
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Result with filePath and data
     */
    async generateReport(auditId, options = {}) {
        try {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 Generating Report for Audit ID: ${auditId}`);
            console.log(`${'='.repeat(60)}\n`);

            // Ensure database connection
            await this.ensureConnection();

            // 1. Fetch audit data
            console.log('📊 Step 1: Fetching audit data...');
            const auditData = await this.dataService.getAuditData(auditId);
            
            // 2. Get settings/thresholds for this schema
            console.log('⚙️ Step 2: Loading settings...');
            const settings = await this.configService.getSettings(auditData.schemaId);
            const threshold = settings.overallPassingGrade;

            // 3. Fetch section scores
            console.log('📈 Step 3: Fetching section scores...');
            const sectionScores = await this.dataService.getSectionScores(auditId);

            // 4. Fetch all responses grouped by section
            console.log('📝 Step 4: Fetching responses...');
            const sections = await this.dataService.getAuditResponses(auditId);

            // Merge section scores with sections
            for (const section of sections) {
                const scoreData = sectionScores.find(s => s.sectionId === section.sectionId);
                if (scoreData) {
                    section.percentage = scoreData.percentage;
                    section.earnedScore = scoreData.earnedScore;
                    section.maxScore = scoreData.maxScore;
                }
            }

            // 5. Fetch pictures (URL-based, no file duplication)
            console.log('🖼️ Step 5: Fetching pictures...');
            const pictures = await this.dataService.getAuditPictures(auditId);

            // 6. Fetch findings
            console.log('🔍 Step 6: Fetching findings...');
            const findings = await this.dataService.getFindings(auditId);

            // 7. Fetch temperature readings (optional)
            console.log('🌡️ Step 7: Fetching temperature readings...');
            const temperatureReadings = await this.dataService.getTemperatureReadings(auditId);

            // 7.5 Fetch historical audits for same store (for C1-C6 display)
            console.log('📜 Step 7.5: Fetching historical audits...');
            const historicalAudits = await this.dataService.getHistoricalAudits(auditData.storeId, auditId);

            // 7.6 Fetch categories for data table grouping
            console.log('📂 Step 7.6: Fetching categories...');
            const categories = await this.dataService.getCategoriesWithSections(auditData.schemaId);

            // 7.7 Fetch historical findings for repetitive issue detection
            console.log('🔄 Step 7.7: Fetching historical findings...');
            const historicalFindings = await this.dataService.getHistoricalFindings(auditData.storeId, auditId);

            // 7.8 Fetch schema colors
            console.log('🎨 Step 7.8: Fetching schema colors...');
            const schemaColors = await this.schemaColorsService.getSchemaColors(auditData.schemaId);

            // 8. Build report data structure
            console.log('📦 Step 8: Building report data...');
            const reportData = {
                // Audit info
                auditId: auditData.auditId,
                documentNumber: auditData.documentNumber,
                storeCode: auditData.storeCode,
                storeName: auditData.storeName,
                schemaId: auditData.schemaId,
                schemaName: auditData.schemaName,
                reportTitle: auditData.reportTitle,
                documentPrefix: auditData.documentPrefix,
                edition: auditData.edition,
                creationDate: auditData.creationDate,
                revisionDate: auditData.revisionDate,
                auditDate: auditData.auditDate,
                timeIn: auditData.timeIn,
                timeOut: auditData.timeOut,
                cycle: auditData.cycle,
                year: auditData.year,
                auditors: auditData.auditors,
                accompaniedBy: auditData.accompaniedBy,
                status: auditData.status,
                
                // Scores
                totalScore: auditData.totalScore,
                threshold,
                sectionScores,
                
                // Data
                sections,
                pictures,
                findings,
                temperatureReadings,
                historicalAudits,
                categories,
                historicalFindings,
                schemaColors,
                
                // Metadata
                generatedAt: new Date().toISOString()
            };

            // 9. Generate HTML
            console.log('🎨 Step 9: Generating HTML...');
            const html = await this.templateEngine.buildDocument(reportData, options);

            // 10. Save report
            console.log('💾 Step 10: Saving report...');
            const reportBaseName = `Audit_Report_${auditData.documentNumber}`;
            const fileName = `${reportBaseName}.html`;
            const filePath = path.join(this.outputDir, fileName);

            // Ensure output directory exists
            await fs.mkdir(this.outputDir, { recursive: true });

            // Write file
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ Report generated successfully!`);
            console.log(`📄 File: ${filePath}`);
            console.log(`📊 Score: ${auditData.totalScore}% (${auditData.totalScore >= threshold ? 'PASS ✅' : 'FAIL ❌'})`);
            console.log(`🏪 Store: ${auditData.storeName}`);
            console.log(`${'='.repeat(60)}\n`);

            return {
                success: true,
                filePath,
                fileName,
                html,
                data: reportData
            };

        } catch (error) {
            console.error('❌ Error generating report:', error);
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    /**
     * Generate action plan report
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Result with findings and file path
     */
    async generateActionPlan(auditId) {
        try {
            console.log(`\n📋 Generating Action Plan for Audit ID: ${auditId}`);

            await this.ensureConnection();

            // Fetch data
            const auditData = await this.dataService.getAuditData(auditId);
            const findings = await this.dataService.getFindings(auditId);
            const pictures = await this.dataService.getAuditPictures(auditId);

            // Build action plan HTML
            const html = this.buildActionPlanHtml({
                ...auditData,
                findings,
                pictures
            });

            // Save
            const fileName = `Action_Plan_${auditData.documentNumber}.html`;
            const filePath = path.join(this.outputDir, fileName);

            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`✅ Action plan generated: ${filePath}`);

            return {
                success: true,
                filePath,
                fileName,
                html,
                findings,
                totalFindings: findings.length,
                highPriority: findings.filter(f => f.priority === 'High').length,
                mediumPriority: findings.filter(f => f.priority === 'Medium').length,
                lowPriority: findings.filter(f => f.priority === 'Low').length
            };

        } catch (error) {
            console.error('❌ Error generating action plan:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build action plan HTML
     */
    buildActionPlanHtml(data) {
        const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
        const sortedFindings = [...data.findings].sort((a, b) => 
            (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
        );

        const rows = sortedFindings.map((f, idx) => {
            const pics = data.pictures[f.responseId] || [];
            const picsHtml = pics.map(p => 
                `<img src="${p.dataUrl}" style="max-width:80px;max-height:60px;margin:2px;border-radius:4px;cursor:pointer;" onclick="openImageModal(this.src)">`
            ).join('');

            const priorityClass = f.priority ? `priority-${f.priority.toLowerCase()}` : '';
            
            return `
                <tr class="${priorityClass}">
                    <td>${idx + 1}</td>
                    <td>${f.referenceValue || ''}</td>
                    <td>${f.sectionName || ''}</td>
                    <td>${f.title || ''}</td>
                    <td>${f.finding || ''}</td>
                    <td>${f.correctiveAction || f.cr || ''}</td>
                    <td><span class="priority-badge ${priorityClass}">${f.priority || '-'}</span></td>
                    <td>${picsHtml || '-'}</td>
                </tr>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Action Plan - ${data.documentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; background: white; }
        .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 1.5rem; margin-bottom: 10px; }
        .header-info { display: flex; gap: 30px; flex-wrap: wrap; font-size: 0.9rem; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-card { flex: 1; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.high { background: #fee2e2; color: #991b1b; }
        .stat-card.medium { background: #fef3c7; color: #92400e; }
        .stat-card.low { background: #dbeafe; color: #1e40af; }
        .stat-card.total { background: #f1f5f9; color: #334155; }
        .stat-value { font-size: 2rem; font-weight: bold; }
        .stat-label { font-size: 0.85rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; }
        .priority-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
        .priority-high { background: #fee2e2; color: #991b1b; }
        .priority-medium { background: #fef3c7; color: #92400e; }
        .priority-low { background: #dbeafe; color: #1e40af; }
        tr.priority-high { background: #fef2f2; }
        tr.priority-medium { background: #fffbeb; }
        tr.priority-low { background: #eff6ff; }
        .image-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .modal-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 2rem; cursor: pointer; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Action Plan Report</h1>
            <div class="header-info">
                <span><strong>Document:</strong> ${data.documentNumber}</span>
                <span><strong>Store:</strong> ${data.storeName} (${data.storeCode})</span>
                <span><strong>Date:</strong> ${new Date(data.auditDate).toLocaleDateString()}</span>
                <span><strong>Auditor:</strong> ${data.auditors}</span>
            </div>
        </div>

        <div class="stats">
            <div class="stat-card total">
                <div class="stat-value">${data.findings.length}</div>
                <div class="stat-label">Total Findings</div>
            </div>
            <div class="stat-card high">
                <div class="stat-value">${data.findings.filter(f => f.priority === 'High').length}</div>
                <div class="stat-label">High Priority</div>
            </div>
            <div class="stat-card medium">
                <div class="stat-value">${data.findings.filter(f => f.priority === 'Medium').length}</div>
                <div class="stat-label">Medium Priority</div>
            </div>
            <div class="stat-card low">
                <div class="stat-value">${data.findings.filter(f => f.priority === 'Low').length}</div>
                <div class="stat-label">Low Priority</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Ref</th>
                    <th>Section</th>
                    <th>Question</th>
                    <th>Finding</th>
                    <th>Corrective Action</th>
                    <th>Priority</th>
                    <th>Pictures</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()} | Food Safety Audit System</p>
        </div>
    </div>

    <div id="imageModal" class="image-modal" onclick="closeImageModal()">
        <span class="modal-close">&times;</span>
        <img id="modalImage" class="modal-content">
    </div>

    <script>
        function openImageModal(src) {
            document.getElementById('imageModal').style.display = 'flex';
            document.getElementById('modalImage').src = src;
        }
        function closeImageModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageModal(); });
    </script>
</body>
</html>`;
    }

    /**
     * Generate department report
     * @param {number} auditId - Audit ID
     * @param {string} department - Department name
     * @returns {Promise<Object>} - Result
     */
    async generateDepartmentReport(auditId, department) {
        try {
            console.log(`\n🏢 Generating ${department} Department Report for Audit ID: ${auditId}`);

            await this.ensureConnection();

            // Fetch data
            const auditData = await this.dataService.getAuditData(auditId);
            
            // Get findings for this department
            const allFindings = await this.dataService.getFindings(auditId);
            const deptFindings = allFindings.filter(f => 
                f.department && f.department.toLowerCase().includes(department.toLowerCase())
            );

            // Fetch pictures (URL-based, no file duplication)
            const pictures = await this.dataService.getAuditPictures(auditId);

            // Build department report HTML (similar to action plan but filtered)
            const html = this.buildDepartmentReportHtml({
                ...auditData,
                department,
                findings: deptFindings,
                pictures
            });

            // Save
            const fileName = `${department}_Report_${auditData.documentNumber}.html`;
            const filePath = path.join(this.outputDir, fileName);

            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`✅ Department report generated: ${filePath}`);

            return {
                success: true,
                filePath,
                fileName,
                html,
                department,
                findings: deptFindings,
                totalFindings: deptFindings.length
            };

        } catch (error) {
            console.error('❌ Error generating department report:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build department report HTML
     */
    buildDepartmentReportHtml(data) {
        const deptColors = {
            'Maintenance': { bg: '#dbeafe', text: '#1e40af', header: '#3b82f6' },
            'Procurement': { bg: '#f3e8ff', text: '#7c3aed', header: '#8b5cf6' },
            'Cleaning': { bg: '#dcfce7', text: '#166534', header: '#22c55e' }
        };
        const colors = deptColors[data.department] || { bg: '#f1f5f9', text: '#334155', header: '#64748b' };

        // Collect all pictures for galleries
        const allFindingPics = [];
        const allCorrectivePics = [];
        const allGoodPics = [];

        const rows = data.findings.map((f, idx) => {
            const pics = data.pictures[f.responseId] || [];
            
            // Categorize pictures and add to galleries
            for (const p of pics) {
                const picType = (p.pictureType || 'finding').toLowerCase();
                const picData = {
                    dataUrl: p.dataUrl,
                    referenceValue: f.referenceValue || '',
                    title: f.title || ''
                };
                if (picType === 'corrective') {
                    allCorrectivePics.push(picData);
                } else if (picType === 'good') {
                    allGoodPics.push(picData);
                } else {
                    allFindingPics.push(picData);
                }
            }
            
            const picsHtml = pics.map(p => 
                `<img src="${p.dataUrl}" style="max-width:80px;max-height:60px;margin:2px;border-radius:4px;cursor:pointer;" onclick="openImageModal(this.src)">`
            ).join('');

            const priorityClass = f.priority ? `priority-${f.priority.toLowerCase()}` : '';
            
            return `
                <tr id="ref-${f.referenceValue || idx}">
                    <td>${idx + 1}</td>
                    <td>${f.referenceValue || ''}</td>
                    <td>${f.title || ''}</td>
                    <td>${f.finding || ''}</td>
                    <td>${f.correctiveAction || f.cr || ''}</td>
                    <td><span class="priority-badge ${priorityClass}">${f.priority || '-'}</span></td>
                    <td>${picsHtml || '-'}</td>
                </tr>
            `;
        }).join('');

        // Build gallery sections
        const buildGallery = (pics, title, bgColor) => {
            if (pics.length === 0) return '';
            const galleryItems = pics.map(p => `
                <div style="display:inline-block;margin:8px;text-align:center;">
                    <img src="${p.dataUrl}" style="max-width:200px;max-height:150px;border-radius:8px;cursor:pointer;border:2px solid #e2e8f0;" onclick="openImageModal(this.src)">
                    <div style="font-size:0.8rem;color:#64748b;margin-top:4px;">${p.referenceValue}</div>
                </div>
            `).join('');
            return `
                <div style="margin-top:30px;padding:20px;background:${bgColor};border-radius:8px;">
                    <h3 style="margin-bottom:15px;">${title} (${pics.length})</h3>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;">
                        ${galleryItems}
                    </div>
                </div>
            `;
        };

        const findingGallery = buildGallery(allFindingPics, '📸 Finding Pictures', '#fef3c7');
        const correctiveGallery = buildGallery(allCorrectivePics, '🔧 Corrective Action Pictures', '#dbeafe');
        const goodGallery = buildGallery(allGoodPics, '✅ Good Observation Pictures', '#dcfce7');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.department} Report - ${data.documentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; background: white; }
        .header { background: ${colors.header}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 1.5rem; margin-bottom: 10px; }
        .header-info { display: flex; gap: 30px; flex-wrap: wrap; font-size: 0.9rem; }
        .dept-badge { display: inline-block; padding: 5px 15px; background: rgba(255,255,255,0.2); border-radius: 20px; margin-bottom: 10px; }
        .summary { background: ${colors.bg}; color: ${colors.text}; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .summary-value { font-size: 2.5rem; font-weight: bold; }
        .summary-label { font-size: 0.9rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e2e8f0; }
        th { background: ${colors.bg}; font-weight: 600; color: ${colors.text}; }
        .priority-badge { padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
        .priority-high { background: #fee2e2; color: #991b1b; }
        .priority-medium { background: #fef3c7; color: #92400e; }
        .priority-low { background: #dbeafe; color: #1e40af; }
        .image-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .modal-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 2rem; cursor: pointer; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem; margin-top: 30px; }
        .no-items { text-align: center; padding: 40px; color: #64748b; }
        .action-buttons { display: flex; gap: 10px; justify-content: center; margin: 20px 0; flex-wrap: wrap; }
        .action-buttons button { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .btn-print-fast { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
        .btn-print-fast:hover { transform: translateY(-2px); }
        .btn-print-full { background: ${colors.header}; color: white; }
        .btn-print-full:hover { transform: translateY(-2px); opacity: 0.9; }
        .btn-download-word { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; }
        .btn-download-word:hover { transform: translateY(-2px); }
        @media print { 
            .no-print { display: none !important; }
            .container { max-width: 100%; }
            body { background: white; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="dept-badge">🏢 ${data.department} Department</span>
            <h1>Follow-up Report</h1>
            <div class="header-info">
                <span><strong>Document:</strong> ${data.documentNumber}</span>
                <span><strong>Store:</strong> ${data.storeName}</span>
                <span><strong>Date:</strong> ${new Date(data.auditDate).toLocaleDateString()}</span>
            </div>
        </div>

        <div class="action-buttons no-print">
            <button id="printCompressedBtn" class="btn-print-fast" onclick="printCompressed()">🖨️ Print (Fast - Compressed)</button>
            <button class="btn-print-full" onclick="window.print()">🖨️ Print (Full Quality)</button>
            <button id="downloadWordBtn" class="btn-download-word" onclick="downloadWord()">📄 Download Word</button>
        </div>

        <script>
            // Store audit info for Word download
            window.auditId = ${data.auditId};
            window.department = '${data.department}';
        </script>

        <div class="summary">
            <div class="summary-value">${data.findings.length}</div>
            <div class="summary-label">Items Assigned to ${data.department}</div>
        </div>

        ${data.findings.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Ref</th>
                    <th>Question</th>
                    <th>Finding</th>
                    <th>Corrective Action</th>
                    <th>Priority</th>
                    <th>Pictures</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        ` : '<div class="no-items">No items assigned to this department.</div>'}

        ${findingGallery}
        ${correctiveGallery}
        ${goodGallery}

        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()} | Food Safety Audit System</p>
        </div>
    </div>

    <div id="imageModal" class="image-modal" onclick="closeImageModal()">
        <span class="modal-close">&times;</span>
        <img id="modalImage" class="modal-content">
    </div>

    <script>
        function openImageModal(src) {
            document.getElementById('imageModal').style.display = 'flex';
            document.getElementById('modalImage').src = src;
        }
        function closeImageModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImageModal(); });
        
        // Compress images and print - reduces PDF size significantly
        async function printCompressed() {
            const btn = document.getElementById('printCompressedBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '⏳ Compressing images...';
            
            const images = document.querySelectorAll('img');
            const totalImages = images.length;
            
            try {
                let processed = 0;
                
                for (const img of images) {
                    // Skip modal image or small images
                    if (img.id === 'modalImage' || img.naturalWidth < 100 || img.naturalHeight < 100) {
                        processed++;
                        continue;
                    }
                    
                    // Compress using canvas
                    await new Promise((resolve) => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Reduce size: max 600px wide, maintain aspect ratio
                        const maxWidth = 600;
                        const scale = Math.min(1, maxWidth / img.naturalWidth);
                        canvas.width = img.naturalWidth * scale;
                        canvas.height = img.naturalHeight * scale;
                        
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        // Convert to JPEG at 50% quality
                        const compressedSrc = canvas.toDataURL('image/jpeg', 0.5);
                        img.src = compressedSrc;
                        
                        processed++;
                        if (processed % 20 === 0) {
                            btn.innerHTML = '⏳ Compressing... ' + processed + '/' + totalImages;
                        }
                        
                        resolve();
                    });
                }
                
                btn.innerHTML = '🖨️ Opening print dialog...';
                await new Promise(r => setTimeout(r, 500));
                window.print();
                
                btn.innerHTML = '✅ Print ready';
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }, 2000);
                
            } catch (error) {
                console.error('Compression error:', error);
                window.print();
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }        
        // Download as Word document (server-side generation)
        async function downloadWord() {
            const btn = document.getElementById('downloadWordBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '⏳ Generating Word...';
            
            try {
                // Call server endpoint to generate Word document
                const response = await fetch(\`/api/audits/\${window.auditId}/department-report/\${window.department}/download-word\`);
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to generate Word document');
                }
                
                // Get blob and download
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`\${window.department}_Report_${data.documentNumber}.docx\`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                btn.innerHTML = '✅ Downloaded';
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }, 2000);
                
            } catch (error) {
                console.error('Word download error:', error);
                alert('Failed to download Word document: ' + error.message);
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    </script>
</body>
</html>`;
    }

    /**
     * Get report data without generating file (for API response)
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Report data
     */
    async getReportData(auditId) {
        try {
            await this.ensureConnection();

            const auditData = await this.dataService.getAuditData(auditId);
            const settings = await this.configService.getSettings(auditData.schemaId);
            const sectionScores = await this.dataService.getSectionScores(auditId);
            const sections = await this.dataService.getAuditResponses(auditId);
            const pictures = await this.dataService.getAuditPictures(auditId);
            const findings = await this.dataService.getFindings(auditId);

            return {
                success: true,
                data: {
                    ...auditData,
                    threshold: settings.overallPassingGrade,
                    sectionScores,
                    sections,
                    pictures,
                    findings,
                    generatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('❌ Error getting report data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate PDF from an existing HTML report
     * @param {number} auditId - Audit ID
     * @param {Object} options - PDF generation options
     * @returns {Promise<Object>} - Result with PDF file path
     */
    async generatePDF(auditId, options = {}) {
        try {
            console.log(`\n📄 Generating PDF for Audit ID: ${auditId}`);

            // First generate the HTML report
            const htmlResult = await this.generateReport(auditId, options);
            
            if (!htmlResult.success) {
                throw new Error(htmlResult.error || 'Failed to generate HTML report');
            }

            // Generate PDF from HTML
            const pdfBuffer = await this.pdfExportService.generatePDFWithPageBreaks(
                htmlResult.html,
                {
                    documentNumber: htmlResult.data.documentNumber,
                    storeName: htmlResult.data.storeName,
                    auditDate: htmlResult.data.auditDate,
                    ...options
                }
            );

            // Save PDF file
            const pdfFileName = `Audit_Report_${htmlResult.data.documentNumber}.pdf`;
            const pdfPath = path.join(this.outputDir, pdfFileName);

            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(pdfPath, pdfBuffer);

            console.log(`✅ PDF generated: ${pdfPath}`);

            return {
                success: true,
                filePath: pdfPath,
                fileName: pdfFileName,
                htmlFilePath: htmlResult.filePath,
                data: htmlResult.data
            };

        } catch (error) {
            console.error('❌ Error generating PDF:', error);
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    /**
     * Generate Summary PDF (2-3 pages with key info only)
     * @param {number} auditId - Audit ID
     * @param {Object} options - PDF generation options
     * @returns {Promise<Object>} - Result with PDF file path
     */
    async generateSummaryPDF(auditId, options = {}) {
        try {
            console.log(`\n📋 Generating Summary PDF for Audit ID: ${auditId}`);

            // First generate the HTML report
            const htmlResult = await this.generateReport(auditId, options);
            
            if (!htmlResult.success) {
                throw new Error(htmlResult.error || 'Failed to generate HTML report');
            }

            // Generate Summary PDF (hides detailed sections)
            const pdfBuffer = await this.pdfExportService.generateSummaryPDF(
                htmlResult.html,
                {
                    documentNumber: htmlResult.data.documentNumber,
                    ...options
                }
            );

            // Save PDF file
            const pdfFileName = `Audit_Summary_${htmlResult.data.documentNumber}.pdf`;
            const pdfPath = path.join(this.outputDir, pdfFileName);

            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(pdfPath, pdfBuffer);

            console.log(`✅ Summary PDF generated: ${pdfPath}`);

            return {
                success: true,
                filePath: pdfPath,
                fileName: pdfFileName,
                isSummary: true,
                data: htmlResult.data
            };

        } catch (error) {
            console.error('❌ Error generating summary PDF:', error);
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    /**
     * Close PDF browser instance (call when done)
     */
    async cleanup() {
        await this.pdfExportService.closeBrowser();
    }
}

module.exports = ReportGenerator;
