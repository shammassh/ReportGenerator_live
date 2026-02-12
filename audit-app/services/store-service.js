/**
 * Store Management Service
 * Handles CRUD operations for stores with schema relationships
 */

const sql = require('mssql');
require('dotenv').config();

class StoreService {
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
            if (this.pool) {
                try { await this.pool.close(); } catch (e) { }
                this.pool = null;
            }
            
            this.pool = await sql.connect({
                server: process.env.SQL_SERVER,
                database: process.env.SQL_DATABASE,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                options: {
                    encrypt: process.env.SQL_ENCRYPT === 'true',
                    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
                },
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                }
            });
            
            this.pool.on('error', err => {
                console.error('SQL Pool Error (StoreService):', err);
                this.pool = null;
            });
            
            return this.pool;
        } finally {
            this.connecting = false;
        }
    }

    /**
     * Get all stores with schema information
     */
    async getAllStores() {
        try {
            const pool = await this.getPool();
            const result = await pool.request().execute('sp_GetAllStores');
            return result.recordset.map(row => ({
                storeId: row.StoreID,
                storeCode: row.StoreCode,
                storeName: row.StoreName,
                location: row.Location,
                schemaId: row.SchemaID,
                schemaName: row.SchemaName,
                brand: row.Brand,
                isActive: row.IsActive,
                createdAt: row.CreatedAt,
                createdBy: row.CreatedBy
            }));
        } catch (error) {
            console.error('Error getting all stores:', error);
            throw error;
        }
    }

    /**
     * Get active stores only
     */
    async getActiveStores() {
        try {
            const pool = await this.getPool();
            const result = await pool.request().execute('sp_GetActiveStores');
            return result.recordset.map(row => ({
                storeId: row.StoreID,
                storeCode: row.StoreCode,
                storeName: row.StoreName,
                location: row.Location,
                schemaId: row.SchemaID,
                schemaName: row.SchemaName,
                brand: row.Brand,
                isActive: row.IsActive
            }));
        } catch (error) {
            console.error('Error getting active stores:', error);
            throw error;
        }
    }

    /**
     * Create a new store
     */
    async createStore(storeData) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('StoreCode', sql.NVarChar(50), storeData.storeCode)
                .input('StoreName', sql.NVarChar(200), storeData.storeName)
                .input('Location', sql.NVarChar(500), storeData.location || null)
                .input('SchemaID', sql.Int, storeData.schemaId)
                .input('CreatedBy', sql.NVarChar(200), storeData.createdBy || null)
                .execute('sp_CreateStore');
            
            return { storeId: result.recordset[0].StoreID };
        } catch (error) {
            console.error('Error creating store:', error);
            throw error;
        }
    }

    /**
     * Update an existing store
     */
    async updateStore(storeId, storeData) {
        try {
            const pool = await this.getPool();
            await pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('StoreCode', sql.NVarChar(50), storeData.storeCode)
                .input('StoreName', sql.NVarChar(200), storeData.storeName)
                .input('Location', sql.NVarChar(500), storeData.location || null)
                .input('SchemaID', sql.Int, storeData.schemaId)
                .input('IsActive', sql.Bit, storeData.isActive !== false)
                .execute('sp_UpdateStore');
            
            return { success: true };
        } catch (error) {
            console.error('Error updating store:', error);
            throw error;
        }
    }

    /**
     * Delete a store
     */
    async deleteStore(storeId) {
        try {
            const pool = await this.getPool();
            await pool.request()
                .input('StoreID', sql.Int, storeId)
                .execute('sp_DeleteStore');
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting store:', error);
            throw error;
        }
    }

    /**
     * Get store managers for a specific store
     */
    async getStoreManagers(storeId) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('StoreID', sql.Int, storeId)
                .query(`
                    SELECT sma.AssignmentID, sma.StoreID, sma.UserID, sma.IsPrimary, sma.CreatedAt,
                           u.email, u.display_name, u.role
                    FROM StoreManagerAssignments sma
                    INNER JOIN Users u ON sma.UserID = u.id
                    WHERE sma.StoreID = @StoreID
                    ORDER BY sma.IsPrimary DESC, u.display_name
                `);
            return result.recordset.map(row => ({
                assignmentId: row.AssignmentID,
                storeId: row.StoreID,
                userId: row.UserID,
                isPrimary: row.IsPrimary,
                email: row.email,
                displayName: row.display_name,
                role: row.role,
                createdAt: row.CreatedAt
            }));
        } catch (error) {
            console.error('Error getting store managers:', error);
            throw error;
        }
    }

    /**
     * Get all store manager assignments (for display in table)
     */
    async getAllStoreManagerAssignments() {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .query(`
                    SELECT sma.AssignmentID, sma.StoreID, sma.UserID, sma.IsPrimary,
                           u.email, u.display_name
                    FROM StoreManagerAssignments sma
                    INNER JOIN Users u ON sma.UserID = u.id
                    ORDER BY sma.StoreID, sma.IsPrimary DESC
                `);
            
            // Group by storeId
            const assignments = {};
            for (const row of result.recordset) {
                if (!assignments[row.StoreID]) {
                    assignments[row.StoreID] = [];
                }
                assignments[row.StoreID].push({
                    assignmentId: row.AssignmentID,
                    userId: row.UserID,
                    email: row.email,
                    displayName: row.display_name,
                    isPrimary: row.IsPrimary
                });
            }
            return assignments;
        } catch (error) {
            console.error('Error getting all store manager assignments:', error);
            throw error;
        }
    }

    /**
     * Get all users who can be store managers (StoreManager role or Admin)
     */
    async getAvailableStoreManagers() {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .query(`
                    SELECT id, email, display_name, role
                    FROM Users
                    WHERE is_active = 1 AND is_approved = 1
                      AND role IN ('StoreManager', 'Admin')
                    ORDER BY display_name
                `);
            return result.recordset.map(row => ({
                userId: row.id,
                email: row.email,
                displayName: row.display_name,
                role: row.role
            }));
        } catch (error) {
            console.error('Error getting available store managers:', error);
            throw error;
        }
    }

    /**
     * Assign store managers to a store (replaces existing assignments)
     */
    async assignStoreManagers(storeId, userIds, createdBy) {
        try {
            const pool = await this.getPool();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Remove existing assignments
                await transaction.request()
                    .input('StoreID', sql.Int, storeId)
                    .query('DELETE FROM StoreManagerAssignments WHERE StoreID = @StoreID');

                // Add new assignments
                for (let i = 0; i < userIds.length; i++) {
                    const userId = userIds[i];
                    const isPrimary = i === 0; // First one is primary
                    await transaction.request()
                        .input('StoreID', sql.Int, storeId)
                        .input('UserID', sql.Int, userId)
                        .input('IsPrimary', sql.Bit, isPrimary)
                        .input('CreatedBy', sql.NVarChar(255), createdBy)
                        .query(`
                            INSERT INTO StoreManagerAssignments (StoreID, UserID, IsPrimary, CreatedBy)
                            VALUES (@StoreID, @UserID, @IsPrimary, @CreatedBy)
                        `);
                }

                await transaction.commit();
                return { success: true, count: userIds.length };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            console.error('Error assigning store managers:', error);
            throw error;
        }
    }

    /**
     * Remove a single store manager assignment
     */
    async removeStoreManager(storeId, userId) {
        try {
            const pool = await this.getPool();
            await pool.request()
                .input('StoreID', sql.Int, storeId)
                .input('UserID', sql.Int, userId)
                .query('DELETE FROM StoreManagerAssignments WHERE StoreID = @StoreID AND UserID = @UserID');
            return { success: true };
        } catch (error) {
            console.error('Error removing store manager:', error);
            throw error;
        }
    }

    /**
     * Get store assignments for a specific user (for filtering audits)
     */
    async getStoreAssignmentsForUser(userId) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('UserID', sql.Int, userId)
                .query(`
                    SELECT sma.StoreID, sma.IsPrimary, s.StoreCode, s.StoreName, s.SchemaID
                    FROM StoreManagerAssignments sma
                    INNER JOIN Stores s ON sma.StoreID = s.StoreID
                    WHERE sma.UserID = @UserID AND s.IsActive = 1
                `);
            return result.recordset.map(row => ({
                storeId: row.StoreID,
                storeCode: row.StoreCode,
                storeName: row.StoreName,
                schemaId: row.SchemaID,
                isPrimary: row.IsPrimary
            }));
        } catch (error) {
            console.error('Error getting store assignments for user:', error);
            throw error;
        }
    }

    // ==========================================
    // Brand Assignment Methods (for HeadOfOperations)
    // ==========================================

    /**
     * Get brand assignments for a user
     */
    async getBrandAssignmentsForUser(userId) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('UserID', sql.Int, userId)
                .query('SELECT Brand FROM UserBrandAssignments WHERE UserID = @UserID');
            return result.recordset.map(row => row.Brand);
        } catch (error) {
            console.error('Error getting brand assignments for user:', error);
            throw error;
        }
    }

    /**
     * Set brand assignments for a user (replaces existing)
     */
    async setBrandAssignmentsForUser(userId, brands, createdBy = null) {
        try {
            const pool = await this.getPool();
            
            // Delete existing assignments
            await pool.request()
                .input('UserID', sql.Int, userId)
                .query('DELETE FROM UserBrandAssignments WHERE UserID = @UserID');
            
            // Insert new assignments
            for (const brand of brands) {
                await pool.request()
                    .input('UserID', sql.Int, userId)
                    .input('Brand', sql.NVarChar(50), brand)
                    .input('CreatedBy', sql.NVarChar(255), createdBy)
                    .query('INSERT INTO UserBrandAssignments (UserID, Brand, CreatedBy) VALUES (@UserID, @Brand, @CreatedBy)');
            }
            
            return { success: true, brandsAssigned: brands.length };
        } catch (error) {
            console.error('Error setting brand assignments:', error);
            throw error;
        }
    }

    /**
     * Get stores by brand(s) for HeadOfOperations filtering
     */
    async getStoresByBrands(brands) {
        try {
            const pool = await this.getPool();
            const brandList = brands.map(b => `'${b}'`).join(',');
            const result = await pool.request()
                .query(`
                    SELECT StoreID, StoreCode, StoreName, Brand
                    FROM Stores 
                    WHERE IsActive = 1 AND Brand IN (${brandList})
                `);
            return result.recordset.map(row => ({
                storeId: row.StoreID,
                storeCode: row.StoreCode,
                storeName: row.StoreName,
                brand: row.Brand
            }));
        } catch (error) {
            console.error('Error getting stores by brands:', error);
            throw error;
        }
    }

    // ==========================================
    // Area Assignment Methods (for AreaManager)
    // ==========================================

    /**
     * Get area store assignments for a user
     */
    async getAreaAssignmentsForUser(userId) {
        try {
            const pool = await this.getPool();
            const result = await pool.request()
                .input('UserID', sql.Int, userId)
                .query(`
                    SELECT uaa.StoreID, s.StoreCode, s.StoreName, s.Brand
                    FROM UserAreaAssignments uaa
                    INNER JOIN Stores s ON uaa.StoreID = s.StoreID
                    WHERE uaa.UserID = @UserID AND s.IsActive = 1
                `);
            return result.recordset.map(row => ({
                storeId: row.StoreID,
                storeCode: row.StoreCode,
                storeName: row.StoreName,
                brand: row.Brand
            }));
        } catch (error) {
            console.error('Error getting area assignments for user:', error);
            throw error;
        }
    }

    /**
     * Set area store assignments for a user (replaces existing)
     */
    async setAreaAssignmentsForUser(userId, storeIds, createdBy = null) {
        try {
            const pool = await this.getPool();
            
            // Delete existing assignments
            await pool.request()
                .input('UserID', sql.Int, userId)
                .query('DELETE FROM UserAreaAssignments WHERE UserID = @UserID');
            
            // Insert new assignments
            for (const storeId of storeIds) {
                await pool.request()
                    .input('UserID', sql.Int, userId)
                    .input('StoreID', sql.Int, storeId)
                    .input('CreatedBy', sql.NVarChar(255), createdBy)
                    .query('INSERT INTO UserAreaAssignments (UserID, StoreID, CreatedBy) VALUES (@UserID, @StoreID, @CreatedBy)');
            }
            
            return { success: true, storesAssigned: storeIds.length };
        } catch (error) {
            console.error('Error setting area assignments:', error);
            throw error;
        }
    }
}

module.exports = new StoreService();
