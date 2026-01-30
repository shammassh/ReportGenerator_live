/**
 * Section Routes
 * API endpoints for checklist section management
 * @module checklist/routes/section-routes
 */

const express = require('express');
const router = express.Router();
const SectionService = require('../services/section-service');
const { requireAuth, requireChecklistAccess } = require('../middleware/auth-check');

const sectionService = new SectionService();

// Apply authentication to all routes
router.use(requireAuth);
router.use(requireChecklistAccess);

/**
 * GET /api/sections
 * Get all sections
 */
router.get('/', async (req, res) => {
  try {
    const sections = await sectionService.getSections();
    res.json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('Error fetching sections:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sections',
      message: error.message
    });
  }
});

/**
 * GET /api/sections/:id
 * Get section by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    
    if (isNaN(sectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid section ID'
      });
    }

    const section = await sectionService.getSectionById(sectionId);
    res.json({
      success: true,
      data: section
    });
  } catch (error) {
    console.error('Error fetching section:', error.message);
    
    if (error.message === 'Section not found') {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch section',
      message: error.message
    });
  }
});

/**
 * POST /api/sections
 * Create a new section
 * Body: { sectionName, emoji, sectionNumber }
 */
router.post('/', async (req, res) => {
  try {
    const { sectionName, emoji, sectionNumber } = req.body;

    // Validation
    if (!sectionName || sectionName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Section name is required'
      });
    }

    const result = await sectionService.createSection(
      sectionName.trim(),
      emoji || '',
      sectionNumber || null,
      req.user.userId
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating section:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create section',
      message: error.message
    });
  }
});

/**
 * PUT /api/sections/:id
 * Update an existing section
 * Body: { sectionName, emoji, sectionNumber }
 */
router.put('/:id', async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);
    const { sectionName, emoji, sectionNumber } = req.body;

    if (isNaN(sectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid section ID'
      });
    }

    if (!sectionName || sectionName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Section name is required'
      });
    }

    const result = await sectionService.updateSection(
      sectionId,
      sectionName.trim(),
      emoji || '',
      sectionNumber || null,
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating section:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update section',
      message: error.message
    });
  }
});

/**
 * DELETE /api/sections/:id
 * Deactivate a section (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const sectionId = parseInt(req.params.id);

    if (isNaN(sectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid section ID'
      });
    }

    const result = await sectionService.deactivateSection(
      sectionId,
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error deactivating section:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate section',
      message: error.message
    });
  }
});

module.exports = router;
