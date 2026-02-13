#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
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
            const TruePersistentConnector = require('./src/true-persistent-connector.js');
            return new TruePersistentConnector(config);
        case 'auto':
        default:
            // Auto-detect: prefer Simple Graph if Azure credentials are available
            if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
                const SimpleGraphConnectorAuto = require('./src/simple-graph-connector.js');
                return new SimpleGraphConnectorAuto(config);
            } else {
                const TruePersistentConnector = require('./src/true-persistent-connector.js');
                return new TruePersistentConnector(config);
            }
    }
}

/**
 * Enhanced HTML Report Generator for Food Safety Audit Reports
 * Based on PowerApps OnVisible code structure and actual SharePoint lists
 */
class EnhancedHTMLReportGenerator {
    constructor(config = {}) {
        this.config = {
            outputDir: config.outputDir || './reports',
            siteUrl: process.env.SHAREPOINT_SITE_URL || 'https://spinneysleb.sharepoint.com/operations/',
            ...config
        };
        
        this.connector = config.connector || getConnector(this.config);
        
        // Section mappings based on CORRECT SharePoint architecture:
        // Template questions are in section lists, answers are in answer lists with ResponseJSON
        this.sectionMappings = {
            'Food Storage': { 
                templateListName: 'Food Storage & Dry Storage',  // Template questions
                answerListName: 'Survey Responses List',         // Answer data with ResponseJSON
                icon: '🥫', 
                title: 'Food Storage and Dry Storage',
                scoreField: 'FoodScore'
            },
            'Fridges': { 
                templateListName: 'Fridges and Freezers',        // Template questions
                answerListName: 'SRA Fridges',                   // Answer data with ResponseJSON
                icon: '❄️', 
                title: 'Fridges and Freezers',
                scoreField: 'FridgesScore'
            },
            'Utensils': { 
                templateListName: 'Utensils and Equipment',      // Template questions
                answerListName: 'SRA Utensils and Equipment',    // Answer data with ResponseJSON
                icon: '🍽️', 
                title: 'Utensils and Equipment',
                scoreField: 'UtensilsScore'
            },
            'Food Handling': { 
                templateListName: 'Food Handling',               // Template questions
                answerListName: 'SRA Food Handling',             // Answer data with ResponseJSON
                icon: '👨‍🍳', 
                title: 'Food Handling',
                scoreField: 'FoodHScore'
            },
            'Cleaning': { 
                templateListName: 'Cleaning and Disinfection',   // Template questions
                answerListName: 'SRA Cleaning and Disinfection', // Answer data with ResponseJSON
                icon: '🧹', 
                title: 'Cleaning and Disinfection',
                scoreField: 'CNDScore'
            },
            'Hygiene': { 
                templateListName: 'Personal Hygiene',            // Template questions
                answerListName: 'SRA Personal Hygiene',          // Answer data with ResponseJSON
                icon: '🧼', 
                title: 'Personal Hygiene',
                scoreField: 'HygScore'
            },
            'Restrooms': { 
                templateListName: 'Restrooms',                   // Template questions
                answerListName: 'SRA Restrooms',                 // Answer data with ResponseJSON
                icon: '🚻', 
                title: 'Restrooms',
                scoreField: 'RestroomScore'
            },
            'Garbage': { 
                templateListName: 'Garbage Storage & Disposal',  // Template questions
                answerListName: 'SRA Garbage Storage and Disposal', // Answer data with ResponseJSON
                icon: '🗑️', 
                title: 'Garbage Storage and Disposal',
                scoreField: 'GarScore'
            },
            'Maintenance': { 
                templateListName: 'Maintenance',                 // Template questions
                answerListName: 'SRA Maintenance',               // Answer data with ResponseJSON
                icon: '🛠️', 
                title: 'Maintenance',
                scoreField: 'MaintScore'
            },
            'Chemicals': { 
                templateListName: 'Chemicals Available',         // Template questions
                answerListName: 'SRA Chemicals Available',       // Answer data with ResponseJSON
                icon: '🧪', 
                title: 'Chemicals Available',
                scoreField: 'ChemScore'
            },
            'Monitoring': { 
                templateListName: 'Monitoring Sheets',           // Template questions
                answerListName: 'SRA Monitoring Sheets are Properly Filled, Documents Present', // Answer data with ResponseJSON
                icon: '📋', 
                title: 'Monitoring Sheets',
                scoreField: 'MonitScore'
            },
            'Culture': { 
                templateListName: 'Food Safety Culture',         // Template questions
                answerListName: 'SRA Culture',                   // Answer data with ResponseJSON
                icon: '🏛️', 
                title: 'Food Safety Culture',
                scoreField: 'CultScore'
            },
            'Policies': { 
                templateListName: 'Policies & Procedures',       // Template questions
                answerListName: 'SRA Policies, Procedures & Posters', // Answer data with ResponseJSON
                icon: '📜', 
                title: 'Policies & Procedures',
                scoreField: 'PolScore'
            }
        };
    }

    /**
     * Generate comprehensive HTML audit report
     */
    async generateHTMLReport(options = {}) {
        try {
            console.log('🚀 Starting Enhanced HTML Report Generation...');
            
            // Validate document number
            const documentNumber = options.documentNumber;
            if (!documentNumber) {
                throw new Error('Document number is required. Please provide options.documentNumber');
            }
            
            console.log(`📄 Generating report for Document Number: ${documentNumber}`);
            
            // Check if we should read from debug folder
            if (options.useDebugFolder) {
                console.log('📁 Reading data from debug folder...');
                return await this.generateReportFromDebugFolder(documentNumber, options);
            }
            
            // Connect to SharePoint
            await this.connector.connectToSharePoint();
            
            // Set document context for debugging
            if (this.connector && this.connector.setDocumentContext) {
                this.connector.setDocumentContext(documentNumber);
            }
            
            console.log('✅ Connected to SharePoint');
            
            // Get all available lists once at the beginning
            const lists = await this.connector.getSharePointLists();
            console.log(`📋 Found ${lists.length} SharePoint lists`);
            
            // Get overall survey data first
            const surveyData = await this.getSurveyData(documentNumber, lists);
            console.log(`📊 Total Score from FS Survey: ${surveyData?.Scor || 0}%`);
            
            // Get images from CImages library
            const images = await this.getCImages(documentNumber, lists);
            
            // Convert all images to base64 for standalone viewing
            console.log('📷 Converting images to base64 for standalone viewing...');
            for (const questionId in images) {
                for (let i = 0; i < images[questionId].length; i++) {
                    const base64Url = await this.downloadImageAsBase64(images[questionId][i]);
                    images[questionId][i].url = base64Url;
                }
            }
            console.log('✅ Image conversion complete');
            
            
            // Get store name for historical data
            const storeName = surveyData?.Store_x0020_Name || surveyData?.Store_Name || surveyData?.StoreName || 
                             surveyData?.Store || surveyData?.['Store Name'] || 
                             (documentNumber ? documentNumber.split('-')[0] : 'N/A');
            
            // Set current document number for historical data exclusion
            this.currentDocumentNumber = documentNumber;

            // Fetch and cache historical scores for this store
            console.log(`🔍 Fetching historical scores for store: ${storeName}`);
            this.cachedHistoricalData = await this.getHistoricalScoresForStore(storeName);
            console.log(`✅ Cached ${this.cachedHistoricalData.length} historical records for scoring`);            // Collect data for all sections
            const reportData = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    siteUrl: this.config.siteUrl,
                    reportType: 'Food Safety and Quality Assurance Department',
                    documentNumber: documentNumber
                },
                surveyData: surveyData,
                images: images,
                sections: [],
                scores: {},
                overallScore: surveyData?.Scor ? parseFloat(surveyData.Scor) : 0,
                performance: this.calculatePerformance(surveyData?.Scor ? parseFloat(surveyData.Scor) : 0),
                auditDetails: {
                    documentNumber: documentNumber,
                    storeName: surveyData?.Store_x0020_Name || surveyData?.Store_Name || surveyData?.StoreName || 
                              surveyData?.Store || surveyData?.['Store Name'] || 
                              (documentNumber ? documentNumber.split('-')[0] : 'N/A'),
                    dateOfAudit: surveyData?.Created ? this.parseSharePointDate(surveyData.Created) : new Date().toLocaleDateString(),
                    auditor: surveyData?.Auditor || surveyData?.Author || options.auditor || 'System Generated',
                    accompaniedBy: surveyData?.['Accompanied By'] || options.accompaniedBy || 'N/A',
                    timeOfAudit: surveyData?.Created ? this.parseSharePointTime(surveyData.Created) : new Date().toLocaleTimeString(),
                    cycle: surveyData?.Cycle || options.cycle || 'Current'
                },
                metadata: {
                    generatedAt: new Date().toISOString(),
                    source: 'sharepoint-live'
                }
            };
            
            // Process each section
            for (const [sectionKey, sectionConfig] of Object.entries(this.sectionMappings)) {
                console.log(`📊 Processing ${sectionConfig.title}...`);
                
                try {
                    const sectionData = await this.processSectionData(sectionConfig, documentNumber, lists);
                    const sectionScore = surveyData?.[sectionConfig.scoreField] || 0;
                    console.log(`📊 ${sectionConfig.title} Score from FS Survey: ${sectionScore}%`);
                    
                    reportData.sections.push({
                        ...sectionConfig,
                        data: sectionData,
                        score: Math.round(sectionScore),
                        status: this.getScoreStatus(sectionScore),
                        emoji: this.getScoreEmoji(sectionScore),
                        performance: this.calculatePerformance(sectionScore)
                    });
                    reportData.scores[sectionKey] = Math.round(sectionScore);
                } catch (error) {
                    console.warn(`⚠️ Could not process ${sectionConfig.title}: ${error.message}`);
                    reportData.sections.push({
                        ...sectionConfig,
                        data: [],
                        score: 0,
                        status: 'No Data',
                        emoji: '⚪',
                        performance: 'No Data Available'
                    });
                    reportData.scores[sectionKey] = 0;
                }
            }
            
            // Generate the HTML report
            const html = await this.generateHTML(reportData);
            
            // Save the report
            const fileName = `Food_Safety_Audit_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.config.outputDir, fileName);
            
            // Ensure output directory exists
            await fs.mkdir(this.config.outputDir, { recursive: true });
            
            // Write HTML file
            await fs.writeFile(filePath, html, 'utf8');
            
            console.log(`✅ HTML Report generated: ${filePath}`);
            console.log(`📊 Overall Score: ${reportData.overallScore}% (${reportData.performance})`);
            console.log(`🏪 Store: ${reportData.auditDetails.storeName}`);
            console.log(`📅 Date: ${reportData.auditDetails.dateOfAudit}`);
            
            return {
                success: true,
                filePath,
                data: reportData
            };
            
        } catch (error) {
            console.error('❌ Error generating HTML report:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse SharePoint date format (25/09/2025 12:22:47 PM)
     */
    parseSharePointDate(dateString) {
        try {
            if (!dateString) return new Date().toLocaleDateString();
            
            // Try different parsing approaches
            let date;
            
            // If it's in dd/mm/yyyy format, convert to mm/dd/yyyy for JavaScript
            if (dateString.includes('/') && dateString.includes(' ')) {
                const parts = dateString.split(' ')[0].split('/');
                if (parts.length === 3) {
                    // Convert dd/mm/yyyy to mm/dd/yyyy
                    const convertedDateString = `${parts[1]}/${parts[0]}/${parts[2]} ${dateString.split(' ').slice(1).join(' ')}`;
                    date = new Date(convertedDateString);
                }
            } else {
                date = new Date(dateString);
            }
            
            return date.toLocaleDateString();
        } catch (error) {
            console.warn('Could not parse date:', dateString, error.message);
            return new Date().toLocaleDateString();
        }
    }

    /**
     * Parse SharePoint time format
     */
    parseSharePointTime(dateString) {
        try {
            if (!dateString) return new Date().toLocaleTimeString();
            
            let date;
            if (dateString.includes('/') && dateString.includes(' ')) {
                const parts = dateString.split(' ')[0].split('/');
                if (parts.length === 3) {
                    // Convert dd/mm/yyyy to mm/dd/yyyy for JavaScript
                    const convertedDateString = `${parts[1]}/${parts[0]}/${parts[2]} ${dateString.split(' ').slice(1).join(' ')}`;
                    date = new Date(convertedDateString);
                }
            } else {
                date = new Date(dateString);
            }
            
            return date.toLocaleTimeString();
        } catch (error) {
            console.warn('Could not parse time:', dateString, error.message);
            return new Date().toLocaleTimeString();
        }
    }

    /**
     * Get survey data from AuditInstances table (FS Survey SharePoint list is deleted)
     */
    async getSurveyData(documentNumber, lists) {
        try {
            // Get data from our SQL database instead of SharePoint FS Survey
            const sql = require('mssql');
            const dbConfig = require('./config/default').database;
            const pool = await sql.connect(dbConfig);
            
            const result = await pool.request()
                .input('documentNumber', sql.NVarChar(100), documentNumber)
                .query(`
                    SELECT 
                        DocumentNumber, StoreName, StoreCode, AuditDate, 
                        Auditors, TotalScore, Cycle, Year, Status,
                        CreatedAt, CreatedBy, AccompaniedBy
                    FROM AuditInstances 
                    WHERE DocumentNumber = @documentNumber
                `);

            if (result.recordset.length === 0) {
                console.warn(`No survey data found in database for document: ${documentNumber}`);
                return null;
            }

            const dbItem = result.recordset[0];
            console.log(`✅ Found survey data in database for document: ${documentNumber}`);
            console.log(`📊 Total Score: ${dbItem.TotalScore}%`);
            console.log(`🏪 Store: ${dbItem.StoreName}`);
            
            // Map to expected format
            return {
                Document_x0020_Number: dbItem.DocumentNumber,
                Store_x0020_Name: dbItem.StoreName,
                StoreName: dbItem.StoreName,
                Scor: dbItem.TotalScore,
                Score: dbItem.TotalScore,
                TotalScore: dbItem.TotalScore,
                Auditor: dbItem.Auditors,
                Created: dbItem.CreatedAt,
                Cycle: dbItem.Cycle,
                Year: dbItem.Year,
                Status: dbItem.Status
            };

        } catch (error) {
            console.warn('Could not get survey data from database:', error.message);
            return null;
        }
    }

    /**
     * Get images from CImages document library (PowerApps pattern)
     * Note: CImages has NO DocumentNumber field, so we retrieve all and filter by parsing ImageID
     * Images are stored in the Image field as JSON: {fileName, serverRelativeUrl, serverUrl, ...}
     */
    async getCImages(documentNumber, lists) {
        try {
            console.log('📷 Retrieving images from CImages document library...');
            
            // CImages is a DOCUMENT LIBRARY - query for actual files with metadata
            // Use FileRef to get the file path, filter for files only (FSObjType eq 0)
            const url = `${this.config.siteUrl}/_api/Web/Lists(guid'abb703bc-835c-4671-bad0-2f89956e3b74')/Items?$select=Id,ImageID,Iscorrective,FileLeafRef,FileRef,File_x0020_Type,Created&$filter=FSObjType eq 0&$top=1000`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.connector.accessToken}`,
                    'Accept': 'application/json;odata=verbose'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get CImages: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const cImagesItems = data.d?.results || [];

            if (!cImagesItems || cImagesItems.length === 0) {
                console.log('📷 No images found in CImages library');
                return {};
            }

            console.log(`📷 Retrieved ${cImagesItems.length} total items from CImages`);

            // Filter images by parsing ImageID (format: "GMRL-FSACR-0039-47" -> document is "GMRL-FSACR-0039")
            const filteredImages = cImagesItems.filter(image => {
                if (!image.ImageID) return false;
                
                // Parse ImageID: "GMRL-FSACR-0039-47" -> ["GMRL", "FSACR", "0039", "47"]
                const parts = image.ImageID.split('-');
                if (parts.length < 4) return false;
                
                // Reconstruct document number from first 3 parts
                const imageDocNum = `${parts[0]}-${parts[1]}-${parts[2]}`;
                return imageDocNum === documentNumber;
            });

            console.log(`📷 Found ${filteredImages.length} image records for document ${documentNumber}`);

            // Create a lookup object for images by question ID (extracted from ImageID)
            // ImageID format: "GMRL-FSACR-0048-87" -> questionId = "87"
            // Structure: { "87": [{ url, isCorrective, ... }], ... }
            const imageMap = {};
            
            // Process each image
            for (const image of filteredImages) {
                // Extract question ID from ImageID (last part after final hyphen)
                // "GMRL-FSACR-0048-87" -> "87"
                const parts = image.ImageID.split('-');
                const questionId = parts[parts.length - 1]; // Get the last part
                
                const isCorrective = image.Iscorrective === true;
                
                // For document library, use FileRef which contains the server-relative URL
                let imageUrl = null;
                
                if (image.FileRef) {
                    // FileRef is the server-relative path like "/operations/CImages/Dashboard.png"
                    imageUrl = image.FileRef;
                    
                    // Convert to full URL (avoid double slashes)
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        // Get base URL without trailing slash or /operations
                        let baseUrl = this.config.siteUrl.replace(/\/$/, '');
                        // Remove /operations from the end if it exists
                        baseUrl = baseUrl.replace(/\/operations$/i, '');
                        
                        // Combine base URL with file path
                        imageUrl = `${baseUrl}${imageUrl}`;
                    }
                }
                
                // If we have a valid image URL and question ID, add to map
                if (imageUrl && questionId) {
                    if (!imageMap[questionId]) {
                        imageMap[questionId] = [];
                    }
                    
                    // Store both the SharePoint URL and the REST API URL for downloading
                    const restApiUrl = `${this.config.siteUrl}/_api/Web/GetFileByServerRelativeUrl('${encodeURIComponent(image.FileRef)}')/$value`;
                    
                    imageMap[questionId].push({
                        url: imageUrl, // Keep original for fallback
                        restApiUrl: restApiUrl, // For downloading with authentication
                        isCorrective: isCorrective,
                        title: image.FileLeafRef || `Image ${image.ImageID}`,
                        imageID: image.ImageID,
                        created: image.Created,
                        fileName: image.FileLeafRef
                    });
                }
            }

            console.log(`📷 Successfully mapped ${Object.keys(imageMap).length} unique question IDs with image URLs`);
            
            // Log sample of mapped images
            const sampleKeys = Object.keys(imageMap).slice(0, 5);
            if (sampleKeys.length > 0) {
                console.log('📷 Sample image mappings:');
                sampleKeys.forEach(key => {
                    const imgs = imageMap[key];
                    const beforeCount = imgs.filter(img => !img.isCorrective).length;
                    const afterCount = imgs.filter(img => img.isCorrective).length;
                    console.log(`   Question ID ${key}: ${beforeCount} before, ${afterCount} after`);
                });
            }
            
            return imageMap;

        } catch (error) {
            console.warn('Could not get images from CImages:', error.message);
            console.error(error.stack);
            return {};
        }
    }

    /**
     * Download images from SharePoint and convert to base64 data URLs
     * This ensures images can be displayed without authentication
     */
    async downloadImageAsBase64(imageItem) {
        try {
            console.log(`📷 Downloading image: ${imageItem.fileName}`);
            
            const response = await fetch(imageItem.restApiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.connector.accessToken}`,
                    'Accept': 'application/octet-stream'
                }
            });

            if (!response.ok) {
                console.warn(`⚠️ Failed to download image ${imageItem.fileName}: ${response.status}`);
                return imageItem.url; // Fallback to original URL
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64String = buffer.toString('base64');
            
            // Determine MIME type based on file extension
            const extension = imageItem.fileName.toLowerCase().split('.').pop();
            let mimeType = 'image/jpeg'; // default
            if (extension === 'png') mimeType = 'image/png';
            else if (extension === 'gif') mimeType = 'image/gif';
            else if (extension === 'webp') mimeType = 'image/webp';
            
            const dataUrl = `data:${mimeType};base64,${base64String}`;
            console.log(`✅ Successfully converted ${imageItem.fileName} to base64 (${Math.round(base64String.length/1024)}KB)`);
            
            return dataUrl;
            
        } catch (error) {
            console.warn(`⚠️ Error downloading image ${imageItem.fileName}:`, error.message);
            return imageItem.url; // Fallback to original URL
        }
    }

    /**
     * Process section data based on CORRECTED SharePoint architecture:
     * 1. Get template questions from section list (e.g., "Food Storage & Dry Storage") 
     * 2. Get answer data with ResponseJSON from answer list (e.g., "Survey Responses List", "SRA Fridges")
     * 3. Process ResponseJSON to get answered questions with scores
     */
    async processSectionData(sectionConfig, documentNumber, lists) {
        try {
            if (!sectionConfig.answerListName) {
                console.log(`❌ No answer list specified for section: ${sectionConfig.title}`);
                return [];
            }
            
            console.log(`\n🔍 Processing ${sectionConfig.title}:`);
            console.log(`   Template List: ${sectionConfig.templateListName}`);
            console.log(`   Answer List: ${sectionConfig.answerListName}`);

            // Get answer data from answer list (contains ResponseJSON with answered questions)
            const answerData = await this.getAnswerDataWithResponseJSON(sectionConfig.answerListName, documentNumber);
            
            if (!answerData || answerData.length === 0) {
                console.log(`   ⚠️ No answer data found in ${sectionConfig.answerListName} for document ${documentNumber}`);
                return [];
            }

            // Process ResponseJSON to get answered questions
            const answeredQuestions = this.processResponseJSONItems(answerData, sectionConfig.title);
            
            console.log(`   📊 Total answered questions processed: ${answeredQuestions.length}`);
            return answeredQuestions;

        } catch (error) {
            console.warn(`⚠️ Error processing section data for ${sectionConfig.title}:`, error.message);
            return [];
        }
    }

    /**
     * Get answer data with ResponseJSON from answer lists
     */
    async getAnswerDataWithResponseJSON(answerListName, documentNumber) {
        try {
            let answerItems = [];
            
            // Try different filter patterns to find the document's answer item
            try {
                // Try with Document_x0020_Number field first
                answerItems = await this.connector.getListItems(answerListName, {
                    filter: `Document_x0020_Number eq '${documentNumber}'`,
                    top: 10
                });
                
                if (!answerItems || answerItems.length === 0) {
                    // Try with Title field containing document number
                    answerItems = await this.connector.getListItems(answerListName, {
                        filter: `substringof('${documentNumber}', Title)`,
                        top: 10
                    });
                }
                
            } catch (filterError) {
                console.warn(`⚠️ Error with filtering ${answerListName}, trying manual search:`, filterError.message);
                try {
                    const allItems = await this.connector.getListItems(answerListName, { top: 100 });
                    // Filter manually by document number
                    answerItems = allItems.filter(item => 
                        (item.Title && item.Title.includes(documentNumber)) ||
                        item.Document_x0020_Number === documentNumber ||
                        item.DocumentNumber === documentNumber ||
                        item.Document_Number === documentNumber
                    );
                } catch (getAllError) {
                    console.error(`❌ Could not get items from ${answerListName}:`, getAllError.message);
                    return [];
                }
            }

            console.log(`   ✅ Found ${answerItems.length} answer item(s) in ${answerListName}`);
            return answerItems;

        } catch (error) {
            console.error(`❌ Error getting answer data from ${answerListName}:`, error.message);
            return [];
        }
    }



    /**
     * Common method to process ResponseJSON field from any list items
     */
    processResponseJSONItems(answerItems, sectionTitle) {
        const allSectionData = [];

        for (let i = 0; i < answerItems.length; i++) {
            const answerItem = answerItems[i];
            console.log(`   Processing item ${i + 1}: ${answerItem.Title} (ID: ${answerItem.ID || answerItem.Id})`);

            // Look for ResponseJSON field
            const responseField = answerItem.ResponseJSON;
            
            if (!responseField) {
                console.log(`   ⚠️ No ResponseJSON field found in item ${i + 1}`);
                console.log(`      Available fields: ${Object.keys(answerItem).join(', ')}`);
                continue;
            }

            // Parse the ResponseJSON field
            let responseData;
            try {
                // Handle both string and object cases
                if (typeof responseField === 'string') {
                    // Clean up the JSON string
                    let cleanJSON = responseField.trim();
                    
                    // Handle common JSON issues
                    cleanJSON = cleanJSON.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
                    cleanJSON = cleanJSON.replace(/\\/g, '\\\\'); // Escape backslashes properly
                    
                    responseData = JSON.parse(cleanJSON);
                } else {
                    responseData = responseField; // Already parsed object
                }
                
                console.log(`   ✅ Parsed ${Array.isArray(responseData) ? responseData.length : 'unknown'} items from ResponseJSON`);
            } catch (parseError) {
                console.error(`   ❌ JSON Parse Error in ${answerItem.Title}:`, parseError.message);
                console.log(`      Raw JSON preview: ${String(responseField).substring(0, 200)}...`);
                continue;
            }

            // Ensure responseData is an array
            if (!Array.isArray(responseData)) {
                console.log(`   ⚠️ ResponseJSON is not an array, wrapping in array`);
                responseData = [responseData];
            }

            // Process each question in the ResponseJSON using the AuditItem interface structure
            for (const questionData of responseData) {
                const processedQuestion = {
                    // Core audit item fields (matching AuditItem interface)
                    Id: questionData.Id || questionData.ID,
                    ID: questionData.Id || questionData.ID,
                    ImageID: questionData.Id || questionData.ID,
                    Title: questionData.Title || 'Unknown Question',
                    Answer: questionData.Answer || '',  // e.g., "Yes,Partially,No,NA"
                    Coeff: questionData.Coeff || 0,
                    Coef: questionData.Coeff || 0,  // Alternative spelling
                    SelectedChoice: questionData.SelectedChoice || '', // "Yes" | "Partially" | "No" | "NA" | ""
                    Value: this.calculateQuestionScore(questionData.SelectedChoice, questionData.Coeff),
                    ReferenceValue: questionData.ReferenceValue || null,
                    
                    // Additional fields
                    comment: questionData.comment || '',
                    Comments: questionData.comment || '',
                    correctedaction: questionData.correctedaction || '',
                    Finding: questionData.Finding || null,
                    Priority: questionData.Priority || '',
                    Picture: questionData.Picture || '',
                    SelectedCr: questionData.SelectedCr || '',
                    cr: questionData.cr || '',
                    
                    // Keep original for debugging
                    OriginalValue: questionData.Value
                };
                
                allSectionData.push(processedQuestion);
            }
        }

        console.log(`   📊 Total questions processed for ${sectionTitle}: ${allSectionData.length}`);
        return allSectionData;
    }

    /**
     * Calculate question score using PowerApps Switch logic
     */
    calculateQuestionScore(selectedChoice, coefficient) {
        if (!selectedChoice || !coefficient) return 0;
        
        const choice = selectedChoice.toLowerCase().trim();
        const coeff = parseFloat(coefficient) || 0;
        
        switch (choice) {
            case 'yes':
                return coeff; // Full coefficient value
            case 'partially':
                return coeff / 2; // Half coefficient value  
            case 'no':
                return 0; // No points
            case 'na':
            case 'n/a':
                return null; // Not applicable - doesn't count
            default:
                return 0;
        }
    }

    /**
     * Process individual JSON item (matching PowerApps logic)
     */
    processJsonItem(jsonItem) {
        const coeff = parseFloat(jsonItem.Coeff) || 0;
        const selectedChoice = jsonItem.SelectedChoice || '';
        
        // Calculate value based on PowerApps Switch logic
        let value = 0;
        switch (selectedChoice) {
            case 'Yes':
                value = coeff;
                break;
            case 'Partially':
                value = coeff / 2;
                break;
            case 'No':
                value = 0;
                break;
            case 'NA':
                value = null; // Blank in PowerApps
                break;
            default:
                value = 0;
        }

        return {
            Id: jsonItem.Id || 'N/A',
            Title: jsonItem.Title || 'N/A',
            Answer: jsonItem.Answer || '',
            Coeff: coeff,
            SelectedChoice: selectedChoice,
            comment: jsonItem.comment || '',
            correctedaction: jsonItem.correctedaction || '',
            Priority: jsonItem.Priority || '',
            Picture: jsonItem.Picture || '',
            SelectedCr: jsonItem.SelectedCr || '',
            cr: jsonItem.cr || '',
            Finding: jsonItem.Finding || '',
            ReferenceValue: jsonItem.ReferenceValue || '',
            Value: value
        };
    }

    /**
     * Calculate performance based on score (matching PowerApps logic)
     */
    calculatePerformance(score) {
        if (score === 0) return "Fail ❌";
        if (score === 83) return "Pass ✅";
        if (score === 100) return "Pass ✅";
        if (score < 83) return "Fail ❌";
        return "Pass ✅";
    }

    /**
     * Get score status
     */
    getScoreStatus(score) {
        if (score === 0) return "No Data";
        if (score < 83) return "FAIL";
        return "PASS";
    }

    /**
     * Get score emoji (matching PowerApps logic)
     */
    getScoreEmoji(score) {
        if (score === 0) return "⚪";
        if (score < 83) return "🔴";
        return "🟢";
    }

    /**
     * Get historical scores for the same store from SQL database (FS Survey is deleted)
     */
    async getHistoricalScoresForStore(storeName) {
        try {
            console.log(`🔍 Fetching historical scores for store: ${storeName} from database`);
            
            const sql = require('mssql');
            const dbConfig = require('./config/default').database;
            const pool = await sql.connect(dbConfig);
            
            const result = await pool.request()
                .input('storeName', sql.NVarChar(255), storeName)
                .query(`
                    SELECT 
                        DocumentNumber, StoreName, TotalScore as Scor, 
                        Cycle, Year, AuditDate, CreatedAt as Created,
                        Auditors as Auditor
                    FROM AuditInstances 
                    WHERE StoreName = @storeName
                    ORDER BY CreatedAt DESC
                `);

            if (!result.recordset || result.recordset.length === 0) {
                console.log(`No historical data found for store: ${storeName}`);
                return [];
            }

            console.log(`✅ Found ${result.recordset.length} historical records for ${storeName}`);
            
            // Map to expected format
            const historicalData = result.recordset.map(record => ({
                Document_x0020_Number: record.DocumentNumber,
                Store_x0020_Name: record.StoreName,
                Scor: record.Scor,
                Score: record.Scor,
                Cycle: record.Cycle,
                Year: record.Year,
                Created: record.Created,
                Auditor: record.Auditor
            }));
            
            return historicalData;

        } catch (error) {
            console.warn('Error fetching historical scores from database:', error.message);
            return [];
        }
    }

    /**
     * Get historical score for a specific section and cycle (matching PowerApps logic)
     */
    async getHistoricalScoreForStore(storeName, sectionTitle, cycle) {
        try {
            // Use cached historical data if available
            if (!this.cachedHistoricalData) {
                this.cachedHistoricalData = await this.getHistoricalScoresForStore(storeName);
            }

            const historicalData = this.cachedHistoricalData;
            
            if (!historicalData || historicalData.length === 0) {
                return '0.1'; // Default value when no historical data
            }

            // Find all records that match the requested cycle, excluding the current document
            const matchingRecords = historicalData.filter(record => {
                const recordCycle = record.Cycle || '';
                const isCurrentDocument = record.Title === this.currentDocumentNumber;
                
                // Match cycle patterns like "C1 (Jan/Feb)", "C2", etc., but exclude current document
                const cycleMatches = recordCycle.includes(cycle) || recordCycle.startsWith(cycle);
                return cycleMatches && !isCurrentDocument;
            });

            if (matchingRecords.length === 0) {
                console.log(`🔍 No historical record found for cycle: ${cycle} (excluding current document), returning 0.1`);
                return '0.1'; // Default if cycle not found
            }

            // If multiple records match, take the most recent one (first in the sorted array)
            const matchingRecord = matchingRecords[0];
            console.log(`🔍 Found ${matchingRecords.length} records for cycle ${cycle}, using most recent: ${matchingRecord.Title}`);

            // Get section score field mapping
            const sectionConfig = Object.values(this.sectionMappings).find(config => 
                config.title === sectionTitle
            );

            if (!sectionConfig) {
                console.log(`🔍 Section config not found for: ${sectionTitle}, returning 0.1`);
                return '0.1';
            }

            const scoreValue = matchingRecord[sectionConfig.scoreField];
            console.log(`🔍 Found historical score for ${sectionTitle} ${cycle}: ${scoreValue} from record ${matchingRecord.Title}`);
            return scoreValue !== null && scoreValue !== undefined ? scoreValue.toString() : '0.1';

        } catch (error) {
            console.warn(`Error getting historical score for ${sectionTitle} ${cycle}:`, error.message);
            return '0.1';
        }
    }

    /**
     * Get historical overall score for a specific cycle
     */
    async getHistoricalOverallScore(cycle) {
        try {
            if (!this.cachedHistoricalData || this.cachedHistoricalData.length === 0) {
                return '0.1'; // Default when no data
            }

            // Find all records that match the requested cycle, excluding the current document
            const matchingRecords = this.cachedHistoricalData.filter(record => {
                const recordCycle = record.Cycle || '';
                const isCurrentDocument = record.Title === this.currentDocumentNumber;
                
                // Match cycle patterns like "C1 (Jan/Feb)", "C2", etc., but exclude current document
                const cycleMatches = recordCycle.includes(cycle) || recordCycle.startsWith(cycle);
                return cycleMatches && !isCurrentDocument;
            });

            if (matchingRecords.length === 0) {
                console.log(`🔍 No historical overall record found for cycle: ${cycle} (excluding current document), returning 0.1`);
                return '0.1';
            }

            // If multiple records match, take the most recent one (first in the sorted array)
            const matchingRecord = matchingRecords[0];
            console.log(`🔍 Found ${matchingRecords.length} overall records for cycle ${cycle}, using most recent: ${matchingRecord.Title}`);

            // Simply use the Score field from FS Survey - no calculation needed
            const overallScore = matchingRecord.Score || matchingRecord.Scor || matchingRecord.TotalScore || matchingRecord.OverallScore;
            
            console.log(`🔍 Found historical overall score for ${cycle}: ${overallScore} from record ${matchingRecord.Title} (Score field)`);
            return overallScore !== null && overallScore !== undefined ? overallScore.toString() : '0.1';

        } catch (error) {
            console.warn(`Error getting historical overall score for ${cycle}:`, error.message);
            return '0.1';
        }
    }

    /**
     * Get historical score (backward compatibility method)
     */
    getHistoricalScore(sectionTitle, cycle) {
        // This method is called synchronously from HTML generation
        // Return placeholder for now, will be replaced by async version
        const placeholderScores = {
            'Food Storage and Dry Storage': { C1: 75, C2: 82, C3: 78, C4: 85 },
            'Fridges and Freezers': { C1: 68, C2: 74, C3: 71, C4: 79 },
            'Utensils and Equipment': { C1: 82, C2: 88, C3: 85, C4: 91 },
            'Food Handling': { C1: 79, C2: 83, C3: 80, C4: 86 },
            'Cleaning and Disinfection': { C1: 73, C2: 77, C3: 75, C4: 81 },
            'Personal Hygiene': { C1: 85, C2: 89, C3: 87, C4: 92 },
            'Restrooms': { C1: 71, C2: 76, C3: 74, C4: 80 },
            'Garbage Storage and Disposal': { C1: 77, C2: 81, C3: 78, C4: 84 },
            'Maintenance': { C1: 69, C2: 73, C3: 71, C4: 77 },
            'Chemicals Available': { C1: 74, C2: 79, C3: 76, C4: 82 },
            'Monitoring Sheets': { C1: 81, C2: 85, C3: 83, C4: 88 },
            'Policies & Procedures': { C1: 76, C2: 80, C3: 78, C4: 84 },
            'Food Safety Culture': { C1: 83, C2: 87, C3: 85, C4: 90 }
        };
        
        return placeholderScores[sectionTitle]?.[cycle] || Math.floor(Math.random() * 40) + 60;
    }

    /**
     * Get score with emoji and styling (matching PowerApps logic)
     */
    getFormattedScore(score, isResult = false) {
        const roundedScore = Math.round(score);
        const emoji = this.getScoreEmoji(roundedScore);
        const bgColor = roundedScore > (isResult ? 83 : 89) ? '#28a745' : '#dc3545';
        
        if (isResult) {
            const resultText = roundedScore > 83 ? 'PASS' : 'FAIL';
            return `<div style='background-color:${bgColor}; color:white; padding:8px; border-radius:4px; display:block; width:100%; height:100%; text-align:center;'>${resultText}</div>`;
        }
        
        return `${roundedScore} ${emoji}`;
    }

    /**
     * Generate corrective actions for a section based on PowerApps logic
     * Shows images with Iscorrective = true (after/corrective photos)
     */
    generateCorrectiveActions(sectionTitle, sectionData, imageMap = {}) {
        if (!sectionData || sectionData.length === 0) {
            return '';
        }

        // Filter items that need corrective actions (following PowerApps logic: Coeff <> Value && SelectedChoice <> "NA")
        const correctiveItems = sectionData.filter(item => {
            return item.Coeff !== item.Value && 
                   item.SelectedChoice && 
                   item.SelectedChoice.toUpperCase() !== "NA" &&
                   item.SelectedChoice.toUpperCase() !== "N/A" &&
                   (item.Finding || item.correctedaction || item.cr);
        });

        if (correctiveItems.length === 0) {
            return `
                <div class="corrective-actions-container">
                    <div class="corrective-actions-header">
                        ✅ NO CORRECTIVE ACTIONS REQUIRED - ${sectionTitle}
                    </div>
                    <div class="no-actions-message">
                        All items in this section are compliant. Great job! 🎉
                    </div>
                </div>
            `;
        }

        // Helper function to clean text from SharePoint (handles both escaped and actual special characters)
        const cleanText = (text) => {
            if (!text) return text;
            return text
                .replace(/\\n/g, '<br>')  // Escaped newlines from SharePoint
                .replace(/\n/g, '<br>')   // Actual newlines
                .replace(/\\t/g, '    ')  // Escaped tabs from SharePoint
                .replace(/\t/g, '    ');  // Actual tabs
        };

        const tableRows = correctiveItems.map((item, index) => {
            const finding = cleanText(item.Finding || item.Title || 'Finding not specified');
            const severity = item.Priority || this.getSeverityFromScore(item.Value, item.Coeff);
            const severityClass = this.getSeverityClass(severity);
            const correctiveAction = cleanText(item.correctedaction || item.cr || 'Corrective action to be determined');
            
            // Get images using question ID (extract from full ImageID format)
            // ResponseJSON Id format: "GMRL-FSACR-0048-87" -> extract "87"
            const fullImageId = String(item.Id || item.ID || item.ImageID || '');
            const questionId = fullImageId.includes('-') ? fullImageId.split('-').pop() : fullImageId;
            const itemImages = imageMap[questionId];
            let pictureCell = '';
            
            if (itemImages && itemImages.length > 0) {
                // Filter for AFTER/CORRECTIVE images (Iscorrective = true)
                const afterImages = itemImages.filter(img => img.isCorrective);
                
                if (afterImages.length > 0) {
                    // Create 2-column grid for corrective action images with click-to-enlarge
                    const imageGrid = afterImages.map((img, idx) => 
                        `<img src='${img.url}' 
                             class='image-thumbnail' 
                             style='border-color: #28a745;' 
                             onclick='openImageModal("${img.url.replace(/'/g, "\\'")}","After: ${img.fileName || img.title}","${img.imageID}","${new Date(img.created).toLocaleString()}")' 
                             alt='After: ${img.title}' 
                             title='Click to enlarge - ${img.imageID}'>`
                    ).join('');
                    
                    pictureCell = `<div class='image-gallery'>${imageGrid}</div>`;
                } else {
                    // Check if there are CImages records but no actual image files
                    pictureCell = '<span style="color: #dc3545; font-size: 0.85em;">⚠️ No corrective photo uploaded</span>';
                }
            } else {
                // No CImages record found at all
                pictureCell = '<span style="color: #999;">—</span>';
            }
            
            return `
                <tr>
                    <td style="width:30px; text-align:center;">${item.ReferenceValue || (index + 1)}</td>
                    <td class="finding-col">${finding}</td>
                    <td class="${severityClass}">${severity}</td>
                    <td style="text-align:center; width:220px; min-width:220px; padding:8px;">
                        ${pictureCell}
                    </td>
                    <td class="action-col">${correctiveAction}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="corrective-actions-container">
                <div class="corrective-actions-header">
                    ⚠️ REQUIRED ACTIONS - ${sectionTitle}
                </div>
                <table class="corrective-actions-table">
                    <tr>
                        <th style="width:30px;">#</th>
                        <th>Finding</th>
                        <th style="width:80px;">Severity</th>
                        <th style="width:220px; min-width:220px;">Corrective Picture (After)</th>
                        <th>Corrective Action</th>
                    </tr>
                    ${tableRows}
                </table>
            </div>
        `;
    }

    /**
     * Generate Fridges Finding and Fridges Good tables for Fridges section
     * @param {string} documentNumber - The audit document number to filter by
     * @returns {Promise<string>} HTML for the fridge tables
     */
    async generateFridgesTables(documentNumber) {
        try {
            console.log(`📊 Fetching SRA Fridges data for ${documentNumber}...`);
            
            // First, fetch SRA Fridges to get ReferenceValues
            const sraFridgesItems = await this.connector.getListItems('SRA Fridges', {
                filter: `Document_x0020_Number eq '${documentNumber}'`,
                top: 1
            });
            
            if (sraFridgesItems.length === 0) {
                console.warn(`⚠️ No SRA Fridges data found for ${documentNumber}`);
                return { findingsTableHTML: '', goodTableHTML: '' };
            }
            
            // Parse the ResponseJSON to get fridge items with ReferenceValues
            const responseJSON = sraFridgesItems[0].ResponseJSON;
            if (!responseJSON || responseJSON === '[]') {
                console.warn(`⚠️ No ResponseJSON data in SRA Fridges for ${documentNumber}`);
                return { findingsTableHTML: '', goodTableHTML: '' };
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
            // This is typically the question about "Air temperature of fridges and freezers"
            const tempMonitoringItem = sraFridgeItems.find(item => 
                item.Title && item.Title.toLowerCase().includes('air temperature of fridges and freezers')
            );
            
            const temperatureReferenceValue = tempMonitoringItem ? tempMonitoringItem.ReferenceValue : '2.26';
            console.log(`📊 Using ReferenceValue "${temperatureReferenceValue}" for temperature monitoring records`);
            
            // Create enriched items with ReferenceValue from SRA Fridges
            // All temperature records use the same ReferenceValue (the temperature monitoring question)
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
                        // Get attachments using getListItems with expand
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
                                const base64 = await this.downloadImageAsBase64(imageItem);
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
                        // Get attachments using getListItems with expand
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
                                const base64 = await this.downloadImageAsBase64(imageItem);
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
                // Helper function to clean text
                const cleanText = (text) => {
                    if (!text) return text;
                    return text
                        .replace(/\\n/g, '<br>')
                        .replace(/\n/g, '<br>')
                        .replace(/\\t/g, '    ')
                        .replace(/\t/g, '    ');
                };

                const findingRows = enrichedFindingItems.map((item) => {
                    const base64Images = fridgeImageMap.get(`finding_${item.ID}`) || [];
                    const pictureHtml = this.generateFridgePictureCell(base64Images);
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
                    const pictureHtml = this.generateFridgePictureCell(base64Images);
                    
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
     * Generate HTML for fridge picture cell with base64 images
     * @param {Array<string>} base64Images - Array of base64 image data URIs
     * @returns {string} HTML for picture cell
     */
    generateFridgePictureCell(base64Images) {
        if (!base64Images || base64Images.length === 0) {
            return '<span style="color: #999;">—</span>';
        }

        const imageHtml = base64Images.map((base64, index) => `
            <img src='${base64}' 
                 class='image-thumbnail' 
                 onclick='openImageModal("${base64}","Fridge Image ${index + 1}","","")' 
                 alt='Fridge Image ${index + 1}' 
                 title='Click to enlarge'
                 style='max-width: 100px; max-height: 100px; cursor: pointer; margin: 4px;'>
        `).join('');

        return `<div class='image-gallery' style='display: flex; flex-wrap: wrap; gap: 4px;'>${imageHtml}</div>`;
    }

    /**
     * Get severity based on score comparison
     */
    getSeverityFromScore(value, coeff) {
        if (!value || !coeff) return 'Medium';
        const percentage = (value / coeff) * 100;
        if (percentage < 50) return 'High';
        if (percentage < 80) return 'Medium';
        return 'Low';
    }

    /**
     * Get CSS class for severity
     */
    getSeverityClass(severity) {
        const sev = (severity || '').toLowerCase();
        if (sev.includes('high') || sev.includes('critical')) return 'severity-high';
        if (sev.includes('medium') || sev.includes('moderate')) return 'severity-medium';
        return 'severity-low';
    }

    /**
     * Generate detailed section table with comprehensive data
     * Shows images with Iscorrective = false (before photos)
     */
    generateDetailedSectionTable(sectionTitle, sectionData, imageMap = {}) {
        if (!sectionData || sectionData.length === 0) {
            return '<p style="text-align: center; color: #666; padding: 20px;">No data available for this section</p>';
        }

        const tableRows = sectionData.map((item, index) => {
            const answerClass = this.getAnswerClass(item.SelectedChoice || item.Answer);
            const criteria = item.Title || item.Question || item.Criteria || 'Criteria not specified';
            // Show blank coefficient if SelectedChoice is NA, otherwise show the coefficient value
            const coefficient = (item.SelectedChoice === 'NA') ? '' : (item.Coeff || item.Coefficient || '-');
            // Show actual SelectedChoice value, or "No Answer" if empty
            const answer = (item.SelectedChoice && item.SelectedChoice.trim()) || 'No Answer';
            const comments = item.comment || item.Comments || item.Note || '-';
            const referenceNumber = item.ReferenceValue || (index + 1);
            
            // Get images using question ID from ResponseJSON (item.Id)
            // Extract question number from full ImageID format: "GMRL-FSACR-0048-87" -> "87"
            const fullImageId = String(item.Id || item.ID || item.ImageID || '');
            const questionId = fullImageId.includes('-') ? fullImageId.split('-').pop() : fullImageId;
            const itemImages = imageMap[questionId];
            let pictureCell = '';
            
            if (itemImages && itemImages.length > 0) {
                // Filter for BEFORE images (Iscorrective = false)
                const beforeImages = itemImages.filter(img => !img.isCorrective);
                
                if (beforeImages.length > 0) {
                    // Create 2-column grid layout for images with click-to-enlarge
                    const imageGrid = beforeImages.map((img, idx) => 
                        `<img src='${img.url}' 
                             class='image-thumbnail' 
                             onclick='openImageModal("${img.url.replace(/'/g, "\\'")}","Before: ${img.fileName || img.title}","${img.imageID}","${new Date(img.created).toLocaleString()}")' 
                             alt='Before: ${img.title}' 
                             title='Click to enlarge - ${img.imageID}'>`
                    ).join('');
                    
                    pictureCell = `<div class='image-gallery'>${imageGrid}</div>`;
                } else {
                    pictureCell = '<span style="color: #ccc;">📷</span>';
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
                    <td class="comments-col">${comments}</td>
                    <td class="picture-col">${pictureCell}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="section-details-table">
                <tr>
                    <th class="ref-col">#</th>
                    <th class="criteria-col">Criteria</th>
                    <th class="coef-col">Coef</th>
                    <th class="answer-col">Answer</th>
                    <th class="comments-col">Comments</th>
                    <th class="picture-col">Pictures (Before)</th>
                </tr>
                ${tableRows}
            </table>
        `;
    }

    /**
     * Get CSS class for answer styling
     */
    getAnswerClass(answer) {
        if (!answer) return 'answer-na';
        const answerLower = answer.toString().toLowerCase();
        if (answerLower.includes('yes') || answerLower === '2') return 'answer-yes';
        if (answerLower.includes('no') || answerLower === '0') return 'answer-no';
        if (answerLower.includes('partial') || answerLower === '1') return 'answer-partial';
        return 'answer-na';
    }

    /**
     * Calculate section score from processed data using PowerApps logic
     */
    calculateSectionScore(sectionData) {
        if (!sectionData || sectionData.length === 0) {
            console.log(`   No data for score calculation`);
            return 0;
        }

        let totalValue = 0;
        let totalCoeff = 0;
        let validItems = 0;

        for (const item of sectionData) {
            const coeff = parseFloat(item.Coeff || item.Coef) || 0;
            const value = item.Value;

            // Only include items that have a coefficient and non-null value
            if (coeff > 0 && value !== null && value !== undefined) {
                totalValue += parseFloat(value) || 0;
                totalCoeff += coeff;
                validItems++;
            }
        }

        if (totalCoeff === 0) {
            console.log(`   No valid items with coefficients for score calculation`);
            return 0;
        }

        const percentage = Math.round((totalValue / totalCoeff) * 100);
        console.log(`   Score calculation: ${totalValue}/${totalCoeff} = ${percentage}% (${validItems} valid items)`);
        
        return percentage;
    }

    /**
     * Get performance text based on score
     */
    getPerformanceText(score) {
        if (score === 0) return "No Data Available";
        if (score < 83) return "Fail ❌";
        if (score === 100) return "Pass ✅";
        return "Pass ✅";
    }

    /**
     * Generate HTML content
     */
    async generateHTML(data) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Food Safety and Quality Assurance Department - ${data.auditDetails.documentNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5; 
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            margin-bottom: 30px; 
            text-align: center; 
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .audit-info { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            margin-bottom: 30px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .audit-info h2 { color: #667eea; margin-bottom: 20px; }
        .info-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 15px; 
        }
        .info-item { padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; margin-top: 5px; }
        .performance-banner {
            background: ${data.overallScore >= 83 ? '#28a745' : '#dc3545'};
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
            font-size: 1.5em;
            font-weight: bold;
        }
        .scores-overview { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            margin-bottom: 30px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .scores-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
        }
        .score-card { 
            padding: 15px; 
            border-radius: 8px; 
            text-align: center; 
            background: #f8f9fa; 
            border-left: 4px solid #667eea; 
        }
        .score-card.pass { border-left-color: #28a745; background: #d4edda; }
        .score-card.fail { border-left-color: #dc3545; background: #f8d7da; }
        .score-card.no-data { border-left-color: #6c757d; background: #e2e3e5; }
        .section { 
            background: white; 
            margin-bottom: 25px; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .section-header { 
            background: #667eea; 
            color: white; 
            padding: 20px; 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
        }
        .section-title { 
            display: flex; 
            align-items: center; 
            gap: 10px; 
            font-size: 1.3em; 
        }
        .section-score { 
            font-size: 1.5em; 
            font-weight: bold; 
        }
        .section-content { padding: 25px; }
        .checklist-item { 
            padding: 15px; 
            border-bottom: 1px solid #eee; 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
        }
        .checklist-item:last-child { border-bottom: none; }
        .item-details { flex: 1; }
        .item-title { font-weight: bold; margin-bottom: 5px; }
        .item-answer { color: #666; margin-bottom: 5px; }
        .item-comment { 
            color: #888; 
            font-style: italic; 
            font-size: 0.9em; 
            margin-top: 5px; 
        }
        .item-score { 
            min-width: 80px; 
            text-align: center; 
            padding: 5px 10px; 
            border-radius: 20px; 
            font-weight: bold; 
        }
        .score-yes { background: #d4edda; color: #155724; }
        .score-partial { background: #fff3cd; color: #856404; }
        .score-no { background: #f8d7da; color: #721c24; }
        .score-na { background: #e2e3e5; color: #6c757d; }
        .footer { 
            text-align: center; 
            padding: 20px; 
            color: #666; 
            background: white; 
            border-radius: 10px; 
            margin-top: 30px; 
        }
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header h1 { font-size: 2em; }
            .info-grid { grid-template-columns: 1fr; }
            .scores-grid { grid-template-columns: 1fr; }
        }
        .chart-container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .chart-container h2 { color: #667eea; margin-bottom: 15px; text-align: center; font-size: 1.3em; }
        .chart-wrapper { 
            position: relative; 
            height: 400px; 
            width: 100%; 
        }
        .data-table-container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            overflow-x: auto;
        }
        .data-table-container h3 { 
            color: #667eea; 
            margin-bottom: 15px; 
            text-align: center; 
            font-size: 1.3em; 
            margin-top: 0;
        }
        .data-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
        }
        .data-table th { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 12px 8px; 
            text-align: center; 
            font-weight: bold; 
            border: 1px solid #5a6fd8;
            font-size: 11px;
        }
        .data-table td { 
            padding: 8px; 
            text-align: center; 
            border: 1px solid #ddd; 
            background: #f9f9f9;
        }
        .data-table tr:nth-child(even) td { 
            background: #f1f1f1; 
        }
        .data-table tr:hover td { 
            background: #e3f2fd; 
        }
        .data-table .category-col { 
            text-align: left; 
            font-weight: 500; 
            min-width: 120px;
        }
        .data-table .score-col { 
            font-weight: bold; 
            color: #2c3e50;
        }
        .corrective-actions-container {
            background: #fff8f0;
            border: 2px solid #ff6b6b;
            border-radius: 8px;
            margin-top: 15px;
            padding: 15px;
        }
        .corrective-actions-header {
            background: #dc3545;
            color: white;
            padding: 10px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
        }
        .corrective-actions-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .corrective-actions-table th {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            padding: 10px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #bd2130;
            font-size: 11px;
        }
        .corrective-actions-table td {
            padding: 8px;
            text-align: left;
            border: 1px solid #ddd;
            background: #fff;
            vertical-align: top;
        }
        .corrective-actions-table tr:nth-child(even) td {
            background: #f8f9fa;
        }
        .corrective-actions-table tr:hover td {
            background: #ffe6e6;
        }
        .corrective-actions-table .finding-col {
            max-width: 200px;
            word-wrap: break-word;
        }
        .corrective-actions-table .action-col {
            max-width: 250px;
            word-wrap: break-word;
        }
        .severity-high { background: #dc3545 !important; color: white; text-align: center; font-weight: bold; }
        .severity-medium { background: #ffc107 !important; color: black; text-align: center; font-weight: bold; }
        .severity-low { background: #28a745 !important; color: white; text-align: center; font-weight: bold; }
        .no-actions-message {
            text-align: center;
            color: #28a745;
            font-weight: bold;
            padding: 20px;
            font-style: italic;
        }
        .section-details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 12px;
            background: white;
        }
        .section-details-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #5a6fd8;
            font-size: 11px;
        }
        .section-details-table td {
            padding: 10px 8px;
            text-align: left;
            border: 1px solid #ddd;
            background: #fff;
            vertical-align: top;
        }
        .section-details-table tr:nth-child(even) td {
            background: #f8f9fa;
        }
        .section-details-table tr:hover td {
            background: #e8f4fd;
        }
        .section-details-table .ref-col {
            width: 40px;
            text-align: center;
            font-weight: bold;
        }
        .section-details-table .criteria-col {
            max-width: 300px;
            word-wrap: break-word;
        }
        .section-details-table .coef-col {
            width: 60px;
            text-align: center;
            font-weight: bold;
        }
        .section-details-table .answer-col {
            width: 100px;
            text-align: center;
        }
        .section-details-table .comments-col {
            max-width: 200px;
            word-wrap: break-word;
            font-style: italic;
            color: #666;
        }
        .section-details-table .picture-col {
            width: 220px;
            min-width: 220px;
            text-align: center;
            padding: 8px !important;
        }
        .answer-yes { background: #d4edda !important; color: #155724; font-weight: bold; }
        .answer-no { background: #f8d7da !important; color: #721c24; font-weight: bold; }
        .answer-partial { background: #fff3cd !important; color: #856404; font-weight: bold; }
        .answer-na { background: #e2e3e5 !important; color: #383d41; font-weight: bold; }
        
        .image-link {
            text-decoration: none;
            color: #007bff;
            font-weight: 500;
        }
        .image-link:hover {
            text-decoration: underline;
            color: #0056b3;
        }
        .image-link img {
            transition: transform 0.2s ease;
        }
        .image-link img:hover {
            transform: scale(1.1);
        }
        
        /* Image Gallery Styles - 2 Column Grid */
        .image-gallery {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
            padding: 4px;
            width: 100%;
            max-width: 220px;
            margin: 0 auto;
        }
        .image-thumbnail {
            width: 100%;
            height: 120px;
            object-fit: cover;
            border: 2px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: block;
        }
        .image-thumbnail:hover {
            border-color: #667eea;
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        /* Modal Styles for Image Viewer */
        .image-modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.95);
            animation: fadeIn 0.3s;
        }
        .image-modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        .modal-content-wrapper {
            position: relative;
            max-width: 95%;
            max-height: 90%;
            animation: zoomIn 0.3s;
        }
        .modal-image {
            width: auto;
            height: auto;
            max-width: 100%;
            max-height: 85vh;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        }
        .modal-close {
            position: absolute;
            top: -50px;
            right: 0;
            color: white;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            background: rgba(220, 53, 69, 0.7);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            border: 2px solid white;
        }
        .modal-close:hover {
            background: rgba(220, 53, 69, 1);
            transform: rotate(90deg);
        }
        .modal-caption {
            color: white;
            text-align: center;
            padding: 15px;
            font-size: 16px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            margin-top: 15px;
            max-width: 800px;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes zoomIn {
            from { transform: scale(0.3); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Food Safety and Quality Assurance Department</h1>
            <p>Food Safety Audit Checklist and Report – Retail</p>
        </div>

        <div class="performance-banner">
            ${data.performance}
        </div>

        <div class="audit-info">
            <h2>📋 Audit Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Document Number</div>
                    <div class="info-value">${data.auditDetails.documentNumber}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Store Name</div>
                    <div class="info-value">${data.auditDetails.storeName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date of Audit</div>
                    <div class="info-value">${data.auditDetails.dateOfAudit}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Auditor</div>
                    <div class="info-value">${data.auditDetails.auditor}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Time of Audit</div>
                    <div class="info-value">${data.auditDetails.timeOfAudit}</div>
                </div>
                <!-- Overall Score info item hidden as per user request -->
            </div>
        </div>

        <div class="chart-container">
            <h2>📊 Section Performance Chart</h2>
            <div class="chart-wrapper">
                <canvas id="sectionChart"></canvas>
            </div>
        </div>

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
                    <th>C5 Score</th>
                    <th>C6 Score</th>
                </tr>
                ${await Promise.all(data.sections.map(async (section, index) => `
                    <tr>
                        <td style="width:30px; text-align:center;">${index + 1}</td>
                        <td class="category-col">${section.title}</td>
                        <td class="score-col">${this.getFormattedScore(section.score)}</td>
                        <td>${await this.getHistoricalScoreForStore(data.auditDetails.storeName, section.title, 'C1')}</td>
                        <td>${await this.getHistoricalScoreForStore(data.auditDetails.storeName, section.title, 'C2')}</td>
                        <td>${await this.getHistoricalScoreForStore(data.auditDetails.storeName, section.title, 'C3')}</td>
                        <td>${await this.getHistoricalScoreForStore(data.auditDetails.storeName, section.title, 'C4')}</td>
                        <td>${await this.getHistoricalScoreForStore(data.auditDetails.storeName, section.title, 'C5')}</td>
                        <td>${await this.getHistoricalScoreForStore(data.auditDetails.storeName, section.title, 'C6')}</td>
                    </tr>
                `)).then(rows => rows.join(''))}
                <!-- Overall Score row hidden as per user request -->
                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <td style="text-align:center;">Result</td>
                    <td class="category-col" style="color: white;">
                        <div style='background-color:${data.overallScore > 83 ? '#28a745' : '#dc3545'}; color:white; padding:8px; border-radius:4px; display:block; width:100%; height:100%; text-align:center;'>
                            Final Result
                        </div>
                    </td>
                    <td style="color: white;">
                        <div style='background-color:${data.overallScore > 83 ? '#28a745' : '#dc3545'}; color:white; padding:8px; border-radius:4px; display:block; width:100%; height:100%; text-align:center;'>
                            ${data.overallScore > 83 ? 'PASS' : 'FAIL'}
                        </div>
                    </td>
                    <td style="color: white;">-</td>
                    <td style="color: white;">-</td>
                    <td style="color: white;">-</td>
                    <td style="color: white;">-</td>
                    <td style="color: white;">-</td>
                    <td style="color: white;">-</td>
                </tr>
            </table>
        </div>

        <div class="scores-overview" style="display: none;">
            <h2>📊 Section Scores Overview</h2>
            <div class="scores-grid">
                ${data.sections.map((section) => `
                    <div class="score-card ${section.status.toLowerCase().replace(' ', '-')}">
                        <div style="font-size: 2em;">${section.icon}</div>
                        <div style="font-weight: bold; margin: 10px 0;">${section.title}</div>
                        <div style="font-size: 1.5em; margin: 5px 0;">
                            ${section.score}% ${section.emoji}
                        </div>
                        <div style="font-size: 0.9em; color: #666;">${section.status}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        ${await Promise.all(data.sections.map(async (section) => `
            <div class="section">
                <div class="section-header">
                    <div class="section-title">
                        <span style="font-size: 1.5em;">${section.icon}</span>
                        ${section.title}
                    </div>
                    <div class="section-score">
                        ${section.score}% ${section.emoji}
                    </div>
                </div>
                <div class="section-content">
                    ${this.generateDetailedSectionTable(section.title, section.data, data.images)}
                </div>
                ${this.generateCorrectiveActions(section.title, section.data, data.images)}
                ${section.title === 'Fridges and Freezers' ? await this.generateFridgesTables(data.auditDetails.documentNumber) : ''}
            </div>
        `)).then(sections => sections.join(''))}

        <div class="footer">
            <p>Report generated on ${new Date(data.metadata.generatedAt).toLocaleString()}</p>
            <p>Generated by Food Safety Audit System</p>
        </div>
    </div>

    <script>
        // Section Performance Chart
        const ctx = document.getElementById('sectionChart').getContext('2d');
        const scores = ${JSON.stringify(data.sections.map(section => section.score))};
        const backgroundColors = scores.map(score => score >= 89 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)');
        const borderColors = scores.map(score => score >= 89 ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)');
        
        const chartData = {
            labels: ${JSON.stringify(data.sections.map(section => section.title))},
            datasets: [{
                label: 'Section Scores (%)',
                data: scores,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2
            }]
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score (%)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.08)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Audit Sections',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 9
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: {
                        size: 12
                    },
                    bodyFont: {
                        size: 11
                    },
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '%';
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: function(value) {
                        return value + '%';
                    },
                    font: {
                        size: 11,
                        weight: 'bold'
                    },
                    color: function(context) {
                        return context.dataset.data[context.dataIndex] >= 89 ? '#28a745' : '#dc3545';
                    }
                }
            },
            animation: {
                duration: 800,
                easing: 'easeInOutQuad'
            },
            layout: {
                padding: {
                    top: 30,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            }
        };

        new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: chartOptions,
            plugins: [ChartDataLabels]
        });
    </script>

    <!-- Image Modal -->
    <div id="imageModal" class="image-modal" onclick="closeImageModal(event)">
        <div class="modal-content-wrapper">
            <span class="modal-close" onclick="closeImageModal(event)">&times;</span>
            <img id="modalImage" class="modal-image" src="" alt="Enlarged Image">
        </div>
        <div id="modalCaption" class="modal-caption"></div>
    </div>

    <script>
        // Image Modal Functions
        function openImageModal(imageUrl, title, imageID, created) {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            const caption = document.getElementById('modalCaption');
            
            modal.classList.add('show');
            modalImg.src = imageUrl;
            caption.innerHTML = '<strong>' + title + '</strong><br>' + 
                               'Image ID: ' + imageID + '<br>' + 
                               'Created: ' + created;
            
            // Prevent body scrolling when modal is open
            document.body.style.overflow = 'hidden';
        }

        function closeImageModal(event) {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            
            // Only close if clicking on the modal background or close button
            if (event.target === modal || event.target.className.includes('modal-close')) {
                modal.classList.remove('show');
                document.body.style.overflow = 'auto';
                
                // Clear the image after animation
                setTimeout(() => {
                    modalImg.src = '';
                }, 300);
            }
        }

        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const modal = document.getElementById('imageModal');
                if (modal.classList.contains('show')) {
                    modal.classList.remove('show');
                    document.body.style.overflow = 'auto';
                    setTimeout(() => {
                        document.getElementById('modalImage').src = '';
                    }, 300);
                }
            }
        });
    </script>
</body>
</html>`;
    }

    /**
     * Generate report using data from debug folder
     */
    async generateReportFromDebugFolder(documentNumber, options = {}) {
        try {
            const debugDir = path.join('./debug/raw-json', documentNumber);
            
            // Check if debug directory exists
            try {
                await fs.access(debugDir);
            } catch (error) {
                throw new Error(`Debug folder not found: ${debugDir}. Please run data collection first.`);
            }
            
            console.log(`📂 Reading from debug directory: ${debugDir}`);
            
            // Read all JSON files in the debug directory
            const files = await fs.readdir(debugDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            console.log(`📄 Found ${jsonFiles.length} JSON files to process`);
            
            // Organize data by list type
            const listData = {};
            let validFiles = 0;
            let skippedFiles = 0;
            
            for (const file of jsonFiles) {
                const filePath = path.join(debugDir, file);
                
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const jsonData = JSON.parse(fileContent);
                    
                    // Extract list name from filename (format: ListName_ItemID.json)
                    const listName = file.replace(/_Item\d+\.json$/, '').replace(/_/g, ' ');
                    
                    if (!listData[listName]) {
                        listData[listName] = [];
                    }
                    
                    listData[listName].push(jsonData);
                    validFiles++;
                    
                } catch (error) {
                    console.warn(`⚠️ Skipping invalid JSON file ${file}: ${error.message.substring(0, 100)}`);
                    skippedFiles++;
                    continue;
                }
            }
            
            console.log(`✅ Processed ${validFiles} valid files, skipped ${skippedFiles} invalid files`);
            
            // Process the data into report format
            const reportData = {
                documentNumber,
                auditDetails: this.extractAuditDetails(listData, documentNumber),
                sections: [],
                overallScore: 0,
                performance: '',
                timestamp: new Date().toISOString(),
                metadata: {
                    generatedAt: new Date().toISOString(),
                    source: 'debug-folder',
                    validFiles: validFiles,
                    skippedFiles: skippedFiles
                }
            };
            
            // Process each section from debug data
            const sectionScores = [];
            
            for (const [sectionKey, mapping] of Object.entries(this.sectionMappings)) {
                console.log(`📊 Processing ${mapping.title}...`);
                
                const sectionData = await this.processSectionFromDebugData(listData, mapping.listName);
                const score = this.calculateSectionScore(sectionData);
                
                reportData.sections.push({
                    ...mapping,
                    data: sectionData,
                    score: score,
                    performance: this.getPerformanceText(score),
                    status: this.getScoreStatus(score),
                    emoji: this.getScoreEmoji(score)
                });
                
                if (score !== null && score !== undefined && !isNaN(score)) {
                    sectionScores.push(score);
                }
            }
            
            // Calculate overall score
            if (sectionScores.length > 0) {
                reportData.overallScore = Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length);
                reportData.performance = this.getPerformanceText(reportData.overallScore);
            } else {
                reportData.overallScore = 0;
                reportData.performance = 'No Data Available';
            }
            
            // Generate the HTML report
            const html = this.generateHTML(reportData);
            
            // Save the report
            const fileName = `Food_Safety_Audit_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.config.outputDir, fileName);
            
            // Ensure output directory exists
            await fs.mkdir(this.config.outputDir, { recursive: true });
            
            // Write HTML file
            await fs.writeFile(filePath, html, 'utf8');
            
            console.log(`✅ HTML Report generated from debug data: ${filePath}`);
            console.log(`📊 Overall Score: ${reportData.overallScore}% (${reportData.performance})`);
            console.log(`🏪 Store: ${reportData.auditDetails.storeName}`);
            console.log(`📅 Date: ${reportData.auditDetails.dateOfAudit}`);
            
            return {
                success: true,
                filePath,
                data: reportData
            };
            
        } catch (error) {
            console.error('❌ Error generating report from debug folder:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process section data from debug folder data
     */
    async processSectionFromDebugData(listData, listName) {
        try {
            const items = listData[listName] || [];
            
            if (items.length === 0) {
                return [];
            }

            // Process the JSON data - each file contains an array of items
            const processedData = [];
            let referenceCounter = 1; // Initialize counter for each section
            
            for (const fileData of items) {
                // fileData is already an array from the JSON file
                if (Array.isArray(fileData)) {
                    for (const item of fileData) {
                        // Extract ReferenceValue from Title if not present (like PowerApps pattern)
                        let referenceValue = item.ReferenceValue;
                        if (!referenceValue && item.Title) {
                            // Try to extract reference from title like "1.1 Properly stored chemicals"
                            const match = item.Title.match(/^(\d+\.?\d*)\s/);
                            if (match) {
                                referenceValue = match[1];
                            } else {
                                // Use sequential numbering for this list
                                referenceValue = referenceCounter++;
                            }
                        } else if (!referenceValue) {
                            referenceValue = referenceCounter++;
                        }

                        // Process each item from the array
                        processedData.push({
                            Id: item.ID || item.Id || 'N/A',
                            ID: item.ID || item.Id || 'N/A',
                            ImageID: item.ID || item.Id || 'N/A',
                            Title: item.Title || 'N/A',
                            ReferenceValue: referenceValue, 
                            Coef: item.Coeff || item.Coef || 0,
                            Coeff: item.Coeff || item.Coef || 0,
                            SelectedChoice: item.SelectedChoice || 'N/A',
                            Value: item.Value || 0,
                            comment: item.comment || '',
                            Comments: item.comment || '',
                            Picture: item.Picture || '',
                            Answer: item.Answer || item.SelectedChoice || 'N/A'
                        });
                    }
                } else {
                    // Handle single item (shouldn't happen with our current debug data structure)
                    let referenceValue = fileData.ReferenceValue;
                    if (!referenceValue && fileData.Title) {
                        const match = fileData.Title.match(/^(\d+\.?\d*)\s/);
                        if (match) {
                            referenceValue = match[1];
                        } else {
                            referenceValue = referenceCounter++;
                        }
                    } else if (!referenceValue) {
                        referenceValue = referenceCounter++;
                    }

                    processedData.push({
                        Id: fileData.ID || fileData.Id || 'N/A',
                        ID: fileData.ID || fileData.Id || 'N/A',
                        ImageID: fileData.ID || fileData.Id || 'N/A',
                        Title: fileData.Title || 'N/A',
                        ReferenceValue: referenceValue,
                        Coef: fileData.Coeff || fileData.Coef || 0,
                        Coeff: fileData.Coeff || fileData.Coef || 0,
                        SelectedChoice: fileData.SelectedChoice || 'N/A',
                        Value: fileData.Value || 0,
                        comment: fileData.comment || '',
                        Comments: fileData.comment || '',
                        Picture: fileData.Picture || '',
                        Answer: fileData.Answer || fileData.SelectedChoice || 'N/A'
                    });
                }
            }

            return processedData;
        } catch (error) {
            console.warn(`Error processing ${listName} from debug data:`, error.message);
            return [];
        }
    }

    /**
     * Extract audit details from database (FS Survey is deleted)
     */
    extractAuditDetails(listData, documentNumber) {
        // Try to get details from Survey Responses List (still exists in SharePoint for section data)
        const surveyData = listData['Survey Responses List'] || [];
        
        let auditDetails = {
            documentNumber: documentNumber,
            storeName: 'N/A',
            dateOfAudit: new Date().toLocaleDateString(),
            timeOfAudit: new Date().toLocaleTimeString(),
            auditor: 'System Generated'
        };

        if (surveyData.length > 0) {
            const firstItem = surveyData[0];
            auditDetails.storeName = firstItem.StoreName || firstItem.Store_Name || firstItem.Store || 'N/A';
            
            // Try to extract date from various possible fields
            if (firstItem.AuditDate) {
                auditDetails.dateOfAudit = new Date(firstItem.AuditDate).toLocaleDateString();
            } else if (firstItem.Created) {
                auditDetails.dateOfAudit = new Date(firstItem.Created).toLocaleDateString();
            } else if (firstItem.Date) {
                auditDetails.dateOfAudit = new Date(firstItem.Date).toLocaleDateString();
            }
            
            if (firstItem.AuditTime) {
                auditDetails.timeOfAudit = firstItem.AuditTime;
            } else if (firstItem.Created) {
                auditDetails.timeOfAudit = new Date(firstItem.Created).toLocaleTimeString();
            }
            
            auditDetails.auditor = firstItem.Auditor || firstItem.Author || 'System Generated';
        }

        return auditDetails;
    }
}

// Main execution
async function main() {
    const documentNumber = process.argv[2];
    const useDebugFlag = process.argv[3];
    
    if (!documentNumber) {
        console.error('❌ Document number is required');
        console.log('Usage: node generate-enhanced-html-report.js <DOCUMENT_NUMBER> [--debug]');
        console.log('Example: node generate-enhanced-html-report.js DOC-001');
        console.log('Example: node generate-enhanced-html-report.js DOC-001 --debug');
        return;
    }

    const generator = new EnhancedHTMLReportGenerator();
    const options = { 
        documentNumber,
        useDebugFolder: useDebugFlag === '--debug' || useDebugFlag === '-d'
    };
    
    const result = await generator.generateHTMLReport(options);
    
    if (result.success) {
        console.log('\n🎉 Enhanced HTML Report Generation Complete!');
        console.log(`📁 File saved: ${result.filePath}`);
        console.log('\n💡 To view the report:');
        console.log('   npm run serve-reports');
        console.log('   Then open your browser to view the HTML file');
    } else {
        console.error('\n❌ Report generation failed:', result.error);
    }
}

// Export for use as module
module.exports = EnhancedHTMLReportGenerator;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}