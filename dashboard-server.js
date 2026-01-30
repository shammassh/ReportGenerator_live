#!/usr/bin/env node

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { exec, spawn } = require('child_process');
const util = require('util');

// Load environment variables
require('dotenv').config();

// Choose connector based on AUTH_METHOD
function getConnector(config = {}) {
    const authMethod = process.env.AUTH_METHOD || 'auto';
    
    switch (authMethod) {
        case 'graph':
        case 'graphql':
            const SimpleGraphConnector = require('./src/simple-graph-connector.js');
            return new SimpleGraphConnector(config);
        case 'interactive':
            const TruePersistentConnector = require('./src/true-persistent-connector');
            return new TruePersistentConnector(config);
        case 'auto':
        default:
            // Auto-detect: prefer Simple Graph if Azure credentials are available
            if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
                const SimpleGraphConnector = require('./src/simple-graph-connector.js');
                return new SimpleGraphConnector(config);
            } else {
                const TruePersistentInteractiveConnector = require('./src/true-persistent-connector');
                return new TruePersistentInteractiveConnector(config);
            }
    }
}

// Import existing modules
const DocumentNumberLister = require('./list-document-numbers');
// Use the NEW refactored report generator
const ReportGenerator = require('./enhanced-report-generator/report-generator');
const ConfigService = require('./enhanced-report-generator/services/config-service');
const ActionPlanReportGenerator = require('./generate-action-plan-report');
const ActionPlanService = require('./src/action-plan-service');
const DepartmentFollowupReportGenerator = require('./department-followup-reports/index');

const execPromise = util.promisify(exec);

/**
 * Dashboard API Server
 * Provides REST API endpoints for the Food Safety Audit Dashboard
 */
class DashboardServer {
    constructor(port = 3000) {
        this.port = port;
        this.documentsDir = path.join(__dirname, 'reports');
        this.documentLister = new DocumentNumberLister();
        
        // Use the connector with authentication auto-detection
        this.connector = getConnector({
            siteUrl: process.env.SHAREPOINT_SITE_URL || 'https://spinneysleb.sharepoint.com/operations/',
            outputDir: './sharepoint-data',
            pageSize: 200
        });
        
        // Initialize ConfigService for dynamic thresholds
        this.configService = new ConfigService(this.connector);
        
        // Initialize the NEW refactored report generator with connector
        this.reportGenerator = new ReportGenerator(this.connector, {
            outputDir: this.documentsDir
        });
        
        this.actionPlanGenerator = new ActionPlanReportGenerator({ 
            outputDir: this.documentsDir,
            reportGenerator: this.reportGenerator
        });
        
        // Initialize department followup report generator
        this.departmentGenerator = new DepartmentFollowupReportGenerator({
            outputDir: this.documentsDir
        });
        
        console.log(`🔧 Dashboard AUTH_METHOD: ${process.env.AUTH_METHOD || 'auto'}`);
        console.log(`🔧 Dashboard using connector: ${this.connector.constructor.name}`);
    }

    start() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        server.listen(this.port, () => {
            console.log(`🚀 Dashboard API Server running on http://localhost:${this.port}`);
            console.log(`📊 Dashboard URL: http://localhost:${this.port}/dashboard`);
            console.log(`📁 Serving reports from: ${this.documentsDir}`);
            
            // Open dashboard automatically
            this.openDashboard();
        });

        // Handle server shutdown gracefully
        process.on('SIGINT', async () => {
            console.log('\n📴 Shutting down dashboard server...');
            
            // Cleanup persistent SharePoint connection
            if (this.connector && this.connector.disconnect) {
                try {
                    console.log('🔌 Closing SharePoint connection...');
                    await this.connector.disconnect();
                } catch (error) {
                    console.warn('Warning during cleanup:', error.message);
                }
            }
            
            server.close();
            process.exit(0);
        });

        return server;
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;

        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            // Route handling
            if (pathname === '/dashboard' || pathname === '/') {
                await this.serveDashboard(res);
            } else if (pathname === '/api/documents') {
                await this.getDocuments(res);
            } else if (pathname === '/api/generate-report') {
                await this.generateReport(req, res);
            } else if (pathname === '/api/generate-action-plan') {
                await this.generateActionPlan(req, res);
            } else if (pathname === '/api/generate-department-followup') {
                await this.generateDepartmentFollowup(req, res);
            } else if (pathname === '/api/export-pdf') {
                await this.exportPDF(req, res);
            } else if (pathname === '/api/export-doc') {
                await this.exportDOC(req, res);
            } else if (pathname === '/api/thresholds') {
                await this.getThresholds(res);
            } else if (pathname.startsWith('/reports/')) {
                await this.serveReport(pathname, res);
            } else {
                this.send404(res);
            }
        } catch (error) {
            console.error('❌ Request error:', error);
            this.sendError(res, 500, 'Internal Server Error');
        }
    }

    // Serve the dashboard HTML
    async serveDashboard(res) {
        try {
            const dashboardPath = path.join(__dirname, 'dashboard.html');
            const html = await fs.readFile(dashboardPath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } catch (error) {
            console.error('Error serving dashboard:', error);
            this.sendError(res, 500, 'Dashboard not found');
        }
    }

    // Get documents list API endpoint
    async getDocuments(res) {
        try {
            console.log('📡 API: Getting documents from SharePoint...');
            
            // Use existing document lister to get data
            const documents = await this.fetchDocumentsFromSharePoint();
            
            const response = {
                success: true,
                documents: documents,
                total: documents.length,
                timestamp: new Date().toISOString()
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));

        } catch (error) {
            console.error('❌ API Error getting documents:', error);
            this.sendError(res, 500, 'Failed to fetch documents from SharePoint');
        }
    }

    // Get scoring thresholds API endpoint
    async getThresholds(res) {
        try {
            console.log('📊 API: Getting scoring thresholds...');
            
            const thresholds = await this.configService.getScoringThresholds();
            
            const response = {
                success: true,
                thresholds: thresholds,
                timestamp: new Date().toISOString()
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));

        } catch (error) {
            console.error('❌ API Error getting thresholds:', error);
            this.sendError(res, 500, 'Failed to fetch scoring thresholds');
        }
    }

    // Fetch documents from SharePoint using existing lister
    async fetchDocumentsFromSharePoint() {
        try {
            console.log('📊 Connecting to SharePoint to fetch documents...');
            
            // Connect once using persistent connector (same as enhanced HTML report)
            await this.connector.connectToSharePoint();
            
            // Get all available lists to find FS Survey
            const lists = await this.connector.getSharePointLists();
            const fsSurveyList = lists.find(list => list.Title === 'FS Survey');
            
            if (!fsSurveyList) {
                throw new Error('FS Survey list not found');
            }

            // Get survey data using the same method as enhanced HTML report
            const surveyData = await this.getSurveyDataForAllDocuments();

            console.log(`✅ Processed ${surveyData.length} unique documents`);
            return surveyData;

        } catch (error) {
            console.error('❌ Error fetching from SharePoint:', error);
            throw error;
        }
        // Note: We keep the persistent connection alive for subsequent requests
    }

    /**
     * Get survey data for all documents using the same approach as enhanced HTML report
     */
    async getSurveyDataForAllDocuments() {
        try {
            // Get all survey items from FS Survey list
            const surveyItems = await this.connector.getListItems('FS Survey', {
                select: 'ID,Document_x0020_Number,Store_x0020_Name,Created,Auditor,Author/Title,Scor,Cycle',
                expand: 'Author',
                orderby: 'Created desc',
                top: 1000
            });

            // Process and format the documents
            const documents = [];
            const processedDocNumbers = new Set();

            surveyItems.forEach((item, index) => {
                const docNum = item['Document_x0020_Number'] || 
                              item['DocumentNumber'] || 
                              item['Document_Number'];
                              
                if (!docNum || !docNum.trim() || processedDocNumbers.has(docNum)) {
                    return; // Skip invalid or duplicate documents
                }

                processedDocNumbers.add(docNum);

                const storeName = item['Store_x0020_Name'] || item['StoreName'] || 'Unknown Store';
                const created = item.Created || new Date().toISOString();
                
                // Use Author (Created By) field as the auditor
                let auditor = (item.Author && item.Author.Title) || 
                             item.Auditor || 
                             'System Generated';
                
                const score = parseFloat(item.Scor) || 0;
                
                // Debug logging for the first few items
                if (documents.length < 3) {
                    console.log(`🔍 Debug - Document ${docNum}: Raw Scor field = "${item.Scor}", parsed score = ${score}`);
                    console.log(`🔍 Debug - Document ${docNum}: Author field = "${item.Author ? item.Author.Title : 'null'}", Auditor field = "${item.Auditor}"`);
                    console.log(`🔍 Debug - Document ${docNum}: Cycle field = "${item.Cycle}"`);
                }

                // Use the Cycle column from SharePoint
                const cycle = item.Cycle || 'Unknown Cycle';
                
                // Determine status based on score and recent activity
                const status = this.determineStatus(score, created);

                documents.push({
                    documentNumber: docNum.trim(),
                    storeName: storeName,
                    cycle: cycle,
                    auditor: auditor,
                    created: created,
                    score: score,
                    status: status,
                    sections: {
                        foodStorage: item.FoodScore || 0,
                        fridges: item.FridgesScore || 0,
                        utensils: item.UtensilsScore || 0,
                        foodHandling: item.FoodHScore || 0,
                        cleaning: item.CNDScore || 0,
                        hygiene: item.HygScore || 0,
                        restrooms: item.RestroomScore || 0,
                        garbage: item.GarScore || 0,
                        maintenance: item.MaintScore || 0,
                        chemicals: item.ChemScore || 0,
                        monitoring: item.MonitScore || 0,
                        culture: item.CultScore || 0,
                        policies: item.PolScore || 0
                    }
                });
            });

            // Sort by creation date (newest first)
            documents.sort((a, b) => new Date(b.created) - new Date(a.created));

            return documents;

        } catch (error) {
            console.error('❌ Error getting survey data from FS Survey:', error);
            throw error;
        }
    }

    // Determine cycle based on document number pattern or date
    determineCycle(docNumber, created) {
        // Try to extract cycle from document number
        const cycleMatch = docNumber.match(/[C-]([1-4])/i);
        if (cycleMatch) {
            return `C${cycleMatch[1]}`;
        }

        // Determine cycle based on date
        const date = new Date(created);
        const month = date.getMonth() + 1; // 1-based month
        const year = date.getFullYear();

        if (month <= 3) return `Q1 ${year}`;
        if (month <= 6) return `Q2 ${year}`;
        if (month <= 9) return `Q3 ${year}`;
        return `Q4 ${year}`;
    }

    // Determine status based on score and date
    async determineStatus(score, created) {
        const date = new Date(created);
        const now = new Date();
        const daysDiff = (now - date) / (1000 * 60 * 60 * 24);

        if (daysDiff > 30) return 'archived';
        
        // Use dynamic threshold instead of hardcoded 83
        const threshold = await this.configService.getOverallPassingScore();
        if (score >= threshold) return 'completed';
        return 'pending';
    }

    // Generate report API endpoint
    async generateReport(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const { documentNumber } = JSON.parse(body);

            if (!documentNumber) {
                this.sendError(res, 400, 'Document number is required');
                return;
            }

            console.log(`📊 API: Generating report for ${documentNumber}...`);

            // Generate the report using NEW refactored generator
            const result = await this.reportGenerator.generateReport(documentNumber);

            if (result.success) {
                const reportUrl = `/reports/${path.basename(result.filePath)}`;
                
                const response = {
                    success: true,
                    message: `Report generated successfully for ${documentNumber}`,
                    reportUrl: reportUrl,
                    filePath: result.filePath
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } else {
                throw new Error(result.error || 'Failed to generate report');
            }

        } catch (error) {
            console.error('❌ API Error generating report:', error);
            this.sendError(res, 500, `Failed to generate report: ${error.message}`);
        }
    }

    // Generate Action Plan Report API endpoint
    async generateActionPlan(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const { documentNumber } = JSON.parse(body);

            if (!documentNumber) {
                this.sendError(res, 400, 'Document number is required');
                return;
            }

            console.log(`🎯 API: Generating Action Plan Report for ${documentNumber}...`);

            // Generate the action plan report
            const result = await this.actionPlanGenerator.generateActionPlanForDocument(documentNumber);

            if (result.success) {
                const reportUrl = `/reports/${result.fileName}`;
                
                const response = {
                    success: true,
                    message: `Action Plan Report generated successfully for ${documentNumber}`,
                    reportUrl: reportUrl,
                    filePath: result.filePath,
                    correctiveActionsCount: result.correctiveActionsCount,
                    metadata: result.metadata
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } else {
                throw new Error('Failed to generate Action Plan Report');
            }

        } catch (error) {
            console.error('❌ API Error generating Action Plan Report:', error);
            this.sendError(res, 500, `Failed to generate Action Plan Report: ${error.message}`);
        }
    }

    // Generate Department Follow-up Report API endpoint
    async generateDepartmentFollowup(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const { department } = JSON.parse(body);

            if (!department) {
                this.sendError(res, 400, 'Department name is required');
                return;
            }

            console.log(`📦 API: Generating ${department} Department Follow-up Report...`);

            // Generate the department follow-up report
            const result = await this.departmentGenerator.generateReport(department);

            if (result.success) {
                const reportUrl = `/reports/${path.basename(result.filePath)}`;
                
                const response = {
                    success: true,
                    message: `${department} Department Follow-up Report generated successfully`,
                    reportUrl: reportUrl,
                    filePath: result.filePath,
                    itemsCount: result.itemsCount,
                    department: department
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } else {
                throw new Error(result.error || 'Failed to generate Department Follow-up Report');
            }

        } catch (error) {
            console.error('❌ API Error generating Department Follow-up Report:', error);
            this.sendError(res, 500, `Failed to generate Department Follow-up Report: ${error.message}`);
        }
    }

    // Export to PDF API endpoint
    async exportPDF(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const { documentNumber } = JSON.parse(body);

            if (!documentNumber) {
                this.sendError(res, 400, 'Document number is required');
                return;
            }

            console.log(`📄 API: Exporting PDF for ${documentNumber}...`);

            // First, ensure the HTML report exists
            let htmlPath = await this.findExistingHTMLReport(documentNumber);
            
            if (!htmlPath) {
                console.log(`📊 No existing HTML report found, generating new report for ${documentNumber}...`);
                
                try {
                    // Generate the HTML report first
                    const result = await this.reportGenerator.generateReport(documentNumber);
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to generate HTML report');
                    }
                    
                    console.log(`✅ HTML report generated: ${result.filePath}`);
                    htmlPath = result.filePath;
                    
                } catch (genError) {
                    console.error(`❌ Error generating HTML report:`, genError);
                    throw new Error(`Cannot generate report: ${genError.message}`);
                }
            } else {
                console.log(`✅ Found existing HTML report: ${htmlPath}`);
            }

            // Verify the file exists
            try {
                await require('fs').promises.access(htmlPath);
                console.log(`✅ HTML file verified: ${htmlPath}`);
            } catch (err) {
                throw new Error(`HTML file not accessible: ${htmlPath}`);
            }

            console.log(`🔄 Converting HTML to PDF...`);
            
            // Convert HTML to PDF
            const pdfBuffer = await this.convertHTMLToPDF(htmlPath);

            console.log(`✅ PDF generated successfully (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Food_Safety_Audit_Report_${documentNumber}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            res.end(pdfBuffer);

        } catch (error) {
            console.error('❌ API Error exporting PDF:', error);
            console.error('❌ Error stack:', error.stack);
            this.sendError(res, 500, `Failed to export PDF: ${error.message}`);
        }
    }

    // Export to DOC API endpoint
    async exportDOC(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const { documentNumber } = JSON.parse(body);

            if (!documentNumber) {
                this.sendError(res, 400, 'Document number is required');
                return;
            }

            console.log(`📝 API: Exporting DOC for ${documentNumber}...`);

            // Find existing HTML report (with any date)
            const htmlPath = await this.findExistingHTMLReport(documentNumber);
            
            if (!htmlPath) {
                // Generate HTML report if it doesn't exist
                console.log(`📊 Generating missing report for ${documentNumber}...`);
                await this.reportGenerator.generateReport(documentNumber);
                
                // Try to find the newly generated report
                const newHtmlPath = await this.findExistingHTMLReport(documentNumber);
                if (!newHtmlPath) {
                    throw new Error('Failed to generate HTML report.');
                }
                const docBuffer = await this.convertHTMLToDOC(newHtmlPath, documentNumber);
                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': `attachment; filename="Food_Safety_Audit_Report_${documentNumber}.docx"`,
                    'Content-Length': docBuffer.length
                });
                res.end(docBuffer);
                return;
            }

            // Convert HTML to DOC
            const docBuffer = await this.convertHTMLToDOC(htmlPath, documentNumber);

            res.writeHead(200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="Food_Safety_Audit_Report_${documentNumber}.docx"`,
                'Content-Length': docBuffer.length
            });
            res.end(docBuffer);

        } catch (error) {
            console.error('❌ API Error exporting DOC:', error);
            this.sendError(res, 500, `Failed to export DOC: ${error.message}`);
        }
    }

    // Serve report files
    async serveReport(pathname, res) {
        try {
            const fileName = path.basename(pathname);
            const filePath = path.join(this.documentsDir, fileName);
            
            const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
            if (!fileExists) {
                this.send404(res);
                return;
            }

            const content = await fs.readFile(filePath);
            const ext = path.extname(fileName);
            const contentType = this.getContentType(ext);

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);

        } catch (error) {
            console.error('Error serving report:', error);
            this.send404(res);
        }
    }

    // Utility: Find existing HTML report with any date
    async findExistingHTMLReport(documentNumber) {
        try {
            const files = await fs.readdir(this.documentsDir);
            
            // Look for HTML files matching the document number pattern
            const htmlFiles = files.filter(file => 
                file.startsWith(`Food_Safety_Audit_Report_${documentNumber}_`) && 
                file.endsWith('.html')
            );
            
            if (htmlFiles.length === 0) {
                console.log(`📄 No existing HTML report found for ${documentNumber}`);
                return null;
            }
            
            // Return the most recent file (sort by name, which includes date)
            const latestFile = htmlFiles.sort().reverse()[0];
            const fullPath = path.join(this.documentsDir, latestFile);
            
            console.log(`� Found existing HTML report: ${latestFile}`);
            return fullPath;
            
        } catch (error) {
            console.error('Error finding HTML report:', error);
            return null;
        }
    }

    // Placeholder: Convert HTML to PDF
    async convertHTMLToPDF(htmlPath) {
        let browser = null;
        try {
            // Verify HTML file exists
            const fs = require('fs').promises;
            try {
                await fs.access(htmlPath);
                console.log(`✅ HTML file exists: ${htmlPath}`);
            } catch (err) {
                throw new Error(`HTML file not found: ${htmlPath}`);
            }

            // Try to use puppeteer if available
            let puppeteer;
            try {
                puppeteer = require('puppeteer');
                console.log('✅ Puppeteer module loaded');
            } catch (error) {
                console.error('⚠️ Puppeteer not installed:', error.message);
                throw new Error('PDF export requires puppeteer. Please run: npm install puppeteer');
            }

            console.log('🔄 Launching Puppeteer browser...');
            browser = await puppeteer.launch({ 
                headless: 'new',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-dev-shm-usage'
                ]
            });
            
            console.log('✅ Browser launched');
            const page = await browser.newPage();
            
            // Set viewport for consistent rendering
            await page.setViewport({
                width: 1200,
                height: 1600,
                deviceScaleFactor: 2
            });
            
            // Set a longer timeout for pages with many images
            page.setDefaultTimeout(90000);
            
            // Convert Windows path to file URL
            const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
            console.log(`📖 Loading HTML page: ${fileUrl}`);
            
            try {
                await page.goto(fileUrl, { 
                    waitUntil: ['load', 'networkidle0'],
                    timeout: 90000
                });
                console.log('✅ Page loaded successfully');
            } catch (loadError) {
                console.error('❌ Failed to load page:', loadError.message);
                throw new Error(`Failed to load HTML page: ${loadError.message}`);
            }
            
            // Wait a bit more for images and dynamic content
            await page.waitForTimeout(2000);
            
            console.log('📄 Generating PDF with A4 format...');
            const pdfBuffer = await page.pdf({ 
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: false,
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: `
                    <div style="font-size: 11px; width: 100%; text-align: center; color: #555; 
                                padding: 10px 0; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif;">
                        <span style="font-weight: 500;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </div>
                `,
                margin: {
                    top: '15mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                },
                scale: 0.9
            });
            
            await browser.close();
            browser = null;
            
            console.log('✅ PDF conversion completed');
            console.log(`📊 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
            return pdfBuffer;

        } catch (error) {
            console.error('❌ PDF conversion failed:', error.message);
            console.error('❌ Full error:', error);
            
            // Ensure browser is closed even on error
            if (browser) {
                try {
                    await browser.close();
                    console.log('🧹 Browser closed after error');
                } catch (closeErr) {
                    console.error('⚠️ Error closing browser:', closeErr.message);
                }
            }
            
            throw error;
        }
    }

    // Enhanced: Convert HTML to DOC
    async convertHTMLToDOC(htmlPath, documentNumber) {
        try {
            // Try to use docx library if available
            let docx;
            try {
                docx = require('docx');
            } catch (error) {
                console.warn('⚠️ DOCX library not installed. Install with: npm install docx');
                throw new Error('Word export requires docx library. Please install it first.');
            }

            console.log('🔄 Converting HTML to Word document...');
            
            const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

            // Read and parse HTML content
            const htmlContent = await fs.readFile(htmlPath, 'utf8');
            
            // Extract key information using regex patterns
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/);
            const title = titleMatch ? titleMatch[1] : `Food Safety Audit Report - ${documentNumber}`;
            
            // Extract audit information
            const auditInfo = this.extractAuditInfo(htmlContent);
            
            // Extract scores
            const scores = this.extractScores(htmlContent);
            
            // Create Word document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        // Title
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Food Safety Audit Report",
                                    bold: true,
                                    size: 36,
                                }),
                            ],
                            heading: HeadingLevel.TITLE,
                        }),
                        
                        // Document Number
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Document Number: ${documentNumber}`,
                                    size: 24,
                                    bold: true,
                                }),
                            ],
                        }),
                        
                        // Generation Date
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Generated: ${new Date().toLocaleString()}`,
                                    size: 20,
                                }),
                            ],
                        }),
                        
                        new Paragraph({ children: [new TextRun({ text: "" })] }), // Empty line
                        
                        // Audit Information Section
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Audit Information",
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            heading: HeadingLevel.HEADING_1,
                        }),
                        
                        ...this.createAuditInfoParagraphs(auditInfo),
                        
                        new Paragraph({ children: [new TextRun({ text: "" })] }), // Empty line
                        
                        // Scores Section
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Audit Scores",
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            heading: HeadingLevel.HEADING_1,
                        }),
                        
                        ...this.createScoresParagraphs(scores),
                        
                        new Paragraph({ children: [new TextRun({ text: "" })] }), // Empty line
                        
                        // Footer note
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Note: This is a Word export of the HTML report. For full interactive features and detailed formatting, please refer to the HTML version.",
                                    size: 18,
                                    italics: true,
                                }),
                            ],
                        }),
                    ],
                }],
            });

            console.log('📄 Generating Word document buffer...');
            const buffer = await Packer.toBuffer(doc);
            console.log('✅ Word document generated successfully');
            
            return buffer;
            
        } catch (error) {
            console.error('❌ Word conversion failed:', error);
            throw new Error(`Word export failed: ${error.message}`);
        }
    }

    // Helper: Extract audit information from HTML
    extractAuditInfo(htmlContent) {
        const info = {};
        
        // Extract store name
        const storeMatch = htmlContent.match(/Store[^:]*:\s*([^<\n]+)/i);
        info.store = storeMatch ? storeMatch[1].trim() : 'N/A';
        
        // Extract auditor
        const auditorMatch = htmlContent.match(/Auditor[^:]*:\s*([^<\n]+)/i);
        info.auditor = auditorMatch ? auditorMatch[1].trim() : 'N/A';
        
        // Extract date
        const dateMatch = htmlContent.match(/Audit Date[^:]*:\s*([^<\n]+)/i);
        info.date = dateMatch ? dateMatch[1].trim() : 'N/A';
        
        return info;
    }

    // Helper: Extract scores from HTML
    extractScores(htmlContent) {
        const scores = {};
        
        // Common score patterns
        const scorePatterns = [
            { key: 'overall', pattern: /Overall Score[^:]*:\s*([0-9.]+)/ },
            { key: 'food', pattern: /Food Score[^:]*:\s*([0-9.]+)/ },
            { key: 'hygiene', pattern: /Hygiene Score[^:]*:\s*([0-9.]+)/ },
            { key: 'maintenance', pattern: /Maintenance Score[^:]*:\s*([0-9.]+)/ },
        ];
        
        scorePatterns.forEach(({ key, pattern }) => {
            const match = htmlContent.match(pattern);
            scores[key] = match ? parseFloat(match[1]) : null;
        });
        
        return scores;
    }

    // Helper: Create audit info paragraphs
    createAuditInfoParagraphs(info) {
        const paragraphs = [];
        
        Object.entries(info).forEach(([key, value]) => {
            if (value && value !== 'N/A') {
                const { Paragraph, TextRun } = require('docx');
                paragraphs.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: `${key.charAt(0).toUpperCase() + key.slice(1)}: `,
                            bold: true,
                            size: 22,
                        }),
                        new TextRun({
                            text: value,
                            size: 22,
                        }),
                    ],
                }));
            }
        });
        
        return paragraphs;
    }

    // Helper: Create scores paragraphs
    createScoresParagraphs(scores) {
        const paragraphs = [];
        const { Paragraph, TextRun } = require('docx');
        
        Object.entries(scores).forEach(([key, value]) => {
            if (value !== null) {
                paragraphs.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: `${key.charAt(0).toUpperCase() + key.slice(1)} Score: `,
                            bold: true,
                            size: 22,
                        }),
                        new TextRun({
                            text: `${value}%`,
                            size: 22,
                            color: value >= 80 ? "008000" : value >= 60 ? "FFA500" : "FF0000",
                        }),
                    ],
                }));
            }
        });
        
        return paragraphs;
    }

    // Utility functions
    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', reject);
        });
    }

    getContentType(ext) {
        switch (ext) {
            case '.html': return 'text/html';
            case '.json': return 'application/json';
            case '.csv': return 'text/csv';
            case '.css': return 'text/css';
            case '.js': return 'application/javascript';
            case '.pdf': return 'application/pdf';
            case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case '.png': return 'image/png';
            case '.jpg':
            case '.jpeg': return 'image/jpeg';
            default: return 'text/plain';
        }
    }

    sendError(res, statusCode, message) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        }));
    }

    send404(res) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Not Found</h1>');
    }

    openDashboard() {
        const url = `http://localhost:${this.port}/dashboard`;
        const platform = process.platform;
        
        let command;
        if (platform === 'win32') {
            command = `start ${url}`;
        } else if (platform === 'darwin') {
            command = `open ${url}`;
        } else {
            command = `xdg-open ${url}`;
        }

        setTimeout(() => {
            exec(command, (error) => {
                if (error) {
                    console.log(`💡 Please open ${url} in your browser manually`);
                } else {
                    console.log(`🌐 Opening dashboard at ${url}...`);
                }
            });
        }, 1000);
    }
}

// Main execution
if (require.main === module) {
    console.log('🚀 Starting Food Safety Audit Dashboard...');
    
    const port = process.env.DASHBOARD_PORT || process.argv[2] || 3000;
    const server = new DashboardServer(port);
    server.start();
}

module.exports = DashboardServer;