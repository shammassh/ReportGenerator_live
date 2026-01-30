/**
 * Checklist Item Service
 * Handles all template item operations including batch operations
 * @module checklist/services/item-service
 */

const SQLConnector = require('../../sql-connector');

class ItemService {
  constructor() {
    this.connector = new SQLConnector();
  }

  /**
   * Add a single item to a template
   * @param {number} templateId - Template ID
   * @param {number} sectionId - Section ID
   * @param {string} referenceValue - Reference value (e.g., "1.1", "2.5")
   * @param {string} title - Item title/question
   * @param {number} coeff - Coefficient/weight
   * @param {string} answer - Allowed answer types (e.g., "Yes,Partially,No,NA")
   * @param {string} cr - Criterion/requirement text
   * @param {number} createdBy - User ID
   * @returns {Promise<Object>} Created item with ID
   */
  async addItem(templateId, sectionId, referenceValue, title, coeff, answer, cr, createdBy) {
    try {
      console.log('ItemService: Adding item to template:', templateId);
      
      const pool = await this.connector.connect();
      const result = await pool.request()
        .input('TemplateID', templateId)
        .input('SectionID', sectionId)
        .input('ReferenceValue', referenceValue)
        .input('Title', title)
        .input('Coeff', coeff)
        .input('Answer', answer)
        .input('cr', cr)
        .input('CreatedBy', createdBy)
        .execute('sp_AddTemplateItem');

      const itemId = result.recordset[0].ItemID;
      console.log('ItemService: Item added with ID:', itemId);
      
      return {
        success: true,
        itemId,
        message: 'Item added successfully'
      };
    } catch (error) {
      console.error('ItemService: Error adding item:', error.message);
      throw error;
    }
  }

  /**
   * Add multiple items at once (batch operation)
   * @param {number} templateId - Template ID
   * @param {number} sectionId - Section ID
   * @param {Array<Object>} items - Array of items to add
   * @param {number} createdBy - User ID
   * @returns {Promise<Object>} Success response with count
   */
  async batchAddItems(templateId, sectionId, items, createdBy) {
    try {
      console.log(`ItemService: Batch adding ${items.length} items to template ${templateId}`);
      
      // Validate items array
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items must be a non-empty array');
      }

      // Ensure all items have required fields
      items.forEach((item, index) => {
        if (!item.ReferenceValue || !item.Title || item.Coeff === undefined || !item.Answer || !item.cr) {
          throw new Error(`Item at index ${index} is missing required fields`);
        }
      });

      const pool = await this.connector.connect();
      const result = await pool.request()
        .input('TemplateID', templateId)
        .input('SectionID', sectionId)
        .input('ItemsJSON', JSON.stringify(items))
        .input('CreatedBy', createdBy)
        .execute('sp_BatchAddTemplateItems');

      const addedCount = result.recordset[0].AddedCount;
      console.log(`ItemService: Successfully added ${addedCount} items`);
      
      return {
        success: true,
        addedCount,
        message: `${addedCount} items added successfully`
      };
    } catch (error) {
      console.error('ItemService: Error batch adding items:', error.message);
      throw error;
    }
  }

  /**
   * Get all items for a template (optionally filtered by section)
   * @param {number} templateId - Template ID
   * @param {number} sectionId - Optional section ID filter
   * @returns {Promise<Array>} List of items
   */
  async getItems(templateId, sectionId = null) {
    try {
      console.log('ItemService: Fetching items for template:', templateId);
      
      const pool = await this.connector.connect();
      const request = pool.request().input('TemplateID', templateId);

      let query = `
        SELECT 
          ti.ItemID,
          ti.TemplateID,
          ti.SectionID,
          s.SectionName,
          s.SectionNumber,
          s.Emoji,
          ti.ReferenceValue,
          ti.Title,
          ti.Coeff,
          ti.Answer,
          ti.cr,
          ti.CreatedAt,
          ti.CreatedBy
        FROM ChecklistTemplateItems ti
        INNER JOIN ChecklistSections s ON ti.SectionID = s.SectionID
        WHERE ti.TemplateID = @TemplateID
      `;

      if (sectionId !== null) {
        request.input('SectionID', sectionId);
        query += ' AND ti.SectionID = @SectionID';
      }

      query += ' ORDER BY ti.ReferenceValue';

      const result = await request.query(query);

      console.log(`ItemService: Retrieved ${result.recordset.length} items`);
      return result.recordset;
    } catch (error) {
      console.error('ItemService: Error fetching items:', error.message);
      throw error;
    }
  }

  /**
   * Get a single item by ID
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Item details
   */
  async getItemById(itemId) {
    try {
      console.log('ItemService: Fetching item by ID:', itemId);
      
      const pool = await this.connector.connect();
      const result = await pool.request()
        .input('ItemID', itemId)
        .execute('sp_GetTemplateItemById');

      if (result.recordset.length === 0) {
        throw new Error('Item not found');
      }

      console.log('ItemService: Item found:', result.recordset[0].Title);
      return result.recordset[0];
    } catch (error) {
      console.error('ItemService: Error fetching item:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing item
   * @param {number} itemId - Item ID
   * @param {string} referenceValue - Reference value
   * @param {string} title - Item title
   * @param {number} coeff - Coefficient
   * @param {string} answer - Allowed answers
   * @param {string} cr - Criterion text
   * @param {number} updatedBy - User ID
   * @returns {Promise<Object>} Success response
   */
  async updateItem(itemId, referenceValue, title, coeff, answer, cr, updatedBy) {
    try {
      console.log('ItemService: Updating item:', itemId);
      
      const pool = await this.connector.connect();
      await pool.request()
        .input('ItemID', itemId)
        .input('ReferenceValue', referenceValue)
        .input('Title', title)
        .input('Coeff', coeff)
        .input('Answer', answer)
        .input('cr', cr)
        .input('UpdatedBy', updatedBy)
        .execute('sp_UpdateTemplateItem');

      console.log('ItemService: Item updated successfully');
      
      return {
        success: true,
        message: 'Item updated successfully'
      };
    } catch (error) {
      console.error('ItemService: Error updating item:', error.message);
      throw error;
    }
  }

  /**
   * Delete an item
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Success response
   */
  async deleteItem(itemId) {
    try {
      console.log('ItemService: Deleting item:', itemId);
      
      const pool = await this.connector.connect();
      await pool.request()
        .input('ItemID', itemId)
        .execute('sp_DeleteTemplateItem');

      console.log('ItemService: Item deleted successfully');
      
      return {
        success: true,
        message: 'Item deleted successfully'
      };
    } catch (error) {
      console.error('ItemService: Error deleting item:', error.message);
      throw error;
    }
  }

  /**
   * Get the next reference value for a section in a template
   * @param {number} templateId - Template ID
   * @param {number} sectionId - Section ID
   * @returns {Promise<string>} Next reference value (e.g., "1.5")
   */
  async getNextReferenceValue(templateId, sectionId) {
    try {
      console.log('ItemService: Getting next reference value for section:', sectionId);
      
      const pool = await this.connector.connect();
      const result = await pool.request()
        .input('TemplateID', templateId)
        .input('SectionID', sectionId)
        .execute('sp_GetNextReferenceValue');

      const nextRef = result.recordset[0].NextReferenceValue;
      console.log('ItemService: Next reference value:', nextRef);
      
      return nextRef;
    } catch (error) {
      console.error('ItemService: Error getting next reference value:', error.message);
      throw error;
    }
  }

  /**
   * Get items grouped by section for a template
   * @param {number} templateId - Template ID
   * @returns {Promise<Array>} Sections with nested items
   */
  async getItemsGroupedBySection(templateId) {
    try {
      console.log('ItemService: Fetching items grouped by section for template:', templateId);
      
      const items = await this.getItems(templateId);
      
      // Group by section
      const sectionsMap = new Map();
      
      items.forEach(item => {
        const sectionId = item.SectionID;
        
        if (!sectionsMap.has(sectionId)) {
          sectionsMap.set(sectionId, {
            sectionId: item.SectionID,
            sectionName: item.SectionName,
            sectionNumber: item.SectionNumber,
            emoji: item.Emoji,
            items: []
          });
        }

        sectionsMap.get(sectionId).items.push({
          itemId: item.ItemID,
          referenceValue: item.ReferenceValue,
          title: item.Title,
          coeff: item.Coeff,
          answer: item.Answer,
          cr: item.cr,
          createdAt: item.CreatedAt,
          createdBy: item.CreatedBy
        });
      });

      // Convert to array and sort
      const sections = Array.from(sectionsMap.values())
        .sort((a, b) => a.sectionNumber - b.sectionNumber);

      // Sort items within each section
      sections.forEach(section => {
        section.items.sort((a, b) => {
          const [aSection, aItem] = a.referenceValue.split('.').map(Number);
          const [bSection, bItem] = b.referenceValue.split('.').map(Number);
          return aItem - bItem;
        });
      });

      console.log(`ItemService: Retrieved ${sections.length} sections with items`);
      return sections;
    } catch (error) {
      console.error('ItemService: Error grouping items by section:', error.message);
      throw error;
    }
  }

  /**
   * Bulk update reference values (useful for reordering)
   * @param {Array<Object>} updates - Array of {itemId, referenceValue}
   * @returns {Promise<Object>} Success response
   */
  async bulkUpdateReferenceValues(updates) {
    try {
      console.log(`ItemService: Bulk updating ${updates.length} reference values`);
      
      const pool = await this.connector.connect();
      const transaction = pool.transaction();
      
      await transaction.begin();

      try {
        for (const update of updates) {
          await transaction.request()
            .input('ItemID', update.itemId)
            .input('ReferenceValue', update.referenceValue)
            .query('UPDATE ChecklistTemplateItems SET ReferenceValue = @ReferenceValue WHERE ItemID = @ItemID');
        }

        await transaction.commit();
        console.log('ItemService: Bulk update completed successfully');
        
        return {
          success: true,
          updatedCount: updates.length,
          message: `${updates.length} reference values updated`
        };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('ItemService: Error bulk updating reference values:', error.message);
      throw error;
    }
  }
}

module.exports = ItemService;
