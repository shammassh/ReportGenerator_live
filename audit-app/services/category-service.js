/**
 * Category Management Service
 * Handles CRUD operations for audit categories
 */

const sql = require('mssql');

class CategoryService {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Get all categories with their sections for a schema
     */
    async getCategoriesWithSections(schemaId) {
        try {
            const result = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT 
                        c.CategoryID,
                        c.CategoryName,
                        c.DisplayOrder as CategoryOrder,
                        c.IsActive,
                        cs.CategorySectionID,
                        cs.DisplayOrder as SectionOrder,
                        s.SectionID,
                        s.SectionName,
                        s.SectionNumber
                    FROM AuditCategories c
                    LEFT JOIN CategorySections cs ON c.CategoryID = cs.CategoryID
                    LEFT JOIN AuditSections s ON cs.SectionID = s.SectionID AND s.SchemaID = @SchemaID
                    WHERE c.SchemaID = @SchemaID AND c.IsActive = 1
                    ORDER BY c.DisplayOrder, cs.DisplayOrder
                `);

            // Group by category
            const categoriesMap = new Map();
            
            for (const row of result.recordset) {
                if (!categoriesMap.has(row.CategoryID)) {
                    categoriesMap.set(row.CategoryID, {
                        categoryId: row.CategoryID,
                        categoryName: row.CategoryName,
                        displayOrder: row.CategoryOrder,
                        isActive: row.IsActive,
                        sections: []
                    });
                }
                
                if (row.SectionID) {
                    categoriesMap.get(row.CategoryID).sections.push({
                        categorySectionId: row.CategorySectionID,
                        sectionId: row.SectionID,
                        sectionName: row.SectionName,
                        sectionNumber: row.SectionNumber,
                        displayOrder: row.SectionOrder
                    });
                }
            }

            return Array.from(categoriesMap.values());
        } catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    }

    /**
     * Get all categories (simple list)
     */
    async getCategories(schemaId) {
        try {
            const result = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT CategoryID, CategoryName, DisplayOrder, IsActive
                    FROM AuditCategories
                    WHERE SchemaID = @SchemaID
                    ORDER BY DisplayOrder
                `);

            return result.recordset.map(row => ({
                categoryId: row.CategoryID,
                categoryName: row.CategoryName,
                displayOrder: row.DisplayOrder,
                isActive: row.IsActive
            }));
        } catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    }

    /**
     * Get uncategorized sections
     */
    async getUncategorizedSections(schemaId) {
        try {
            const result = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .query(`
                    SELECT s.SectionID, s.SectionName, s.SectionNumber
                    FROM AuditSections s
                    WHERE s.SchemaID = @SchemaID
                        AND s.IsActive = 1
                        AND NOT EXISTS (
                            SELECT 1 FROM CategorySections cs 
                            JOIN AuditCategories c ON cs.CategoryID = c.CategoryID
                            WHERE cs.SectionID = s.SectionID AND c.SchemaID = @SchemaID
                        )
                    ORDER BY s.SectionNumber
                `);

            return result.recordset.map(row => ({
                sectionId: row.SectionID,
                sectionName: row.SectionName,
                sectionNumber: row.SectionNumber
            }));
        } catch (error) {
            console.error('Error getting uncategorized sections:', error);
            throw error;
        }
    }

    /**
     * Create a new category
     */
    async createCategory(schemaId, categoryName, displayOrder = 0) {
        try {
            const result = await this.pool.request()
                .input('SchemaID', sql.Int, schemaId)
                .input('CategoryName', sql.NVarChar(200), categoryName)
                .input('DisplayOrder', sql.Int, displayOrder)
                .query(`
                    INSERT INTO AuditCategories (CategoryName, DisplayOrder, SchemaID, IsActive)
                    OUTPUT INSERTED.CategoryID
                    VALUES (@CategoryName, @DisplayOrder, @SchemaID, 1)
                `);

            return { 
                success: true, 
                categoryId: result.recordset[0].CategoryID 
            };
        } catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    }

    /**
     * Update a category
     */
    async updateCategory(categoryId, categoryName, displayOrder, isActive) {
        try {
            await this.pool.request()
                .input('CategoryID', sql.Int, categoryId)
                .input('CategoryName', sql.NVarChar(200), categoryName)
                .input('DisplayOrder', sql.Int, displayOrder)
                .input('IsActive', sql.Bit, isActive)
                .query(`
                    UPDATE AuditCategories
                    SET CategoryName = @CategoryName,
                        DisplayOrder = @DisplayOrder,
                        IsActive = @IsActive,
                        UpdatedAt = GETDATE()
                    WHERE CategoryID = @CategoryID
                `);

            return { success: true };
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    }

    /**
     * Delete a category
     */
    async deleteCategory(categoryId) {
        try {
            await this.pool.request()
                .input('CategoryID', sql.Int, categoryId)
                .query(`DELETE FROM AuditCategories WHERE CategoryID = @CategoryID`);

            return { success: true };
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    }

    /**
     * Add section to category (with schema validation)
     */
    async addSectionToCategory(categoryId, sectionId, displayOrder = 0) {
        try {
            // First, validate that section and category belong to the same schema
            const validationResult = await this.pool.request()
                .input('CategoryID', sql.Int, categoryId)
                .input('SectionID', sql.Int, sectionId)
                .query(`
                    SELECT 
                        c.SchemaID as CategorySchemaID,
                        s.SchemaID as SectionSchemaID
                    FROM AuditCategories c
                    CROSS JOIN AuditSections s
                    WHERE c.CategoryID = @CategoryID AND s.SectionID = @SectionID
                `);

            if (validationResult.recordset.length === 0) {
                throw new Error('Category or Section not found');
            }

            const { CategorySchemaID, SectionSchemaID } = validationResult.recordset[0];
            
            if (CategorySchemaID !== SectionSchemaID) {
                throw new Error(`Schema mismatch: Category belongs to schema ${CategorySchemaID}, but section belongs to schema ${SectionSchemaID}`);
            }

            // Now insert the mapping
            await this.pool.request()
                .input('CategoryID', sql.Int, categoryId)
                .input('SectionID', sql.Int, sectionId)
                .input('DisplayOrder', sql.Int, displayOrder)
                .query(`
                    INSERT INTO CategorySections (CategoryID, SectionID, DisplayOrder)
                    VALUES (@CategoryID, @SectionID, @DisplayOrder)
                `);

            return { success: true };
        } catch (error) {
            console.error('Error adding section to category:', error);
            throw error;
        }
    }

    /**
     * Remove section from category
     */
    async removeSectionFromCategory(categoryId, sectionId) {
        try {
            await this.pool.request()
                .input('CategoryID', sql.Int, categoryId)
                .input('SectionID', sql.Int, sectionId)
                .query(`
                    DELETE FROM CategorySections 
                    WHERE CategoryID = @CategoryID AND SectionID = @SectionID
                `);

            return { success: true };
        } catch (error) {
            console.error('Error removing section from category:', error);
            throw error;
        }
    }

    /**
     * Update section order within category
     */
    async updateSectionOrder(categoryId, sectionId, displayOrder) {
        try {
            await this.pool.request()
                .input('CategoryID', sql.Int, categoryId)
                .input('SectionID', sql.Int, sectionId)
                .input('DisplayOrder', sql.Int, displayOrder)
                .query(`
                    UPDATE CategorySections 
                    SET DisplayOrder = @DisplayOrder
                    WHERE CategoryID = @CategoryID AND SectionID = @SectionID
                `);

            return { success: true };
        } catch (error) {
            console.error('Error updating section order:', error);
            throw error;
        }
    }

    /**
     * Bulk update category sections (replace all sections in a category)
     */
    async updateCategorySections(categoryId, sectionIds) {
        try {
            // Start transaction
            const transaction = new sql.Transaction(this.pool);
            await transaction.begin();

            try {
                // Remove all existing sections
                await transaction.request()
                    .input('CategoryID', sql.Int, categoryId)
                    .query(`DELETE FROM CategorySections WHERE CategoryID = @CategoryID`);

                // Add new sections
                for (let i = 0; i < sectionIds.length; i++) {
                    await transaction.request()
                        .input('CategoryID', sql.Int, categoryId)
                        .input('SectionID', sql.Int, sectionIds[i])
                        .input('DisplayOrder', sql.Int, i)
                        .query(`
                            INSERT INTO CategorySections (CategoryID, SectionID, DisplayOrder)
                            VALUES (@CategoryID, @SectionID, @DisplayOrder)
                        `);
                }

                await transaction.commit();
                return { success: true };
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Error updating category sections:', error);
            throw error;
        }
    }
}

module.exports = CategoryService;
