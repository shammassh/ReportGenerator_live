/**
 * Audit Service
 * Handles audit instance creation and management
 */

const sql = require('mssql');
require('dotenv').config();

class AuditService {
    constructor() {
        this.pool = null;
        this.connecting = false;
    }

    async getPool() {
        // If pool exists and is connected, return it
        if (this.pool && this.pool.connected) {
            return this.pool;
        }
        
        // If currently connecting, wait for it
        if (this.connecting) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.getPool();
        }
        
        // Create new connection
        this.connecting = true;
        try {
            // Close existing pool if it exists but is disconnected
            if (this.pool) {
                try {
                    await this.pool.close();
                } catch (e) {
                    // Ignore close errors
                }
                this.pool = null;
            }
            
            this.pool = await sql.connect({
                server: process.env.SQL_SERVER,
                database: process.env.SQL_DATABASE,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                options: {
                    encrypt: process.env.SQL_ENCRYPT === 'true',
                    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
                    requestTimeout: 120000    // 2 minutes for queries (for large reports)
                },
                connectionTimeout: 30000,  // 30 seconds to connect
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                }
            });
            
            // Handle pool errors
            this.pool.on('error', err => {
                console.error('SQL Pool Error:', err);
                this.pool = null;
            });
            
            return this.pool;
        } finally {
            this.connecting = false;
        }
    }

    /**
     * Generate Document Number using prefix from schema settings
     * Format: PREFIX-0001 (e.g., GMRL-FSACSG-1221-0001)
     */
    async generateDocumentNumber(schemaId) {
        try {
            const pool = await this.getPool();
            
            // Get the document prefix from schema settings
            let prefix = 'GMRL-FSACR'; // Default fallback
            if (schemaId) {
                const schemaResult = await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .query(`
                        SELECT DocumentPrefix 
                        FROM AuditSchemas 
                        WHERE SchemaID = @SchemaID
                    `);
                
                if (schemaResult.recordset.length > 0 && schemaResult.recordset[0].DocumentPrefix) {
                    prefix = schemaResult.recordset[0].DocumentPrefix;
                }
            }
            
            // Find the highest document number with this prefix
            const result = await pool.request()
                .input('Prefix', sql.NVarChar(100), prefix + '-%')
                .query(`
                    SELECT TOP 1 DocumentNumber 
                    FROM AuditInstances 
                    WHERE DocumentNumber LIKE @Prefix
                    ORDER BY AuditID DESC
                `);

            let nextNumber = 1;
            if (result.recordset.length > 0) {
                const lastDoc = result.recordset[0].DocumentNumber;
                // Extract the last numeric part (handles any prefix format)
                const parts = lastDoc.split('-');
                const lastPart = parts[parts.length - 1];
                const parsed = parseInt(lastPart);
                if (!isNaN(parsed)) {
                    nextNumber = parsed + 1;
                }
            }

            return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
        } catch (error) {
            console.error('Error generating document number:', error);
            throw error;
        }
    }

    /**
     * Start a new audit
     */
    async startAudit(auditData) {
        try {
            const pool = await this.getPool();
            const documentNumber = await this.generateDocumentNumber(auditData.schemaId);

            const result = await pool.request()
                .input('DocumentNumber', sql.NVarChar(50), documentNumber)
                .input('StoreID', sql.Int, auditData.storeId)
                .input('StoreCode', sql.NVarChar(50), auditData.storeCode)
                .input('StoreName', sql.NVarChar(200), auditData.storeName)
                .input('SchemaID', sql.Int, auditData.schemaId)
                .input('AuditDate', sql.Date, auditData.auditDate)
                .input('TimeIn', sql.NVarChar(10), auditData.timeIn)
                .input('TimeOut', sql.NVarChar(10), auditData.timeOut || null)
                .input('Cycle', sql.NVarChar(10), auditData.cycle)
                .input('Year', sql.Int, auditData.year)
                .input('Auditors', sql.NVarChar(500), auditData.auditors)
                .input('AccompaniedBy', sql.NVarChar(500), auditData.accompaniedBy || null)
                .input('CreatedBy', sql.NVarChar(200), auditData.createdBy)
                .query(`
                    INSERT INTO AuditInstances (
                        DocumentNumber, StoreID, StoreCode, StoreName, SchemaID,
                        AuditDate, TimeIn, TimeOut, Cycle, Year, Auditors, AccompaniedBy,
                        Status, CreatedBy, CreatedAt
                    ) VALUES (
                        @DocumentNumber, @StoreID, @StoreCode, @StoreName, @SchemaID,
                        @AuditDate, @TimeIn, @TimeOut, @Cycle, @Year, @Auditors, @AccompaniedBy,
                        'In Progress', @CreatedBy, GETDATE()
                    );
                    SELECT SCOPE_IDENTITY() AS AuditID;
                `);

            const auditId = result.recordset[0].AuditID;

            // Initialize audit responses from schema template
            await this.initializeAuditResponses(auditId, auditData.schemaId);

            return {
                auditId,
                documentNumber
            };
        } catch (error) {
            console.error('Error starting audit:', error);
            throw error;
        }
    }

    /**
     * Initialize audit responses from schema template
     */
    async initializeAuditResponses(auditId, schemaId) {
        try {
            const pool = await this.getPool();

            // Get all sections and items from the schema
            const sectionsResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT s.SectionID, s.SectionNumber, s.SectionName, s.SectionIcon
                    FROM AuditSections s
                    WHERE s.SchemaID = @SchemaID AND s.IsActive = 1
                    ORDER BY s.SectionNumber
                `);

            for (const section of sectionsResult.recordset) {
                // Get items for this section
                const itemsResult = await pool.request()
                    .input('SectionID', sql.Int, section.SectionID)
                    .query(`
                        SELECT ItemID, ReferenceValue, Title, Coeff, Answer, CR
                        FROM AuditItems
                        WHERE SectionID = @SectionID AND IsActive = 1
                        ORDER BY SortOrder, ReferenceValue
                    `);

                // Create response for each item
                for (const item of itemsResult.recordset) {
                    await pool.request()
                        .input('AuditID', sql.Int, auditId)
                        .input('SectionID', sql.Int, section.SectionID)
                        .input('SectionNumber', sql.Int, section.SectionNumber)
                        .input('SectionName', sql.NVarChar(200), section.SectionName)
                        .input('ItemID', sql.Int, item.ItemID)
                        .input('ReferenceValue', sql.NVarChar(50), item.ReferenceValue)
                        .input('Title', sql.NVarChar(1000), item.Title)
                        .input('Coeff', sql.Int, item.Coeff)
                        .input('AnswerOptions', sql.NVarChar(200), item.Answer)
                        .input('CR', sql.NVarChar(2000), item.CR)
                        .query(`
                            INSERT INTO AuditResponses (
                                AuditID, SectionID, SectionNumber, SectionName,
                                ItemID, ReferenceValue, Title, Coeff, AnswerOptions, CR,
                                SelectedChoice, Value
                            ) VALUES (
                                @AuditID, @SectionID, @SectionNumber, @SectionName,
                                @ItemID, @ReferenceValue, @Title, @Coeff, @AnswerOptions, @CR,
                                NULL, NULL
                            )
                        `);
                }
            }
        } catch (error) {
            console.error('Error initializing audit responses:', error);
            throw error;
        }
    }

    /**
     * Sync audit responses with current template (add missing items)
     * This is useful when items are added/reactivated after an audit was started
     */
    async syncAuditWithTemplate(auditId) {
        try {
            const pool = await this.getPool();
            
            // Get audit to find schema
            const auditResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`SELECT SchemaID, Status FROM AuditInstances WHERE AuditID = @AuditID`);
            
            if (auditResult.recordset.length === 0) {
                throw new Error('Audit not found');
            }
            
            const { SchemaID: schemaId, Status: status } = auditResult.recordset[0];
            
            if (status === 'Completed') {
                throw new Error('Cannot sync a completed audit');
            }
            
            // Get existing response ItemIDs
            const existingResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`SELECT ItemID FROM AuditResponses WHERE AuditID = @AuditID`);
            
            const existingItemIds = new Set(existingResult.recordset.map(r => r.ItemID));
            
            let added = 0;
            
            // Get all sections from schema
            const sectionsResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT s.SectionID, s.SectionNumber, s.SectionName
                    FROM AuditSections s
                    WHERE s.SchemaID = @SchemaID AND s.IsActive = 1
                    ORDER BY s.SectionNumber
                `);
            
            for (const section of sectionsResult.recordset) {
                // Get all active items for this section
                const itemsResult = await pool.request()
                    .input('SectionID', sql.Int, section.SectionID)
                    .query(`
                        SELECT ItemID, ReferenceValue, Title, Coeff, Answer, CR
                        FROM AuditItems
                        WHERE SectionID = @SectionID AND IsActive = 1
                        ORDER BY SortOrder, ReferenceValue
                    `);
                
                for (const item of itemsResult.recordset) {
                    // Only add if not already in responses
                    if (!existingItemIds.has(item.ItemID)) {
                        await pool.request()
                            .input('AuditID', sql.Int, auditId)
                            .input('SectionID', sql.Int, section.SectionID)
                            .input('SectionNumber', sql.Int, section.SectionNumber)
                            .input('SectionName', sql.NVarChar(200), section.SectionName)
                            .input('ItemID', sql.Int, item.ItemID)
                            .input('ReferenceValue', sql.NVarChar(50), item.ReferenceValue)
                            .input('Title', sql.NVarChar(1000), item.Title)
                            .input('Coeff', sql.Int, item.Coeff)
                            .input('AnswerOptions', sql.NVarChar(200), item.Answer)
                            .input('CR', sql.NVarChar(2000), item.CR)
                            .query(`
                                INSERT INTO AuditResponses (
                                    AuditID, SectionID, SectionNumber, SectionName,
                                    ItemID, ReferenceValue, Title, Coeff, AnswerOptions, CR,
                                    SelectedChoice, Value
                                ) VALUES (
                                    @AuditID, @SectionID, @SectionNumber, @SectionName,
                                    @ItemID, @ReferenceValue, @Title, @Coeff, @AnswerOptions, @CR,
                                    NULL, NULL
                                )
                            `);
                        added++;
                        console.log(`[SYNC] Added item ${item.ReferenceValue} to audit ${auditId}`);
                    }
                }
            }
            
            return { success: true, itemsAdded: added };
        } catch (error) {
            console.error('Error syncing audit with template:', error);
            throw error;
        }
    }

    /**
     * Get audit by ID with all responses
     */
    async getAudit(auditId) {
        try {
            const pool = await this.getPool();

            // Get audit header
            const auditResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT a.*, s.SchemaName
                    FROM AuditInstances a
                    INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
                    WHERE a.AuditID = @AuditID
                `);

            if (auditResult.recordset.length === 0) {
                return null;
            }

            const audit = auditResult.recordset[0];

            // Get responses grouped by section with section icons
            const responsesResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT r.*, s.SectionIcon,
                        (SELECT COUNT(*) FROM AuditPictures p WHERE p.ResponseID = r.ResponseID AND p.PictureType = 'Good') AS GoodPictureCount
                    FROM AuditResponses r
                    LEFT JOIN AuditSections s ON r.SectionID = s.SectionID
                    WHERE r.AuditID = @AuditID
                    ORDER BY r.SectionNumber
                `);

            // Helper function to sort reference values naturally (1.1, 1.2, ... 1.9, 1.10, 1.11)
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

            // Group responses by section
            const sections = {};
            for (const response of responsesResult.recordset) {
                if (!sections[response.SectionID]) {
                    sections[response.SectionID] = {
                        sectionId: response.SectionID,
                        sectionNumber: response.SectionNumber,
                        sectionName: response.SectionName,
                        sectionIcon: response.SectionIcon,
                        items: []
                    };
                }
                sections[response.SectionID].items.push({
                    responseId: response.ResponseID,
                    itemId: response.ItemID,
                    referenceValue: response.ReferenceValue,
                    title: response.Title,
                    coeff: response.Coeff,
                    answerOptions: response.AnswerOptions,
                    cr: response.CR,
                    selectedChoice: response.SelectedChoice,
                    value: response.Value,
                    finding: response.Finding,
                    comment: response.Comment,
                    correctiveAction: response.CorrectiveAction,
                    priority: response.Priority,
                    hasPicture: response.HasPicture,
                    hasGoodPicture: response.GoodPictureCount > 0,
                    escalate: response.Escalate,
                    department: response.Department
                });
            }

            // Sort items within each section by reference value (natural sort)
            for (const sectionId in sections) {
                sections[sectionId].items.sort(sortByRefValue);
            }

            return {
                auditId: audit.AuditID,
                documentNumber: audit.DocumentNumber,
                storeId: audit.StoreID,
                storeCode: audit.StoreCode,
                storeName: audit.StoreName,
                schemaId: audit.SchemaID,
                schemaName: audit.SchemaName,
                auditDate: audit.AuditDate,
                timeIn: audit.TimeIn,
                timeOut: audit.TimeOut,
                cycle: audit.Cycle,
                year: audit.Year,
                auditors: audit.Auditors,
                accompaniedBy: audit.AccompaniedBy,
                status: audit.Status,
                totalScore: audit.TotalScore,
                sections: Object.values(sections)
            };
        } catch (error) {
            console.error('Error getting audit:', error);
            throw error;
        }
    }

    /**
     * Get audit status by response ID (for permission checking)
     */
    async getAuditStatusByResponseId(responseId) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('ResponseID', sql.Int, responseId)
                .query(`
                    SELECT a.Status 
                    FROM AuditInstances a
                    INNER JOIN AuditResponses r ON a.AuditID = r.AuditID
                    WHERE r.ResponseID = @ResponseID
                `);
            
            return result.recordset.length > 0 ? result.recordset[0].Status : null;
        } catch (error) {
            console.error('Error getting audit status by response ID:', error);
            throw error;
        }
    }

    /**
     * Update audit response
     */
    async updateResponse(responseId, responseData) {
        try {
            const pool = await this.getPool();

            // Calculate value based on selected choice
            let value = null;
            if (responseData.selectedChoice) {
                const coeff = responseData.coeff || 2;
                switch (responseData.selectedChoice) {
                    case 'Yes': value = 1 * coeff; break;
                    case 'Partially': value = 0.5 * coeff; break;
                    case 'No': value = 0; break;
                    case 'NA': value = null; break;
                }
            }

            await pool.request()
                .input('ResponseID', sql.Int, responseId)
                .input('SelectedChoice', sql.NVarChar(20), responseData.selectedChoice)
                .input('Value', sql.Float, value)
                .input('Finding', sql.NVarChar(2000), responseData.finding || null)
                .input('Comment', sql.NVarChar(2000), responseData.comment || null)
                .input('CorrectiveAction', sql.NVarChar(2000), responseData.correctiveAction || null)
                .input('Priority', sql.NVarChar(20), responseData.priority || null)
                .input('HasPicture', sql.Bit, responseData.hasPicture || false)
                .input('CR', sql.NVarChar(2000), responseData.cr !== undefined ? responseData.cr : null)
                .input('Escalate', sql.Bit, responseData.escalate !== undefined ? responseData.escalate : null)
                .input('Department', sql.NVarChar(200), responseData.department !== undefined ? responseData.department : null)
                .query(`
                    UPDATE AuditResponses
                    SET SelectedChoice = COALESCE(@SelectedChoice, SelectedChoice),
                        Value = CASE WHEN @SelectedChoice IS NOT NULL THEN @Value ELSE Value END,
                        Finding = COALESCE(@Finding, Finding),
                        Comment = COALESCE(@Comment, Comment),
                        CorrectiveAction = COALESCE(@CorrectiveAction, CorrectiveAction),
                        Priority = COALESCE(@Priority, Priority),
                        HasPicture = COALESCE(@HasPicture, HasPicture),
                        CR = CASE WHEN @CR IS NOT NULL THEN @CR ELSE CR END,
                        Escalate = CASE WHEN @Escalate IS NOT NULL THEN @Escalate ELSE Escalate END,
                        Department = CASE WHEN @Department IS NOT NULL THEN @Department ELSE Department END,
                        UpdatedAt = GETDATE()
                    WHERE ResponseID = @ResponseID
                `);

            return { success: true };
        } catch (error) {
            console.error('Error updating response:', error);
            throw error;
        }
    }

    /**
     * Complete audit and calculate scores
     */
    async completeAudit(auditId) {
        try {
            const pool = await this.getPool();

            // Calculate section scores and save them
            // Note: EarnedScore explicitly excludes NA items to avoid data corruption issues
            const sectionScoresResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT 
                        SectionID,
                        SectionNumber,
                        SectionName,
                        SUM(CASE WHEN SelectedChoice != 'NA' AND SelectedChoice IS NOT NULL AND SelectedChoice != '' THEN ISNULL(Value, 0) ELSE 0 END) as EarnedScore,
                        SUM(CASE WHEN SelectedChoice != 'NA' AND SelectedChoice IS NOT NULL AND SelectedChoice != '' THEN Coeff ELSE 0 END) as MaxScore,
                        COUNT(*) as TotalQuestions,
                        SUM(CASE WHEN SelectedChoice IS NOT NULL AND SelectedChoice != '' THEN 1 ELSE 0 END) as AnsweredQuestions,
                        SUM(CASE WHEN SelectedChoice = 'NA' THEN 1 ELSE 0 END) as NAQuestions
                    FROM AuditResponses
                    WHERE AuditID = @AuditID
                    GROUP BY SectionID, SectionNumber, SectionName
                    ORDER BY SectionNumber
                `);

            // Delete existing section scores for this audit (in case of re-completion)
            await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`DELETE FROM AuditSectionScores WHERE AuditID = @AuditID`);

            // Insert section scores
            for (const section of sectionScoresResult.recordset) {
                const percentage = section.MaxScore > 0 
                    ? (section.EarnedScore / section.MaxScore) * 100 
                    : 0;

                await pool.request()
                    .input('AuditID', sql.Int, auditId)
                    .input('SectionID', sql.Int, section.SectionID)
                    .input('SectionNumber', sql.Int, section.SectionNumber)
                    .input('SectionName', sql.NVarChar, section.SectionName)
                    .input('EarnedScore', sql.Decimal(10, 2), section.EarnedScore || 0)
                    .input('MaxScore', sql.Decimal(10, 2), section.MaxScore || 0)
                    .input('Percentage', sql.Decimal(5, 2), percentage)
                    .input('TotalQuestions', sql.Int, section.TotalQuestions)
                    .input('AnsweredQuestions', sql.Int, section.AnsweredQuestions)
                    .input('NAQuestions', sql.Int, section.NAQuestions)
                    .query(`
                        INSERT INTO AuditSectionScores 
                        (AuditID, SectionID, SectionNumber, SectionName, EarnedScore, MaxScore, Percentage, TotalQuestions, AnsweredQuestions, NAQuestions)
                        VALUES 
                        (@AuditID, @SectionID, @SectionNumber, @SectionName, @EarnedScore, @MaxScore, @Percentage, @TotalQuestions, @AnsweredQuestions, @NAQuestions)
                    `);
            }

            // Calculate total score from section scores
            const totalScoreResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT 
                        SUM(EarnedScore) as TotalEarned,
                        SUM(MaxScore) as TotalMax
                    FROM AuditSectionScores
                    WHERE AuditID = @AuditID
                `);

            const { TotalEarned, TotalMax } = totalScoreResult.recordset[0];
            const totalPercentage = TotalMax > 0 ? parseFloat(((TotalEarned / TotalMax) * 100).toFixed(2)) : 0;

            await pool.request()
                .input('AuditID', sql.Int, auditId)
                .input('TotalScore', sql.Decimal(5, 2), totalPercentage)
                .query(`
                    UPDATE AuditInstances
                    SET Status = 'Completed',
                        TotalScore = @TotalScore,
                        CompletedAt = GETDATE()
                    WHERE AuditID = @AuditID
                `);

            return {
                totalScore: totalPercentage,
                sectionScores: sectionScoresResult.recordset.map(s => ({
                    sectionId: s.SectionID,
                    sectionName: s.SectionName,
                    percentage: s.MaxScore > 0 ? parseFloat(((s.EarnedScore / s.MaxScore) * 100).toFixed(2)) : 0
                })),
                status: 'Completed'
            };
        } catch (error) {
            console.error('Error completing audit:', error);
            throw error;
        }
    }

    /**
     * Get all audits (for dashboard)
     */
    async getAllAudits() {
        try {
            const pool = await this.getPool();
            // Query includes calculated running score for in-progress audits
            const result = await pool.request().query(`
                SELECT a.*, s.SchemaName,
                    CASE 
                        WHEN a.Status = 'Completed' THEN a.TotalScore
                        ELSE (
                            SELECT CASE 
                                WHEN SUM(CASE WHEN r.SelectedChoice != 'NA' THEN r.Coeff ELSE 0 END) > 0 
                                THEN CAST(
                                    (SUM(CASE 
                                        WHEN r.SelectedChoice = 'Yes' THEN r.Coeff * 1.0
                                        WHEN r.SelectedChoice = 'Partially' THEN r.Coeff * 0.5
                                        ELSE 0 
                                    END) * 100.0) / 
                                    SUM(CASE WHEN r.SelectedChoice != 'NA' THEN r.Coeff ELSE 0 END)
                                AS DECIMAL(5,2))
                                ELSE NULL 
                            END
                            FROM AuditResponses r
                            WHERE r.AuditID = a.AuditID AND r.SelectedChoice IS NOT NULL AND r.SelectedChoice != ''
                        )
                    END AS CalculatedScore
                FROM AuditInstances a
                INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
                ORDER BY a.CreatedAt DESC
            `);

            return result.recordset.map(row => ({
                auditId: row.AuditID,
                documentNumber: row.DocumentNumber,
                storeCode: row.StoreCode,
                storeName: row.StoreName,
                schemaName: row.SchemaName,
                auditDate: row.AuditDate,
                cycle: row.Cycle,
                year: row.Year,
                auditors: row.Auditors,
                status: row.Status,
                totalScore: row.CalculatedScore,
                createdAt: row.CreatedAt
            }));
        } catch (error) {
            console.error('Error getting all audits:', error);
            throw error;
        }
    }

    /**
     * Upload picture for a response
     */
    async uploadPicture(pictureData) {
        try {
            const pool = await this.getPool();
            
            const result = await pool.request()
                .input('ResponseID', sql.Int, pictureData.responseId)
                .input('AuditID', sql.Int, pictureData.auditId)
                .input('FileName', sql.NVarChar(255), pictureData.fileName)
                .input('FileData', sql.VarBinary(sql.MAX), Buffer.from(pictureData.fileData, 'base64'))
                .input('ContentType', sql.NVarChar(100), pictureData.contentType)
                .input('PictureType', sql.NVarChar(50), pictureData.pictureType)
                .query(`
                    INSERT INTO AuditPictures (ResponseID, AuditID, FileName, FileData, ContentType, PictureType)
                    VALUES (@ResponseID, @AuditID, @FileName, @FileData, @ContentType, @PictureType);
                    SELECT SCOPE_IDENTITY() AS PictureID;
                `);

            const pictureId = result.recordset[0].PictureID;

            // Update HasPicture flag on response
            await pool.request()
                .input('ResponseID', sql.Int, pictureData.responseId)
                .query(`UPDATE AuditResponses SET HasPicture = 1 WHERE ResponseID = @ResponseID`);

            return { pictureId };
        } catch (error) {
            console.error('Error uploading picture:', error);
            throw error;
        }
    }

    /**
     * Get pictures for a response
     */
    async getPictures(responseId) {
        try {
            const pool = await this.getPool();
            
            const result = await pool.request()
                .input('ResponseID', sql.Int, responseId)
                .query(`
                    SELECT PictureID, FileName, FileData, ContentType, PictureType, CreatedAt
                    FROM AuditPictures
                    WHERE ResponseID = @ResponseID
                    ORDER BY CreatedAt DESC
                `);

            return result.recordset.map(row => ({
                pictureId: row.PictureID,
                fileName: row.FileName,
                fileData: row.FileData.toString('base64'),
                contentType: row.ContentType,
                pictureType: row.PictureType,
                createdAt: row.CreatedAt
            }));
        } catch (error) {
            console.error('Error getting pictures:', error);
            throw error;
        }
    }

    /**
     * Delete picture
     */
    async deletePicture(pictureId) {
        try {
            const pool = await this.getPool();
            
            // Get response ID before deleting
            const picResult = await pool.request()
                .input('PictureID', sql.Int, pictureId)
                .query(`SELECT ResponseID FROM AuditPictures WHERE PictureID = @PictureID`);

            if (picResult.recordset.length === 0) {
                throw new Error('Picture not found');
            }

            const responseId = picResult.recordset[0].ResponseID;

            // Delete picture
            await pool.request()
                .input('PictureID', sql.Int, pictureId)
                .query(`DELETE FROM AuditPictures WHERE PictureID = @PictureID`);

            // Check if there are any remaining pictures for this response
            const countResult = await pool.request()
                .input('ResponseID', sql.Int, responseId)
                .query(`SELECT COUNT(*) as PicCount FROM AuditPictures WHERE ResponseID = @ResponseID`);

            // Update HasPicture flag if no pictures remain
            if (countResult.recordset[0].PicCount === 0) {
                await pool.request()
                    .input('ResponseID', sql.Int, responseId)
                    .query(`UPDATE AuditResponses SET HasPicture = 0 WHERE ResponseID = @ResponseID`);
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting picture:', error);
            throw error;
        }
    }

    /**
     * Get audits list for Audit List page
     */
    async getAuditsList() {
        try {
            const pool = await this.getPool();
            
            // Ensure checklist info columns exist in AuditSchemas
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'CreationDate')
                BEGIN
                    ALTER TABLE AuditSchemas ADD CreationDate DATE NULL;
                END;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'RevisionDate')
                BEGIN
                    ALTER TABLE AuditSchemas ADD RevisionDate DATE NULL;
                END;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'Edition')
                BEGIN
                    ALTER TABLE AuditSchemas ADD Edition NVARCHAR(50) NULL;
                END;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'ReportTitle')
                BEGIN
                    ALTER TABLE AuditSchemas ADD ReportTitle NVARCHAR(200) NULL;
                END;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'DocumentPrefix')
                BEGIN
                    ALTER TABLE AuditSchemas ADD DocumentPrefix NVARCHAR(50) NULL;
                END;
            `);
            
            const result = await pool.request().query(`
                SELECT 
                    a.AuditID,
                    a.DocumentNumber,
                    a.StoreCode,
                    a.StoreName,
                    a.SchemaID,
                    s.SchemaName,
                    a.AuditDate,
                    a.Cycle AS AuditCycle,
                    a.Year AS AuditYear,
                    a.Auditors,
                    a.Status,
                    CASE 
                        WHEN a.Status = 'Completed' THEN a.TotalScore
                        ELSE (
                            SELECT 
                                CASE 
                                    WHEN SUM(r.Coeff) = 0 THEN NULL
                                    ELSE ROUND(
                                        (SUM(CASE 
                                            WHEN r.SelectedChoice = 'Yes' THEN r.Coeff
                                            WHEN r.SelectedChoice = 'Partially' THEN r.Coeff * 0.5
                                            ELSE 0
                                        END) * 100.0) / 
                                        NULLIF(SUM(CASE WHEN r.SelectedChoice != 'NA' AND r.SelectedChoice IS NOT NULL AND r.SelectedChoice != '' THEN r.Coeff ELSE 0 END), 0),
                                        1
                                    )
                                END
                            FROM AuditResponses r
                            WHERE r.AuditID = a.AuditID
                              AND r.SelectedChoice IS NOT NULL 
                              AND r.SelectedChoice != ''
                        )
                    END AS TotalScore,
                    a.CreatedAt,
                    a.CompletedAt,
                    ISNULL(ss.PassingGrade, 83) AS PassingGrade,
                    s.Edition AS ChecklistEdition,
                    s.RevisionDate AS ChecklistRevisionDate,
                    s.CreationDate AS ChecklistCreationDate,
                    s.ReportTitle AS ChecklistReportTitle,
                    s.DocumentPrefix AS ChecklistDocumentPrefix
                FROM AuditInstances a
                INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
                LEFT JOIN SystemSettings ss ON ss.SchemaID = a.SchemaID AND ss.SettingType = 'Overall'
                ORDER BY a.CreatedAt DESC
            `);

            return result.recordset;
        } catch (error) {
            console.error('Error getting audits list:', error);
            throw error;
        }
    }

    /**
     * Delete an audit and all related data
     */
    async deleteAudit(auditId) {
        try {
            const pool = await this.getPool();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Delete section scores (cascade should handle this, but explicit is safer)
                await transaction.request()
                    .input('AuditID', sql.Int, auditId)
                    .query(`DELETE FROM AuditSectionScores WHERE AuditID = @AuditID`);

                // Delete pictures first
                await transaction.request()
                    .input('AuditID', sql.Int, auditId)
                    .query(`
                        DELETE FROM AuditPictures 
                        WHERE ResponseID IN (
                            SELECT ResponseID FROM AuditResponses WHERE AuditID = @AuditID
                        )
                    `);

                // Delete responses
                await transaction.request()
                    .input('AuditID', sql.Int, auditId)
                    .query(`DELETE FROM AuditResponses WHERE AuditID = @AuditID`);

                // Delete the audit instance
                await transaction.request()
                    .input('AuditID', sql.Int, auditId)
                    .query(`DELETE FROM AuditInstances WHERE AuditID = @AuditID`);

                await transaction.commit();
                return { success: true };
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Error deleting audit:', error);
            throw error;
        }
    }

    /**
     * Get section scores for an audit (for reports)
     */
    async getSectionScores(auditId) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT 
                        ScoreID,
                        AuditID,
                        SectionID,
                        SectionNumber,
                        SectionName,
                        EarnedScore,
                        MaxScore,
                        Percentage,
                        TotalQuestions,
                        AnsweredQuestions,
                        NAQuestions,
                        CreatedAt
                    FROM AuditSectionScores
                    WHERE AuditID = @AuditID
                    ORDER BY SectionNumber
                `);

            return result.recordset;
        } catch (error) {
            console.error('Error getting section scores:', error);
            throw error;
        }
    }

    /**
     * Save fridge temperature readings
     */
    async saveFridgeReadings(auditId, documentNumber, goodReadings, badReadings, enabledSections) {
        try {
            const pool = await this.getPool();
            
            // First ensure the tables exist (with NVARCHAR for temperatures to support NA)
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FridgeReadings')
                BEGIN
                    CREATE TABLE FridgeReadings (
                        ReadingID INT IDENTITY(1,1) PRIMARY KEY,
                        AuditID INT NOT NULL,
                        DocumentNumber NVARCHAR(50),
                        ResponseID INT,
                        ReadingType NVARCHAR(10), -- 'Good' or 'Bad'
                        Section NVARCHAR(100),
                        Unit NVARCHAR(200),
                        DisplayTemp NVARCHAR(50),
                        ProbeTemp NVARCHAR(50),
                        Issue NVARCHAR(500),
                        Picture NVARCHAR(MAX),
                        CreatedAt DATETIME DEFAULT GETDATE()
                    )
                END
                ELSE
                BEGIN
                    -- Alter columns to NVARCHAR if they are DECIMAL (to support NA values)
                    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FridgeReadings') AND name = 'DisplayTemp' AND system_type_id = 106)
                    BEGIN
                        ALTER TABLE FridgeReadings ALTER COLUMN DisplayTemp NVARCHAR(50);
                    END
                    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FridgeReadings') AND name = 'ProbeTemp' AND system_type_id = 106)
                    BEGIN
                        ALTER TABLE FridgeReadings ALTER COLUMN ProbeTemp NVARCHAR(50);
                    END
                END;
                
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TempMonitoringSections')
                BEGIN
                    CREATE TABLE TempMonitoringSections (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        AuditID INT NOT NULL,
                        SectionID INT NOT NULL,
                        Enabled BIT DEFAULT 1,
                        CreatedAt DATETIME DEFAULT GETDATE(),
                        UNIQUE (AuditID, SectionID)
                    )
                END
            `);
            
            // Delete existing readings for this audit
            await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`DELETE FROM FridgeReadings WHERE AuditID = @AuditID`);
            
            // Delete existing enabled sections for this audit
            await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`DELETE FROM TempMonitoringSections WHERE AuditID = @AuditID`);
            
            // Insert enabled sections
            if (enabledSections && typeof enabledSections === 'object') {
                for (const [sectionId, enabled] of Object.entries(enabledSections)) {
                    if (enabled) {
                        await pool.request()
                            .input('AuditID', sql.Int, auditId)
                            .input('SectionID', sql.Int, parseInt(sectionId))
                            .input('Enabled', sql.Bit, 1)
                            .query(`
                                INSERT INTO TempMonitoringSections (AuditID, SectionID, Enabled)
                                VALUES (@AuditID, @SectionID, @Enabled)
                            `);
                    }
                }
            }
            
            // Insert good readings
            for (const reading of (goodReadings || [])) {
                await pool.request()
                    .input('AuditID', sql.Int, auditId)
                    .input('DocumentNumber', sql.NVarChar(50), documentNumber)
                    .input('ResponseID', sql.Int, reading.responseId)
                    .input('ReadingType', sql.NVarChar(10), 'Good')
                    .input('Section', sql.NVarChar(100), reading.section)
                    .input('Unit', sql.NVarChar(200), reading.unit)
                    .input('DisplayTemp', sql.NVarChar(50), String(reading.displayTemp))
                    .input('ProbeTemp', sql.NVarChar(50), String(reading.probeTemp))
                    .input('Issue', sql.NVarChar(500), null)
                    .input('Picture', sql.NVarChar(sql.MAX), reading.picture || null)
                    .query(`
                        INSERT INTO FridgeReadings (
                            AuditID, DocumentNumber, ResponseID, ReadingType,
                            Section, Unit, DisplayTemp, ProbeTemp, Issue, Picture
                        ) VALUES (
                            @AuditID, @DocumentNumber, @ResponseID, @ReadingType,
                            @Section, @Unit, @DisplayTemp, @ProbeTemp, @Issue, @Picture
                        )
                    `);
            }
            
            // Insert bad readings
            for (const reading of (badReadings || [])) {
                await pool.request()
                    .input('AuditID', sql.Int, auditId)
                    .input('DocumentNumber', sql.NVarChar(50), documentNumber)
                    .input('ResponseID', sql.Int, reading.responseId)
                    .input('ReadingType', sql.NVarChar(10), 'Bad')
                    .input('Section', sql.NVarChar(100), reading.section)
                    .input('Unit', sql.NVarChar(200), reading.unit)
                    .input('DisplayTemp', sql.NVarChar(50), String(reading.displayTemp))
                    .input('ProbeTemp', sql.NVarChar(50), String(reading.probeTemp))
                    .input('Issue', sql.NVarChar(500), reading.issue)
                    .input('Picture', sql.NVarChar(sql.MAX), reading.picture || null)
                    .query(`
                        INSERT INTO FridgeReadings (
                            AuditID, DocumentNumber, ResponseID, ReadingType,
                            Section, Unit, DisplayTemp, ProbeTemp, Issue, Picture
                        ) VALUES (
                            @AuditID, @DocumentNumber, @ResponseID, @ReadingType,
                            @Section, @Unit, @DisplayTemp, @ProbeTemp, @Issue, @Picture
                        )
                    `);
            }
            
            console.log(`✅ Saved ${(goodReadings || []).length} good and ${(badReadings || []).length} bad fridge readings for audit ${auditId}`);
            
            return {
                goodCount: (goodReadings || []).length,
                badCount: (badReadings || []).length
            };
        } catch (error) {
            console.error('Error saving fridge readings:', error);
            throw error;
        }
    }

    /**
     * Get fridge temperature readings
     */
    async getFridgeReadings(auditId) {
        try {
            const pool = await this.getPool();
            
            // Check if tables exist
            const tableCheck = await pool.request().query(`
                SELECT 
                    (SELECT COUNT(*) FROM sys.tables WHERE name = 'FridgeReadings') as fridgeTable,
                    (SELECT COUNT(*) FROM sys.tables WHERE name = 'TempMonitoringSections') as sectionsTable
            `);
            
            if (tableCheck.recordset[0].fridgeTable === 0) {
                return { goodReadings: [], badReadings: [], enabledSections: {} };
            }
            
            // Get enabled sections
            let enabledSections = {};
            if (tableCheck.recordset[0].sectionsTable > 0) {
                const sectionsResult = await pool.request()
                    .input('AuditID', sql.Int, auditId)
                    .query(`
                        SELECT SectionID, Enabled
                        FROM TempMonitoringSections
                        WHERE AuditID = @AuditID AND Enabled = 1
                    `);
                
                for (const row of sectionsResult.recordset) {
                    enabledSections[row.SectionID] = true;
                }
            }
            
            const result = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT 
                        ReadingID,
                        ResponseID as responseId,
                        ReadingType as readingType,
                        Section as section,
                        Unit as unit,
                        DisplayTemp as displayTemp,
                        ProbeTemp as probeTemp,
                        Issue as issue,
                        Picture as picture,
                        CreatedAt
                    FROM FridgeReadings
                    WHERE AuditID = @AuditID
                    ORDER BY ReadingID
                `);
            
            const goodReadings = result.recordset
                .filter(r => r.readingType === 'Good')
                .map(r => ({
                    responseId: r.responseId,
                    section: r.section,
                    unit: r.unit,
                    displayTemp: r.displayTemp,
                    probeTemp: r.probeTemp,
                    picture: r.picture
                }));
            
            const badReadings = result.recordset
                .filter(r => r.readingType === 'Bad')
                .map(r => ({
                    responseId: r.responseId,
                    section: r.section,
                    unit: r.unit,
                    displayTemp: r.displayTemp,
                    probeTemp: r.probeTemp,
                    issue: r.issue,
                    picture: r.picture
                }));
            
            return { goodReadings, badReadings, enabledSections };
        } catch (error) {
            console.error('Error getting fridge readings:', error);
            throw error;
        }
    }

    /**
     * Get department report data for an audit
     * Returns items escalated to a specific department with pictures
     * @param {number} auditId - Audit ID
     * @param {string} department - Department name (Maintenance, Procurement, Cleaning)
     */
    async getDepartmentReport(auditId, department) {
        try {
            const pool = await this.getPool();
            
            // Get audit info with custom department names
            const auditResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .query(`
                    SELECT a.AuditID, a.DocumentNumber, a.StoreID, a.StoreCode, a.StoreName,
                           a.SchemaID, a.AuditDate, a.Cycle, a.Year,
                           a.Auditors, a.AccompaniedBy, a.Status, a.TotalScore,
                           sc.DeptNameMaintenance, sc.DeptNameProcurement, sc.DeptNameCleaning
                    FROM AuditInstances a
                    LEFT JOIN AuditSchemas sc ON a.SchemaID = sc.SchemaID
                    WHERE a.AuditID = @AuditID
                `);
            
            if (auditResult.recordset.length === 0) {
                throw new Error('Audit not found');
            }
            
            const audit = auditResult.recordset[0];
            
            // Get custom department name or use default
            const departmentDisplayNames = {
                Maintenance: audit.DeptNameMaintenance || 'Maintenance',
                Procurement: audit.DeptNameProcurement || 'Procurement',
                Cleaning: audit.DeptNameCleaning || 'Cleaning'
            };
            const departmentDisplayName = departmentDisplayNames[department] || department;
            
            // Get responses escalated to this department
            // Department field can contain multiple departments like "Maintenance, Cleaning"
            const responsesResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .input('Department', sql.NVarChar(200), department)
                .query(`
                    SELECT 
                        ar.ResponseID, ar.ReferenceValue, ar.Title, ar.SectionName,
                        ar.Finding, ar.CorrectiveAction, ar.Priority, ar.Department, ar.CR
                    FROM AuditResponses ar
                    WHERE ar.AuditID = @AuditID
                      AND ar.Escalate = 1
                      AND ar.Department LIKE '%' + @Department + '%'
                    ORDER BY ar.SectionNumber, ar.ReferenceValue
                `);
            
            // Get all response IDs for batch picture fetch
            const responseIds = responsesResult.recordset.map(r => r.ResponseID);
            
            // Fetch all pictures in one query (much faster than N+1 queries)
            let picturesByResponse = {};
            if (responseIds.length > 0) {
                const picturesResult = await pool.request()
                    .query(`
                        SELECT PictureID, ResponseID, FileName, FileData, ContentType, PictureType
                        FROM AuditPictures
                        WHERE ResponseID IN (${responseIds.join(',')})
                          AND PictureType IN ('Finding', 'finding', 'Corrective', 'corrective', 'Good', 'good')
                        ORDER BY ResponseID,
                            CASE WHEN PictureType IN ('Finding', 'finding') THEN 1 
                                 WHEN PictureType IN ('Good', 'good') THEN 2
                                 ELSE 3 END,
                            CreatedAt DESC
                    `);
                
                // Group pictures by ResponseID
                for (const pic of picturesResult.recordset) {
                    if (!picturesByResponse[pic.ResponseID]) {
                        picturesByResponse[pic.ResponseID] = [];
                    }
                    picturesByResponse[pic.ResponseID].push({
                        pictureId: pic.PictureID,
                        fileName: pic.FileName,
                        base64: pic.FileData.toString('base64'),
                        contentType: pic.ContentType,
                        pictureType: pic.PictureType
                    });
                }
            }
            
            // Build items with pictures
            const items = [];
            for (const response of responsesResult.recordset) {
                const pictures = picturesByResponse[response.ResponseID] || [];
                
                // Use CR (Criterion/Requirement) as Corrective Action if CorrectiveAction is empty
                const correctiveAction = response.CorrectiveAction || response.CR || '';
                
                items.push({
                    responseId: response.ResponseID,
                    referenceValue: response.ReferenceValue || '-',
                    title: response.Title,
                    section: response.SectionName,
                    finding: response.Finding || '',
                    correctiveAction: correctiveAction,
                    priority: response.Priority || 'Medium',
                    pictures: pictures
                });
            }
            
            return {
                audit: {
                    auditId: audit.AuditID,
                    documentNumber: audit.DocumentNumber,
                    storeName: audit.StoreName,
                    storeCode: audit.StoreCode,
                    auditDate: audit.AuditDate,
                    auditors: audit.Auditors,
                    cycle: audit.Cycle,
                    year: audit.Year
                },
                department: department,
                departmentDisplayName: departmentDisplayName,
                items: items,
                totalItems: items.length,
                byPriority: {
                    high: items.filter(i => i.priority === 'High').length,
                    medium: items.filter(i => i.priority === 'Medium').length,
                    low: items.filter(i => i.priority === 'Low').length
                }
            };
        } catch (error) {
            console.error('Error getting department report:', error);
            throw error;
        }
    }

    /**
     * Ensure DepartmentReports table exists
     */
    async ensureDepartmentReportsTable() {
        try {
            const pool = await this.getPool();
            await pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DepartmentReports' AND xtype='U')
                CREATE TABLE DepartmentReports (
                    ReportID INT IDENTITY(1,1) PRIMARY KEY,
                    AuditID INT NOT NULL,
                    Department NVARCHAR(50) NOT NULL,
                    DocumentNumber NVARCHAR(50),
                    StoreName NVARCHAR(200),
                    StoreCode NVARCHAR(50),
                    AuditDate DATE,
                    TotalItems INT DEFAULT 0,
                    HighPriority INT DEFAULT 0,
                    MediumPriority INT DEFAULT 0,
                    LowPriority INT DEFAULT 0,
                    ReportData NVARCHAR(MAX),
                    GeneratedBy NVARCHAR(200),
                    GeneratedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT FK_DeptReports_Audit FOREIGN KEY (AuditID) REFERENCES AuditInstances(AuditID)
                )
            `);
            return true;
        } catch (error) {
            console.error('Error ensuring DepartmentReports table:', error);
            throw error;
        }
    }

    /**
     * Save department report to SQL
     */
    async saveDepartmentReport(auditId, department, reportData, generatedBy) {
        try {
            await this.ensureDepartmentReportsTable();
            const pool = await this.getPool();
            
            // Check if report already exists for this audit/department
            const existingResult = await pool.request()
                .input('AuditID', sql.Int, auditId)
                .input('Department', sql.NVarChar(50), department)
                .query(`
                    SELECT ReportID FROM DepartmentReports 
                    WHERE AuditID = @AuditID AND Department = @Department
                `);
            
            if (existingResult.recordset.length > 0) {
                // Update existing report
                await pool.request()
                    .input('ReportID', sql.Int, existingResult.recordset[0].ReportID)
                    .input('TotalItems', sql.Int, reportData.totalItems)
                    .input('HighPriority', sql.Int, reportData.byPriority.high)
                    .input('MediumPriority', sql.Int, reportData.byPriority.medium)
                    .input('LowPriority', sql.Int, reportData.byPriority.low)
                    .input('ReportData', sql.NVarChar(sql.MAX), JSON.stringify(reportData))
                    .input('GeneratedBy', sql.NVarChar(200), generatedBy)
                    .query(`
                        UPDATE DepartmentReports
                        SET TotalItems = @TotalItems,
                            HighPriority = @HighPriority,
                            MediumPriority = @MediumPriority,
                            LowPriority = @LowPriority,
                            ReportData = @ReportData,
                            GeneratedBy = @GeneratedBy,
                            GeneratedAt = GETDATE()
                        WHERE ReportID = @ReportID
                    `);
                return { reportId: existingResult.recordset[0].ReportID, updated: true };
            } else {
                // Insert new report - handle null/undefined values
                const docNumber = String(reportData.audit?.documentNumber || '');
                const storeName = String(reportData.audit?.storeName || 'Unknown Store');
                const storeCode = String(reportData.audit?.storeCode || '');
                const auditDate = reportData.audit?.auditDate ? new Date(reportData.audit.auditDate) : new Date();
                
                const result = await pool.request()
                    .input('AuditID', sql.Int, auditId)
                    .input('Department', sql.NVarChar(50), department)
                    .input('DocumentNumber', sql.NVarChar(50), docNumber)
                    .input('StoreName', sql.NVarChar(200), storeName)
                    .input('StoreCode', sql.NVarChar(50), storeCode)
                    .input('AuditDate', sql.Date, auditDate)
                    .input('TotalItems', sql.Int, reportData.totalItems || 0)
                    .input('HighPriority', sql.Int, reportData.byPriority?.high || 0)
                    .input('MediumPriority', sql.Int, reportData.byPriority?.medium || 0)
                    .input('LowPriority', sql.Int, reportData.byPriority?.low || 0)
                    .input('ReportData', sql.NVarChar(sql.MAX), JSON.stringify(reportData))
                    .input('GeneratedBy', sql.NVarChar(200), String(generatedBy || 'Unknown'))
                    .query(`
                        INSERT INTO DepartmentReports 
                        (AuditID, Department, DocumentNumber, StoreName, StoreCode, AuditDate, 
                         TotalItems, HighPriority, MediumPriority, LowPriority, ReportData, GeneratedBy)
                        VALUES (@AuditID, @Department, @DocumentNumber, @StoreName, @StoreCode, @AuditDate,
                                @TotalItems, @HighPriority, @MediumPriority, @LowPriority, @ReportData, @GeneratedBy);
                        SELECT SCOPE_IDENTITY() AS ReportID;
                    `);
                return { reportId: result.recordset[0].ReportID, updated: false };
            }
        } catch (error) {
            console.error('Error saving department report:', error);
            throw error;
        }
    }

    /**
     * Get saved department reports for a department
     */
    async getDepartmentReports(department) {
        try {
            await this.ensureDepartmentReportsTable();
            const pool = await this.getPool();
            
            const result = await pool.request()
                .input('Department', sql.NVarChar(50), department)
                .query(`
                    SELECT ReportID, AuditID, Department, DocumentNumber, StoreName, StoreCode,
                           AuditDate, TotalItems, HighPriority, MediumPriority, LowPriority,
                           GeneratedBy, GeneratedAt
                    FROM DepartmentReports
                    WHERE Department = @Department
                    ORDER BY GeneratedAt DESC
                `);
            
            return result.recordset.map(row => ({
                reportId: row.ReportID,
                auditId: row.AuditID,
                department: row.Department,
                documentNumber: row.DocumentNumber,
                storeName: row.StoreName,
                storeCode: row.StoreCode,
                auditDate: row.AuditDate,
                totalItems: row.TotalItems,
                highPriority: row.HighPriority,
                mediumPriority: row.MediumPriority,
                lowPriority: row.LowPriority,
                generatedBy: row.GeneratedBy,
                generatedAt: row.GeneratedAt
            }));
        } catch (error) {
            console.error('Error getting department reports:', error);
            throw error;
        }
    }

    /**
     * Get a single department report by ID
     */
    async getDepartmentReportById(reportId) {
        try {
            const pool = await this.getPool();
            
            const result = await pool.request()
                .input('ReportID', sql.Int, reportId)
                .query(`
                    SELECT * FROM DepartmentReports WHERE ReportID = @ReportID
                `);
            
            if (result.recordset.length === 0) {
                return null;
            }
            
            const row = result.recordset[0];
            return {
                reportId: row.ReportID,
                auditId: row.AuditID,
                department: row.Department,
                documentNumber: row.DocumentNumber,
                storeName: row.StoreName,
                storeCode: row.StoreCode,
                auditDate: row.AuditDate,
                totalItems: row.TotalItems,
                highPriority: row.HighPriority,
                mediumPriority: row.MediumPriority,
                lowPriority: row.LowPriority,
                reportData: row.ReportData ? JSON.parse(row.ReportData) : null,
                generatedBy: row.GeneratedBy,
                generatedAt: row.GeneratedAt
            };
        } catch (error) {
            console.error('Error getting department report by ID:', error);
            throw error;
        }
    }
}

module.exports = new AuditService();

