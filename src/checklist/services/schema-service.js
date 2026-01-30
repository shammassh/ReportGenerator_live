/**
 * Schema Service
 * Handles CRUD operations for audit schemas
 * @module checklist/services/schema-service
 */

const sql = require('mssql');

class SchemaService {
    constructor() {
        this.pool = null;
        this.config = {
            server: process.env.SQL_SERVER || 'PowerApps-Repor',
            database: process.env.SQL_DATABASE || 'FoodSafetyDB',
            user: process.env.SQL_USER || 'sa',
            password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
            options: {
                encrypt: process.env.SQL_ENCRYPT === 'true' || false,
                trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== 'false'
            }
        };
    }

    async getPool() {
        if (!this.pool) {
            this.pool = await sql.connect(this.config);
        }
        return this.pool;
    }

    /**
     * Get all active schemas with section counts
     */
    async getSchemas() {
        try {
            const pool = await this.getPool();
            
            const result = await pool.request().query(`
                SELECT 
                    s.SchemaID as schemaId,
                    s.SchemaName as schemaName,
                    s.Description as description,
                    s.CreatedBy as createdBy,
                    s.CreatedDate as createdAt,
                    s.IsActive as isActive,
                    (SELECT COUNT(*) FROM AuditSections WHERE SchemaID = s.SchemaID AND IsActive = 1) as sectionCount
                FROM AuditSchemas s
                WHERE s.IsActive = 1
                ORDER BY s.SchemaName
            `);

            return result.recordset;
        } catch (error) {
            console.error('Error fetching schemas:', error);
            throw error;
        }
    }

    /**
     * Get schema by ID
     */
    async getSchemaById(schemaId) {
        try {
            const pool = await this.getPool();
            
            const result = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT 
                        SchemaID as schemaId,
                        SchemaName as schemaName,
                        Description as description,
                        CreatedBy as createdBy,
                        CreatedDate as createdAt,
                        IsActive as isActive
                    FROM AuditSchemas
                    WHERE SchemaID = @SchemaID
                `);

            if (result.recordset.length === 0) {
                throw new Error('Schema not found');
            }

            return result.recordset[0];
        } catch (error) {
            console.error('Error fetching schema:', error);
            throw error;
        }
    }

    /**
     * Create a new schema
     */
    async createSchema(schemaName, description, createdBy) {
        try {
            const pool = await this.getPool();
            
            const result = await pool.request()
                .input('SchemaName', sql.NVarChar(255), schemaName)
                .input('Description', sql.NVarChar(500), description || '')
                .input('CreatedBy', sql.NVarChar(255), createdBy || 'System')
                .query(`
                    INSERT INTO AuditSchemas (SchemaName, Description, CreatedBy, IsActive)
                    OUTPUT INSERTED.SchemaID as schemaId, 
                           INSERTED.SchemaName as schemaName, 
                           INSERTED.Description as description,
                           INSERTED.CreatedBy as createdBy,
                           INSERTED.CreatedDate as createdAt
                    VALUES (@SchemaName, @Description, @CreatedBy, 1)
                `);

            return {
                success: true,
                message: 'Schema created successfully',
                data: result.recordset[0]
            };
        } catch (error) {
            console.error('Error creating schema:', error);
            throw error;
        }
    }

    /**
     * Update an existing schema
     */
    async updateSchema(schemaId, schemaName, description, updatedBy) {
        try {
            const pool = await this.getPool();
            
            // Check if schema exists
            const checkResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`SELECT SchemaID FROM AuditSchemas WHERE SchemaID = @SchemaID`);

            if (checkResult.recordset.length === 0) {
                throw new Error('Schema not found');
            }

            // Update the schema
            const result = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .input('SchemaName', sql.NVarChar(255), schemaName)
                .input('Description', sql.NVarChar(500), description || '')
                .input('ModifiedBy', sql.NVarChar(255), updatedBy || 'System')
                .query(`
                    UPDATE AuditSchemas 
                    SET SchemaName = @SchemaName,
                        Description = @Description,
                        ModifiedDate = GETDATE(),
                        ModifiedBy = @ModifiedBy
                    OUTPUT INSERTED.SchemaID as schemaId, 
                           INSERTED.SchemaName as schemaName, 
                           INSERTED.Description as description
                    WHERE SchemaID = @SchemaID
                `);

            return {
                success: true,
                message: 'Schema updated successfully',
                data: result.recordset[0]
            };
        } catch (error) {
            console.error('Error updating schema:', error);
            throw error;
        }
    }

    /**
     * Deactivate a schema (soft delete)
     */
    async deactivateSchema(schemaId, deactivatedBy) {
        try {
            const pool = await this.getPool();
            
            // Check if schema exists
            const checkResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`SELECT SchemaID, SchemaName FROM AuditSchemas WHERE SchemaID = @SchemaID`);

            if (checkResult.recordset.length === 0) {
                throw new Error('Schema not found');
            }

            const schemaName = checkResult.recordset[0].SchemaName;

            // Deactivate the schema
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .input('ModifiedBy', sql.NVarChar(255), deactivatedBy || 'System')
                .query(`
                    UPDATE AuditSchemas 
                    SET IsActive = 0,
                        ModifiedDate = GETDATE(),
                        ModifiedBy = @ModifiedBy
                    WHERE SchemaID = @SchemaID
                `);

            // Also deactivate all sections belonging to this schema
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    UPDATE AuditSections 
                    SET IsActive = 0
                    WHERE SchemaID = @SchemaID
                `);

            return {
                success: true,
                message: `Schema "${schemaName}" deactivated successfully`
            };
        } catch (error) {
            console.error('Error deactivating schema:', error);
            throw error;
        }
    }
}

module.exports = SchemaService;
