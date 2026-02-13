/**
 * Template Engine
 * Handles loading and rendering HTML templates with data
 */

const fs = require('fs').promises;
const path = require('path');
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

class TemplateEngine {
    constructor(templatesDir, services = {}) {
        this.templatesDir = templatesDir || path.join(__dirname, '../templates');
        this.templateCache = {};
        this.imageService = services.imageService;
        this.scoringService = services.scoringService;
        this.dataService = services.dataService;
        this.configService = services.configService;
        this.connector = services.connector;
        this.config = services.config;
        this.sectionMappings = services.sectionMappings || {};
        
        // Scoring thresholds (will be loaded from SharePoint)
        this.scoringThresholds = null;
    }

    /**
     * Load scoring thresholds from config service
     * @returns {Promise<Object>} Scoring thresholds
     */
    async loadScoringThresholds() {
        if (this.scoringThresholds) {
            return this.scoringThresholds;
        }
        
        if (this.configService) {
            this.scoringThresholds = await this.configService.getScoringThresholds();
        } else {
            // Fallback defaults if no config service
            this.scoringThresholds = {
                overall: 83,
                section: 89,
                category: 83
            };
        }
        
        return this.scoringThresholds;
    }

    /**
     * Load a template file
     * @param {string} templateName - Name of the template file (without .html)
     * @returns {Promise<string>} - Template content
     */
    async loadTemplate(templateName) {
        // Check cache first
        if (this.templateCache[templateName]) {
            return this.templateCache[templateName];
        }

        const templatePath = path.join(this.templatesDir, `${templateName}.html`);
        
        try {
            const content = await fs.readFile(templatePath, 'utf8');
            this.templateCache[templateName] = content;
            return content;
        } catch (error) {
            throw new Error(`Failed to load template "${templateName}": ${error.message}`);
        }
    }

    /**
     * Render a template with data
     * @param {string} template - Template content
     * @param {Object} data - Data to inject into template
     * @returns {string} - Rendered HTML
     */
    render(template, data) {
        let rendered = template;

        // Replace all {{variable}} placeholders with data
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(regex, value || '');
        }

        return rendered;
    }

    /**
     * Render a template file with data
     * @param {string} templateName - Template file name
     * @param {Object} data - Data to inject
     * @returns {Promise<string>} - Rendered HTML
     */
    async renderTemplate(templateName, data) {
        const template = await this.loadTemplate(templateName);
        return this.render(template, data);
    }

    /**
     * Build complete HTML document
     * @param {Object} reportData - Complete report data
     * @param {Object} options - Rendering options
     * @returns {Promise<string>} - Complete HTML document
     */
    async buildDocument(reportData, options = {}) {
        const {
            useInlineStyles = true,
            useInlineScripts = true
        } = options;

        // Load scoring thresholds from SharePoint config
        const thresholds = await this.loadScoringThresholds();
        console.log(`📊 Using scoring thresholds - Overall: ${thresholds.overall}%, Section: ${thresholds.section}%, Category: ${thresholds.category}%`);

        // Load individual templates
        const header = await this.loadTemplate('header');
        const performanceBanner = await this.renderTemplate('performance-banner', {
            bannerClass: reportData.overallScore >= thresholds.overall ? 'pass' : 'fail',
            performanceText: reportData.performance,
            overallScore: Math.round(reportData.overallScore)
        });
        
        const auditInfo = await this.renderTemplate('audit-info', reportData.auditDetails);
        const chart = await this.loadTemplate('chart');
        const imageModal = await this.loadTemplate('image-modal');
        const footer = await this.renderTemplate('footer', {
            generatedAt: new Date(reportData.metadata.generatedAt).toLocaleString()
        });

        // Build sections
        const sections = await this.buildSections(reportData.sections, reportData);

        // Build data table with section mappings
        const dataTable = await this.buildDataTable(reportData, this.sectionMappings);

        // Determine paths for CSS and JS
        let cssPath = './styles/report-styles.css';
        let scriptPath = './scripts/report-client.js';
        let cssContent = '';
        let scriptContent = '';

        if (useInlineStyles) {
            cssContent = await fs.readFile(path.join(__dirname, '../styles/report-styles.css'), 'utf8');
        }

        if (useInlineScripts) {
            scriptContent = await fs.readFile(path.join(__dirname, '../scripts/report-client.js'), 'utf8');
        }

        // Build main layout
        let mainLayout = await this.loadTemplate('main-layout');
        
        // For standalone HTML, inline the styles and scripts
        if (useInlineStyles) {
            mainLayout = mainLayout.replace(
                '<link rel="stylesheet" href="{{cssPath}}">',
                `<style>${cssContent}</style>`
            );
        } else {
            mainLayout = mainLayout.replace('{{cssPath}}', cssPath);
        }

        if (useInlineScripts) {
            mainLayout = mainLayout.replace(
                '<script src="{{scriptPath}}"></script>',
                `<script>${scriptContent}</script>`
            );
        } else {
            mainLayout = mainLayout.replace('{{scriptPath}}', scriptPath);
        }

        // Build category chart data for grouped chart
        const categoryChartData = await this.buildCategoryChartData(reportData);

        // Replace template placeholders
        const renderedHtml = this.render(mainLayout, {
            documentNumber: reportData.auditDetails.documentNumber,
            header,
            performanceBanner,
            auditInfo,
            chart,
            dataTable,
            sections,
            footer,
            imageModal,
            sectionsData: JSON.stringify(reportData.sections),
            categoryChartData: JSON.stringify(categoryChartData),
            scoringThresholds: JSON.stringify(thresholds)
        });

        return renderedHtml;
    }

    /**
     * Build sections HTML
     * @param {Array} sections - Array of section objects
     * @param {Object} reportData - Full report data
     * @returns {Promise<string>} - Sections HTML
     */
    async buildSections(sections, reportData) {
        const sectionTemplate = await this.loadTemplate('section');
        const sectionsHtml = [];

        // Section ID mapping for chart navigation
        const sectionIdMap = {
            'Food Storage and Dry Storage': 'section-food-storage',
            'Fridges and Freezers': 'section-fridges',
            'Food Handling': 'section-food-handling',
            'Personal Hygiene': 'section-personal-hygiene',
            'Food Safety Culture': 'section-culture',
            'Utensils and Equipment': 'section-utensils',
            'Cleaning and Disinfection': 'section-cleaning',
            'Restrooms': 'section-restrooms',
            'Garbage Storage and Disposal': 'section-garbage',
            'Chemicals Available': 'section-chemicals',
            'Maintenance': 'section-maintenance',
            'Monitoring Sheets': 'section-monitoring',
            'Policies & Procedures': 'section-policies'
        };

        for (const section of sections) {
            // Generate fridges tables only for Fridges and Freezers section
            let fridgesTables = '';
            if (section.title === 'Fridges and Freezers' && reportData.metadata.documentNumber) {
                fridgesTables = await this.generateFridgesTables(reportData.metadata.documentNumber);
            }
            
            // Get section ID for this section
            const sectionId = sectionIdMap[section.title] || 'section-' + section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            
            const sectionHtml = this.render(sectionTemplate, {
                sectionId: sectionId,
                icon: section.icon,
                title: section.title,
                score: section.score,
                emoji: section.emoji,
                detailsTable: this.buildDetailsTable(section.data, reportData.images),
                correctiveActions: this.buildCorrectiveActions(section.data, reportData.images),
                fridgesTables: fridgesTables
            });

            sectionsHtml.push(sectionHtml);
        }

        return sectionsHtml.join('\n');
    }

    /**
     * Build details table with complete logic (from original lines 1450-1520)
     * Shows images with Iscorrective = false (before photos)
     * @param {Array} data - Section data
     * @param {Object} imageMap - Images collection grouped by question ID
     * @returns {string} - Table HTML
     */
    buildDetailsTable(data, imageMap) {
        if (!data || data.length === 0) {
            return '<p style="text-align: center; color: #666; padding: 20px;">No data available for this section</p>';
        }

        const rows = data.map((item, index) => {
            const answerClass = this.scoringService ? this.scoringService.getAnswerClass(item.SelectedChoice || item.Answer) : '';
            const criteria = getCriteria(item);
            // Show blank coefficient if SelectedChoice is NA, otherwise show the coefficient value
            const coefficient = getCoefficientDisplay(item);
            // Show actual SelectedChoice value, or "No Answer" if empty
            const answer = getAnswerDisplay(item);
            const comments = getComment(item);
            const referenceNumber = getReferenceValue(item, index);
            
            // Get images using question ID from ResponseJSON (item.Id)
            // Extract question number from full ImageID format: "GMRL-FSACR-0048-87" -> "87"
            const fullImageId = String(item.Id || item.ID || item.ImageID || '');
            const questionId = extractQuestionId(fullImageId);
            const itemImages = imageMap[questionId] || [];
            let pictureCell = '';
            
            if (itemImages && itemImages.length > 0) {
                // Filter for BEFORE images (Iscorrective = false)
                const beforeImages = itemImages.filter(img => !img.isCorrective);
                
                if (beforeImages.length > 0 && this.imageService) {
                    // Use image service to generate gallery with before images
                    pictureCell = this.imageService.generateImageGallery(questionId, imageMap, false);
                } else {
                    pictureCell = '<span style="color: #ccc;">—</span>';
                }
            } else {
                // No images found for this question
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
                        <th style="width:220px; min-width:220px;">Pictures of Coments</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Build corrective actions table with complete logic (from original lines 1060-1180)
     * Shows images with Iscorrective = true (after photos)
     * @param {Array} data - Section data
     * @param {Object} imageMap - Images collection grouped by question ID
     * @returns {string} - Corrective actions HTML
     */
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
            let finding = cleanText(item.Finding || item.finding || '-');
            
            // Check for "Good Observation" or "Good observation" and color the text after it green
            if (finding.includes('Good Observation') || finding.includes('Good observation')) {
                const keyword = finding.includes('Good Observation') ? 'Good Observation' : 'Good observation';
                const parts = finding.split(keyword);
                if (parts.length > 1 && parts[1].trim()) {
                    finding = `${parts[0]}${keyword}<span style="color: #28a745; font-weight: 600;">${parts[1]}</span>`;
                }
            }
            
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
                        <th style="width:220px; min-width:220px;">Picture of finding</th>
                        <th>Corrective Action</th>
                    </tr>
                    ${rows}
                </table>
            </div>
        `;
    }

    /**
     * Generate fridge temperature tables (from original lines 1177-1400)
     * Creates two tables: Findings and Compliant fridges
     * @param {string} documentNumber - Document number
     * @returns {Promise<string>} - HTML for fridge tables
     */
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

    /**
     * Build data table with historical scores (ENHANCED - Power Apps Style)
     * Grouped by categories with sub-sections indented
     * @param {Object} reportData - Report data
     * @param {Object} sectionMappings - Section configuration mappings
     * @returns {Promise<string>} - Data table HTML
     */
    async buildDataTable(reportData, sectionMappings) {
        const storeName = reportData.auditDetails.storeName;
        const surveyData = reportData.surveyData || {};
        
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

        // Helper function to get historical scores for a section
        const getHistoricalScores = async (sectionTitle) => {
            let c2 = '-', c3 = '-', c4 = '-', c5 = '-', c6 = '-';
            if (historicalDataAvailable && this.dataService) {
                try {
                    const [h2, h3, h4, h5, h6] = await Promise.all([
                        this.dataService.getHistoricalScoreForStore(storeName, sectionTitle, 'C2', sectionMappings),
                        this.dataService.getHistoricalScoreForStore(storeName, sectionTitle, 'C3', sectionMappings),
                        this.dataService.getHistoricalScoreForStore(storeName, sectionTitle, 'C4', sectionMappings),
                        this.dataService.getHistoricalScoreForStore(storeName, sectionTitle, 'C5', sectionMappings),
                        this.dataService.getHistoricalScoreForStore(storeName, sectionTitle, 'C6', sectionMappings)
                    ]);
                    c2 = h2 === '0.1' ? '-' : parseFloat(h2) + '%';
                    c3 = h3 === '0.1' ? '-' : parseFloat(h3) + '%';
                    c4 = h4 === '0.1' ? '-' : parseFloat(h4) + '%';
                    c5 = h5 === '0.1' ? '-' : parseFloat(h5) + '%';
                    c6 = h6 === '0.1' ? '-' : parseFloat(h6) + '%';
                } catch (error) {
                    console.warn(`Error fetching historical scores for ${sectionTitle}:`, error.message);
                }
            }
            return { c2, c3, c4, c5, c6 };
        };

        // Helper function to calculate historical category average
        const calculateHistoricalCategoryAverage = async (sectionTitles, cycle) => {
            if (!historicalDataAvailable || !this.dataService) return '-';
            try {
                const scores = await Promise.all(
                    sectionTitles.map(title => 
                        this.dataService.getHistoricalScoreForStore(storeName, title, cycle, sectionMappings)
                    )
                );
                const validScores = scores.filter(s => s !== '0.1').map(s => parseFloat(s));
                if (validScores.length === 0) return '-';
                return Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) + '%';
            } catch (error) {
                return '-';
            }
        };

        // Define category structure matching Power Apps
        // Category scores come directly from FS Survey columns (not calculated)
        const categories = [
            {
                name: 'Storage of Food',
                categoryScoreField: 'FoodStorageCatscore',  // From FS Survey
                subSections: [
                    { title: 'Food Storage and Dry Storage', scoreField: 'FoodScore' },
                    { title: 'Fridges and Freezers', scoreField: 'FridgesScore' }
                ]
            },
            {
                name: "Employees' Food Handling and Food Safety Culture",
                categoryScoreField: 'EmployeefoodhfoculterMainscore',  // From FS Survey
                subSections: [
                    { title: 'Food Handling', scoreField: 'FoodHScore' },
                    { title: 'Personal Hygiene', scoreField: 'HygScore' },
                    { title: 'Food Safety Culture of the Store', scoreField: 'CultScore' }
                ]
            },
            {
                name: 'Cleaning and Equipment Condition',
                categoryScoreField: 'cleanMianscore',  // From FS Survey
                subSections: [
                    { title: 'Utensils and Equipment', scoreField: 'UtensilsScore' },
                    { title: 'Cleaning and Disinfection', scoreField: 'CNDScore' },
                    { title: 'Restrooms', scoreField: 'RestroomScore' },
                    { title: 'Garbage Storage and Disposal', scoreField: 'GarScore' },
                    { title: 'Chemicals Available', scoreField: 'ChemScore' }
                ]
            },
            {
                name: 'Maintenance',
                categoryScoreField: 'MaintenanceMainscore',  // From FS Survey
                subSections: []
            },
            {
                name: 'Documentation',
                categoryScoreField: 'DocMainScore',  // From FS Survey
                subSections: [
                    { title: 'Monitoring Sheets & Documents', scoreField: 'MonitScore' },
                    { title: 'Policies, Procedures & Posters', scoreField: 'PolScore' }
                ]
            }
        ];

        let tableRows = '';

        // Build rows for each category
        for (const category of categories) {
            // Get category score directly from FS Survey field (not calculated)
            const categoryScore = Math.round(parseFloat(surveyData[category.categoryScoreField]) || 0);
            
            // Get historical category scores
            const sectionTitles = category.subSections.length > 0 
                ? category.subSections.map(s => s.title)
                : [category.name];
            
            const [catC2, catC3, catC4, catC5, catC6] = await Promise.all([
                calculateHistoricalCategoryAverage(sectionTitles, 'C2'),
                calculateHistoricalCategoryAverage(sectionTitles, 'C3'),
                calculateHistoricalCategoryAverage(sectionTitles, 'C4'),
                calculateHistoricalCategoryAverage(sectionTitles, 'C5'),
                calculateHistoricalCategoryAverage(sectionTitles, 'C6')
            ]);

            // Category header row (gray background, bold)
            tableRows += `
                <tr style="background-color: #bfbfbf;">
                    <td style="padding: 8px; font-weight: bold; border: 1px solid #000;">${category.name}</td>
                    <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${categoryScore}%</td>
                    <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${catC2}</td>
                    <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${catC3}</td>
                    <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${catC4}</td>
                    <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${catC5}</td>
                    <td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold;">${catC6}</td>
                </tr>
            `;

            // Sub-section rows (indented, white background)
            for (const subSection of category.subSections) {
                const subScore = surveyData[subSection.scoreField] || 0;
                const historical = await getHistoricalScores(subSection.title);
                
                tableRows += `
                    <tr>
                        <td style="padding: 6px 6px 6px 20px; border: 1px solid #000;">${subSection.title}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: center;">${subScore}%</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: center;">${historical.c2}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: center;">${historical.c3}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: center;">${historical.c4}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: center;">${historical.c5}</td>
                        <td style="padding: 6px; border: 1px solid #000; text-align: center;">${historical.c6}</td>
                    </tr>
                `;
            }
        }

        // Get overall historical scores
        let overallC2 = '-', overallC3 = '-', overallC4 = '-', overallC5 = '-', overallC6 = '-';
        if (historicalDataAvailable && this.dataService) {
            try {
                overallC2 = await this.dataService.getHistoricalOverallScore('C2');
                overallC3 = await this.dataService.getHistoricalOverallScore('C3');
                overallC4 = await this.dataService.getHistoricalOverallScore('C4');
                overallC5 = await this.dataService.getHistoricalOverallScore('C5');
                overallC6 = await this.dataService.getHistoricalOverallScore('C6');
                
                overallC2 = overallC2 === '0.1' ? '-' : Math.round(parseFloat(overallC2)) + '%';
                overallC3 = overallC3 === '0.1' ? '-' : Math.round(parseFloat(overallC3)) + '%';
                overallC4 = overallC4 === '0.1' ? '-' : Math.round(parseFloat(overallC4)) + '%';
                overallC5 = overallC5 === '0.1' ? '-' : Math.round(parseFloat(overallC5)) + '%';
                overallC6 = overallC6 === '0.1' ? '-' : Math.round(parseFloat(overallC6)) + '%';
            } catch (error) {
                console.warn('Error fetching historical overall scores:', error.message);
            }
        }

        // Total score from FS Survey
        const totalScore = surveyData.Score || surveyData.Scor || reportData.overallScore || 0;

        // Total Score row
        tableRows += `
            <tr style="background-color: #f2f2f2;">
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 16px;">Total Score</td>
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 16px;">${Math.round(totalScore)}%</td>
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 14px;">${overallC2}</td>
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 14px;">${overallC3}</td>
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 14px;">${overallC4}</td>
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 14px;">${overallC5}</td>
                <td style="padding: 10px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 14px;">${overallC6}</td>
            </tr>
        `;

        return `
            <div style="font-family: Segoe UI, sans-serif; padding: 10px;">
                <h2 style="color: #3860B2; border-bottom: 2px solid #3860B2; margin-bottom: 15px;">Audit Summary</h2>
                <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000;">
                    <thead>
                        <tr style="background-color: #ffffff;">
                            <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 14px;">Description</th>
                            <th style="padding: 8px; border: 1px solid #000; text-align: center; width: 80px; font-size: 14px;">C1</th>
                            <th style="padding: 8px; border: 1px solid #000; text-align: center; width: 80px; font-size: 14px;">C2</th>
                            <th style="padding: 8px; border: 1px solid #000; text-align: center; width: 80px; font-size: 14px;">C3</th>
                            <th style="padding: 8px; border: 1px solid #000; text-align: center; width: 80px; font-size: 14px;">C4</th>
                            <th style="padding: 8px; border: 1px solid #000; text-align: center; width: 80px; font-size: 14px;">C5</th>
                            <th style="padding: 8px; border: 1px solid #000; text-align: center; width: 80px; font-size: 14px;">C6</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Build category chart data for grouped chart display
     * @param {Object} reportData - Full report data
     * @returns {Array} - Array of category objects with scores for chart
     */
    async buildCategoryChartData(reportData) {
        const surveyData = reportData.surveyData || {};
        
        // Define categories with their sub-sections (matching Power Apps structure)
        const categories = [
            {
                name: 'Storage of Food',
                categoryScoreField: 'FoodStorageCatscore',
                isCategory: true,
                subSections: [
                    { name: 'Food Storage and Dry Storage', scoreField: 'FoodScore', sectionId: 'section-food-storage', isCategory: false },
                    { name: 'Fridges and Freezers', scoreField: 'FridgesScore', sectionId: 'section-fridges', isCategory: false }
                ]
            },
            {
                name: "Employees' Food Handling",
                categoryScoreField: 'EmployeefoodhfoculterMainscore',
                isCategory: true,
                subSections: [
                    { name: 'Food Handling', scoreField: 'FoodHScore', sectionId: 'section-food-handling', isCategory: false },
                    { name: 'Personal Hygiene', scoreField: 'HygScore', sectionId: 'section-personal-hygiene', isCategory: false },
                    { name: 'Food Safety Culture', scoreField: 'CultScore', sectionId: 'section-culture', isCategory: false }
                ]
            },
            {
                name: 'Cleaning & Equipment',
                categoryScoreField: 'cleanMianscore',
                isCategory: true,
                subSections: [
                    { name: 'Utensils and Equipment', scoreField: 'UtensilsScore', sectionId: 'section-utensils', isCategory: false },
                    { name: 'Cleaning and Disinfection', scoreField: 'CNDScore', sectionId: 'section-cleaning', isCategory: false },
                    { name: 'Restrooms', scoreField: 'RestroomScore', sectionId: 'section-restrooms', isCategory: false },
                    { name: 'Garbage Storage', scoreField: 'GarScore', sectionId: 'section-garbage', isCategory: false },
                    { name: 'Chemicals Available', scoreField: 'ChemScore', sectionId: 'section-chemicals', isCategory: false }
                ]
            },
            {
                name: 'Maintenance',
                categoryScoreField: 'MaintenanceMainscore',
                isCategory: true,
                subSections: [
                    { name: 'Maintenance', scoreField: 'MaintScore', sectionId: 'section-maintenance', isCategory: false }
                ]
            },
            {
                name: 'Documentation',
                categoryScoreField: 'DocMainScore',
                isCategory: true,
                subSections: [
                    { name: 'Monitoring Sheets', scoreField: 'MonitScore', sectionId: 'section-monitoring', isCategory: false },
                    { name: 'Policies & Procedures', scoreField: 'PolScore', sectionId: 'section-policies', isCategory: false }
                ]
            }
        ];

        const chartData = [];

        for (const category of categories) {
            // Add category (main group)
            const categoryScore = Math.round(parseFloat(surveyData[category.categoryScoreField]) || 0);
            chartData.push({
                name: category.name,
                score: categoryScore,
                isCategory: true,
                sectionId: null
            });

            // Add sub-sections
            for (const sub of category.subSections) {
                const subScore = Math.round(parseFloat(surveyData[sub.scoreField]) || 0);
                chartData.push({
                    name: '  ' + sub.name,  // Indent sub-sections
                    score: subScore,
                    isCategory: false,
                    sectionId: sub.sectionId
                });
            }
        }

        return chartData;
    }

    /**
     * Get answer CSS class
     * @param {string} answer - Answer value
     * @returns {string} - CSS class
     */
    getAnswerClass(answer) {
        if (!answer) return '';
        const answerLower = answer.toLowerCase();
        if (answerLower === 'yes') return 'answer-yes';
        if (answerLower === 'no') return 'answer-no';
        if (answerLower === 'partially') return 'answer-partial';
        if (answerLower === 'na') return 'answer-na';
        return '';
    }
}

module.exports = TemplateEngine;
