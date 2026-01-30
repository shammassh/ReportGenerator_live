/**
 * Audit Template Service
 * Manages Schemas, Sections, and Items for audit templates
 */

const sql = require('mssql');
require('dotenv').config();

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'PowerApps-Repor',
    database: process.env.SQL_DATABASE || 'FoodSafetyDB',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

class AuditTemplateService {
    
    // ==========================================
    // SCHEMA OPERATIONS
    // ==========================================
    
    /**
     * Get all schemas
     */
    async getAllSchemas(activeOnly = true) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('ActiveOnly', sql.Bit, activeOnly)
                .execute('sp_GetAllSchemas');
            
            return result.recordset.map(s => ({
                schemaId: s.SchemaID,
                schemaName: s.SchemaName,
                description: s.Description,
                isActive: s.IsActive,
                createdBy: s.CreatedBy,
                createdDate: s.CreatedDate,
                sectionCount: s.SectionCount
            }));
        } catch (error) {
            console.error('Error fetching schemas:', error);
            throw error;
        }
    }
    
    /**
     * Create a new schema
     */
    async createSchema(schemaName, description, createdBy) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SchemaName', sql.NVarChar(100), schemaName)
                .input('Description', sql.NVarChar(500), description)
                .input('CreatedBy', sql.NVarChar(255), createdBy)
                .execute('sp_CreateSchema');
            
            return { schemaId: result.recordset[0].SchemaID };
        } catch (error) {
            console.error('Error creating schema:', error);
            throw error;
        }
    }
    
    /**
     * Update an existing schema
     */
    async updateSchema(schemaId, schemaName, description, modifiedBy) {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .input('SchemaName', sql.NVarChar(100), schemaName)
                .input('Description', sql.NVarChar(500), description || '')
                .input('ModifiedBy', sql.NVarChar(255), modifiedBy)
                .query(`
                    UPDATE AuditSchemas 
                    SET SchemaName = @SchemaName,
                        Description = @Description,
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = GETDATE()
                    WHERE SchemaID = @SchemaID
                `);
            
            return { success: true, schemaId };
        } catch (error) {
            console.error('Error updating schema:', error);
            throw error;
        }
    }
    
    /**
     * Delete a schema (hard delete)
     * Cascades to delete all sections and items
     * Also unlinks any stores assigned to this schema
     */
    async deleteSchema(schemaId, modifiedBy) {
        try {
            const pool = await sql.connect(dbConfig);
            
            // First, unlink any stores from this schema (set SchemaID to NULL)
            const storesResult = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    UPDATE Stores SET SchemaID = NULL WHERE SchemaID = @SchemaID;
                    SELECT @@ROWCOUNT AS UnlinkedStores;
                `);
            const unlinkedStores = storesResult.recordset[0]?.UnlinkedStores || 0;
            if (unlinkedStores > 0) {
                console.log(`[HARD DELETE] Unlinked ${unlinkedStores} store(s) from schema ${schemaId}`);
            }
            
            // Delete all items in sections belonging to this schema
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    DELETE FROM AuditItems 
                    WHERE SectionID IN (SELECT SectionID FROM AuditSections WHERE SchemaID = @SchemaID)
                `);
            
            // Then delete all sections belonging to this schema
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    DELETE FROM AuditSections WHERE SchemaID = @SchemaID
                `);
            
            // Finally delete the schema itself
            await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    DELETE FROM AuditSchemas WHERE SchemaID = @SchemaID
                `);
            
            console.log(`[HARD DELETE] Schema ${schemaId} and all its sections/items permanently deleted by ${modifiedBy}`);
            
            return { success: true, schemaId, unlinkedStores };
        } catch (error) {
            console.error('Error deleting schema:', error);
            throw error;
        }
    }
    
    /**
     * Get full schema with all sections and items
     */
    async getFullSchema(schemaId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .execute('sp_GetFullSchema');
            
            const schema = result.recordsets[0][0];
            if (!schema) return null;
            
            const sections = result.recordsets[1];
            const items = result.recordsets[2];
            
            // Group items by section
            const sectionsWithItems = sections.map(section => ({
                sectionId: section.SectionID,
                sectionNumber: section.SectionNumber,
                sectionName: section.SectionName,
                sectionIcon: section.SectionIcon,
                items: items
                    .filter(item => item.SectionID === section.SectionID)
                    .map(item => ({
                        itemId: item.ItemID,
                        referenceValue: item.ReferenceValue,
                        title: item.Title,
                        coeff: item.Coeff,
                        answer: item.Answer,
                        cr: item.CR,
                        sortOrder: item.SortOrder
                    }))
            }));
            
            return {
                schemaId: schema.SchemaID,
                schemaName: schema.SchemaName,
                description: schema.Description,
                isActive: schema.IsActive,
                createdBy: schema.CreatedBy,
                createdDate: schema.CreatedDate,
                sections: sectionsWithItems
            };
        } catch (error) {
            console.error('Error fetching full schema:', error);
            throw error;
        }
    }
    
    // ==========================================
    // SECTION OPERATIONS
    // ==========================================
    
    /**
     * Get sections by schema
     */
    async getSectionsBySchema(schemaId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .execute('sp_GetSectionsBySchema');
            
            return result.recordset.map(s => ({
                sectionId: s.SectionID,
                schemaId: s.SchemaID,
                sectionNumber: s.SectionNumber,
                sectionName: s.SectionName,
                sectionIcon: s.SectionIcon,
                isActive: s.IsActive,
                createdBy: s.CreatedBy,
                createdDate: s.CreatedDate,
                itemCount: s.ItemCount
            }));
        } catch (error) {
            console.error('Error fetching sections:', error);
            throw error;
        }
    }
    
    /**
     * Create a new section
     */
    async createSection(schemaId, sectionNumber, sectionName, sectionIcon, createdBy) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .input('SectionNumber', sql.Int, sectionNumber)
                .input('SectionName', sql.NVarChar(200), sectionName)
                .input('SectionIcon', sql.NVarChar(10), sectionIcon || '📋')
                .input('CreatedBy', sql.NVarChar(255), createdBy)
                .execute('sp_CreateSection');
            
            return { sectionId: result.recordset[0].SectionID };
        } catch (error) {
            console.error('Error creating section:', error);
            throw error;
        }
    }
    
    // ==========================================
    // ITEM OPERATIONS
    // ==========================================
    
    /**
     * Get items by section (active only)
     */
    async getItemsBySection(sectionId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SectionID', sql.Int, sectionId)
                .execute('sp_GetItemsBySection');
            
            return result.recordset.map(i => ({
                itemId: i.ItemID,
                sectionId: i.SectionID,
                referenceValue: i.ReferenceValue,
                title: i.Title,
                coeff: i.Coeff,
                answer: i.Answer,
                cr: i.CR,
                sortOrder: i.SortOrder,
                isActive: i.IsActive
            }));
        } catch (error) {
            console.error('Error fetching items:', error);
            throw error;
        }
    }
    
    /**
     * Get ALL items by section (including inactive/deleted)
     * Used for duplicate checking during bulk uploads
     */
    async getAllItemsBySection(sectionId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SectionID', sql.Int, sectionId)
                .query(`
                    SELECT ItemID, SectionID, ReferenceValue, Title, Coeff, Answer, CR, SortOrder, IsActive
                    FROM AuditItems
                    WHERE SectionID = @SectionID
                    ORDER BY SortOrder, ReferenceValue
                `);
            
            return result.recordset.map(i => ({
                itemId: i.ItemID,
                sectionId: i.SectionID,
                referenceValue: i.ReferenceValue,
                title: i.Title,
                coeff: i.Coeff,
                answer: i.Answer,
                cr: i.CR,
                sortOrder: i.SortOrder,
                isActive: i.IsActive
            }));
        } catch (error) {
            console.error('Error fetching all items:', error);
            throw error;
        }
    }
    
    /**
     * Create a new item
     */
    async createItem(sectionId, referenceValue, title, coeff, answer, cr, createdBy) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SectionID', sql.Int, sectionId)
                .input('ReferenceValue', sql.NVarChar(20), referenceValue)
                .input('Title', sql.NVarChar(1000), title)
                .input('Coeff', sql.Int, coeff)
                .input('Answer', sql.NVarChar(100), answer || 'Yes,Partially,No,NA')
                .input('CR', sql.NVarChar(2000), cr || '')
                .input('CreatedBy', sql.NVarChar(255), createdBy)
                .execute('sp_CreateItem');
            
            return { itemId: result.recordset[0].ItemID };
        } catch (error) {
            console.error('Error creating item:', error);
            throw error;
        }
    }
    
    /**
     * Update an item
     */
    async updateItem(itemId, referenceValue, title, coeff, answer, cr, modifiedBy) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('ItemID', sql.Int, itemId)
                .input('ReferenceValue', sql.NVarChar(20), referenceValue)
                .input('Title', sql.NVarChar(1000), title)
                .input('Coeff', sql.Int, coeff)
                .input('Answer', sql.NVarChar(100), answer)
                .input('CR', sql.NVarChar(2000), cr || '')
                .input('ModifiedBy', sql.NVarChar(255), modifiedBy)
                .execute('sp_UpdateItem');
            
            return { success: result.recordset[0].RowsAffected > 0 };
        } catch (error) {
            console.error('Error updating item:', error);
            throw error;
        }
    }
    
    /**
     * Update an item AND reactivate it if inactive
     * Used for bulk uploads to restore deleted items
     */
    async updateAndReactivateItem(itemId, referenceValue, title, coeff, answer, cr, modifiedBy) {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('ItemID', sql.Int, itemId)
                .input('ReferenceValue', sql.NVarChar(20), referenceValue)
                .input('Title', sql.NVarChar(1000), title)
                .input('Coeff', sql.Int, coeff)
                .input('Answer', sql.NVarChar(100), answer)
                .input('CR', sql.NVarChar(2000), cr || '')
                .input('ModifiedBy', sql.NVarChar(255), modifiedBy)
                .query(`
                    UPDATE AuditItems
                    SET ReferenceValue = @ReferenceValue,
                        Title = @Title,
                        Coeff = @Coeff,
                        Answer = @Answer,
                        CR = @CR,
                        IsActive = 1,
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = GETDATE()
                    WHERE ItemID = @ItemID
                `);
            
            return { success: true };
        } catch (error) {
            console.error('Error updating and reactivating item:', error);
            throw error;
        }
    }
    
    /**
     * Delete an item (soft delete)
     */
    async deleteItem(itemId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('ItemID', sql.Int, itemId)
                .execute('sp_DeleteItem');
            
            return { success: result.recordset[0].RowsAffected > 0 };
        } catch (error) {
            console.error('Error deleting item:', error);
            throw error;
        }
    }
    
    /**
     * Delete ALL items in a section (soft delete)
     */
    async deleteAllItemsInSection(sectionId) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('SectionID', sql.Int, sectionId)
                .query(`
                    UPDATE AuditItems 
                    SET IsActive = 0, ModifiedDate = GETDATE()
                    WHERE SectionID = @SectionID AND IsActive = 1
                `);
            
            return { 
                success: true, 
                deleted: result.rowsAffected[0] 
            };
        } catch (error) {
            console.error('Error deleting all items in section:', error);
            throw error;
        }
    }
}

module.exports = AuditTemplateService;
