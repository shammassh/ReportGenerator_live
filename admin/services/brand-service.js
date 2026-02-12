/**
 * Brand Service
 * Manages dynamic brand operations for the audit system
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

class BrandService {
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
     * Get all brands
     * @param {boolean} activeOnly - If true, only return active brands
     */
    async getAllBrands(activeOnly = true) {
        const pool = await this.getPool();
        
        let query = `
            SELECT 
                BrandID,
                BrandName,
                BrandCode,
                BrandIcon,
                IsActive,
                CreatedAt,
                (SELECT COUNT(*) FROM Stores WHERE Brand = b.BrandName) AS StoreCount
            FROM Brands b
        `;
        
        if (activeOnly) {
            query += ' WHERE IsActive = 1';
        }
        
        query += ' ORDER BY BrandName';
        
        const result = await pool.request().query(query);
        return result.recordset;
    }

    /**
     * Get a single brand by ID
     */
    async getBrandById(brandId) {
        const pool = await this.getPool();
        
        const result = await pool.request()
            .input('brandId', sql.Int, brandId)
            .query(`
                SELECT 
                    BrandID,
                    BrandName,
                    BrandCode,
                    BrandIcon,
                    IsActive,
                    CreatedAt,
                    (SELECT COUNT(*) FROM Stores WHERE Brand = b.BrandName) AS StoreCount
                FROM Brands b
                WHERE BrandID = @brandId
            `);
        
        return result.recordset[0] || null;
    }

    /**
     * Create a new brand
     */
    async createBrand(brandData, createdBy) {
        const pool = await this.getPool();
        
        // Check if brand already exists
        const existing = await pool.request()
            .input('brandName', sql.NVarChar, brandData.brandName)
            .query('SELECT BrandID FROM Brands WHERE BrandName = @brandName');
        
        if (existing.recordset.length > 0) {
            throw new Error(`Brand "${brandData.brandName}" already exists`);
        }
        
        const result = await pool.request()
            .input('brandName', sql.NVarChar, brandData.brandName)
            .input('brandCode', sql.NVarChar, brandData.brandCode || brandData.brandName)
            .input('brandIcon', sql.NVarChar, brandData.brandIcon || '🏬')
            .input('isActive', sql.Bit, brandData.isActive !== false)
            .input('createdBy', sql.NVarChar, createdBy)
            .query(`
                INSERT INTO Brands (BrandName, BrandCode, BrandIcon, IsActive, CreatedBy)
                OUTPUT INSERTED.BrandID
                VALUES (@brandName, @brandCode, @brandIcon, @isActive, @createdBy)
            `);
        
        const newId = result.recordset[0].BrandID;
        return await this.getBrandById(newId);
    }

    /**
     * Update an existing brand
     */
    async updateBrand(brandId, brandData) {
        const pool = await this.getPool();
        
        // Check if new name conflicts with another brand
        if (brandData.brandName) {
            const existing = await pool.request()
                .input('brandName', sql.NVarChar, brandData.brandName)
                .input('brandId', sql.Int, brandId)
                .query('SELECT BrandID FROM Brands WHERE BrandName = @brandName AND BrandID != @brandId');
            
            if (existing.recordset.length > 0) {
                throw new Error(`Brand "${brandData.brandName}" already exists`);
            }
        }
        
        // Get current brand for updating stores if name changes
        const currentBrand = await this.getBrandById(brandId);
        if (!currentBrand) {
            throw new Error('Brand not found');
        }
        
        const result = await pool.request()
            .input('brandId', sql.Int, brandId)
            .input('brandName', sql.NVarChar, brandData.brandName || currentBrand.BrandName)
            .input('brandCode', sql.NVarChar, brandData.brandCode || currentBrand.BrandCode)
            .input('brandIcon', sql.NVarChar, brandData.brandIcon || currentBrand.BrandIcon)
            .input('isActive', sql.Bit, brandData.isActive !== undefined ? brandData.isActive : currentBrand.IsActive)
            .query(`
                UPDATE Brands 
                SET BrandName = @brandName,
                    BrandCode = @brandCode,
                    BrandIcon = @brandIcon,
                    IsActive = @isActive
                WHERE BrandID = @brandId
            `);
        
        // If brand name changed, update all stores with this brand
        if (brandData.brandName && brandData.brandName !== currentBrand.BrandName) {
            await pool.request()
                .input('oldName', sql.NVarChar, currentBrand.BrandName)
                .input('newName', sql.NVarChar, brandData.brandName)
                .query(`
                    UPDATE Stores SET Brand = @newName WHERE Brand = @oldName
                `);
            
            // Also update user brand assignments
            await pool.request()
                .input('oldName', sql.NVarChar, currentBrand.BrandName)
                .input('newName', sql.NVarChar, brandData.brandName)
                .query(`
                    UPDATE Users 
                    SET assigned_brands = REPLACE(assigned_brands, @oldName, @newName)
                    WHERE assigned_brands LIKE '%' + @oldName + '%'
                `);
        }
        
        return await this.getBrandById(brandId);
    }

    /**
     * Delete a brand (soft delete by setting IsActive = 0)
     */
    async deleteBrand(brandId) {
        const pool = await this.getPool();
        
        // Check if brand has stores
        const brand = await this.getBrandById(brandId);
        if (!brand) {
            throw new Error('Brand not found');
        }
        
        if (brand.StoreCount > 0) {
            throw new Error(`Cannot delete brand "${brand.BrandName}" - it has ${brand.StoreCount} stores assigned`);
        }
        
        await pool.request()
            .input('brandId', sql.Int, brandId)
            .query('UPDATE Brands SET IsActive = 0 WHERE BrandID = @brandId');
        
        return { success: true, message: 'Brand deactivated successfully' };
    }

    /**
     * Permanently delete a brand (only if no stores)
     */
    async permanentlyDeleteBrand(brandId) {
        const pool = await this.getPool();
        
        const brand = await this.getBrandById(brandId);
        if (!brand) {
            throw new Error('Brand not found');
        }
        
        if (brand.StoreCount > 0) {
            throw new Error(`Cannot delete brand "${brand.BrandName}" - it has ${brand.StoreCount} stores assigned`);
        }
        
        await pool.request()
            .input('brandId', sql.Int, brandId)
            .query('DELETE FROM Brands WHERE BrandID = @brandId');
        
        return { success: true, message: 'Brand permanently deleted' };
    }
}

module.exports = new BrandService();
