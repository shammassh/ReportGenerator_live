/**
 * Checklist Management API Server
 * Express API for creating and managing custom checklists
 */

const express = require('express');
const cors = require('cors');
const ChecklistService = require('./src/checklist-service');

const app = express();
const port = process.env.CHECKLIST_API_PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize service
const checklistService = new ChecklistService();

// =============================================================================
// HEALTH CHECK
// =============================================================================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Checklist Management API',
        timestamp: new Date().toISOString()
    });
});

// =============================================================================
// TEST DATABASE CONNECTION
// =============================================================================
app.get('/api/test-connection', async (req, res) => {
    try {
        const result = await checklistService.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================================================
// CHECKLIST MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * Create a new checklist
 * POST /api/checklists
 * Body: {
 *   checklistName: string,
 *   storeCategory: string,
 *   description: string,
 *   createdBy: string
 * }
 */
app.post('/api/checklists', async (req, res) => {
    try {
        console.log('📋 Creating new checklist:', req.body.checklistName);
        
        const result = await checklistService.createChecklist(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Error creating checklist:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get all checklists
 * GET /api/checklists?activeOnly=true
 */
app.get('/api/checklists', async (req, res) => {
    try {
        const activeOnly = req.query.activeOnly !== 'false';
        console.log(`📋 Fetching checklists (active only: ${activeOnly})`);
        
        const result = await checklistService.getChecklists(activeOnly);
        res.json(result);
    } catch (error) {
        console.error('❌ Error fetching checklists:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get checklist by ID
 * GET /api/checklists/:id
 */
app.get('/api/checklists/:id', async (req, res) => {
    try {
        const checklistId = parseInt(req.params.id);
        console.log(`📋 Fetching checklist ${checklistId}`);
        
        const result = await checklistService.getChecklistById(checklistId);
        res.json(result);
    } catch (error) {
        console.error('❌ Error fetching checklist:', error.message);
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get checklists by store category
 * GET /api/checklists/category/:category
 */
app.get('/api/checklists/category/:category', async (req, res) => {
    try {
        const storeCategory = req.params.category;
        console.log(`📋 Fetching checklists for category: ${storeCategory}`);
        
        const result = await checklistService.getChecklistsByCategory(storeCategory);
        res.json(result);
    } catch (error) {
        console.error('❌ Error fetching checklists by category:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Deactivate checklist
 * DELETE /api/checklists/:id
 */
app.delete('/api/checklists/:id', async (req, res) => {
    try {
        const checklistId = parseInt(req.params.id);
        console.log(`🔒 Deactivating checklist ${checklistId}`);
        
        const result = await checklistService.deactivateChecklist(checklistId);
        res.json(result);
    } catch (error) {
        console.error('❌ Error deactivating checklist:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================================================
// CHECKLIST ITEMS ENDPOINTS
// =============================================================================

/**
 * Add item to checklist
 * POST /api/checklists/:id/items
 * Body: {
 *   referenceValue: string,
 *   title: string,
 *   coeff: number,
 *   answer: string,
 *   cr: string,
 *   sortOrder: number
 * }
 */
app.post('/api/checklists/:id/items', async (req, res) => {
    try {
        const checklistId = parseInt(req.params.id);
        const itemData = {
            checklistId,
            ...req.body
        };
        
        console.log(`📝 Adding item ${itemData.referenceValue} to checklist ${checklistId}`);
        
        const result = await checklistService.addChecklistItem(itemData);
        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Error adding checklist item:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Add multiple items to checklist (batch)
 * POST /api/checklists/:id/items/batch
 * Body: {
 *   items: [{ referenceValue, title, coeff, answer, cr, sortOrder }, ...]
 * }
 */
app.post('/api/checklists/:id/items/batch', async (req, res) => {
    try {
        const checklistId = parseInt(req.params.id);
        const items = req.body.items;
        
        console.log(`📝 Adding ${items.length} items to checklist ${checklistId}`);
        
        const result = await checklistService.addChecklistItems(checklistId, items);
        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Error adding checklist items:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Update checklist item
 * PUT /api/items/:itemId
 * Body: {
 *   referenceValue: string,
 *   title: string,
 *   coeff: number,
 *   answer: string,
 *   cr: string
 * }
 */
app.put('/api/items/:itemId', async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId);
        console.log(`📝 Updating item ${itemId}`);
        
        const result = await checklistService.updateChecklistItem(itemId, req.body);
        res.json(result);
    } catch (error) {
        console.error('❌ Error updating checklist item:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Delete checklist item
 * DELETE /api/items/:itemId
 */
app.delete('/api/items/:itemId', async (req, res) => {
    try {
        const itemId = parseInt(req.params.itemId);
        console.log(`🗑️ Deleting item ${itemId}`);
        
        const result = await checklistService.deleteChecklistItem(itemId);
        res.json(result);
    } catch (error) {
        console.error('❌ Error deleting checklist item:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================================================
// SCORING ENDPOINTS
// =============================================================================

/**
 * Calculate checklist score
 * POST /api/checklists/:id/calculate-score
 * Body: {
 *   responses: [{ referenceValue, selectedChoice }, ...]
 * }
 */
app.post('/api/checklists/:id/calculate-score', async (req, res) => {
    try {
        const checklistId = parseInt(req.params.id);
        const responses = req.body.responses;
        
        console.log(`🧮 Calculating score for checklist ${checklistId}`);
        
        // Get checklist items
        const checklistResult = await checklistService.getChecklistById(checklistId);
        if (!checklistResult.success) {
            throw new Error('Checklist not found');
        }
        
        const items = checklistResult.checklist.items;
        
        // Calculate score
        const scoreResult = checklistService.calculateScore(responses, items);
        res.json(scoreResult);
    } catch (error) {
        console.error('❌ Error calculating score:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// =============================================================================
// START SERVER
// =============================================================================
app.listen(port, () => {
    console.log('='.repeat(60));
    console.log('📋 Checklist Management API Server Started');
    console.log('='.repeat(60));
    console.log(`🌐 Server running on: http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔍 Test connection: http://localhost:${port}/api/test-connection`);
    console.log('');
    console.log('📋 Available Endpoints:');
    console.log('  POST   /api/checklists              - Create checklist');
    console.log('  GET    /api/checklists              - Get all checklists');
    console.log('  GET    /api/checklists/:id          - Get checklist by ID');
    console.log('  GET    /api/checklists/category/:category - Get by category');
    console.log('  DELETE /api/checklists/:id          - Deactivate checklist');
    console.log('');
    console.log('  POST   /api/checklists/:id/items    - Add item to checklist');
    console.log('  POST   /api/checklists/:id/items/batch - Add multiple items');
    console.log('  PUT    /api/items/:itemId           - Update item');
    console.log('  DELETE /api/items/:itemId           - Delete item');
    console.log('');
    console.log('  POST   /api/checklists/:id/calculate-score - Calculate score');
    console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📋 Shutting down Checklist API server...');
    await checklistService.close();
    process.exit(0);
});

module.exports = app;
