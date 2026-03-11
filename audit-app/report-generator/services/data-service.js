/**
 * Data Service
 * Handles fetching audit data from SQL Server database
 */

const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

class DataService {
    constructor(pool) {
        this.pool = pool;
        this.imageOutputDir = null; // Set by report generator
    }

    /**
     * Set the database pool
     * @param {Object} pool - SQL connection pool
     */
    setPool(pool) {
        this.pool = pool;
    }

    /**
     * Get complete audit data by ID
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Complete audit data
     */
    async getAuditData(auditId) {
        try {
            console.log(`📊 Fetching audit data for ID: ${auditId}`);

            // Get audit header with cycle display name
            const auditResult = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT a.*, s.SchemaName, s.Description as SchemaDescription,
                           s.ReportTitle, s.DocumentPrefix, s.Edition, s.CreationDate, s.RevisionDate,
                           s.CycleTypeID, ct.TypeName as CycleTypeName, ct.TypeCode as CycleTypeCode,
                           cd.CycleName as CycleDisplayName
                    FROM AuditInstances a
                    INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
                    LEFT JOIN CycleTypes ct ON s.CycleTypeID = ct.CycleTypeID
                    LEFT JOIN CycleDefinitions cd ON ct.CycleTypeID = cd.CycleTypeID 
                        AND cd.CycleNumber = a.Cycle
                    WHERE a.AuditID = @AuditID
                `);

            if (auditResult.recordset.length === 0) {
                throw new Error(`Audit not found: ${auditId}`);
            }

            const audit = auditResult.recordset[0];
            console.log(`   ✅ Found audit: ${audit.DocumentNumber}`);

            // Build cycle display: "C3 (May-Jun)" or just "C3" if no definition found
            const cycleDisplay = audit.CycleDisplayName 
                ? `${audit.Cycle} (${audit.CycleDisplayName})`
                : audit.Cycle;

            return {
                auditId: audit.AuditID,
                documentNumber: audit.DocumentNumber,
                storeId: audit.StoreID,
                storeCode: audit.StoreCode,
                storeName: audit.StoreName,
                schemaId: audit.SchemaID,
                schemaName: audit.SchemaName,
                schemaDescription: audit.SchemaDescription,
                reportTitle: audit.ReportTitle || 'Food Safety Audit Report',
                documentPrefix: audit.DocumentPrefix || '',
                edition: audit.Edition || '',
                creationDate: audit.CreationDate,
                revisionDate: audit.RevisionDate,
                auditDate: audit.AuditDate,
                timeIn: audit.TimeIn,
                timeOut: audit.TimeOut,
                cycle: audit.Cycle,
                cycleDisplay: cycleDisplay,  // New field with full display name
                cycleTypeName: audit.CycleTypeName,
                year: audit.Year,
                auditors: audit.Auditors,
                accompaniedBy: audit.AccompaniedBy,
                status: audit.Status,
                totalScore: audit.TotalScore,
                createdAt: audit.CreatedAt,
                completedAt: audit.CompletedAt
            };
        } catch (error) {
            console.error('❌ Error fetching audit data:', error);
            throw error;
        }
    }

    /**
     * Get section scores for an audit
     * @param {number} auditId - Audit ID
     * @returns {Promise<Array>} - Section scores
     */
    async getSectionScores(auditId) {
        try {
            console.log(`📈 Fetching section scores for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT ss.*, s.SectionIcon
                    FROM AuditSectionScores ss
                    LEFT JOIN AuditSections s ON ss.SectionID = s.SectionID
                    WHERE ss.AuditID = @AuditID
                    ORDER BY ss.SectionNumber
                `);

            console.log(`   ✅ Found ${result.recordset.length} section scores`);

            return result.recordset.map(row => ({
                sectionId: row.SectionID,
                sectionNumber: row.SectionNumber,
                sectionName: row.SectionName,
                sectionIcon: row.SectionIcon,
                earnedScore: row.EarnedScore,
                maxScore: row.MaxScore,
                percentage: parseFloat((row.Percentage || 0).toFixed(2)),
                totalQuestions: row.TotalQuestions,
                answeredQuestions: row.AnsweredQuestions,
                naQuestions: row.NAQuestions
            }));
        } catch (error) {
            console.error('❌ Error fetching section scores:', error);
            throw error;
        }
    }

    /**
     * Get all responses for an audit grouped by section
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Responses grouped by section
     */
    async getAuditResponses(auditId) {
        try {
            console.log(`📝 Fetching audit responses for: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT r.*, s.SectionIcon
                    FROM AuditResponses r
                    LEFT JOIN AuditSections s ON r.SectionID = s.SectionID
                    WHERE r.AuditID = @AuditID
                    ORDER BY r.SectionNumber, r.ReferenceValue
                `);

            // Group by section
            const sections = {};
            for (const row of result.recordset) {
                const sectionId = row.SectionID;
                
                if (!sections[sectionId]) {
                    sections[sectionId] = {
                        sectionId: row.SectionID,
                        sectionNumber: row.SectionNumber,
                        sectionName: row.SectionName,
                        sectionIcon: row.SectionIcon,
                        items: []
                    };
                }

                sections[sectionId].items.push({
                    responseId: row.ResponseID,
                    itemId: row.ItemID,
                    referenceValue: row.ReferenceValue,
                    title: row.Title,
                    coeff: row.Coeff,
                    answerOptions: row.AnswerOptions,
                    cr: row.CR,
                    selectedChoice: row.SelectedChoice,
                    value: row.Value,
                    finding: row.Finding,
                    comment: row.Comment,
                    correctiveAction: row.CorrectiveAction,
                    priority: row.Priority,
                    hasPicture: row.HasPicture,
                    escalate: row.Escalate,
                    department: row.Department
                });
            }

            // Natural sort helper for reference values (1.1, 1.2, ... 1.10, 1.11)
            const sortByRefValue = (a, b) => {
                const partsA = (a.referenceValue || '').split('.').map(p => parseFloat(p) || 0);
                const partsB = (b.referenceValue || '').split('.').map(p => parseFloat(p) || 0);
                for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                    const numA = partsA[i] || 0;
                    const numB = partsB[i] || 0;
                    if (numA !== numB) return numA - numB;
                }
                return 0;
            };

            // Sort items within each section by reference value naturally
            for (const sectionId in sections) {
                sections[sectionId].items.sort(sortByRefValue);
            }

            console.log(`   ✅ Found ${Object.keys(sections).length} sections with responses`);

            return Object.values(sections);
        } catch (error) {
            console.error('❌ Error fetching audit responses:', error);
            throw error;
        }
    }

    /**
     * Get all pictures for an audit - uses file-based storage with URLs
     * @param {number} auditId - Audit ID
     * @param {string} imageDir - (DEPRECATED) No longer used, images served via API
     * @param {string} reportBaseName - (DEPRECATED) No longer used
     * @returns {Promise<Object>} - Pictures grouped by responseId
     */
    async getAuditPictures(auditId, imageDir = null, reportBaseName = null) {
        try {
            console.log(`🖼️ Fetching pictures for audit: ${auditId}`);

            // Query only metadata, not FileData (which may be NULL after migration)
            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT PictureID, ResponseID, FileName, FilePath, ContentType, PictureType, Category, CreatedAt,
                           CASE WHEN FileData IS NOT NULL THEN DATALENGTH(FileData) ELSE 0 END as FileSize,
                           CASE WHEN FilePath IS NOT NULL AND FilePath != '' THEN 1 ELSE 0 END as HasFilePath
                    FROM AuditPictures
                    WHERE AuditID = @AuditID
                    ORDER BY ResponseID, CreatedAt
                `);

            // Calculate total size to decide strategy
            console.log(`   📊 Found ${result.recordset.length} pictures`);

            // Group by responseId - use URLs instead of base64 or duplicating files
            const pictures = {};
            let totalPictures = 0;

            for (const row of result.recordset) {
                const responseId = row.ResponseID;
                
                if (!pictures[responseId]) {
                    pictures[responseId] = [];
                }

                // Use URL-based approach - pictures served via /api/pictures/:id endpoint
                // If FilePath exists, use file-based URL; otherwise fallback to picture ID
                let dataUrl;
                if (row.FilePath) {
                    dataUrl = `/api/pictures/file/${row.FilePath}`;
                } else {
                    dataUrl = `/api/pictures/${row.PictureID}`;
                }

                const pic = {
                    pictureId: row.PictureID,
                    fileName: row.FileName,
                    contentType: row.ContentType,
                    pictureType: row.PictureType,
                    category: row.Category || null,
                    createdAt: row.CreatedAt,
                    fileSize: row.FileSize || 0,
                    dataUrl: dataUrl,
                    isFileBased: !!row.FilePath
                };
                
                pictures[responseId].push(pic);
                totalPictures++;
            }

            console.log(`   ✅ Processed ${totalPictures} pictures for ${Object.keys(pictures).length} responses (URL-based)`);

            return pictures;
        } catch (error) {
            console.error('❌ Error fetching pictures:', error);
            throw error;
        }
    }

    /**
     * Get file extension from content type
     */
    getExtensionFromContentType(contentType) {
        const map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp'
        };
        return map[contentType] || '.jpg';
    }

    /**
     * Get findings/issues for action plan
     * @param {number} auditId - Audit ID
     * @returns {Promise<Array>} - Array of findings
     */
    async getFindings(auditId) {
        try {
            console.log(`🔍 Fetching findings for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT r.*, s.SectionIcon
                    FROM AuditResponses r
                    LEFT JOIN AuditSections s ON r.SectionID = s.SectionID
                    WHERE r.AuditID = @AuditID
                      AND (
                          r.SelectedChoice IN ('No', 'Partially')
                          OR r.Finding IS NOT NULL
                          OR r.Priority IS NOT NULL
                          OR r.Escalate = 1
                      )
                    ORDER BY 
                        CASE r.Priority 
                            WHEN 'High' THEN 1 
                            WHEN 'Medium' THEN 2 
                            WHEN 'Low' THEN 3 
                            ELSE 4 
                        END,
                        r.SectionNumber, r.ReferenceValue
                `);

            console.log(`   ✅ Found ${result.recordset.length} findings`);

            return result.recordset.map(row => ({
                responseId: row.ResponseID,
                sectionNumber: row.SectionNumber,
                sectionName: row.SectionName,
                sectionIcon: row.SectionIcon,
                referenceValue: row.ReferenceValue,
                title: row.Title,
                selectedChoice: row.SelectedChoice,
                finding: row.Finding,
                cr: row.CR,
                correctiveAction: row.CorrectiveAction || row.CR, // Fallback to CR
                priority: row.Priority,
                hasPicture: row.HasPicture,
                escalate: row.Escalate,
                department: row.Department
            }));
        } catch (error) {
            console.error('❌ Error fetching findings:', error);
            throw error;
        }
    }

    /**
     * Get temperature readings for an audit
     * @param {number} auditId - Audit ID
     * @returns {Promise<Object>} - Temperature readings grouped by type
     */
    async getTemperatureReadings(auditId) {
        try {
            console.log(`🌡️ Fetching temperature readings for audit: ${auditId}`);

            const result = await this.pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT fr.*, ar.ReferenceValue
                    FROM FridgeReadings fr
                    LEFT JOIN AuditResponses ar ON fr.ResponseID = ar.ResponseID
                    WHERE fr.AuditID = @AuditID
                    ORDER BY fr.Section, fr.ReadingType, fr.CreatedAt
                `);

            // Group by section and type
            const readings = {
                good: [],
                bad: []
            };
            
            // Helper to get picture URLs (supports multiple pictures stored as JSON array)
            const getPictureUrls = (picturePath) => {
                if (!picturePath) return [];
                try {
                    // Check if it's a JSON array
                    if (picturePath.startsWith('[')) {
                        const paths = JSON.parse(picturePath);
                        return paths.map(p => `/api/fridge-pictures/file/${p}`);
                    }
                } catch (e) {
                    // Not JSON, treat as single path
                }
                return [`/api/fridge-pictures/file/${picturePath}`];
            };

            for (const row of result.recordset) {
                // Get picture URLs (not base64 - pictures served via API endpoint)
                const pictures = getPictureUrls(row.PicturePath);
                
                const reading = {
                    readingId: row.ReadingID,
                    responseId: row.ResponseID,
                    documentNumber: row.DocumentNumber,
                    section: row.Section,
                    category: row.Category,
                    referenceValue: row.ReferenceValue,
                    unit: row.Unit,
                    displayTemp: row.DisplayTemp,
                    probeTemp: row.ProbeTemp,
                    issue: row.Issue,
                    picture: pictures.length > 0 ? pictures[0] : null, // Backward compatibility
                    pictures: pictures, // Multiple pictures support
                    readingType: row.ReadingType,
                    createdAt: row.CreatedAt
                };

                if (row.ReadingType === 'Good') {
                    readings.good.push(reading);
                } else {
                    readings.bad.push(reading);
                }
            }

            console.log(`   ✅ Found ${readings.good.length} good, ${readings.bad.length} bad readings`);

            return readings;
        } catch (error) {
            console.error('❌ Error fetching temperature readings:', error);
            // Return empty if table doesn't exist
            return { good: [], bad: [] };
        }
    }

    /**
     * Get recurring issues for a store - detects items that failed in multiple cycles
     * Matches by: Same Store + Same Schema + SectionName + ReferenceValue + Title
     * Returns which specific cycles each issue appeared in
     * @param {number} storeId - Store ID
     * @param {number} schemaId - Schema ID (same template type)
     * @param {number} currentAuditId - Current audit ID to exclude from history
     * @param {number} currentCycle - Current cycle number
     * @returns {Promise<Object>} - Map of unique key -> cycle occurrences
     */
    async getRecurringIssues(storeId, schemaId, currentAuditId, currentCycle) {
        try {
            console.log(`🔄 Fetching recurring issues for store: ${storeId}, schema: ${schemaId}`);

            // Get all failed items from previous audits for same store and schema
            const result = await this.pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('SchemaID', sql.Int, schemaId)
                .input('CurrentAuditID', sql.Int, currentAuditId)
                .query(`
                    SELECT 
                        r.SectionName,
                        r.ReferenceValue,
                        r.Title,
                        r.SelectedChoice,
                        ai.Cycle,
                        ai.Year,
                        ai.DocumentNumber,
                        ai.AuditDate,
                        ai.AuditID
                    FROM AuditResponses r
                    INNER JOIN AuditInstances ai ON r.AuditID = ai.AuditID
                    WHERE ai.StoreID = @StoreID
                        AND ai.SchemaID = @SchemaID
                        AND ai.AuditID != @CurrentAuditID
                        AND ai.Status = 'Completed'
                        AND r.SelectedChoice IN ('No', 'Partially')
                    ORDER BY r.SectionName, r.ReferenceValue, ai.Cycle DESC
                `);

            // Group by Section + ReferenceValue + Title (composite key)
            const recurringMap = {};
            
            for (const row of result.recordset) {
                // Create unique key: SectionName|ReferenceValue|Title
                const key = `${row.SectionName}|${row.ReferenceValue || ''}|${row.Title || ''}`;
                
                if (!recurringMap[key]) {
                    recurringMap[key] = {
                        sectionName: row.SectionName,
                        referenceValue: row.ReferenceValue,
                        title: row.Title,
                        cycles: [],          // Array of cycle numbers where this failed
                        occurrences: [],     // Detailed occurrence info
                        count: 0
                    };
                }
                
                // Add this cycle if not already added (avoid duplicates)
                const cycleKey = `${row.Year}-C${row.Cycle}`;
                if (!recurringMap[key].cycles.includes(row.Cycle)) {
                    recurringMap[key].cycles.push(row.Cycle);
                    recurringMap[key].occurrences.push({
                        cycle: row.Cycle,
                        year: row.Year,
                        cycleDisplay: cycleKey,
                        documentNumber: row.DocumentNumber,
                        auditDate: row.AuditDate,
                        selectedChoice: row.SelectedChoice
                    });
                    recurringMap[key].count++;
                }
            }

            // Filter to items that appeared in 1+ PREVIOUS audits
            // (current audit also failing = 2+ total occurrences = truly recurring)
            const recurringIssues = {};
            for (const [key, data] of Object.entries(recurringMap)) {
                if (data.count >= 1) {  // 1+ previous = recurring (since current also fails)
                    // Sort cycles in ascending order for display
                    data.cycles.sort((a, b) => a - b);
                    data.occurrences.sort((a, b) => a.cycle - b.cycle);
                    data.cyclesDisplay = data.cycles.map(c => `C${c}`).join(', ');
                    recurringIssues[key] = data;
                }
            }

            console.log(`   ✅ Found ${Object.keys(recurringIssues).length} recurring issues (1+ previous cycles)`);

            return recurringIssues;
        } catch (error) {
            console.error('❌ Error fetching recurring issues:', error);
            return {};
        }
    }

    /**
     * Get historical findings for a store to detect repetitive issues
     * Returns findings from previous audits grouped by ReferenceValue
     * @param {number} storeId - Store ID
     * @param {number} currentAuditId - Current audit ID to exclude
     * @returns {Promise<Object>} - Map of ReferenceValue -> occurrence count and details
     */
    async getHistoricalFindings(storeId, currentAuditId) {
        try {
            console.log(`🔄 Fetching historical findings for store: ${storeId}`);

            const result = await this.pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('CurrentAuditID', sql.Int, currentAuditId)
                .query(`
                    SELECT 
                        r.ReferenceValue,
                        r.Title,
                        r.SectionName,
                        r.SelectedChoice,
                        ai.DocumentNumber,
                        ai.AuditDate,
                        ai.AuditID
                    FROM AuditResponses r
                    INNER JOIN AuditInstances ai ON r.AuditID = ai.AuditID
                    WHERE ai.StoreID = @StoreID
                        AND ai.AuditID != @CurrentAuditID
                        AND ai.Status = 'Completed'
                        AND r.SelectedChoice IN ('No', 'Partially')
                    ORDER BY r.ReferenceValue, ai.AuditDate DESC
                `);

            // Group findings by ReferenceValue
            const findingsMap = {};
            for (const row of result.recordset) {
                const refVal = row.ReferenceValue || row.Title; // Use Title as fallback
                if (!findingsMap[refVal]) {
                    findingsMap[refVal] = {
                        referenceValue: refVal,
                        title: row.Title,
                        sectionName: row.SectionName,
                        occurrences: [],
                        count: 0
                    };
                }
                findingsMap[refVal].occurrences.push({
                    auditId: row.AuditID,
                    documentNumber: row.DocumentNumber,
                    auditDate: row.AuditDate,
                    selectedChoice: row.SelectedChoice
                });
                findingsMap[refVal].count++;
            }

            console.log(`   ✅ Found ${Object.keys(findingsMap).length} unique historical findings`);

            return findingsMap;
        } catch (error) {
            console.error('❌ Error fetching historical findings:', error);
            return {};
        }
    }

    /**
     * Get historical audits for a store (for cycle-based display)
     * Returns audits for the same store and schema, ordered by cycle number
     * @param {number} storeId - Store ID
     * @param {number} schemaId - Schema ID (same audit type)
     * @param {number} currentAuditId - Current audit ID to exclude
     * @param {number} currentCycle - Current cycle number
     * @returns {Promise<Array>} - Array of historical audit data with section scores, keyed by cycle
     */
    async getHistoricalAudits(storeId, schemaId, currentAuditId, currentCycle) {
        try {
            console.log(`📜 Fetching historical audits for store: ${storeId}, schema: ${schemaId}, current cycle: ${currentCycle}`);

            // Get all completed audits for same store and schema, excluding current
            // Order by Cycle ASC so we can map them correctly
            const auditsResult = await this.pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('SchemaID', sql.Int, schemaId)
                .input('CurrentAuditID', sql.Int, currentAuditId)
                .query(`
                    SELECT 
                        ai.AuditID, ai.DocumentNumber, ai.TotalScore, ai.AuditDate, ai.Cycle, ai.Year
                    FROM AuditInstances ai
                    WHERE ai.StoreID = @StoreID 
                        AND ai.SchemaID = @SchemaID
                        AND ai.AuditID != @CurrentAuditID
                        AND ai.Status = 'Completed'
                    ORDER BY ai.Cycle ASC
                `);

            const historicalAudits = [];

            for (const audit of auditsResult.recordset) {
                // Get section scores for each historical audit (including earned/max for weighted calculation)
                const scoresResult = await this.pool.request()
                    .input('AuditID', sql.Int, audit.AuditID)
                    .query(`
                        SELECT SectionName, Percentage, EarnedScore, MaxScore
                        FROM AuditSectionScores
                        WHERE AuditID = @AuditID
                    `);

                const sectionScores = {};
                const sectionEarned = {};
                const sectionMax = {};
                for (const score of scoresResult.recordset) {
                    sectionScores[score.SectionName] = parseFloat((score.Percentage || 0).toFixed(2));
                    sectionEarned[score.SectionName] = score.EarnedScore || 0;
                    sectionMax[score.SectionName] = score.MaxScore || 0;
                }

                // Store by cycle number as key
                historicalAudits.push({
                    auditId: audit.AuditID,
                    documentNumber: audit.DocumentNumber,
                    totalScore: parseFloat((audit.TotalScore || 0).toFixed(2)),
                    auditDate: audit.AuditDate,
                    cycle: audit.Cycle,  // Keep original format (e.g., "C2")
                    year: audit.Year,
                    sectionScores,
                    sectionEarned,
                    sectionMax
                });
            }

            // Create a map by cycle number for easy lookup
            // Support both numeric (1, 2) and string ("C1", "C2") keys
            const cycleMap = {};
            for (const audit of historicalAudits) {
                // Extract numeric part from cycle (e.g., "C2" -> 2)
                const cycleNum = parseInt(String(audit.cycle).replace(/[^0-9]/g, '')) || 0;
                cycleMap[cycleNum] = audit;           // Numeric key: cycleMap[2]
                cycleMap[audit.cycle] = audit;        // String key: cycleMap["C2"]
            }

            console.log(`   ✅ Found ${historicalAudits.length} historical audits for cycles: ${historicalAudits.map(a => a.cycle).join(', ')}`);

            // Return both the array and cycle map for flexible access
            return {
                audits: historicalAudits,
                cycleMap: cycleMap,
                currentCycle: currentCycle
            };
        } catch (error) {
            console.error('❌ Error fetching historical audits:', error);
            return [];
        }
    }

    /**
     * Get categories with sections for a schema
     * @param {number} schemaId - Schema ID
     * @returns {Promise<Array>} - Categories with sections
     */
    async getCategoriesWithSections(schemaId) {
        try {
            console.log(`📂 Fetching categories for schema: ${schemaId}`);

            const result = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT 
                        c.CategoryID,
                        c.CategoryName,
                        c.DisplayOrder as CategoryOrder,
                        cs.DisplayOrder as SectionOrder,
                        s.SectionID,
                        s.SectionName,
                        s.SectionNumber
                    FROM AuditCategories c
                    LEFT JOIN CategorySections cs ON c.CategoryID = cs.CategoryID
                    LEFT JOIN AuditSections s ON cs.SectionID = s.SectionID AND s.SchemaID = @SchemaID
                    WHERE c.SchemaID = @SchemaID AND c.IsActive = 1
                    ORDER BY c.DisplayOrder, cs.DisplayOrder
                `);

            // Group by category
            const categoriesMap = new Map();
            
            for (const row of result.recordset) {
                if (!categoriesMap.has(row.CategoryID)) {
                    categoriesMap.set(row.CategoryID, {
                        categoryId: row.CategoryID,
                        categoryName: row.CategoryName,
                        displayOrder: row.CategoryOrder,
                        sections: []
                    });
                }
                
                if (row.SectionID) {
                    categoriesMap.get(row.CategoryID).sections.push({
                        sectionId: row.SectionID,
                        sectionName: row.SectionName,
                        sectionNumber: row.SectionNumber,
                        displayOrder: row.SectionOrder
                    });
                }
            }

            const categories = Array.from(categoriesMap.values());
            console.log(`   ✅ Found ${categories.length} categories`);

            return categories;
        } catch (error) {
            console.error('❌ Error fetching categories:', error);
            return [];
        }
    }
}

module.exports = DataService;
