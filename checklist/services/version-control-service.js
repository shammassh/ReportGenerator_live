/**
 * Version Control Service
 * Track changes to checklist questions using existing infrastructure
 * 
 * Uses FoodSafetyDB AuditLog table (from existing schema)
 */

const sql = require('mssql');
const config = require('../../config/default');

class VersionControlService {
    constructor() {
        this.dbConfig = {
            server: config.database.server,
            database: config.database.database,
            user: config.database.authentication.options.userName,
            password: config.database.authentication.options.password,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };
    }

    /**
     * Log a change to a checklist question
     * @param {Object} changeData - Change information
     * @returns {Promise<number>} Log entry ID
     */
    async logChange(changeData) {
        const {
            userId,
            userEmail,
            section,
            action, // 'add', 'update', 'delete', 'toggle'
            questionId,
            questionData,
            beforeState,
            reason,
            ipAddress
        } = changeData;

        try {
            const pool = await sql.connect(this.dbConfig);
            
            // Prepare change details JSON
            const details = {
                section,
                action,
                questionId,
                questionData: questionData || {},
                beforeState: beforeState || {},
                timestamp: new Date().toISOString()
            };

            // Insert into AuditLog table (assuming it exists from existing schema)
            // If AuditLog doesn't exist, we'll create a simple log in ChecklistChanges
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('userEmail', sql.NVarChar, userEmail)
                .input('action', sql.NVarChar, `CHECKLIST_${action.toUpperCase()}`)
                .input('entity', sql.NVarChar, section)
                .input('entityId', sql.NVarChar, questionId ? questionId.toString() : null)
                .input('details', sql.NVarChar, JSON.stringify(details))
                .input('reason', sql.NVarChar, reason || null)
                .input('ipAddress', sql.NVarChar, ipAddress || null)
                .query(`
                    INSERT INTO AuditLog 
                    (user_id, user_email, action, entity, entity_id, details, reason, ip_address, created_at)
                    VALUES 
                    (@userId, @userEmail, @action, @entity, @entityId, @details, @reason, @ipAddress, GETDATE());
                    SELECT SCOPE_IDENTITY() AS id;
                `);

            const logId = result.recordset[0].id;
            console.log(`✅ Change logged: ${action} on ${section} (Log ID: ${logId})`);
            
            await pool.close();
            return logId;

        } catch (error) {
            // If AuditLog table doesn't exist, fall back to console logging
            if (error.message.includes('Invalid object name') || 
                error.message.includes('AuditLog')) {
                console.warn('⚠️ AuditLog table not found, logging to console only');
                console.log('📝 Change Log:', {
                    userId,
                    userEmail,
                    section,
                    action,
                    questionId,
                    timestamp: new Date().toISOString()
                });
                return -1; // Indicate console-only logging
            }
            
            console.error('❌ Error logging change:', error);
            throw error;
        }
    }

    /**
     * Get change history with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Change history
     */
    async getChangeHistory(filters = {}) {
        const {
            section,
            questionId,
            userId,
            action,
            startDate,
            endDate,
            limit = 100
        } = filters;

        try {
            const pool = await sql.connect(this.dbConfig);
            
            let query = `
                SELECT 
                    id,
                    user_id,
                    user_email,
                    action,
                    entity as section,
                    entity_id as question_id,
                    details,
                    reason,
                    ip_address,
                    created_at
                FROM AuditLog
                WHERE action LIKE 'CHECKLIST_%'
            `;

            const request = pool.request();

            // Apply filters
            if (section) {
                query += ` AND entity = @section`;
                request.input('section', sql.NVarChar, section);
            }

            if (questionId) {
                query += ` AND entity_id = @questionId`;
                request.input('questionId', sql.NVarChar, questionId.toString());
            }

            if (userId) {
                query += ` AND user_id = @userId`;
                request.input('userId', sql.Int, userId);
            }

            if (action) {
                query += ` AND action = @action`;
                request.input('action', sql.NVarChar, `CHECKLIST_${action.toUpperCase()}`);
            }

            if (startDate) {
                query += ` AND created_at >= @startDate`;
                request.input('startDate', sql.DateTime, startDate);
            }

            if (endDate) {
                query += ` AND created_at <= @endDate`;
                request.input('endDate', sql.DateTime, endDate);
            }

            query += ` ORDER BY created_at DESC`;
            
            if (limit) {
                query = `SELECT TOP ${parseInt(limit)} * FROM (${query}) AS T`;
            }

            const result = await request.query(query);
            
            // Parse details JSON
            const history = result.recordset.map(row => ({
                ...row,
                details: JSON.parse(row.details || '{}')
            }));

            await pool.close();
            return history;

        } catch (error) {
            if (error.message.includes('Invalid object name') || 
                error.message.includes('AuditLog')) {
                console.warn('⚠️ AuditLog table not found, returning empty history');
                return [];
            }
            
            console.error('❌ Error fetching change history:', error);
            throw error;
        }
    }

    /**
     * Get change history for a specific question
     * @param {string} section - Section name
     * @param {number} questionId - Question ID
     * @returns {Promise<Array>} Question change history
     */
    async getQuestionHistory(section, questionId) {
        return await this.getChangeHistory({
            section,
            questionId
        });
    }

    /**
     * Get recent changes (last 24 hours)
     * @param {number} hours - Number of hours to look back (default: 24)
     * @returns {Promise<Array>} Recent changes
     */
    async getRecentChanges(hours = 24) {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);

        return await this.getChangeHistory({
            startDate,
            limit: 50
        });
    }

    /**
     * Get changes by user
     * @param {number} userId - User ID
     * @param {number} limit - Max results
     * @returns {Promise<Array>} User's changes
     */
    async getUserChanges(userId, limit = 50) {
        return await this.getChangeHistory({
            userId,
            limit
        });
    }

    /**
     * Get change statistics
     * @param {Object} filters - Optional filters
     * @returns {Promise<Object>} Statistics
     */
    async getChangeStatistics(filters = {}) {
        const { startDate, endDate, section } = filters;

        try {
            const pool = await sql.connect(this.dbConfig);
            
            let query = `
                SELECT 
                    action,
                    entity as section,
                    COUNT(*) as count
                FROM AuditLog
                WHERE action LIKE 'CHECKLIST_%'
            `;

            const request = pool.request();

            if (section) {
                query += ` AND entity = @section`;
                request.input('section', sql.NVarChar, section);
            }

            if (startDate) {
                query += ` AND created_at >= @startDate`;
                request.input('startDate', sql.DateTime, startDate);
            }

            if (endDate) {
                query += ` AND created_at <= @endDate`;
                request.input('endDate', sql.DateTime, endDate);
            }

            query += ` GROUP BY action, entity ORDER BY count DESC`;

            const result = await request.query(query);
            
            // Aggregate statistics
            const stats = {
                totalChanges: 0,
                byAction: {},
                bySection: {},
                details: result.recordset
            };

            result.recordset.forEach(row => {
                stats.totalChanges += row.count;
                
                const action = row.action.replace('CHECKLIST_', '').toLowerCase();
                stats.byAction[action] = (stats.byAction[action] || 0) + row.count;
                stats.bySection[row.section] = (stats.bySection[row.section] || 0) + row.count;
            });

            await pool.close();
            return stats;

        } catch (error) {
            if (error.message.includes('Invalid object name') || 
                error.message.includes('AuditLog')) {
                console.warn('⚠️ AuditLog table not found, returning empty stats');
                return {
                    totalChanges: 0,
                    byAction: {},
                    bySection: {},
                    details: []
                };
            }
            
            console.error('❌ Error fetching statistics:', error);
            throw error;
        }
    }

    /**
     * Rollback a question to a previous state
     * @param {number} logId - Log entry ID to rollback to
     * @returns {Promise<Object>} Previous state data
     */
    async getRollbackData(logId) {
        try {
            const pool = await sql.connect(this.dbConfig);
            
            const result = await pool.request()
                .input('logId', sql.Int, logId)
                .query(`
                    SELECT 
                        details,
                        entity as section,
                        entity_id as question_id
                    FROM AuditLog
                    WHERE id = @logId AND action LIKE 'CHECKLIST_%'
                `);

            if (result.recordset.length === 0) {
                throw new Error(`Log entry ${logId} not found`);
            }

            const row = result.recordset[0];
            const details = JSON.parse(row.details);

            await pool.close();
            
            return {
                section: row.section,
                questionId: row.question_id,
                beforeState: details.beforeState || {},
                action: details.action
            };

        } catch (error) {
            console.error('❌ Error fetching rollback data:', error);
            throw error;
        }
    }

    /**
     * Compare two states and return differences
     * @param {Object} oldState - Previous state
     * @param {Object} newState - Current state
     * @returns {Object} Differences
     */
    compareStates(oldState, newState) {
        const differences = {};

        const allKeys = new Set([
            ...Object.keys(oldState || {}),
            ...Object.keys(newState || {})
        ]);

        allKeys.forEach(key => {
            const oldVal = oldState[key];
            const newVal = newState[key];

            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                differences[key] = {
                    before: oldVal,
                    after: newVal
                };
            }
        });

        return differences;
    }
}

module.exports = VersionControlService;
