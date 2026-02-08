/**
 * Activity Log Service
 * Lightweight logging for key user actions only
 * Auto-cleanup: 90 days retention
 * ~500 bytes per entry, estimated 30MB/month max
 */

const sql = require('mssql');

// Action types - only log important events
const ACTION_TYPES = {
    // Authentication
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    LOGIN_FAILED: 'LOGIN_FAILED',
    
    // Reports
    REPORT_GENERATED: 'REPORT_GENERATED',
    REPORT_EXPORTED: 'REPORT_EXPORTED',
    
    // Emails
    EMAIL_SENT: 'EMAIL_SENT',
    BROADCAST_SENT: 'BROADCAST_SENT',
    
    // Action Plans
    ACTION_PLAN_SAVED: 'ACTION_PLAN_SAVED',
    ACTION_PLAN_SUBMITTED: 'ACTION_PLAN_SUBMITTED',
    
    // Admin actions
    USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
    USER_APPROVED: 'USER_APPROVED',
    USER_REJECTED: 'USER_REJECTED',
    
    // Templates
    TEMPLATE_UPDATED: 'TEMPLATE_UPDATED',
    TEMPLATE_CREATED: 'TEMPLATE_CREATED',
    
    // Audits
    AUDIT_STARTED: 'AUDIT_STARTED',
    AUDIT_COMPLETED: 'AUDIT_COMPLETED'
};

const ACTION_CATEGORIES = {
    AUTH: 'AUTH',
    REPORT: 'REPORT',
    EMAIL: 'EMAIL',
    ACTION_PLAN: 'ACTION_PLAN',
    ADMIN: 'ADMIN',
    TEMPLATE: 'TEMPLATE',
    AUDIT: 'AUDIT'
};

// Map action types to categories
const ACTION_TO_CATEGORY = {
    LOGIN: 'AUTH',
    LOGOUT: 'AUTH',
    LOGIN_FAILED: 'AUTH',
    REPORT_GENERATED: 'REPORT',
    REPORT_EXPORTED: 'REPORT',
    EMAIL_SENT: 'EMAIL',
    BROADCAST_SENT: 'EMAIL',
    ACTION_PLAN_SAVED: 'ACTION_PLAN',
    ACTION_PLAN_SUBMITTED: 'ACTION_PLAN',
    USER_ROLE_CHANGED: 'ADMIN',
    USER_APPROVED: 'ADMIN',
    USER_REJECTED: 'ADMIN',
    TEMPLATE_UPDATED: 'TEMPLATE',
    TEMPLATE_CREATED: 'TEMPLATE',
    AUDIT_STARTED: 'AUDIT',
    AUDIT_COMPLETED: 'AUDIT'
};

class ActivityLogService {
    constructor() {
        this.dbConfig = {
            server: 'localhost',
            database: 'FoodSafetyDB_Live',
            user: 'sa',
            password: 'Kokowawa123@@',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };
        this.pool = null;
    }

    async getPool() {
        if (!this.pool) {
            this.pool = await sql.connect(this.dbConfig);
        }
        return this.pool;
    }

    /**
     * Log an activity - lightweight, fire-and-forget
     * @param {Object} params
     * @param {string} params.actionType - One of ACTION_TYPES
     * @param {string} params.description - Human readable description
     * @param {Object} params.user - User object (id, email, name)
     * @param {string} params.targetType - Type of target (document, user, template)
     * @param {string} params.targetId - ID of target
     * @param {Object} params.metadata - Additional JSON data
     * @param {Object} params.req - Express request object for IP/user-agent
     */
    async log({ actionType, description, user, targetType, targetId, metadata, req }) {
        try {
            const pool = await this.getPool();
            const category = ACTION_TO_CATEGORY[actionType] || 'OTHER';
            
            // Extract IP and user agent from request
            let ipAddress = null;
            let userAgent = null;
            if (req) {
                ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip;
                userAgent = req.headers['user-agent']?.substring(0, 500);
            }

            await pool.request()
                .input('user_id', sql.Int, user?.id || null)
                .input('user_email', sql.NVarChar(255), user?.email || null)
                .input('user_name', sql.NVarChar(255), user?.displayName || user?.name || null)
                .input('action_type', sql.NVarChar(50), actionType)
                .input('action_category', sql.NVarChar(50), category)
                .input('description', sql.NVarChar(500), description?.substring(0, 500) || null)
                .input('target_type', sql.NVarChar(50), targetType || null)
                .input('target_id', sql.NVarChar(100), targetId || null)
                .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
                .input('ip_address', sql.NVarChar(45), ipAddress)
                .input('user_agent', sql.NVarChar(500), userAgent)
                .query(`
                    INSERT INTO ActivityLog 
                    (user_id, user_email, user_name, action_type, action_category, description, 
                     target_type, target_id, metadata, ip_address, user_agent)
                    VALUES 
                    (@user_id, @user_email, @user_name, @action_type, @action_category, @description,
                     @target_type, @target_id, @metadata, @ip_address, @user_agent)
                `);
        } catch (error) {
            // Don't let logging errors affect the main application
            console.error('[ActivityLog] Failed to log activity:', error.message);
        }
    }

    /**
     * Get activity logs with pagination and filters
     * @param {Object} options
     * @param {number} options.page - Page number (1-based)
     * @param {number} options.pageSize - Items per page (default 50, max 100)
     * @param {string} options.actionType - Filter by action type
     * @param {string} options.category - Filter by category
     * @param {number} options.userId - Filter by user ID
     * @param {string} options.search - Search in description
     * @param {Date} options.startDate - Filter from date
     * @param {Date} options.endDate - Filter to date
     */
    async getLogs({ page = 1, pageSize = 50, actionType, category, userId, search, startDate, endDate }) {
        try {
            const pool = await this.getPool();
            
            // Cap page size
            pageSize = Math.min(pageSize, 100);
            const offset = (page - 1) * pageSize;

            let whereConditions = [];
            const request = pool.request();

            if (actionType) {
                whereConditions.push('action_type = @actionType');
                request.input('actionType', sql.NVarChar(50), actionType);
            }

            if (category) {
                whereConditions.push('action_category = @category');
                request.input('category', sql.NVarChar(50), category);
            }

            if (userId) {
                whereConditions.push('user_id = @userId');
                request.input('userId', sql.Int, userId);
            }

            if (search) {
                whereConditions.push('(description LIKE @search OR user_email LIKE @search OR user_name LIKE @search)');
                request.input('search', sql.NVarChar(255), `%${search}%`);
            }

            if (startDate) {
                whereConditions.push('created_at >= @startDate');
                request.input('startDate', sql.DateTime2, new Date(startDate));
            }

            if (endDate) {
                whereConditions.push('created_at <= @endDate');
                request.input('endDate', sql.DateTime2, new Date(endDate));
            }

            const whereClause = whereConditions.length > 0 
                ? 'WHERE ' + whereConditions.join(' AND ') 
                : '';

            // Get total count
            const countResult = await request.query(`
                SELECT COUNT(*) as total FROM ActivityLog ${whereClause}
            `);
            const total = countResult.recordset[0].total;

            // Get paginated results
            const dataRequest = pool.request();
            // Re-add inputs for data query
            if (actionType) dataRequest.input('actionType', sql.NVarChar(50), actionType);
            if (category) dataRequest.input('category', sql.NVarChar(50), category);
            if (userId) dataRequest.input('userId', sql.Int, userId);
            if (search) dataRequest.input('search', sql.NVarChar(255), `%${search}%`);
            if (startDate) dataRequest.input('startDate', sql.DateTime2, new Date(startDate));
            if (endDate) dataRequest.input('endDate', sql.DateTime2, new Date(endDate));
            
            dataRequest.input('offset', sql.Int, offset);
            dataRequest.input('pageSize', sql.Int, pageSize);

            const dataResult = await dataRequest.query(`
                SELECT id, user_id, user_email, user_name, action_type, action_category,
                       description, target_type, target_id, metadata, ip_address, 
                       created_at
                FROM ActivityLog 
                ${whereClause}
                ORDER BY created_at DESC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            `);

            return {
                logs: dataResult.recordset.map(row => ({
                    ...row,
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                })),
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            };
        } catch (error) {
            console.error('[ActivityLog] Failed to get logs:', error.message);
            throw error;
        }
    }

    /**
     * Get activity summary statistics
     */
    async getStats() {
        try {
            const pool = await this.getPool();
            
            // Get counts by category for last 7 days
            const result = await pool.request().query(`
                SELECT 
                    action_category,
                    COUNT(*) as count
                FROM ActivityLog
                WHERE created_at >= DATEADD(DAY, -7, GETDATE())
                GROUP BY action_category
                ORDER BY count DESC;

                SELECT COUNT(*) as total_today 
                FROM ActivityLog 
                WHERE created_at >= CAST(GETDATE() AS DATE);

                SELECT COUNT(*) as total_week 
                FROM ActivityLog 
                WHERE created_at >= DATEADD(DAY, -7, GETDATE());

                SELECT COUNT(*) as total_all 
                FROM ActivityLog;

                SELECT TOP 5 user_email, user_name, COUNT(*) as action_count
                FROM ActivityLog
                WHERE created_at >= DATEADD(DAY, -7, GETDATE())
                AND user_email IS NOT NULL
                GROUP BY user_email, user_name
                ORDER BY action_count DESC;
            `);

            return {
                byCategory: result.recordsets[0],
                totalToday: result.recordsets[1][0]?.total_today || 0,
                totalWeek: result.recordsets[2][0]?.total_week || 0,
                totalAll: result.recordsets[3][0]?.total_all || 0,
                topUsers: result.recordsets[4]
            };
        } catch (error) {
            console.error('[ActivityLog] Failed to get stats:', error.message);
            throw error;
        }
    }

    /**
     * Run cleanup - delete logs older than retention period
     * @param {number} retentionDays - Days to keep (default 90)
     */
    async cleanup(retentionDays = 90) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('retentionDays', sql.Int, retentionDays)
                .execute('sp_CleanupActivityLog');
            
            console.log(`[ActivityLog] Cleanup completed: ${result.recordset[0].DeletedRows} rows deleted`);
            return result.recordset[0];
        } catch (error) {
            console.error('[ActivityLog] Cleanup failed:', error.message);
            throw error;
        }
    }

    /**
     * Get distinct users who have activity
     */
    async getActiveUsers() {
        try {
            const pool = await this.getPool();
            const result = await pool.request().query(`
                SELECT DISTINCT user_id, user_email, user_name
                FROM ActivityLog
                WHERE user_id IS NOT NULL
                ORDER BY user_name
            `);
            return result.recordset;
        } catch (error) {
            console.error('[ActivityLog] Failed to get active users:', error.message);
            throw error;
        }
    }
}

// Export singleton instance and constants
const activityLogService = new ActivityLogService();

module.exports = {
    activityLogService,
    ACTION_TYPES,
    ACTION_CATEGORIES,
    
    // Convenience methods for common logging
    logLogin: (user, req) => activityLogService.log({
        actionType: ACTION_TYPES.LOGIN,
        description: `User logged in`,
        user,
        req
    }),
    
    logLogout: (user, req) => activityLogService.log({
        actionType: ACTION_TYPES.LOGOUT,
        description: `User logged out`,
        user,
        req
    }),
    
    logReportGenerated: (user, documentNumber, storeName, req) => activityLogService.log({
        actionType: ACTION_TYPES.REPORT_GENERATED,
        description: `Generated report for ${storeName}`,
        user,
        targetType: 'document',
        targetId: documentNumber,
        metadata: { storeName },
        req
    }),
    
    logEmailSent: (user, recipients, subject, req) => activityLogService.log({
        actionType: ACTION_TYPES.EMAIL_SENT,
        description: `Sent email: ${subject?.substring(0, 100)}`,
        user,
        targetType: 'email',
        metadata: { recipients: recipients?.length || 0, subject },
        req
    }),
    
    logBroadcast: (user, recipientCount, subject, req) => activityLogService.log({
        actionType: ACTION_TYPES.BROADCAST_SENT,
        description: `Broadcast to ${recipientCount} recipients: ${subject?.substring(0, 50)}`,
        user,
        targetType: 'broadcast',
        metadata: { recipientCount, subject },
        req
    }),
    
    logActionPlanSaved: (user, documentNumber, itemCount, req) => activityLogService.log({
        actionType: ACTION_TYPES.ACTION_PLAN_SAVED,
        description: `Saved action plan with ${itemCount} items`,
        user,
        targetType: 'document',
        targetId: documentNumber,
        metadata: { itemCount },
        req
    }),
    
    logActionPlanSubmitted: (user, documentNumber, req) => activityLogService.log({
        actionType: ACTION_TYPES.ACTION_PLAN_SUBMITTED,
        description: `Submitted action plan for review`,
        user,
        targetType: 'document',
        targetId: documentNumber,
        req
    }),
    
    logUserRoleChanged: (admin, targetUser, oldRole, newRole, req) => activityLogService.log({
        actionType: ACTION_TYPES.USER_ROLE_CHANGED,
        description: `Changed ${targetUser.email} role: ${oldRole} → ${newRole}`,
        user: admin,
        targetType: 'user',
        targetId: String(targetUser.id),
        metadata: { targetEmail: targetUser.email, oldRole, newRole },
        req
    }),
    
    logTemplateUpdated: (user, templateKey, req) => activityLogService.log({
        actionType: ACTION_TYPES.TEMPLATE_UPDATED,
        description: `Updated email template: ${templateKey}`,
        user,
        targetType: 'template',
        targetId: templateKey,
        req
    })
};
