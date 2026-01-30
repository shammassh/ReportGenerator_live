/**
 * System Settings Service
 * Manages passing grades for schemas, sections, and templates
 */

const sql = require('mssql');

class SystemSettingsService {
    constructor() {
        this.pool = null;
        this.config = {
            server: 'PowerApps-Repor',
            database: 'FoodSafetyDB',
            user: 'sa',
            password: 'Kokowawa123@@',
            options: {
                encrypt: false,
                trustServerCertificate: true
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
     * Get all schemas with their settings
     */
    async getSchemasWithSettings() {
        try {
            const pool = await this.getPool();
            
            // Get all schemas
            const schemasResult = await pool.request().query(`
                SELECT SchemaID, SchemaName, Description, IsActive
                FROM AuditSchemas
                WHERE IsActive = 1
                ORDER BY SchemaName
            `);

            const schemas = schemasResult.recordset;

            // Get settings for each schema
            for (const schema of schemas) {
                // Get overall passing grade
                const overallResult = await pool.request()
                    .input('SchemaID', sql.Int, schema.SchemaID)
                    .query(`
                        SELECT PassingGrade 
                        FROM SystemSettings 
                        WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                    `);
                schema.overallPassingGrade = overallResult.recordset[0]?.PassingGrade || 83;

                // Get sections for this schema
                const sectionsResult = await pool.request()
                    .input('SchemaID', sql.Int, schema.SchemaID)
                    .query(`
                        SELECT s.SectionID, s.SectionName, s.SectionNumber, s.SectionIcon,
                               ISNULL(ss.PassingGrade, 83) as PassingGrade
                        FROM AuditSections s
                        LEFT JOIN SystemSettings ss ON ss.SchemaID = s.SchemaID 
                            AND ss.SettingType = 'Section' 
                            AND ss.EntityID = s.SectionID
                        WHERE s.SchemaID = @SchemaID AND s.IsActive = 1
                        ORDER BY s.SectionNumber
                    `);
                schema.sections = sectionsResult.recordset;
            }

            return schemas;
        } catch (error) {
            console.error('Error getting schemas with settings:', error);
            throw error;
        }
    }

    /**
     * Get settings for a specific schema
     */
    async getSchemaSettings(schemaId) {
        try {
            const pool = await this.getPool();

            // Get schema info
            const schemaResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT SchemaID, SchemaName, Description
                    FROM AuditSchemas WHERE SchemaID = @SchemaID
                `);

            if (schemaResult.recordset.length === 0) {
                throw new Error('Schema not found');
            }

            const schema = schemaResult.recordset[0];

            // Get overall passing grade
            const overallResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT PassingGrade 
                    FROM SystemSettings 
                    WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                `);
            schema.overallPassingGrade = overallResult.recordset[0]?.PassingGrade || 83;

            // Get section settings
            const sectionsResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT s.SectionID, s.SectionName, s.SectionNumber, s.SectionIcon,
                           ISNULL(ss.PassingGrade, 83) as PassingGrade
                    FROM AuditSections s
                    LEFT JOIN SystemSettings ss ON ss.SchemaID = s.SchemaID 
                        AND ss.SettingType = 'Section' 
                        AND ss.EntityID = s.SectionID
                    WHERE s.SchemaID = @SchemaID AND s.IsActive = 1
                    ORDER BY s.SectionNumber
                `);
            schema.sections = sectionsResult.recordset;

            return schema;
        } catch (error) {
            console.error('Error getting schema settings:', error);
            throw error;
        }
    }

    /**
     * Save overall passing grade for a schema
     */
    async saveOverallPassingGrade(schemaId, passingGrade, updatedBy) {
        try {
            const pool = await this.getPool();

            // Check if setting exists
            const existingResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT SettingID FROM SystemSettings 
                    WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                `);

            if (existingResult.recordset.length > 0) {
                // Update existing
                await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('PassingGrade', sql.Int, passingGrade)
                    .input('UpdatedBy', sql.NVarChar, updatedBy)
                    .query(`
                        UPDATE SystemSettings 
                        SET PassingGrade = @PassingGrade, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
                        WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                    `);
            } else {
                // Insert new
                await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('PassingGrade', sql.Int, passingGrade)
                    .input('UpdatedBy', sql.NVarChar, updatedBy)
                    .query(`
                        INSERT INTO SystemSettings (SchemaID, SettingType, PassingGrade, UpdatedBy)
                        VALUES (@SchemaID, 'Overall', @PassingGrade, @UpdatedBy)
                    `);
            }

            return { success: true };
        } catch (error) {
            console.error('Error saving overall passing grade:', error);
            throw error;
        }
    }

    /**
     * Save section passing grade
     */
    async saveSectionPassingGrade(schemaId, sectionId, sectionName, passingGrade, updatedBy) {
        try {
            const pool = await this.getPool();

            // Check if setting exists
            const existingResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .input('SectionID', sql.Int, sectionId)
                .query(`
                    SELECT SettingID FROM SystemSettings 
                    WHERE SchemaID = @SchemaID AND SettingType = 'Section' AND EntityID = @SectionID
                `);

            if (existingResult.recordset.length > 0) {
                // Update existing
                await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('SectionID', sql.Int, sectionId)
                    .input('PassingGrade', sql.Int, passingGrade)
                    .input('UpdatedBy', sql.NVarChar, updatedBy)
                    .query(`
                        UPDATE SystemSettings 
                        SET PassingGrade = @PassingGrade, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
                        WHERE SchemaID = @SchemaID AND SettingType = 'Section' AND EntityID = @SectionID
                    `);
            } else {
                // Insert new
                await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('SectionID', sql.Int, sectionId)
                    .input('SectionName', sql.NVarChar, sectionName)
                    .input('PassingGrade', sql.Int, passingGrade)
                    .input('UpdatedBy', sql.NVarChar, updatedBy)
                    .query(`
                        INSERT INTO SystemSettings (SchemaID, SettingType, EntityID, EntityName, PassingGrade, UpdatedBy)
                        VALUES (@SchemaID, 'Section', @SectionID, @SectionName, @PassingGrade, @UpdatedBy)
                    `);
            }

            return { success: true };
        } catch (error) {
            console.error('Error saving section passing grade:', error);
            throw error;
        }
    }

    /**
     * Bulk save all settings for a schema
     */
    async saveSchemaSettings(schemaId, settings, updatedBy) {
        try {
            const pool = await this.getPool();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Save overall passing grade
                if (settings.overallPassingGrade !== undefined) {
                    const existingResult = await transaction.request()
                        .input('SchemaID', sql.Int, schemaId)
                        .query(`
                            SELECT SettingID FROM SystemSettings 
                            WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                        `);

                    if (existingResult.recordset.length > 0) {
                        await transaction.request()
                            .input('SchemaID', sql.Int, schemaId)
                            .input('PassingGrade', sql.Int, settings.overallPassingGrade)
                            .input('UpdatedBy', sql.NVarChar, updatedBy)
                            .query(`
                                UPDATE SystemSettings 
                                SET PassingGrade = @PassingGrade, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
                                WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                            `);
                    } else {
                        await transaction.request()
                            .input('SchemaID', sql.Int, schemaId)
                            .input('PassingGrade', sql.Int, settings.overallPassingGrade)
                            .input('UpdatedBy', sql.NVarChar, updatedBy)
                            .query(`
                                INSERT INTO SystemSettings (SchemaID, SettingType, PassingGrade, UpdatedBy)
                                VALUES (@SchemaID, 'Overall', @PassingGrade, @UpdatedBy)
                            `);
                    }
                }

                // Save section passing grades
                if (settings.sections && Array.isArray(settings.sections)) {
                    for (const section of settings.sections) {
                        const existingResult = await transaction.request()
                            .input('SchemaID', sql.Int, schemaId)
                            .input('SectionID', sql.Int, section.sectionId)
                            .query(`
                                SELECT SettingID FROM SystemSettings 
                                WHERE SchemaID = @SchemaID AND SettingType = 'Section' AND EntityID = @SectionID
                            `);

                        if (existingResult.recordset.length > 0) {
                            await transaction.request()
                                .input('SchemaID', sql.Int, schemaId)
                                .input('SectionID', sql.Int, section.sectionId)
                                .input('PassingGrade', sql.Int, section.passingGrade)
                                .input('UpdatedBy', sql.NVarChar, updatedBy)
                                .query(`
                                    UPDATE SystemSettings 
                                    SET PassingGrade = @PassingGrade, UpdatedAt = GETDATE(), UpdatedBy = @UpdatedBy
                                    WHERE SchemaID = @SchemaID AND SettingType = 'Section' AND EntityID = @SectionID
                                `);
                        } else {
                            await transaction.request()
                                .input('SchemaID', sql.Int, schemaId)
                                .input('SectionID', sql.Int, section.sectionId)
                                .input('SectionName', sql.NVarChar, section.sectionName)
                                .input('PassingGrade', sql.Int, section.passingGrade)
                                .input('UpdatedBy', sql.NVarChar, updatedBy)
                                .query(`
                                    INSERT INTO SystemSettings (SchemaID, SettingType, EntityID, EntityName, PassingGrade, UpdatedBy)
                                    VALUES (@SchemaID, 'Section', @SectionID, @SectionName, @PassingGrade, @UpdatedBy)
                                `);
                        }
                    }
                }

                await transaction.commit();
                return { success: true };
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Error saving schema settings:', error);
            throw error;
        }
    }

    /**
     * Get passing grade for scoring (used during audit completion)
     */
    async getPassingGradeForScoring(schemaId, sectionId = null) {
        try {
            const pool = await this.getPool();

            if (sectionId) {
                // Get section-specific passing grade
                const result = await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('SectionID', sql.Int, sectionId)
                    .query(`
                        SELECT PassingGrade FROM SystemSettings 
                        WHERE SchemaID = @SchemaID AND SettingType = 'Section' AND EntityID = @SectionID
                    `);
                return result.recordset[0]?.PassingGrade || 83;
            } else {
                // Get overall passing grade
                const result = await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .query(`
                        SELECT PassingGrade FROM SystemSettings 
                        WHERE SchemaID = @SchemaID AND SettingType = 'Overall'
                    `);
                return result.recordset[0]?.PassingGrade || 83;
            }
        } catch (error) {
            console.error('Error getting passing grade:', error);
            return 83; // Default fallback
        }
    }
}

module.exports = new SystemSettingsService();
