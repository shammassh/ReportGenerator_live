/**
 * Template Routes
 * API endpoints for checklist template management
 * @module checklist/routes/template-routes
 */

const express = require('express');
const router = express.Router();
const TemplateService = require('../services/template-service');
const { requireAuth, requireChecklistAccess } = require('../middleware/auth-check');

const templateService = new TemplateService();

// Apply authentication to all routes
router.use(requireAuth);
router.use(requireChecklistAccess);

/**
 * GET /api/templates
 * Get all templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = await templateService.getTemplates();
    res.json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:id
 * Get template by ID (basic info)
 */
router.get('/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    const template = await templateService.getTemplateById(templateId);
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error.message);
    
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:id/full
 * Get complete template with all sections and items
 */
router.get('/:id/full', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    const template = await templateService.getTemplateWithItems(templateId);
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching full template:', error.message);
    
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:id/sections
 * Get all sections assigned to a template
 */
router.get('/:id/sections', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    const sections = await templateService.getTemplateSections(templateId);
    res.json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('Error fetching template sections:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template sections',
      message: error.message
    });
  }
});

/**
 * POST /api/templates
 * Create a new template
 * Body: { templateName, schemaId, description }
 */
router.post('/', async (req, res) => {
  try {
    const { templateName, schemaId, description } = req.body;

    // Validation
    if (!templateName || templateName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    if (!schemaId || isNaN(parseInt(schemaId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid schema ID is required'
      });
    }

    const result = await templateService.createTemplate(
      templateName.trim(),
      parseInt(schemaId),
      description || '',
      req.user.userId
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
      message: error.message
    });
  }
});

/**
 * POST /api/templates/:id/sections
 * Add a section to a template
 * Body: { sectionId }
 */
router.post('/:id/sections', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { sectionId } = req.body;

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

    const result = await templateService.addSectionToTemplate(
      templateId,
      parseInt(sectionId),
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error adding section to template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to add section',
      message: error.message
    });
  }
});

/**
 * DELETE /api/templates/:id/sections/:sectionId
 * Remove a section from a template
 */
router.delete('/:id/sections/:sectionId', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const sectionId = parseInt(req.params.sectionId);

    if (isNaN(templateId) || isNaN(sectionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template or section ID'
      });
    }

    const result = await templateService.removeSectionFromTemplate(
      templateId,
      sectionId
    );

    res.json(result);
  } catch (error) {
    console.error('Error removing section from template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to remove section',
      message: error.message
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 * Body: { templateName, description }
 */
router.put('/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { templateName, description } = req.body;

    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    if (!templateName || templateName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    const result = await templateService.updateTemplate(
      templateId,
      templateName.trim(),
      description || '',
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      message: error.message
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Deactivate a template (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    const result = await templateService.deactivateTemplate(
      templateId,
      req.user.userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error deactivating template:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate template',
      message: error.message
    });
  }
});

module.exports = router;
