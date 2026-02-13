/**
 * Enhanced Report Generator
 * Main orchestrator class that coordinates all services to generate reports
 */

const fs = require('fs').promises;
const path = require('path');
const DataService = require('./services/data-service');
const ScoringService = require('./services/scoring-service');
const ImageService = require('./services/image-service');
const TemplateEngine = require('./services/template-engine');
const ConfigService = require('./services/config-service');
const config = require('./config/config');

class ReportGenerator {
    constructor(connector, options = {}) {
        this.connector = connector;
        this.config = { ...config, ...options };
        
        // Initialize services
        this.dataService = new DataService(connector);
        this.scoringService = new ScoringService();
        this.imageService = new ImageService(connector);
        this.configService = new ConfigService(connector);
        
        // Initialize template engine with all services
        this.templateEngine = new TemplateEngine(
            options.templatesDir || path.join(__dirname, 'templates'),
            {
                imageService: this.imageService,
                scoringService: this.scoringService,
                dataService: this.dataService,
                configService: this.configService,
                connector: connector,
                config: this.config,
                sectionMappings: config.sectionMappings
            }
        );
    }

    /**
     * Generate a complete HTML audit report
     * @param {string} documentNumber - The document number to generate report for
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Result with success status and file path
     */
    async generateReport(documentNumber, options = {}) {
        try {
            console.log('🚀 Starting Enhanced HTML Report Generation...');
            console.log(`📄 Document Number: ${documentNumber}`);

            // Get dynamic thresholds from ConfigService
            const thresholds = await this.configService.getScoringThresholds();

            // Connect to SharePoint if not already connected
            if (!this.connector.isConnected) {
                await this.connector.connectToSharePoint();
                console.log('✅ Connected to SharePoint');
            }

            // Get available lists
            const lists = await this.connector.getSharePointLists();
            console.log(`📋 Found ${lists.length} SharePoint lists`);

            // Fetch survey data
            const surveyData = await this.dataService.getSurveyData(documentNumber, lists);
            if (!surveyData) {
                throw new Error('Survey data not found for document number: ' + documentNumber);
            }

            console.log(`📊 Total Score: ${surveyData.Scor || 0}%`);

            // Fetch and convert images
            let images = await this.dataService.getCImages(documentNumber, lists);
            
            if (this.config.reportOptions.convertImagesToBase64) {
                console.log('📷 Converting images to base64...');
                images = await this.imageService.convertImagesToBase64(images);
                console.log('✅ Image conversion complete');
            }

            // Build report data structure
            const reportData = this.buildReportData(documentNumber, surveyData, images, thresholds);

            // Process all sections
            console.log('📊 Processing sections...');
            for (const [sectionKey, sectionConfig] of Object.entries(this.config.sectionMappings)) {
                console.log(`  Processing ${sectionConfig.title}...`);
                
                try {
                    const sectionData = await this.dataService.processSectionData(
                        sectionConfig, 
                        documentNumber, 
                        lists
                    );
                    
                    // Process items through scoring service
                    const processedData = sectionData.map(item => 
                        this.scoringService.processResponseItem(item)
                    );

                    const sectionScore = surveyData[sectionConfig.scoreField] || 0;

                    reportData.sections.push({
                        ...sectionConfig,
                        data: processedData,
                        score: Math.round(sectionScore),
                        status: this.scoringService.getScoreStatus(sectionScore, thresholds.section),
                        emoji: this.scoringService.getScoreEmoji(sectionScore, thresholds.section),
                        performance: this.scoringService.calculatePerformance(sectionScore, thresholds.section)
                    });

                } catch (error) {
                    console.warn(`  ⚠️ Error processing ${sectionConfig.title}: ${error.message}`);
                    reportData.sections.push({
                        ...sectionConfig,
                        data: [],
                        score: 0,
                        status: 'No Data',
                        emoji: '⚪',
                        performance: 'No Data Available'
                    });
                }
            }

            // Generate HTML using template engine
            console.log('🎨 Generating HTML...');
            const html = await this.templateEngine.buildDocument(reportData, {
                useInlineStyles: this.config.reportOptions.useInlineStyles,
                useInlineScripts: this.config.reportOptions.useInlineScripts
            });

            // Save the report
            const fileName = `Food_Safety_Audit_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.config.outputDir, fileName);

            // Ensure output directory exists
            await fs.mkdir(this.config.outputDir, { recursive: true });

            // Write HTML file
            await fs.writeFile(filePath, html, 'utf8');

            console.log(`✅ Report generated successfully: ${filePath}`);
            console.log(`📊 Overall Score: ${reportData.overallScore}% (${reportData.performance})`);
            console.log(`🏪 Store: ${reportData.auditDetails.storeName}`);

            return {
                success: true,
                filePath,
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
     * Build the report data structure
     * @param {string} documentNumber - Document number
     * @param {Object} surveyData - Survey data from SharePoint
     * @param {Object} images - Images collection
     * @param {Object} thresholds - Dynamic scoring thresholds
     * @returns {Object} - Report data structure
     */
    buildReportData(documentNumber, surveyData, images, thresholds) {
        const overallScore = surveyData.Scor ? parseFloat(surveyData.Scor) : 0;
        
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                siteUrl: this.config.siteUrl,
                reportType: 'Food Safety and Quality Assurance Department',
                documentNumber: documentNumber
            },
            surveyData: surveyData,
            images: images,
            sections: [],
            overallScore: overallScore,
            performance: this.scoringService.calculatePerformance(overallScore, thresholds.overall),
            auditDetails: {
                documentNumber: documentNumber,
                storeName: this.extractStoreName(surveyData, documentNumber),
                dateOfAudit: surveyData.Created 
                    ? this.dataService.parseSharePointDate(surveyData.Created) 
                    : new Date().toLocaleDateString(),
                auditor: surveyData.Auditor || surveyData.Author || 'System Generated',
                accompaniedBy: surveyData['Accompanied By'] || 'N/A',
                timeOfAudit: surveyData.Created 
                    ? this.dataService.parseSharePointTime(surveyData.Created) 
                    : new Date().toLocaleTimeString(),
                cycle: surveyData.Cycle || 'Current'
            }
        };
    }

    /**
     * Extract store name from survey data
     * @param {Object} surveyData - Survey data
     * @param {string} documentNumber - Document number fallback
     * @returns {string} - Store name
     */
    extractStoreName(surveyData, documentNumber) {
        return surveyData?.Store_x0020_Name || 
               surveyData?.Store_Name || 
               surveyData?.StoreName || 
               surveyData?.Store || 
               surveyData?.['Store Name'] || 
               (documentNumber ? documentNumber.split('-')[0] : 'N/A');
    }

    /**
     * Get connector for SharePoint access
     * @param {Object} config - Configuration options
     * @returns {Object} - SharePoint connector instance
     */
    static getConnector(config = {}) {
        const authMethod = process.env.AUTH_METHOD || 'auto';
        
        switch (authMethod) {
            case 'graph':
            case 'graphql':
                const SimpleGraphConnector = require('../src/simple-graph-connector.js');
                return new SimpleGraphConnector(config);
            case 'interactive':
                const TruePersistentConnector = require('../../src/true-persistent-connector.js');
                return new TruePersistentConnector(config);
            case 'auto':
            default:
                if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
                    const SimpleGraphConnectorAuto = require('../src/simple-graph-connector.js');
                    return new SimpleGraphConnectorAuto(config);
                } else {
                    const TruePersistentConnector = require('../../src/true-persistent-connector.js');
                    return new TruePersistentConnector(config);
                }
        }
    }
}

module.exports = ReportGenerator;
