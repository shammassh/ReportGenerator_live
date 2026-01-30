/**
 * Role Assignment Service
 * Database operations for user management
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const sql = require('mssql');
const dbConfig = require('../../config/default');

class RoleAssignmentService {
    /**
     * Get all users from database
     */
    static async getAllUsers() {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request().query(`
                SELECT 
                    id,
                    azure_user_id,
                    email,
                    display_name,
                    department,
                    role,
                    assigned_stores,
                    assigned_department,
                    is_active,
                    is_approved,
                    last_login,
                    created_at,
                    updated_at
                FROM Users
                ORDER BY 
                    CASE 
                        WHEN role = 'Pending' THEN 0
                        ELSE 1
                    END,
                    display_name
            `);
            
            return result.recordset;
            
        } catch (error) {
            console.error('[DB] Error fetching users:', error);
            throw new Error('Failed to fetch users from database');
        }
    }
    
    /**
     * Get user by ID
     */
    static async getUserById(userId) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        id,
                        azure_user_id,
                        email,
                        display_name,
                        department,
                        role,
                        assigned_stores,
                        assigned_department,
                        is_active,
                        is_approved,
                        last_login,
                        created_at,
                        updated_at
                    FROM Users
                    WHERE id = @userId
                `);
            
            return result.recordset[0] || null;
            
        } catch (error) {
            console.error('[DB] Error fetching user:', error);
            throw new Error('Failed to fetch user from database');
        }
    }
    
    /**
     * Get user by email
     */
    static async getUserByEmail(email) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('email', sql.NVarChar(255), email)
                .query(`
                    SELECT 
                        id,
                        azure_user_id,
                        email,
                        display_name,
                        department,
                        role,
                        assigned_stores,
                        assigned_department,
                        is_active,
                        is_approved,
                        last_login,
                        created_at,
                        updated_at
                    FROM Users
                    WHERE email = @email
                `);
            
            return result.recordset[0] || null;
            
        } catch (error) {
            console.error('[DB] Error fetching user by email:', error);
            throw new Error('Failed to fetch user from database');
        }
    }
    
    /**
     * Create or update user
     */
    static async upsertUser(userData) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            // Check if user exists
            const existingUser = await this.getUserByEmail(userData.email);
            
            if (existingUser) {
                // Update existing user
                const result = await pool.request()
                    .input('email', sql.NVarChar(255), userData.email)
                    .input('displayName', sql.NVarChar(255), userData.display_name)
                    .input('department', sql.NVarChar(100), userData.department)
                    .query(`
                        UPDATE Users
                        SET 
                            display_name = @displayName,
                            department = @department,
                            updated_at = GETDATE()
                        WHERE email = @email
                        
                        SELECT * FROM Users WHERE email = @email
                    `);
                
                return result.recordset[0];
                
            } else {
                // Create new user - use a unique azure_user_id based on email hash if null
                const azureUserId = userData.azure_user_id || `sp_${Buffer.from(userData.email).toString('base64').substring(0, 50)}`;
                
                const result = await pool.request()
                    .input('azureUserId', sql.NVarChar(255), azureUserId)
                    .input('email', sql.NVarChar(255), userData.email)
                    .input('displayName', sql.NVarChar(255), userData.display_name)
                    .input('department', sql.NVarChar(100), userData.department)
                    .query(`
                        -- Check if azure_user_id already exists, if so update that record
                        IF EXISTS (SELECT 1 FROM Users WHERE azure_user_id = @azureUserId AND email != @email)
                        BEGIN
                            -- Generate a new unique ID for this user using timestamp
                            INSERT INTO Users (
                                azure_user_id,
                                email,
                                display_name,
                                department,
                                role,
                                is_active,
                                is_approved,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                CONCAT(@azureUserId, '_', CONVERT(VARCHAR(20), GETDATE(), 112) + REPLACE(CONVERT(VARCHAR(12), GETDATE(), 114), ':', '')),
                                @email,
                                @displayName,
                                @department,
                                'Pending',
                                1,
                                0,
                                GETDATE(),
                                GETDATE()
                            )
                        END
                        ELSE
                        BEGIN
                            INSERT INTO Users (
                                azure_user_id,
                                email,
                                display_name,
                                department,
                                role,
                                is_active,
                                is_approved,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                @azureUserId,
                                @email,
                                @displayName,
                                @department,
                                'Pending',
                                1,
                                0,
                                GETDATE(),
                                GETDATE()
                            )
                        END
                        
                        SELECT * FROM Users WHERE email = @email
                    `);
                
                return result.recordset[0];
            }
            
        } catch (error) {
            console.error('[DB] Error upserting user:', error);
            throw new Error('Failed to create/update user');
        }
    }
    
    /**
     * Update user role and permissions
     */
    static async updateUser(userId, updateData) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('role', sql.NVarChar(50), updateData.role)
                .input('assignedStores', sql.NVarChar(sql.MAX), updateData.assigned_stores)
                .input('assignedDepartment', sql.NVarChar(100), updateData.assigned_department)
                .input('isActive', sql.Bit, updateData.is_active)
                .input('isApproved', sql.Bit, updateData.is_approved)
                .query(`
                    UPDATE Users
                    SET 
                        role = @role,
                        assigned_stores = @assignedStores,
                        assigned_department = @assignedDepartment,
                        is_active = @isActive,
                        is_approved = @isApproved,
                        updated_at = GETDATE()
                    WHERE id = @userId
                    
                    SELECT * FROM Users WHERE id = @userId
                `);
            
            console.log(`[DB] Updated user ${userId}: role=${updateData.role}`);
            
            return result.recordset[0];
            
        } catch (error) {
            console.error('[DB] Error updating user:', error);
            throw new Error('Failed to update user');
        }
    }
    
    /**
     * Update user active status
     */
    static async updateUserStatus(userId, isActive) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('isActive', sql.Bit, isActive)
                .query(`
                    UPDATE Users
                    SET 
                        is_active = @isActive,
                        updated_at = GETDATE()
                    WHERE id = @userId
                    
                    SELECT * FROM Users WHERE id = @userId
                `);
            
            console.log(`[DB] Updated user ${userId} status: active=${isActive}`);
            
            return result.recordset[0];
            
        } catch (error) {
            console.error('[DB] Error updating user status:', error);
            throw new Error('Failed to update user status');
        }
    }
    
    /**
     * Get list of stores from database
     */
    static async getStoresList() {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request().query(`
                SELECT 
                    StoreID as store_id,
                    StoreCode as store_code,
                    StoreName as store_name,
                    Location as location,
                    Brand as brand,
                    IsActive as is_active
                FROM Stores
                WHERE IsActive = 1
                ORDER BY StoreName
            `);
            
            return result.recordset;
            
        } catch (error) {
            console.error('[DB] Error fetching stores:', error);
            return [];
        }
    }
    
    /**
     * Create new store
     */
    static async createStore(storeData, createdBy) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('storeCode', sql.NVarChar(50), storeData.store_code)
                .input('storeName', sql.NVarChar(255), storeData.store_name)
                .input('location', sql.NVarChar(255), storeData.location || null)
                .input('createdBy', sql.NVarChar(255), createdBy)
                .query(`
                    INSERT INTO Stores (StoreCode, StoreName, Location, IsActive, CreatedBy)
                    VALUES (@storeCode, @storeName, @location, 1, @createdBy);
                    
                    SELECT StoreID as id, StoreCode as store_code, StoreName as store_name, Location as location, IsActive as is_active FROM Stores WHERE StoreID = SCOPE_IDENTITY();
                `);
            
            return result.recordset[0];
            
        } catch (error) {
            console.error('[DB] Error creating store:', error);
            throw new Error('Failed to create store');
        }
    }
    
    /**
     * Update store
     */
    static async updateStore(storeId, storeData) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('storeId', sql.Int, storeId)
                .input('storeCode', sql.NVarChar(50), storeData.store_code)
                .input('storeName', sql.NVarChar(255), storeData.store_name)
                .input('location', sql.NVarChar(255), storeData.location || null)
                .query(`
                    UPDATE Stores
                    SET 
                        StoreCode = @storeCode,
                        StoreName = @storeName,
                        Location = @location,
                        UpdatedAt = GETDATE()
                    WHERE StoreID = @storeId;
                    
                    SELECT StoreID as id, StoreCode as store_code, StoreName as store_name, Location as location, IsActive as is_active FROM Stores WHERE StoreID = @storeId;
                `);
            
            return result.recordset[0];
            
        } catch (error) {
            console.error('[DB] Error updating store:', error);
            throw new Error('Failed to update store');
        }
    }
    
    /**
     * Toggle store active status
     */
    static async toggleStoreStatus(storeId, isActive) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request()
                .input('storeId', sql.Int, storeId)
                .input('isActive', sql.Bit, isActive)
                .query(`
                    UPDATE Stores
                    SET 
                        IsActive = @isActive,
                        UpdatedAt = GETDATE()
                    WHERE StoreID = @storeId;
                    
                    SELECT StoreID as id, StoreCode as store_code, StoreName as store_name, Location as location, IsActive as is_active FROM Stores WHERE StoreID = @storeId;
                `);
            
            return result.recordset[0];
            
        } catch (error) {
            console.error('[DB] Error toggling store status:', error);
            throw new Error('Failed to toggle store status');
        }
    }
    
    /**
     * Delete store (soft delete by setting inactive)
     */
    static async deleteStore(storeId) {
        try {
            await this.toggleStoreStatus(storeId, false);
            return { success: true };
            
        } catch (error) {
            console.error('[DB] Error deleting store:', error);
            throw new Error('Failed to delete store');
        }
    }
    
    /**
     * Get list of all stores (including inactive) - for admin management
     */
    static async getAllStores() {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            const result = await pool.request().query(`
                SELECT 
                    StoreID as store_id,
                    StoreCode as store_code,
                    StoreName as store_name,
                    Location as location,
                    Brand as brand,
                    IsActive as is_active,
                    CreatedAt as created_at,
                    CreatedBy as created_by
                FROM Stores
                ORDER BY IsActive DESC, StoreName
            `);
            
            return result.recordset;
            
        } catch (error) {
            console.error('[DB] Error fetching all stores:', error);
            return [];
        }
    }
    
    /**
     * Sync users from Microsoft Graph
     */
    static async syncUsersFromGraph(graphUsers) {
        try {
            let newUsers = 0;
            let updatedUsers = 0;
            
            for (const graphUser of graphUsers) {
                const existingUser = await this.getUserByEmail(graphUser.email);
                
                if (existingUser) {
                    // Update only display name and department (don't overwrite roles)
                    await this.upsertUser(graphUser);
                    updatedUsers++;
                } else {
                    // Create new user with Pending role
                    await this.upsertUser(graphUser);
                    newUsers++;
                }
            }
            
            console.log(`[DB] Sync complete: ${newUsers} new, ${updatedUsers} updated`);
            
            return { newUsers, updatedUsers };
            
        } catch (error) {
            console.error('[DB] Error syncing users:', error);
            throw new Error('Failed to sync users from Microsoft Graph');
        }
    }
    
    /**
     * Log admin action to audit log
     */
    static async logAction(userId, action, details) {
        try {
            const pool = await sql.connect(dbConfig.database);
            
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('action', sql.NVarChar(100), action)
                .input('details', sql.NVarChar(sql.MAX), JSON.stringify(details))
                .query(`
                    INSERT INTO AuditLog (user_id, action, details, created_at)
                    VALUES (@userId, @action, @details, GETDATE())
                `);
            
        } catch (error) {
            console.error('[DB] Error logging action:', error);
            // Don't throw - logging failure shouldn't break operations
        }
    }
}

module.exports = RoleAssignmentService;
