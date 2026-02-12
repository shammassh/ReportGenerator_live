/**
 * Database Inspector Service
 * Admin-only service for viewing real database data
 */

const sql = require('mssql');

const sqlConfig = {
    user: 'sa',
    password: 'Kokowawa123@@',
    database: 'FoodSafetyDB_Live',
    server: 'localhost',
    options: {
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

class DatabaseInspectorService {
    constructor() {
        this.pool = null;
    }

    async getPool() {
        if (!this.pool) {
            this.pool = await sql.connect(sqlConfig);
        }
        return this.pool;
    }

    /**
     * Compare Store Assignments: StoreManagerAssignments table vs Users.assigned_stores
     */
    async getStoreAssignmentsComparison() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            -- Get all store manager assignments from both sources
            SELECT 
                u.id AS user_id,
                u.display_name,
                u.email,
                u.role,
                s.StoreID,
                s.StoreName,
                s.StoreCode,
                CASE WHEN sma.AssignmentID IS NOT NULL THEN 'YES' ELSE 'NO' END AS in_assignments_table,
                CASE WHEN u.assigned_stores LIKE '%' + CAST(s.StoreID AS VARCHAR) + '%' THEN 'YES' ELSE 'NO' END AS in_json_column,
                CASE 
                    WHEN sma.AssignmentID IS NOT NULL AND u.assigned_stores LIKE '%' + CAST(s.StoreID AS VARCHAR) + '%' THEN 'MATCH'
                    WHEN sma.AssignmentID IS NOT NULL AND (u.assigned_stores IS NULL OR u.assigned_stores NOT LIKE '%' + CAST(s.StoreID AS VARCHAR) + '%') THEN 'TABLE ONLY'
                    WHEN sma.AssignmentID IS NULL AND u.assigned_stores LIKE '%' + CAST(s.StoreID AS VARCHAR) + '%' THEN 'JSON ONLY'
                    ELSE 'NONE'
                END AS comparison
            FROM Users u
            CROSS JOIN Stores s
            LEFT JOIN StoreManagerAssignments sma ON sma.UserID = u.id AND sma.StoreID = s.StoreID
            WHERE u.role IN ('StoreManager', 'DutyManager', 'DepartmentHead')
                AND (sma.AssignmentID IS NOT NULL OR u.assigned_stores LIKE '%' + CAST(s.StoreID AS VARCHAR) + '%')
            ORDER BY u.display_name, s.StoreName
        `);

        return {
            title: 'Store Assignments Comparison (Table vs JSON Column)',
            data: result.recordset,
            columns: ['display_name', 'email', 'role', 'StoreCode', 'StoreName', 'in_assignments_table', 'in_json_column', 'comparison']
        };
    }

    /**
     * Get all users with their roles and assignments
     */
    async getUsersAndRoles() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            SELECT 
                u.id,
                u.display_name,
                u.email,
                u.role,
                u.is_approved,
                u.assigned_stores AS assigned_stores_json,
                (SELECT COUNT(*) FROM StoreManagerAssignments WHERE UserID = u.id) AS stores_in_table,
                u.created_at,
                u.last_login
            FROM Users u
            ORDER BY 
                CASE u.role 
                    WHEN 'Admin' THEN 1 
                    WHEN 'SuperAuditor' THEN 2 
                    WHEN 'Auditor' THEN 3 
                    WHEN 'StoreManager' THEN 4 
                    WHEN 'DutyManager' THEN 5 
                    WHEN 'DepartmentHead' THEN 6 
                    ELSE 7 
                END,
                u.display_name
        `);

        return {
            title: 'All Users with Roles',
            data: result.recordset,
            columns: ['id', 'display_name', 'email', 'role', 'is_approved', 'assigned_stores_json', 'stores_in_table', 'created_at', 'last_login']
        };
    }

    /**
     * Get store managers grouped by store
     */
    async getStoreManagersByStore() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            SELECT 
                s.StoreID,
                s.StoreCode,
                s.StoreName,
                s.Brand,
                CASE WHEN sma.IsPrimary = 1 THEN 'Primary' ELSE 'Secondary' END AS assignment_type,
                u.display_name,
                u.email,
                u.role,
                sma.CreatedAt AS assigned_at
            FROM Stores s
            LEFT JOIN StoreManagerAssignments sma ON sma.StoreID = s.StoreID
            LEFT JOIN Users u ON u.id = sma.UserID
            ORDER BY s.Brand, s.StoreName, sma.IsPrimary DESC
        `);

        return {
            title: 'Store Manager Assignments by Store',
            data: result.recordset,
            columns: ['StoreCode', 'StoreName', 'Brand', 'assignment_type', 'display_name', 'email', 'role']
        };
    }

    /**
     * Get recent audits
     */
    async getRecentAudits() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            SELECT TOP 50
                ai.AuditID,
                ai.DocumentNumber,
                ai.StoreCode,
                ai.StoreName,
                ai.Status,
                ai.TotalScore,
                ai.Auditors AS auditor_name,
                ai.AuditDate,
                ai.CreatedAt,
                ai.CompletedAt
            FROM AuditInstances ai
            ORDER BY ai.CreatedAt DESC
        `);

        return {
            title: 'Recent Audits (Last 50)',
            data: result.recordset,
            columns: ['AuditID', 'DocumentNumber', 'StoreCode', 'StoreName', 'Status', 'TotalScore', 'auditor_name', 'AuditDate', 'CompletedAt']
        };
    }

    /**
     * Get notifications summary
     */
    async getNotificationsSummary() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            SELECT TOP 100
                n.id,
                n.document_number,
                n.recipient_email,
                n.recipient_name,
                n.notification_type,
                n.status,
                n.sent_at,
                n.sent_by_name,
                n.sent_by_email
            FROM Notifications n
            ORDER BY n.sent_at DESC
        `);

        return {
            title: 'Recent Notifications (Last 100)',
            data: result.recordset,
            columns: ['id', 'document_number', 'recipient_name', 'recipient_email', 'notification_type', 'status', 'sent_at', 'sent_by_name']
        };
    }

    /**
     * Get all stores
     */
    async getStoresList() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            SELECT 
                s.StoreID,
                s.StoreCode,
                s.StoreName,
                s.Brand,
                s.Location,
                s.IsActive,
                (SELECT COUNT(*) FROM StoreManagerAssignments WHERE StoreID = s.StoreID) AS manager_count,
                (SELECT COUNT(*) FROM AuditInstances WHERE StoreID = s.StoreID) AS audit_count
            FROM Stores s
            ORDER BY s.Brand, s.StoreName
        `);

        return {
            title: 'All Stores',
            data: result.recordset,
            columns: ['StoreID', 'StoreCode', 'StoreName', 'Brand', 'Location', 'IsActive', 'manager_count', 'audit_count']
        };
    }

    /**
     * Get schemas and sections
     */
    async getSchemasAndSections() {
        const pool = await this.getPool();
        
        // Check what schema-related tables exist
        const result = await pool.request().query(`
            SELECT 
                TABLE_NAME,
                (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) AS column_count
            FROM INFORMATION_SCHEMA.TABLES t
            WHERE TABLE_NAME LIKE '%Schema%' 
               OR TABLE_NAME LIKE '%Checklist%' 
               OR TABLE_NAME LIKE '%Section%'
               OR TABLE_NAME LIKE '%Template%'
            ORDER BY TABLE_NAME
        `);

        return {
            title: 'Schema/Template Related Tables in Database',
            data: result.recordset,
            columns: ['TABLE_NAME', 'column_count']
        };
    }

    /**
     * Get email recipients check - who would receive email for each store
     */
    async getEmailRecipientsCheck() {
        const pool = await this.getPool();
        
        const result = await pool.request().query(`
            SELECT 
                s.StoreID,
                s.StoreCode,
                s.StoreName,
                CASE WHEN sma.IsPrimary = 1 THEN 'Primary' ELSE 'Secondary' END AS assignment_type,
                u.display_name,
                u.email,
                u.role,
                u.is_approved,
                CASE WHEN u.is_approved = 1 THEN 'Will Receive' ELSE 'NOT APPROVED' END AS email_status
            FROM Stores s
            LEFT JOIN StoreManagerAssignments sma ON sma.StoreID = s.StoreID
            LEFT JOIN Users u ON u.id = sma.UserID
            WHERE sma.AssignmentID IS NOT NULL
            ORDER BY s.Brand, s.StoreName, sma.IsPrimary DESC
        `);

        return {
            title: 'Email Recipients by Store (Who Will Receive Notifications)',
            data: result.recordset,
            columns: ['StoreCode', 'StoreName', 'assignment_type', 'display_name', 'email', 'role', 'is_approved', 'email_status']
        };
    }

    /**
     * Execute a specific query by type
     */
    async executeQuery(queryType) {
        switch (queryType) {
            case 'store_assignments':
                return await this.getStoreAssignmentsComparison();
            case 'users_roles':
                return await this.getUsersAndRoles();
            case 'store_managers_by_store':
                return await this.getStoreManagersByStore();
            case 'recent_audits':
                return await this.getRecentAudits();
            case 'notifications_summary':
                return await this.getNotificationsSummary();
            case 'stores_list':
                return await this.getStoresList();
            case 'schemas_sections':
                return await this.getSchemasAndSections();
            case 'email_recipients_check':
                return await this.getEmailRecipientsCheck();
            default:
                throw new Error(`Unknown query type: ${queryType}`);
        }
    }
}

module.exports = new DatabaseInspectorService();
