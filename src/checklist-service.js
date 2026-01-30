/**
 * Checklist Management Service
 * Handles creation and management of custom checklists for auditors and admins
 */

const SQLConnector = require('./sql-connector');
const sql = require('mssql');

class ChecklistService {
    constructor() {
        this.sqlConnector = new SQLConnector();
    }

    /**
     * Create a new checklist template
     * @param {Object} checklistData - Checklist metadata
     * @param {string} checklistData.checklistName - Name of the checklist
     * @param {string} checklistData.storeCategory - Category (e.g., 'Happy Stores', 'Signature Stores')
     * @param {string} checklistData.description - Description of the checklist
     * @param {string} checklistData.createdBy - User who created the checklist
     * @returns {Object} Created checklist with ID
     */
    async createChecklist(checklistData) {
        try {
            console.log(`📋 Creating new checklist: ${checklistData.checklistName}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ChecklistName', sql.NVarChar(200), checklistData.checklistName);
            request.input('StoreCategory', sql.NVarChar(100), checklistData.storeCategory);
            request.input('Description', sql.NVarChar(sql.MAX), checklistData.description || '');
            request.input('CreatedBy', sql.NVarChar(100), checklistData.createdBy);
            request.input('IsActive', sql.Bit, true);

            const result = await request.execute('sp_CreateChecklist');
            const checklistId = result.recordset[0].ChecklistID;
            
            console.log(`✅ Checklist created successfully (ID: ${checklistId})`);
            
            return {
                success: true,
                checklistId: checklistId,
                message: 'Checklist created successfully'
            };
        } catch (error) {
            console.error('❌ Error creating checklist:', error.message);
            throw error;
        }
    }

    /**
     * Add an item to a checklist
     * @param {Object} itemData - Checklist item data
     * @param {number} itemData.checklistId - ID of the parent checklist
     * @param {string} itemData.referenceValue - Reference code (e.g., '1.1', '1.2')
     * @param {string} itemData.title - The control to check
     * @param {number} itemData.coeff - Weight/importance (2, 4, etc.)
     * @param {string} itemData.answer - Allowed answers: 'Yes,Partially,No,NA'
     * @param {string} itemData.cr - Guidance/corrective actions
     * @returns {Object} Created item with ID
     */
    async addChecklistItem(itemData) {
        try {
            console.log(`📝 Adding item ${itemData.referenceValue} to checklist ${itemData.checklistId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ChecklistID', sql.Int, itemData.checklistId);
            request.input('ReferenceValue', sql.NVarChar(20), itemData.referenceValue);
            request.input('Title', sql.NVarChar(sql.MAX), itemData.title);
            request.input('Coeff', sql.Int, itemData.coeff);
            request.input('Answer', sql.NVarChar(100), itemData.answer);
            request.input('Cr', sql.NVarChar(sql.MAX), itemData.cr || '');

            const result = await request.execute('sp_AddChecklistItem');
            const itemId = result.recordset[0].ItemID;
            
            console.log(`✅ Checklist item added successfully (ID: ${itemId})`);
            
            return {
                success: true,
                itemId: itemId,
                message: 'Checklist item added successfully'
            };
        } catch (error) {
            console.error('❌ Error adding checklist item:', error.message);
            throw error;
        }
    }

    /**
     * Add multiple items to a checklist (batch operation)
     * @param {number} checklistId - ID of the parent checklist
     * @param {Array} items - Array of checklist items
     * @returns {Object} Batch operation result
     */
    async addChecklistItems(checklistId, items) {
        try {
            console.log(`📝 Adding ${items.length} items to checklist ${checklistId}...`);
            
            const results = [];
            let successCount = 0;
            let errorCount = 0;

            for (const item of items) {
                try {
                    item.checklistId = checklistId;
                    const result = await this.addChecklistItem(item);
                    results.push(result);
                    successCount++;
                } catch (error) {
                    console.error(`❌ Error adding item ${item.referenceValue}:`, error.message);
                    results.push({
                        success: false,
                        referenceValue: item.referenceValue,
                        error: error.message
                    });
                    errorCount++;
                }
            }

            console.log(`✅ Batch add complete: ${successCount} succeeded, ${errorCount} failed`);

            return {
                success: errorCount === 0,
                totalProcessed: items.length,
                successCount,
                errorCount,
                results
            };
        } catch (error) {
            console.error('❌ Error in batch add:', error.message);
            throw error;
        }
    }

    /**
     * Get all checklists
     * @param {boolean} activeOnly - Return only active checklists
     * @returns {Array} List of checklists
     */
    async getChecklists(activeOnly = true) {
        try {
            console.log('📋 Fetching checklists...');
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ActiveOnly', sql.Bit, activeOnly);
            const result = await request.execute('sp_GetChecklists');
            
            console.log(`✅ Found ${result.recordset.length} checklists`);
            
            return {
                success: true,
                checklists: result.recordset
            };
        } catch (error) {
            console.error('❌ Error fetching checklists:', error.message);
            throw error;
        }
    }

    /**
     * Get checklist by ID with all items
     * @param {number} checklistId - Checklist ID
     * @returns {Object} Checklist with items
     */
    async getChecklistById(checklistId) {
        try {
            console.log(`📋 Fetching checklist ${checklistId}...`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ChecklistID', sql.Int, checklistId);
            const result = await request.execute('sp_GetChecklistById');
            
            if (result.recordsets.length < 2) {
                throw new Error('Checklist not found');
            }

            const checklist = result.recordsets[0][0];
            const items = result.recordsets[1];
            
            console.log(`✅ Found checklist with ${items.length} items`);
            
            return {
                success: true,
                checklist: {
                    ...checklist,
                    items: items
                }
            };
        } catch (error) {
            console.error('❌ Error fetching checklist:', error.message);
            throw error;
        }
    }

    /**
     * Get checklists by store category
     * @param {string} storeCategory - Store category to filter by
     * @returns {Array} List of checklists
     */
    async getChecklistsByCategory(storeCategory) {
        try {
            console.log(`📋 Fetching checklists for category: ${storeCategory}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('StoreCategory', sql.NVarChar(100), storeCategory);
            const result = await request.execute('sp_GetChecklistsByCategory');
            
            console.log(`✅ Found ${result.recordset.length} checklists for ${storeCategory}`);
            
            return {
                success: true,
                checklists: result.recordset
            };
        } catch (error) {
            console.error('❌ Error fetching checklists by category:', error.message);
            throw error;
        }
    }

    /**
     * Update checklist item
     * @param {number} itemId - Item ID
     * @param {Object} updates - Fields to update
     * @returns {Object} Update result
     */
    async updateChecklistItem(itemId, updates) {
        try {
            console.log(`📝 Updating checklist item ${itemId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ItemID', sql.Int, itemId);
            request.input('ReferenceValue', sql.NVarChar(20), updates.referenceValue || null);
            request.input('Title', sql.NVarChar(sql.MAX), updates.title || null);
            request.input('Coeff', sql.Int, updates.coeff || null);
            request.input('Answer', sql.NVarChar(100), updates.answer || null);
            request.input('Cr', sql.NVarChar(sql.MAX), updates.cr || null);

            await request.execute('sp_UpdateChecklistItem');
            
            console.log(`✅ Checklist item ${itemId} updated successfully`);
            
            return {
                success: true,
                message: 'Checklist item updated successfully'
            };
        } catch (error) {
            console.error('❌ Error updating checklist item:', error.message);
            throw error;
        }
    }

    /**
     * Delete checklist item
     * @param {number} itemId - Item ID
     * @returns {Object} Delete result
     */
    async deleteChecklistItem(itemId) {
        try {
            console.log(`🗑️ Deleting checklist item ${itemId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ItemID', sql.Int, itemId);
            await request.execute('sp_DeleteChecklistItem');
            
            console.log(`✅ Checklist item ${itemId} deleted successfully`);
            
            return {
                success: true,
                message: 'Checklist item deleted successfully'
            };
        } catch (error) {
            console.error('❌ Error deleting checklist item:', error.message);
            throw error;
        }
    }

    /**
     * Deactivate checklist (soft delete)
     * @param {number} checklistId - Checklist ID
     * @returns {Object} Deactivation result
     */
    async deactivateChecklist(checklistId) {
        try {
            console.log(`🔒 Deactivating checklist ${checklistId}`);
            
            const pool = await this.sqlConnector.connect();
            const request = pool.request();

            request.input('ChecklistID', sql.Int, checklistId);
            await request.execute('sp_DeactivateChecklist');
            
            console.log(`✅ Checklist ${checklistId} deactivated successfully`);
            
            return {
                success: true,
                message: 'Checklist deactivated successfully'
            };
        } catch (error) {
            console.error('❌ Error deactivating checklist:', error.message);
            throw error;
        }
    }

    /**
     * Calculate checklist score based on responses
     * @param {Array} responses - Array of responses with selectedChoice
     * @param {Array} items - Array of checklist items with coeff
     * @returns {Object} Score calculation result
     */
    calculateScore(responses, items) {
        try {
            let totalScore = 0;
            let maxScore = 0;
            const itemScores = [];

            // Create a map of items by referenceValue
            const itemsMap = {};
            items.forEach(item => {
                itemsMap[item.ReferenceValue] = item;
            });

            // Calculate scores
            responses.forEach(response => {
                const item = itemsMap[response.referenceValue];
                if (!item) {
                    console.warn(`⚠️ Item not found for reference: ${response.referenceValue}`);
                    return;
                }

                const coeff = item.Coeff;
                maxScore += coeff;

                let itemScore = 0;
                switch (response.selectedChoice) {
                    case 'Yes':
                        itemScore = coeff * 1.0;
                        break;
                    case 'Partially':
                        itemScore = coeff * 0.5;
                        break;
                    case 'No':
                        itemScore = 0;
                        break;
                    case 'NA':
                        itemScore = 0;
                        maxScore -= coeff; // Don't count NA items in max score
                        break;
                    default:
                        itemScore = 0;
                }

                totalScore += itemScore;
                itemScores.push({
                    referenceValue: response.referenceValue,
                    title: item.Title,
                    coeff: coeff,
                    selectedChoice: response.selectedChoice,
                    score: itemScore
                });
            });

            const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

            return {
                success: true,
                totalScore: Math.round(totalScore * 100) / 100,
                maxScore: maxScore,
                percentage: Math.round(percentage * 100) / 100,
                itemScores: itemScores
            };
        } catch (error) {
            console.error('❌ Error calculating score:', error.message);
            throw error;
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        return await this.sqlConnector.testConnection();
    }

    /**
     * Close database connection
     */
    async close() {
        await this.sqlConnector.disconnect();
    }
}

module.exports = ChecklistService;
