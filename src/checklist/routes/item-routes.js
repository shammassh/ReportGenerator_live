/**
 * Item Routes
 * API endpoints for checklist item management
 * @module checklist/routes/item-routes
 */

const express = require('express');
const router = express.Router();
const ItemService = require('../services/item-service');
const { requireAuth, requireChecklistAccess } = require('../middleware/auth-check');

const itemService = new ItemService();

// Apply authentication to all routes
router.use(requireAuth);
router.use(requireChecklistAccess);

/**
 * GET /api/templates/:templateId/items
 * Get all items for a template (optionally filtered by section)
 * Query params: ?sectionId=X
 */
router.get('/:templateId/items', async (req, res) => {
  try {
    const templateId = parseInt(req.params.templateId);
    const sectionId = req.query.sectionId ? parseInt(req.query.sectionId) : null;
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    const items = await itemService.getItems(templateId, sectionId);
    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch items',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:templateId/items/grouped
 * Get items grouped by section
 */
router.get('/:templateId/items/grouped', async (req, res) => {
  try {
    const templateId = parseInt(req.params.templateId);
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    const sections = await itemService.getItemsGroupedBySection(templateId);
    res.json({
      success: true,
      sectionCount: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('Error fetching grouped items:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch grouped items',
      message: error.message
    });
  }
});

/**
 * GET /api/items/:itemId
 * Get a single item by ID
 */
router.get('/items/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    const item = await itemService.getItemById(itemId);
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error fetching item:', error.message);
    
    if (error.message === 'Item not found') {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch item',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:templateId/sections/:sectionId/next-reference
 * Get next reference value for a section
 */
router.get('/:templateId/sections/:sectionId/next-reference', async (req, res) => {
  try {
    const templateId = parseInt(req.params.templateId);
    const sectionId = parseInt(req.params.sectionId);
    
    if (isNaN(templateId) || isNaN(sectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template or section ID'
      });
    }

    const nextRef = await itemService.getNextReferenceValue(templateId, sectionId);
    res.json({
      success: true,
      nextReferenceValue: nextRef
    });
  } catch (error) {
    console.error('Error getting next reference value:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get next reference value',
      message: error.message
    });
  }
});

/**
 * POST /api/templates/:templateId/items
 * Add a single item to a template
 * Body: { sectionId, referenceValue, title, coeff, answer, cr }
 */
router.post('/:templateId/items', async (req, res) => {
  try {
    const templateId = parseInt(req.params.templateId);
    const { sectionId, referenceValue, title, coeff, answer, cr } = req.body;

    // Validation
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    if (!sectionId || isNaN(parseInt(sectionId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid section ID is required'
      });
    }

    if (!referenceValue || !title || coeff === undefined || !answer || !cr) {
      return res.status(400).json({
        success: false,
        error: 'All fields (referenceValue, title, coeff, answer, cr) are required'
      });
    }

    const result = await itemService.addItem(
      templateId,
      parseInt(sectionId),
      referenceValue,
      title,
      parseFloat(coeff),
      answer,
      cr,
      req.user.userId
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding item:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to add item',
      message: error.message
    });
  }
});

/**
 * POST /api/templates/:templateId/items/batch
 * Add multiple items at once
 * Body: { sectionId, items: [{referenceValue, title, coeff, answer, cr}, ...] }
 */
router.post('/:templateId/items/batch', async (req, res) => {
  try {
    const templateId = parseInt(req.params.templateId);
    const { sectionId, items } = req.body;

    // Validation
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    if (!sectionId || isNaN(parseInt(sectionId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid section ID is required'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty'
      });
    }

    // Format items for stored procedure (expects capitalized property names)
    const formattedItems = items.map(item => ({
      ReferenceValue: item.referenceValue || item.ReferenceValue,
      Title: item.title || item.Title,
      Coeff: item.coeff || item.Coeff,
      Answer: item.answer || item.Answer,
      cr: item.cr || item.cr
    }));

    const result = await itemService.batchAddItems(
      templateId,
      parseInt(sectionId),
      formattedItems,
      req.user.userId
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error batch adding items:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to batch add items',
      message: error.message
    });
  }
});

/**
 * PUT /api/items/:itemId
 * Update an existing item
 * Body: { referenceValue, title, coeff, answer, cr }
 */
router.put('/items/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const { referenceValue, title, coeff, answer, cr } = req.body;

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    if (!referenceValue || !title || coeff === undefined || !answer || !cr) {
      return res.status(400).json({
        success: false,
        error: 'All fields (referenceValue, title, coeff, answer, cr) are required'
      });
    }

    const result = await itemService.updateItem(
      itemId,
      referenceValue,
      title,
      parseFloat(coeff),
      answer,
      cr,
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating item:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update item',
      message: error.message
    });
  }
});

/**
 * PUT /api/items/bulk-update-references
 * Bulk update reference values (for reordering)
 * Body: { updates: [{itemId, referenceValue}, ...] }
 */
router.put('/items/bulk-update-references', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required and must not be empty'
      });
    }

    const result = await itemService.bulkUpdateReferenceValues(updates);
    res.json(result);
  } catch (error) {
    console.error('Error bulk updating references:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update reference values',
      message: error.message
    });
  }
});

/**
 * DELETE /api/items/:itemId
 * Delete an item
 */
router.delete('/items/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);

    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item ID'
      });
    }

    const result = await itemService.deleteItem(itemId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting item:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete item',
      message: error.message
    });
  }
});

module.exports = router;
