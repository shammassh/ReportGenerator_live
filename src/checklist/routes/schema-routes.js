/**
 * Schema Routes
 * API endpoints for checklist schema management
 * @module checklist/routes/schema-routes
 */

const express = require('express');
const router = express.Router();
const SchemaService = require('../services/schema-service');
const { requireAuth, requireChecklistAccess } = require('../middleware/auth-check');

const schemaService = new SchemaService();

// Apply authentication to all routes
router.use(requireAuth);
router.use(requireChecklistAccess);

/**
 * GET /api/schemas
 * Get all schemas
 */
router.get('/', async (req, res) => {
  try {
    const schemas = await schemaService.getSchemas();
    res.json({
      success: true,
      count: schemas.length,
      data: schemas
    });
  } catch (error) {
    console.error('Error fetching schemas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schemas',
      message: error.message
    });
  }
});

/**
 * GET /api/schemas/:id
 * Get schema by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const schemaId = parseInt(req.params.id);
    
    if (isNaN(schemaId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schema ID'
      });
    }

    const schema = await schemaService.getSchemaById(schemaId);
    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    console.error('Error fetching schema:', error.message);
    
    if (error.message === 'Schema not found') {
      return res.status(404).json({
        success: false,
        error: 'Schema not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch schema',
      message: error.message
    });
  }
});

/**
 * POST /api/schemas
 * Create a new schema
 * Body: { schemaName, description }
 */
router.post('/', async (req, res) => {
  try {
    const { schemaName, description } = req.body;

    // Validation
    if (!schemaName || schemaName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Schema name is required'
      });
    }

    const result = await schemaService.createSchema(
      schemaName.trim(),
      description || '',
      req.user.userId
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating schema:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create schema',
      message: error.message
    });
  }
});

/**
 * PUT /api/schemas/:id
 * Update an existing schema
 * Body: { schemaName, description }
 */
router.put('/:id', async (req, res) => {
  try {
    const schemaId = parseInt(req.params.id);
    const { schemaName, description } = req.body;

    if (isNaN(schemaId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schema ID'
      });
    }

    if (!schemaName || schemaName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Schema name is required'
      });
    }

    const result = await schemaService.updateSchema(
      schemaId,
      schemaName.trim(),
      description || '',
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating schema:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update schema',
      message: error.message
    });
  }
});

/**
 * DELETE /api/schemas/:id
 * Deactivate a schema (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const schemaId = parseInt(req.params.id);

    if (isNaN(schemaId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schema ID'
      });
    }

    const result = await schemaService.deactivateSchema(
      schemaId,
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error deactivating schema:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate schema',
      message: error.message
    });
  }
});

module.exports = router;
