/**
 * Score Calculator Service
 * Provides section exclusion functionality for audit score calculations
 * DOES NOT modify actual audit data - calculator only
 */

const sql = require('mssql');

class ScoreCalculatorService {
    /**
     * Get all sections with scores for an audit
     * @param {number} auditId - The audit ID
     * @returns {Promise<Object>} Sections with scores and exclusion status
     */
    static async getAuditSectionsWithScores(auditId) {
        const dbConfig = require('../../config/default').database;
        const pool = await sql.connect(dbConfig);

        // Get audit basic info
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    ai.AuditID,
                    ai.DocumentNumber,
                    ai.StoreName,
                    ai.StoreCode,
                    ai.AuditDate,
                    ai.Status,
                    ai.TotalScore,
                    ai.SchemaID,
                    s.SchemaName,
                    ISNULL(ss.PassingGrade, 83) AS PassingGrade
                FROM AuditInstances ai
                INNER JOIN AuditSchemas s ON ai.SchemaID = s.SchemaID
                LEFT JOIN SystemSettings ss ON ss.SchemaID = ai.SchemaID AND ss.SettingType = 'Overall'
                WHERE ai.AuditID = @auditId
            `);

        if (auditResult.recordset.length === 0) {
            throw new Error(`Audit not found: ${auditId}`);
        }

        const audit = auditResult.recordset[0];

        // Get sections with their scores
        const sectionsResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    sec.SectionID,
                    sec.SectionName,
                    sec.SectionNumber,
                    -- Calculate section score
                    CASE 
                        WHEN SUM(CASE WHEN r.SelectedChoice != 'NA' AND r.SelectedChoice IS NOT NULL AND r.SelectedChoice != '' THEN r.Coeff ELSE 0 END) = 0 THEN NULL
                        ELSE ROUND(
                            (SUM(CASE 
                                WHEN r.SelectedChoice = 'Yes' THEN r.Coeff
                                WHEN r.SelectedChoice = 'Partially' THEN r.Coeff * 0.5
                                ELSE 0
                            END) * 100.0) / 
                            NULLIF(SUM(CASE WHEN r.SelectedChoice != 'NA' AND r.SelectedChoice IS NOT NULL AND r.SelectedChoice != '' THEN r.Coeff ELSE 0 END), 0),
                            1
                        )
                    END AS SectionScore,
                    -- Total possible coefficient (excluding NA)
                    SUM(CASE WHEN r.SelectedChoice != 'NA' AND r.SelectedChoice IS NOT NULL AND r.SelectedChoice != '' THEN r.Coeff ELSE 0 END) AS TotalCoeff,
                    -- Earned points
                    SUM(CASE 
                        WHEN r.SelectedChoice = 'Yes' THEN r.Coeff
                        WHEN r.SelectedChoice = 'Partially' THEN r.Coeff * 0.5
                        ELSE 0
                    END) AS EarnedPoints,
                    -- Question count
                    COUNT(r.ResponseID) AS TotalQuestions,
                    SUM(CASE WHEN r.SelectedChoice IS NOT NULL AND r.SelectedChoice != '' THEN 1 ELSE 0 END) AS AnsweredQuestions,
                    -- Check if excluded
                    CASE WHEN e.ExclusionID IS NOT NULL THEN 1 ELSE 0 END AS IsExcluded
                FROM AuditSections sec
                LEFT JOIN AuditResponses r ON r.AuditID = @auditId AND r.SectionID = sec.SectionID
                LEFT JOIN AuditScoreExclusions e ON e.AuditID = @auditId AND e.SectionID = sec.SectionID
                WHERE sec.SchemaID = (SELECT SchemaID FROM AuditInstances WHERE AuditID = @auditId)
                GROUP BY sec.SectionID, sec.SectionName, sec.SectionNumber, e.ExclusionID
                ORDER BY sec.SectionNumber
            `);

        const sections = sectionsResult.recordset;

        // Calculate original total (all sections)
        const originalTotal = this.calculateTotalScore(sections, false);

        // Calculate adjusted total (excluding excluded sections)
        const adjustedTotal = this.calculateTotalScore(sections, true);

        // Get exclusion history
        const historyResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT TOP 20
                    SectionName,
                    Action,
                    OriginalScore,
                    AdjustedScore,
                    ChangedBy,
                    ChangedAt
                FROM AuditScoreExclusionHistory
                WHERE AuditID = @auditId
                ORDER BY ChangedAt DESC
            `);

        return {
            audit: audit,
            sections: sections,
            originalTotal: originalTotal,
            adjustedTotal: adjustedTotal,
            excludedCount: sections.filter(s => s.IsExcluded).length,
            history: historyResult.recordset
        };
    }

    /**
     * Calculate total score from sections
     * @param {Array} sections - Array of section data
     * @param {boolean} excludeMarked - Whether to exclude marked sections
     * @returns {number|null} Total score percentage
     */
    static calculateTotalScore(sections, excludeMarked = false) {
        let totalCoeff = 0;
        let earnedPoints = 0;

        for (const section of sections) {
            if (excludeMarked && section.IsExcluded) {
                continue;
            }
            totalCoeff += section.TotalCoeff || 0;
            earnedPoints += section.EarnedPoints || 0;
        }

        if (totalCoeff === 0) return null;
        return Math.round((earnedPoints / totalCoeff) * 1000) / 10; // Round to 1 decimal
    }

    /**
     * Save section exclusions
     * @param {number} auditId - The audit ID
     * @param {Array<number>} excludedSectionIds - Array of section IDs to exclude
     * @param {string} username - User making the change
     * @returns {Promise<Object>} Updated scores
     */
    static async saveExclusions(auditId, excludedSectionIds, username) {
        const dbConfig = require('../../config/default').database;
        const pool = await sql.connect(dbConfig);

        // Get current exclusions before change
        const currentResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`SELECT SectionID FROM AuditScoreExclusions WHERE AuditID = @auditId`);
        
        const currentExclusions = new Set(currentResult.recordset.map(r => r.SectionID));
        const newExclusions = new Set(excludedSectionIds);

        // Get section names for history
        const sectionNamesResult = await pool.request()
            .input('schemaId', sql.Int, null)
            .query(`
                SELECT sec.SectionID, sec.SectionName 
                FROM AuditSections sec
                WHERE sec.SchemaID = (SELECT SchemaID FROM AuditInstances WHERE AuditID = ${auditId})
            `);
        const sectionNames = {};
        sectionNamesResult.recordset.forEach(r => sectionNames[r.SectionID] = r.SectionName);

        // Get scores before change for history
        const beforeData = await this.getAuditSectionsWithScores(auditId);

        // Start transaction
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Delete all current exclusions for this audit
            await transaction.request()
                .input('auditId', sql.Int, auditId)
                .query(`DELETE FROM AuditScoreExclusions WHERE AuditID = @auditId`);

            // Insert new exclusions
            for (const sectionId of excludedSectionIds) {
                await transaction.request()
                    .input('auditId', sql.Int, auditId)
                    .input('sectionId', sql.Int, sectionId)
                    .input('username', sql.NVarChar(255), username)
                    .query(`
                        INSERT INTO AuditScoreExclusions (AuditID, SectionID, IsExcluded, CreatedBy, CreatedAt)
                        VALUES (@auditId, @sectionId, 1, @username, GETDATE())
                    `);
            }

            // Record history for changes
            // Find sections that were added to exclusions
            for (const sectionId of excludedSectionIds) {
                if (!currentExclusions.has(sectionId)) {
                    await transaction.request()
                        .input('auditId', sql.Int, auditId)
                        .input('sectionId', sql.Int, sectionId)
                        .input('sectionName', sql.NVarChar(255), sectionNames[sectionId] || 'Unknown')
                        .input('action', sql.NVarChar(50), 'Excluded')
                        .input('originalScore', sql.Decimal(5, 2), beforeData.originalTotal)
                        .input('username', sql.NVarChar(255), username)
                        .query(`
                            INSERT INTO AuditScoreExclusionHistory (AuditID, SectionID, SectionName, Action, OriginalScore, ChangedBy, ChangedAt)
                            VALUES (@auditId, @sectionId, @sectionName, @action, @originalScore, @username, GETDATE())
                        `);
                }
            }

            // Find sections that were removed from exclusions
            for (const sectionId of currentExclusions) {
                if (!newExclusions.has(sectionId)) {
                    await transaction.request()
                        .input('auditId', sql.Int, auditId)
                        .input('sectionId', sql.Int, sectionId)
                        .input('sectionName', sql.NVarChar(255), sectionNames[sectionId] || 'Unknown')
                        .input('action', sql.NVarChar(50), 'Included')
                        .input('originalScore', sql.Decimal(5, 2), beforeData.originalTotal)
                        .input('username', sql.NVarChar(255), username)
                        .query(`
                            INSERT INTO AuditScoreExclusionHistory (AuditID, SectionID, SectionName, Action, OriginalScore, ChangedBy, ChangedAt)
                            VALUES (@auditId, @sectionId, @sectionName, @action, @originalScore, @username, GETDATE())
                        `);
                }
            }

            await transaction.commit();

            // Return updated data
            return await this.getAuditSectionsWithScores(auditId);

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Get list of audits for dropdown
     * @returns {Promise<Array>} List of audits
     */
    static async getAuditsList() {
        const dbConfig = require('../../config/default').database;
        const pool = await sql.connect(dbConfig);

        const result = await pool.request().query(`
            SELECT 
                ai.AuditID,
                ai.DocumentNumber,
                ai.StoreName,
                ai.StoreCode,
                ai.AuditDate,
                ai.Status,
                ai.TotalScore,
                s.SchemaName
            FROM AuditInstances ai
            INNER JOIN AuditSchemas s ON ai.SchemaID = s.SchemaID
            ORDER BY ai.AuditDate DESC, ai.DocumentNumber DESC
        `);

        return result.recordset;
    }

    /**
     * Get exclusion history for an audit
     * @param {number} auditId - The audit ID
     * @returns {Promise<Array>} History records
     */
    static async getExclusionHistory(auditId) {
        const dbConfig = require('../../config/default').database;
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    HistoryID,
                    SectionID,
                    SectionName,
                    Action,
                    OriginalScore,
                    AdjustedScore,
                    ChangedBy,
                    ChangedAt
                FROM AuditScoreExclusionHistory
                WHERE AuditID = @auditId
                ORDER BY ChangedAt DESC
            `);

        return result.recordset;
    }

    /**
     * Get all exclusion history across all audits (with optional filters)
     * @param {Object} filters - Optional filters { startDate, endDate, changedBy, auditId }
     * @returns {Promise<Array>} History records with audit info
     */
    static async getAllExclusionHistory(filters = {}) {
        const dbConfig = require('../../config/default').database;
        const pool = await sql.connect(dbConfig);

        let whereConditions = [];
        const request = pool.request();

        if (filters.startDate) {
            whereConditions.push('h.ChangedAt >= @startDate');
            request.input('startDate', sql.DateTime, new Date(filters.startDate));
        }

        if (filters.endDate) {
            whereConditions.push('h.ChangedAt <= @endDate');
            request.input('endDate', sql.DateTime, new Date(filters.endDate));
        }

        if (filters.changedBy) {
            whereConditions.push('h.ChangedBy LIKE @changedBy');
            request.input('changedBy', sql.NVarChar(255), `%${filters.changedBy}%`);
        }

        if (filters.auditId) {
            whereConditions.push('h.AuditID = @auditId');
            request.input('auditId', sql.Int, filters.auditId);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const result = await request.query(`
            SELECT TOP 500
                h.HistoryID,
                h.AuditID,
                ai.DocumentNumber,
                ai.StoreName,
                h.SectionID,
                h.SectionName,
                h.Action,
                h.OriginalScore,
                h.AdjustedScore,
                h.ChangedBy,
                h.ChangedAt
            FROM AuditScoreExclusionHistory h
            LEFT JOIN AuditInstances ai ON h.AuditID = ai.AuditID
            ${whereClause}
            ORDER BY h.ChangedAt DESC
        `);

        return result.recordset;
    }

    /**
     * Get summary statistics for exclusion history
     * @returns {Promise<Object>} Statistics
     */
    static async getExclusionStats() {
        const dbConfig = require('../../config/default').database;
        const pool = await sql.connect(dbConfig);

        const result = await pool.request().query(`
            SELECT 
                COUNT(DISTINCT AuditID) AS AuditsWithExclusions,
                COUNT(*) AS TotalChanges,
                COUNT(CASE WHEN Action = 'Excluded' THEN 1 END) AS TotalExclusions,
                COUNT(CASE WHEN Action = 'Included' THEN 1 END) AS TotalInclusions,
                COUNT(DISTINCT ChangedBy) AS UniqueUsers,
                MIN(ChangedAt) AS FirstChange,
                MAX(ChangedAt) AS LastChange
            FROM AuditScoreExclusionHistory
        `);

        return result.recordset[0];
    }
}

module.exports = ScoreCalculatorService;
