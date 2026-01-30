/**
 * Schema Colors Service
 * Manages color schemes for different audit schemas
 */

const sql = require('mssql');

class SchemaColorsService {
    constructor(pool = null) {
        this.pool = pool;
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
        
        // Default colors used when no schema-specific colors are defined
        this.defaultColors = {
            passColor: '#10b981',           // Green for pass
            failColor: '#ef4444',           // Red for fail
            categoryPassColor: '#22c55e',   // Category pass green
            categoryFailColor: '#f87171',   // Category fail red
            headerBackgroundColor: '#1e3a5f', // Dark blue header
            headerTextColor: '#ffffff',     // White header text
            bannerPassBackground: '#10b981', // Green banner for pass
            bannerPassText: '#ffffff',      // White text on pass banner
            bannerFailBackground: '#ef4444', // Red banner for fail
            bannerFailText: '#ffffff',      // White text on fail banner
            sectionHeaderBackground: '#f3f4f6', // Light gray section headers
            sectionBorderColor: '#e5e7eb',  // Border color
            chartPassColor: '#10b981',      // Chart pass color
            chartFailColor: '#ef4444',      // Chart fail color
            chartCategoryPassColor: '#22c55e', // Chart category pass
            chartCategoryFailColor: '#f87171', // Chart category fail
            accentColor: '#3b82f6'          // Accent blue
        };
    }

    setPool(pool) {
        this.pool = pool;
    }

    async getPool() {
        if (!this.pool) {
            this.pool = await sql.connect(this.config);
        }
        return this.pool;
    }

    /**
     * Get colors for a specific schema
     * @param {number} schemaId - The schema ID
     * @returns {Object} Color configuration object
     */
    async getSchemaColors(schemaId) {
        try {
            const pool = await this.getPool();
            
            // Check if SchemaColors table exists
            const tableCheck = await pool.request().query(`
                SELECT COUNT(*) as cnt 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'SchemaColors'
            `);
            
            if (tableCheck.recordset[0].cnt === 0) {
                // Table doesn't exist, return default colors
                console.log('SchemaColors table not found, using default colors');
                return this.defaultColors;
            }
            
            // Try to get schema-specific colors
            const result = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT 
                        PassColor, FailColor,
                        CategoryPassColor, CategoryFailColor,
                        HeaderBackgroundColor, HeaderTextColor,
                        BannerPassBackground, BannerPassText,
                        BannerFailBackground, BannerFailText,
                        SectionHeaderBackground, SectionBorderColor,
                        ChartPassColor, ChartFailColor,
                        ChartCategoryPassColor, ChartCategoryFailColor,
                        AccentColor
                    FROM SchemaColors 
                    WHERE SchemaID = @SchemaID
                `);
            
            if (result.recordset.length === 0) {
                // No schema-specific colors, return defaults
                return this.defaultColors;
            }
            
            const row = result.recordset[0];
            
            // Map database columns to camelCase properties, with fallback to defaults
            return {
                passColor: row.PassColor || this.defaultColors.passColor,
                failColor: row.FailColor || this.defaultColors.failColor,
                categoryPassColor: row.CategoryPassColor || this.defaultColors.categoryPassColor,
                categoryFailColor: row.CategoryFailColor || this.defaultColors.categoryFailColor,
                headerBackgroundColor: row.HeaderBackgroundColor || this.defaultColors.headerBackgroundColor,
                headerTextColor: row.HeaderTextColor || this.defaultColors.headerTextColor,
                bannerPassBackground: row.BannerPassBackground || this.defaultColors.bannerPassBackground,
                bannerPassText: row.BannerPassText || this.defaultColors.bannerPassText,
                bannerFailBackground: row.BannerFailBackground || this.defaultColors.bannerFailBackground,
                bannerFailText: row.BannerFailText || this.defaultColors.bannerFailText,
                sectionHeaderBackground: row.SectionHeaderBackground || this.defaultColors.sectionHeaderBackground,
                sectionBorderColor: row.SectionBorderColor || this.defaultColors.sectionBorderColor,
                chartPassColor: row.ChartPassColor || this.defaultColors.chartPassColor,
                chartFailColor: row.ChartFailColor || this.defaultColors.chartFailColor,
                chartCategoryPassColor: row.ChartCategoryPassColor || this.defaultColors.chartCategoryPassColor,
                chartCategoryFailColor: row.ChartCategoryFailColor || this.defaultColors.chartCategoryFailColor,
                accentColor: row.AccentColor || this.defaultColors.accentColor
            };
        } catch (error) {
            console.error('Error fetching schema colors:', error.message);
            // Return default colors on error
            return this.defaultColors;
        }
    }

    /**
     * Save colors for a specific schema
     * @param {number} schemaId - The schema ID
     * @param {Object} colors - Color configuration object
     */
    async saveSchemaColors(schemaId, colors) {
        try {
            const pool = await this.getPool();
            
            // Ensure SchemaColors table exists
            await this.ensureTableExists();
            
            // Check if record exists
            const existsResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query('SELECT COUNT(*) as cnt FROM SchemaColors WHERE SchemaID = @SchemaID');
            
            if (existsResult.recordset[0].cnt > 0) {
                // Update existing record
                await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('PassColor', sql.NVarChar(20), colors.passColor)
                    .input('FailColor', sql.NVarChar(20), colors.failColor)
                    .input('CategoryPassColor', sql.NVarChar(20), colors.categoryPassColor)
                    .input('CategoryFailColor', sql.NVarChar(20), colors.categoryFailColor)
                    .input('HeaderBackgroundColor', sql.NVarChar(20), colors.headerBackgroundColor)
                    .input('HeaderTextColor', sql.NVarChar(20), colors.headerTextColor)
                    .input('BannerPassBackground', sql.NVarChar(20), colors.bannerPassBackground)
                    .input('BannerPassText', sql.NVarChar(20), colors.bannerPassText)
                    .input('BannerFailBackground', sql.NVarChar(20), colors.bannerFailBackground)
                    .input('BannerFailText', sql.NVarChar(20), colors.bannerFailText)
                    .input('SectionHeaderBackground', sql.NVarChar(20), colors.sectionHeaderBackground)
                    .input('SectionBorderColor', sql.NVarChar(20), colors.sectionBorderColor)
                    .input('ChartPassColor', sql.NVarChar(20), colors.chartPassColor)
                    .input('ChartFailColor', sql.NVarChar(20), colors.chartFailColor)
                    .input('ChartCategoryPassColor', sql.NVarChar(20), colors.chartCategoryPassColor)
                    .input('ChartCategoryFailColor', sql.NVarChar(20), colors.chartCategoryFailColor)
                    .input('AccentColor', sql.NVarChar(20), colors.accentColor)
                    .query(`
                        UPDATE SchemaColors SET
                            PassColor = @PassColor,
                            FailColor = @FailColor,
                            CategoryPassColor = @CategoryPassColor,
                            CategoryFailColor = @CategoryFailColor,
                            HeaderBackgroundColor = @HeaderBackgroundColor,
                            HeaderTextColor = @HeaderTextColor,
                            BannerPassBackground = @BannerPassBackground,
                            BannerPassText = @BannerPassText,
                            BannerFailBackground = @BannerFailBackground,
                            BannerFailText = @BannerFailText,
                            SectionHeaderBackground = @SectionHeaderBackground,
                            SectionBorderColor = @SectionBorderColor,
                            ChartPassColor = @ChartPassColor,
                            ChartFailColor = @ChartFailColor,
                            ChartCategoryPassColor = @ChartCategoryPassColor,
                            ChartCategoryFailColor = @ChartCategoryFailColor,
                            AccentColor = @AccentColor,
                            UpdatedAt = GETDATE()
                        WHERE SchemaID = @SchemaID
                    `);
            } else {
                // Insert new record
                await pool.request()
                    .input('SchemaID', sql.Int, schemaId)
                    .input('PassColor', sql.NVarChar(20), colors.passColor)
                    .input('FailColor', sql.NVarChar(20), colors.failColor)
                    .input('CategoryPassColor', sql.NVarChar(20), colors.categoryPassColor)
                    .input('CategoryFailColor', sql.NVarChar(20), colors.categoryFailColor)
                    .input('HeaderBackgroundColor', sql.NVarChar(20), colors.headerBackgroundColor)
                    .input('HeaderTextColor', sql.NVarChar(20), colors.headerTextColor)
                    .input('BannerPassBackground', sql.NVarChar(20), colors.bannerPassBackground)
                    .input('BannerPassText', sql.NVarChar(20), colors.bannerPassText)
                    .input('BannerFailBackground', sql.NVarChar(20), colors.bannerFailBackground)
                    .input('BannerFailText', sql.NVarChar(20), colors.bannerFailText)
                    .input('SectionHeaderBackground', sql.NVarChar(20), colors.sectionHeaderBackground)
                    .input('SectionBorderColor', sql.NVarChar(20), colors.sectionBorderColor)
                    .input('ChartPassColor', sql.NVarChar(20), colors.chartPassColor)
                    .input('ChartFailColor', sql.NVarChar(20), colors.chartFailColor)
                    .input('ChartCategoryPassColor', sql.NVarChar(20), colors.chartCategoryPassColor)
                    .input('ChartCategoryFailColor', sql.NVarChar(20), colors.chartCategoryFailColor)
                    .input('AccentColor', sql.NVarChar(20), colors.accentColor)
                    .query(`
                        INSERT INTO SchemaColors (
                            SchemaID, PassColor, FailColor,
                            CategoryPassColor, CategoryFailColor,
                            HeaderBackgroundColor, HeaderTextColor,
                            BannerPassBackground, BannerPassText,
                            BannerFailBackground, BannerFailText,
                            SectionHeaderBackground, SectionBorderColor,
                            ChartPassColor, ChartFailColor,
                            ChartCategoryPassColor, ChartCategoryFailColor,
                            AccentColor
                        ) VALUES (
                            @SchemaID, @PassColor, @FailColor,
                            @CategoryPassColor, @CategoryFailColor,
                            @HeaderBackgroundColor, @HeaderTextColor,
                            @BannerPassBackground, @BannerPassText,
                            @BannerFailBackground, @BannerFailText,
                            @SectionHeaderBackground, @SectionBorderColor,
                            @ChartPassColor, @ChartFailColor,
                            @ChartCategoryPassColor, @ChartCategoryFailColor,
                            @AccentColor
                        )
                    `);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error saving schema colors:', error);
            throw error;
        }
    }

    /**
     * Reset schema colors to defaults
     * @param {number} schemaId - The schema ID
     */
    async resetSchemaColors(schemaId) {
        try {
            const pool = await this.getPool();
            
            // Delete schema-specific colors to use defaults
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query('DELETE FROM SchemaColors WHERE SchemaID = @SchemaID');
            
            return { success: true, colors: this.defaultColors };
        } catch (error) {
            console.error('Error resetting schema colors:', error);
            throw error;
        }
    }

    /**
     * Get default colors
     * @returns {Object} Default color configuration
     */
    getDefaultColors() {
        return { ...this.defaultColors };
    }

    /**
     * Ensure SchemaColors table exists
     */
    async ensureTableExists() {
        try {
            const pool = await this.getPool();
            
            await pool.request().query(`
                IF OBJECT_ID('dbo.SchemaColors', 'U') IS NULL
                BEGIN
                    CREATE TABLE SchemaColors (
                        ColorID INT IDENTITY(1,1) PRIMARY KEY,
                        SchemaID INT NOT NULL UNIQUE,
                        PassColor NVARCHAR(20) DEFAULT '#10b981',
                        FailColor NVARCHAR(20) DEFAULT '#ef4444',
                        CategoryPassColor NVARCHAR(20) DEFAULT '#22c55e',
                        CategoryFailColor NVARCHAR(20) DEFAULT '#f87171',
                        HeaderBackgroundColor NVARCHAR(20) DEFAULT '#1e3a5f',
                        HeaderTextColor NVARCHAR(20) DEFAULT '#ffffff',
                        BannerPassBackground NVARCHAR(20) DEFAULT '#10b981',
                        BannerPassText NVARCHAR(20) DEFAULT '#ffffff',
                        BannerFailBackground NVARCHAR(20) DEFAULT '#ef4444',
                        BannerFailText NVARCHAR(20) DEFAULT '#ffffff',
                        SectionHeaderBackground NVARCHAR(20) DEFAULT '#f3f4f6',
                        SectionBorderColor NVARCHAR(20) DEFAULT '#e5e7eb',
                        ChartPassColor NVARCHAR(20) DEFAULT '#10b981',
                        ChartFailColor NVARCHAR(20) DEFAULT '#ef4444',
                        ChartCategoryPassColor NVARCHAR(20) DEFAULT '#22c55e',
                        ChartCategoryFailColor NVARCHAR(20) DEFAULT '#f87171',
                        AccentColor NVARCHAR(20) DEFAULT '#3b82f6',
                        CreatedAt DATETIME DEFAULT GETDATE(),
                        UpdatedAt DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_SchemaColors_Schema FOREIGN KEY (SchemaID) 
                            REFERENCES AuditSchemas(SchemaID) ON DELETE CASCADE
                    );
                    
                    CREATE INDEX IX_SchemaColors_SchemaID ON SchemaColors(SchemaID);
                    PRINT 'Created table: SchemaColors';
                END
            `);
        } catch (error) {
            console.error('Error ensuring SchemaColors table exists:', error);
            // Don't throw - table might already exist or we'll use defaults
        }
    }
}

module.exports = SchemaColorsService;
