/**
 * Data Service
 * Handles data fetching and processing from SharePoint
 */

class DataService {
    constructor(connector) {
        this.connector = connector;
        this.currentDocumentNumber = null;
        this.cachedHistoricalData = [];
    }

    /**
     * Set the current document number context
     * @param {string} documentNumber - Current document number
     */
    setDocumentContext(documentNumber) {
        this.currentDocumentNumber = documentNumber;
    }

    /**
     * Get survey data from AuditInstances table (FS Survey SharePoint list is deleted)
     * @param {string} documentNumber - Document number to fetch
     * @param {Array} lists - Available SharePoint lists (not used anymore)
     * @returns {Object} - Survey data object
     */
    async getSurveyData(documentNumber, lists) {
        try {
            console.log(`📊 Fetching survey data for ${documentNumber} from database...`);
            
            const sql = require('mssql');
            const dbConfig = require('../../config/default').database;
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

            if (result.recordset.length > 0) {
                const dbItem = result.recordset[0];
                console.log(`✅ Found survey data in database with ${Object.keys(dbItem).length} fields`);
                
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
            }

            console.warn('⚠️ No survey data found for document number:', documentNumber);
            return null;

        } catch (error) {
            console.error('Error fetching survey data from database:', error.message);
            return null;
        }
    }

    /**
     * Get images from CImages library
     * @param {string} documentNumber - Document number
     * @param {Array} lists - Available SharePoint lists
     * @returns {Object} - Images grouped by ImageID
     */
    async getCImages(documentNumber, lists) {
        try {
            console.log(`📷 Fetching images for document ${documentNumber}...`);

            // CImages is a DOCUMENT LIBRARY - use direct REST API with GUID
            // GUID from original code: abb703bc-835c-4671-bad0-2f89956e3b74
            const token = await this.connector.getAccessToken();
            const siteUrl = this.connector.config?.siteUrl || this.config.siteUrl;
            const url = `${siteUrl}/_api/Web/Lists(guid'abb703bc-835c-4671-bad0-2f89956e3b74')/Items?$select=Id,ImageID,Iscorrective,FileLeafRef,FileRef,File_x0020_Type,Created&$filter=FSObjType eq 0 and substringof('${documentNumber}', ImageID)&$top=1000`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json;odata=verbose'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch CImages: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const items = data.d?.results || [];

            if (items.length === 0) {
                console.log('No images found for this document');
                return {};
            }

            console.log(`✅ Found ${items.length} image files`);

            // Group images by ImageID
            const imagesByID = {};
            
            for (const item of items) {
                const imageID = item.ImageID;
                if (!imageID) continue;
                
                if (!imagesByID[imageID]) {
                    imagesByID[imageID] = [];
                }
                
                // Build REST API URL for downloading the file
                const restApiUrl = `${siteUrl}/_api/Web/GetFileByServerRelativeUrl('${encodeURIComponent(item.FileRef)}')/$value`;
                
                imagesByID[imageID].push({
                    ...item,
                    restApiUrl: restApiUrl,
                    fileName: item.FileLeafRef || `Image ${imageID}`
                });
            }

            console.log(`📷 Grouped into ${Object.keys(imagesByID).length} image groups`);
            return imagesByID;

        } catch (error) {
            console.error('Error fetching CImages:', error.message);
            return {};
        }
    }

    /**
     * Process section data from SharePoint
     * @param {Object} sectionConfig - Section configuration
     * @param {string} documentNumber - Document number
     * @param {Array} lists - Available SharePoint lists
     * @returns {Array} - Processed section items
     */
    async processSectionData(sectionConfig, documentNumber, lists) {
        try {
            const answerList = lists.find(list => 
                list.Title === sectionConfig.answerListName || 
                list.name === sectionConfig.answerListName
            );

            if (!answerList) {
                throw new Error(`Answer list not found: ${sectionConfig.answerListName}`);
            }

            // Special case: "SRA Policies, Procedures & Posters" uses "DocumentNumber" field (no underscores)
            // All other lists use "Document_x0020_Number" (with underscores for space)
            const documentField = sectionConfig.answerListName === 'SRA Policies, Procedures & Posters' 
                ? 'DocumentNumber' 
                : 'Document_x0020_Number';

            const items = await this.connector.getListItems(sectionConfig.answerListName, {
                filter: `${documentField} eq '${documentNumber}'`
            });

            if (!items || items.length === 0) {
                console.warn(`No data found in ${sectionConfig.answerListName}`);
                return [];
            }

            // Parse ResponseJSON if it exists
            const processedItems = [];
            for (const item of items) {
                if (item.ResponseJSON) {
                    try {
                        const jsonData = JSON.parse(item.ResponseJSON);
                        if (Array.isArray(jsonData)) {
                            processedItems.push(...jsonData);
                        }
                    } catch (parseError) {
                        console.warn(`Failed to parse ResponseJSON: ${parseError.message}`);
                    }
                }
            }

            return processedItems;

        } catch (error) {
            console.error(`Error processing ${sectionConfig.title}:`, error.message);
            return [];
        }
    }

    /**
     * Get historical scores for a store from database (FS Survey is deleted)
     * @param {string} storeName - Store name
     * @returns {Array} - Historical data records
     */
    async getHistoricalScoresForStore(storeName) {
        try {
            console.log(`🔍 Fetching historical scores for store: ${storeName} from database`);
            
            const sql = require('mssql');
            const dbConfig = require('../../config/default').database;
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
     * Get historical score for a specific section and cycle (lines 928-975)
     * @param {string} storeName - Store name
     * @param {string} sectionTitle - Section title
     * @param {string} cycle - Cycle identifier (C1, C2, C3, C4)
     * @param {Object} sectionMappings - Section configuration mappings
     * @returns {string} - Historical score or '0.1' as default
     */
    async getHistoricalScoreForStore(storeName, sectionTitle, cycle, sectionMappings) {
        try {
            // Use cached historical data if available
            if (!this.cachedHistoricalData || this.cachedHistoricalData.length === 0) {
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
                return '0.1'; // Default if cycle not found
            }

            // If multiple records match, take the most recent one (first in the sorted array)
            const matchingRecord = matchingRecords[0];

            // Get section score field mapping
            const sectionConfig = Object.values(sectionMappings).find(config => 
                config.title === sectionTitle
            );

            if (!sectionConfig) {
                return '0.1';
            }

            const scoreValue = matchingRecord[sectionConfig.scoreField];
            return scoreValue !== null && scoreValue !== undefined ? scoreValue.toString() : '0.1';

        } catch (error) {
            console.warn(`Error getting historical score for ${sectionTitle} ${cycle}:`, error.message);
            return '0.1';
        }
    }

    /**
     * Get historical overall score for a specific cycle (lines 976-1015)
     * @param {string} cycle - Cycle identifier (C1, C2, C3, C4)
     * @returns {string} - Historical overall score or '0.1' as default
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
     * Parse SharePoint date string
     * @param {string} dateString - SharePoint date string
     * @returns {string} - Formatted date
     */
    parseSharePointDate(dateString) {
        if (!dateString) return new Date().toLocaleDateString();
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (error) {
            return new Date().toLocaleDateString();
        }
    }

    /**
     * Parse SharePoint time string
     * @param {string} dateString - SharePoint date string
     * @returns {string} - Formatted time
     */
    parseSharePointTime(dateString) {
        if (!dateString) return new Date().toLocaleTimeString();
        
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString();
        } catch (error) {
            return new Date().toLocaleTimeString();
        }
    }
}

module.exports = DataService;
