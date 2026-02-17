/**
 * Main Application Entry Point with Authentication
 * 
 * This integrates the authentication system with the existing application
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { initializeAuth, requireAuth, requireRole, requireAutoRole, requirePagePermission } = require('./auth/auth-server');
const DashboardPage = require('./dashboard/pages/dashboard-page');
const ChecklistManagementPage = require('./checklist/pages/checklist-management-page');
const DashboardFilterService = require('./dashboard/services/dashboard-filter-service');
const EmailNotificationService = require('./services/email-notification-service');
const NotificationHistoryService = require('./services/notification-history-service');
const ActionPlanService = require('./src/action-plan-service');
const StoreService = require('./audit-app/services/store-service');
const AuditService = require('./audit-app/services/audit-service');
const AuditReportGenerator = require('./audit-app/report-generator');
const ScoreCalculatorService = require('./audit-app/services/score-calculator-service');
const TokenRefreshService = require('./auth/services/token-refresh-service');
const SessionManager = require('./auth/services/session-manager');
const { activityLogService, logLogin, logLogout, logReportGenerated, logEmailSent, logBroadcast, logActionPlanSaved, logActionPlanSubmitted, logUserRoleChanged, logTemplateUpdated } = require('./services/activity-log-service');

/**
 * Helper function to get a valid access token, refreshing if expired
 * @param {object} req - Express request object with currentUser and sessionToken
 * @returns {Promise<string|null>} Valid access token or null
 */
async function getValidAccessToken(req) {
    const user = req.currentUser;
    const sessionToken = req.sessionToken;
    
    console.log('🔑 [TOKEN] getValidAccessToken called');
    console.log('🔑 [TOKEN] sessionToken exists:', !!sessionToken);
    console.log('🔑 [TOKEN] user exists:', !!user);
    console.log('🔑 [TOKEN] user.accessToken length:', user?.accessToken?.length || 0);
    
    if (!user || !sessionToken) {
        console.log('❌ [TOKEN] No user or session token');
        return null;
    }
    
    // Try current token first
    if (user.accessToken) {
        console.log('🔑 [TOKEN] Checking if current token is valid...');
        const isValid = await TokenRefreshService.isTokenValid(user.accessToken);
        console.log('🔑 [TOKEN] Current token valid:', isValid);
        if (isValid) {
            return user.accessToken;
        }
    }
    
    // Token expired - try to refresh
    console.log('⏰ [TOKEN] Access token expired, attempting refresh...');
    
    // Get session with refresh token
    const session = await SessionManager.getSession(sessionToken);
    console.log('🔑 [TOKEN] Session retrieved:', !!session);
    console.log('🔑 [TOKEN] Refresh token exists:', !!session?.azure_refresh_token);
    console.log('🔑 [TOKEN] Refresh token length:', session?.azure_refresh_token?.length || 0);
    
    if (!session || !session.azure_refresh_token) {
        console.log('❌ [TOKEN] No refresh token available in session');
        return null;
    }
    
    // Refresh the token
    console.log('🔑 [TOKEN] Calling TokenRefreshService.refreshAccessToken...');
    const newTokens = await TokenRefreshService.refreshAccessToken(sessionToken, session.azure_refresh_token);
    console.log('🔑 [TOKEN] Refresh result:', !!newTokens);
    
    if (newTokens) {
        console.log('✅ [TOKEN] Token refreshed successfully');
        // Update req.currentUser with new token for this request
        req.currentUser.accessToken = newTokens.accessToken;
        return newTokens.accessToken;
    }
    
    console.log('❌ [TOKEN] Token refresh failed');
    return null;
}

// Initialize Action Plan Service
const actionPlanService = new ActionPlanService();

//Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Body parser for JSON with increased limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Disable caching for API routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Serve favicon
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'favicon.ico'));
});

// Serve static files from dashboard folder
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

// Serve static files from checklist folder
app.use('/checklist', express.static(path.join(__dirname, 'checklist')));

// ==========================================
// Initialize Authentication System (Phase 2)
// ==========================================
const authServer = initializeAuth(app);

// ==========================================
// Initialize Authentication System
// ==========================================
console.log('[APP] Authentication system loaded');

// ==========================================
// Initialize Checklist Management (Phase 6)
// ==========================================
const checklistManagement = new ChecklistManagementPage(app);

console.log('[APP] Checklist management system loaded');

// ==========================================
// Initialize Audit Template System
// ==========================================
const AuditTemplateService = require('./src/services/audit-template-service');
const auditTemplateService = new AuditTemplateService();

// Serve the template builder page - uses auto role from MenuPermissions
app.get('/admin/template-builder', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-template-builder.html'));
});

// API Routes for Audit Templates - all use page permission from /admin/template-builder
const TEMPLATE_PAGE = '/admin/template-builder';
const ROLE_PAGE = '/admin/role-management';
const STORE_PAGE = '/admin/store-management';
const BRAND_PAGE = '/admin/brand-management';
const SYSTEM_SETTINGS_PAGE = '/admin/system-settings';
const NOTIFICATION_PAGE = '/admin/notification-history';
const BROADCAST_PAGE = '/admin/broadcast';

// Get all schemas
app.get('/api/audit-templates/schemas', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const schemas = await auditTemplateService.getAllSchemas();
        res.json({ success: true, data: schemas });
    } catch (error) {
        console.error('Error fetching schemas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create schema
app.post('/api/audit-templates/schemas', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const result = await auditTemplateService.createSchema(schemaName, description, req.currentUser.email);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating schema:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get full schema with sections and items
app.get('/api/audit-templates/schemas/:schemaId', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const schema = await auditTemplateService.getFullSchema(parseInt(req.params.schemaId));
        res.json({ success: true, data: schema });
    } catch (error) {
        console.error('Error fetching schema:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update schema (rename)
app.put('/api/audit-templates/schemas/:schemaId', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        if (!schemaName || schemaName.trim() === '') {
            return res.status(400).json({ success: false, error: 'Schema name is required' });
        }
        const result = await auditTemplateService.updateSchema(
            parseInt(req.params.schemaId),
            schemaName.trim(),
            description || '',
            req.currentUser.email
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating schema:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete schema (soft delete)
app.delete('/api/audit-templates/schemas/:schemaId', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await auditTemplateService.deleteSchema(
            parseInt(req.params.schemaId),
            req.currentUser.email
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting schema:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get sections by schema
app.get('/api/audit-templates/schemas/:schemaId/sections', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sections = await auditTemplateService.getSectionsBySchema(parseInt(req.params.schemaId));
        res.json({ success: true, data: sections });
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create section
app.post('/api/audit-templates/schemas/:schemaId/sections', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { sectionNumber, sectionName, sectionIcon } = req.body;
        const result = await auditTemplateService.createSection(
            parseInt(req.params.schemaId),
            sectionNumber,
            sectionName,
            sectionIcon,
            req.currentUser.email
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating section:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get items by section
app.get('/api/audit-templates/sections/:sectionId/items', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const items = await auditTemplateService.getItemsBySection(parseInt(req.params.sectionId));
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create item
app.post('/api/audit-templates/sections/:sectionId/items', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { referenceValue, title, coeff, answer, cr } = req.body;
        const result = await auditTemplateService.createItem(
            parseInt(req.params.sectionId),
            referenceValue,
            title,
            coeff,
            answer,
            cr,
            req.currentUser.email
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk create items
app.post('/api/audit-templates/sections/:sectionId/items/bulk', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { items, duplicateAction = 'skip' } = req.body;
        const sectionId = parseInt(req.params.sectionId);
        const userEmail = req.currentUser.email;

        console.log(`[BULK UPLOAD] Starting upload of ${items?.length || 0} items to section ${sectionId}, duplicate action: ${duplicateAction}`);

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'No items provided' });
        }

        // Fetch ALL existing items (including inactive/deleted) to check for duplicates
        const existingItems = await auditTemplateService.getAllItemsBySection(sectionId);
        const existingRefValues = existingItems.map(i => `${i.referenceValue?.trim()} (active: ${i.isActive})`);
        console.log(`[BULK UPLOAD] All items in section ${sectionId}:`, existingRefValues);

        let created = 0;
        let updated = 0;
        let reactivated = 0;
        let skipped = 0;
        let errors = 0;
        const errorDetails = [];

        for (const item of items) {
            try {
                // Normalize reference value (trim whitespace)
                const refValue = item.referenceValue?.trim();
                
                // Validate reference value length
                if (!refValue || refValue.length > 20) {
                    throw new Error(`Invalid reference value (max 20 chars): "${item.referenceValue?.substring(0, 30)}..."`);
                }
                
                console.log(`[BULK UPLOAD] Processing item: "${refValue}"`);
                
                // Check if item already exists (case-insensitive comparison)
                const existingItem = existingItems.find(i => 
                    i.referenceValue?.trim().toLowerCase() === refValue.toLowerCase()
                );
                
                if (existingItem) {
                    console.log(`[BULK UPLOAD] Found existing item: "${existingItem.referenceValue}" (ID: ${existingItem.itemId}, active: ${existingItem.isActive})`);
                    
                    // If item is INACTIVE, always reactivate it (regardless of skip/update mode)
                    if (!existingItem.isActive) {
                        await auditTemplateService.updateAndReactivateItem(
                            existingItem.itemId,
                            refValue,
                            item.title,
                            item.coeff || 2,
                            item.answer || 'Yes,Partially,No,NA',
                            item.cr || '',
                            userEmail
                        );
                        reactivated++;
                        console.log(`[BULK UPLOAD] Reactivated deleted item: ${refValue}`);
                    } else if (duplicateAction === 'update') {
                        // Item is active - update it
                        await auditTemplateService.updateAndReactivateItem(
                            existingItem.itemId,
                            refValue,
                            item.title,
                            item.coeff || 2,
                            item.answer || 'Yes,Partially,No,NA',
                            item.cr || '',
                            userEmail
                        );
                        updated++;
                        console.log(`[BULK UPLOAD] Updated item: ${refValue}`);
                    } else {
                        // Item is active and mode is skip - skip it
                        skipped++;
                        console.log(`[BULK UPLOAD] Skipped active duplicate: ${refValue}`);
                    }
                } else {
                    // Create new item
                    await auditTemplateService.createItem(
                        sectionId,
                        refValue,
                        item.title,
                        item.coeff || 2,
                        item.answer || 'Yes,Partially,No,NA',
                        item.cr || '',
                        userEmail
                    );
                    created++;
                    console.log(`[BULK UPLOAD] Created item: ${refValue}`);
                }
            } catch (itemError) {
                errors++;
                console.error(`[BULK UPLOAD] Error processing item ${item.referenceValue}:`, itemError.message);
                errorDetails.push({ referenceValue: item.referenceValue, error: itemError.message });
            }
        }

        console.log(`[BULK UPLOAD] Completed: ${created} created, ${updated} updated, ${reactivated} reactivated, ${skipped} skipped, ${errors} errors`);
        
        res.json({ 
            success: true, 
            data: { 
                created,
                updated,
                reactivated,
                skipped,
                errors,
                total: items.length,
                errorDetails: errors > 0 ? errorDetails : undefined
            } 
        });
    } catch (error) {
        console.error('Error bulk creating items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update item
app.put('/api/audit-templates/items/:itemId', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { referenceValue, title, coeff, answer, cr } = req.body;
        const result = await auditTemplateService.updateItem(
            parseInt(req.params.itemId),
            referenceValue,
            title,
            coeff,
            answer,
            cr,
            req.currentUser.email
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete item
app.delete('/api/audit-templates/items/:itemId', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await auditTemplateService.deleteItem(parseInt(req.params.itemId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete ALL items in a section
app.delete('/api/audit-templates/sections/:sectionId/items/all', requireAuth, requirePagePermission(TEMPLATE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sectionId = parseInt(req.params.sectionId);
        const result = await auditTemplateService.deleteAllItemsInSection(sectionId);
        console.log(`[DELETE ALL] Deleted ${result.deleted} items from section ${sectionId}`);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting all items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Audit template system loaded');

// ==========================================
// Category Management System
// ==========================================
const CategoryService = require('./audit-app/services/category-service');
let categoryService = null;

// Initialize category service after DB connection
async function initCategoryService() {
    try {
        // Use the existing AuditService instance to get the pool
        const pool = await AuditService.getPool();
        categoryService = new CategoryService(pool);
        console.log('[APP] Category service initialized');
    } catch (error) {
        console.error('Failed to init category service:', error.message);
    }
}
// Delay initialization to allow AuditService to connect
setTimeout(() => initCategoryService(), 2000);

// Serve Category Management page - uses auto role from MenuPermissions
app.get('/admin/category-management', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/category-manager.html'));
});

// API: Get all schemas (for dropdown)
app.get('/api/audit/schemas', requireAuth, async (req, res) => {
    try {
        const schemas = await auditTemplateService.getAllSchemas();
        res.json(schemas);
    } catch (error) {
        console.error('Error fetching schemas:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Get categories with sections for a schema
app.get('/api/categories', requireAuth, async (req, res) => {
    try {
        const schemaId = parseInt(req.query.schemaId);
        if (!schemaId) {
            return res.status(400).json({ error: 'schemaId is required' });
        }
        const categories = await categoryService.getCategoriesWithSections(schemaId);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Get uncategorized sections
app.get('/api/categories/uncategorized', requireAuth, async (req, res) => {
    try {
        const schemaId = parseInt(req.query.schemaId);
        if (!schemaId) {
            return res.status(400).json({ error: 'schemaId is required' });
        }
        const sections = await categoryService.getUncategorizedSections(schemaId);
        res.json(sections);
    } catch (error) {
        console.error('Error fetching uncategorized sections:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Create category
app.post('/api/categories', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { schemaId, categoryName, displayOrder } = req.body;
        const result = await categoryService.createCategory(schemaId, categoryName, displayOrder);
        res.json(result);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Update category
app.put('/api/categories/:categoryId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const { categoryName, displayOrder, isActive } = req.body;
        const result = await categoryService.updateCategory(categoryId, categoryName, displayOrder, isActive);
        res.json(result);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Delete category
app.delete('/api/categories/:categoryId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const result = await categoryService.deleteCategory(categoryId);
        res.json(result);
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Add section to category
app.post('/api/categories/:categoryId/sections', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const { sectionId, displayOrder } = req.body;
        const result = await categoryService.addSectionToCategory(categoryId, sectionId, displayOrder || 0);
        res.json(result);
    } catch (error) {
        console.error('Error adding section to category:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Remove section from category
app.delete('/api/categories/:categoryId/sections/:sectionId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const categoryId = parseInt(req.params.categoryId);
        const sectionId = parseInt(req.params.sectionId);
        const result = await categoryService.removeSectionFromCategory(categoryId, sectionId);
        res.json(result);
    } catch (error) {
        console.error('Error removing section from category:', error);
        res.status(500).json({ error: error.message });
    }
});

console.log('[APP] Category management system loaded');

// ==========================================
// Store Management System
// ==========================================

// Serve Store Management page - uses auto role from MenuPermissions
app.get('/admin/store-management', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/store-management.html'));
});

// Get all stores
app.get('/api/stores', requireAuth, async (req, res) => {
    try {
        const stores = await StoreService.getAllStores();
        res.json({ success: true, data: stores });
    } catch (error) {
        console.error('Error getting stores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get active stores only
app.get('/api/stores/active', requireAuth, async (req, res) => {
    try {
        const stores = await StoreService.getActiveStores();
        res.json({ success: true, data: stores });
    } catch (error) {
        console.error('Error getting active stores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available store managers (users with StoreManager or Admin role)
// MUST be before /:storeId routes
app.get('/api/stores/available-managers', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const managers = await StoreService.getAvailableStoreManagers();
        res.json({ success: true, data: managers });
    } catch (error) {
        console.error('Error getting available store managers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all store manager assignments (grouped by store)
// MUST be before /:storeId routes
app.get('/api/stores/manager-assignments', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const assignments = await StoreService.getAllStoreManagerAssignments();
        res.json({ success: true, data: assignments });
    } catch (error) {
        console.error('Error getting store manager assignments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create store
app.post('/api/stores', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const storeData = {
            ...req.body,
            createdBy: req.currentUser.email
        };
        const result = await StoreService.createStore(storeData);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update store
app.put('/api/stores/:storeId', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await StoreService.updateStore(parseInt(req.params.storeId), req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating store:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete store
app.delete('/api/stores/:storeId', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await StoreService.deleteStore(parseInt(req.params.storeId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting store:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get store managers for a specific store
app.get('/api/stores/:storeId/managers', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const managers = await StoreService.getStoreManagers(parseInt(req.params.storeId));
        res.json({ success: true, data: managers });
    } catch (error) {
        console.error('Error getting store managers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Assign store managers to a store
app.post('/api/stores/:storeId/managers', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { userIds } = req.body;
        console.log(`📝 [STORE-MGMT] User ${req.currentUser?.email} (${req.currentUser?.role}) assigning managers to store ${req.params.storeId}:`, userIds);
        
        if (!Array.isArray(userIds)) {
            return res.status(400).json({ success: false, error: 'userIds must be an array' });
        }
        const result = await StoreService.assignStoreManagers(
            parseInt(req.params.storeId),
            userIds,
            req.currentUser?.email || 'Admin'
        );
        console.log(`✅ [STORE-MGMT] Assignment successful:`, result);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('❌ [STORE-MGMT] Error assigning store managers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove a store manager from a store
app.delete('/api/stores/:storeId/managers/:userId', requireAuth, requirePagePermission(STORE_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await StoreService.removeStoreManager(
            parseInt(req.params.storeId),
            parseInt(req.params.userId)
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error removing store manager:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get assigned stores for current StoreManager
app.get('/api/store-manager/my-stores', requireAuth, async (req, res) => {
    try {
        const user = req.currentUser;
        
        // Check if impersonating with assigned stores
        if (user._isImpersonating && user.assignedStores && user.assignedStores.length > 0) {
            // Return impersonation assigned stores
            const allStores = await StoreService.getAllStores();
            const matchedStores = allStores
                .filter(s => user.assignedStores.includes(s.storeName))
                .map(s => ({
                    storeId: s.storeId,
                    storeCode: s.storeCode,
                    storeName: s.storeName,
                    isPrimary: true
                }));
            
            return res.json({ 
                success: true, 
                stores: matchedStores
            });
        }
        
        // Get store assignments for this user from database
        const assignments = await StoreService.getStoreAssignmentsForUser(user.id);
        
        res.json({ 
            success: true, 
            stores: assignments.map(a => ({
                storeId: a.storeId,
                storeCode: a.storeCode,
                storeName: a.storeName,
                isPrimary: a.isPrimary
            }))
        });
    } catch (error) {
        console.error('Error getting store assignments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// HeadOfOperations / AreaManager Region APIs
// ==========================================

// Get assigned region info for HeadOfOperations or AreaManager
app.get('/api/region-manager/my-region', requireAuth, requireRole('HeadOfOperations', 'AreaManager', 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const user = req.currentUser;
        
        if (user.role === 'HeadOfOperations' || (user._isImpersonating && user.role === 'HeadOfOperations')) {
            // Check if impersonating with assignedBrands
            let brands = user.assignedBrands || [];
            
            // If not impersonating or no brands from impersonation, get from database
            if (brands.length === 0 && !user._isImpersonating) {
                brands = await StoreService.getBrandAssignmentsForUser(user.id);
            }
            
            return res.json({ 
                success: true, 
                role: 'HeadOfOperations',
                brands: brands
            });
        }
        
        if (user.role === 'AreaManager' || (user._isImpersonating && user.role === 'AreaManager')) {
            // Check if impersonating with assignedStores
            let stores = [];
            
            if (user._isImpersonating && user.assignedStores && user.assignedStores.length > 0) {
                // Convert store codes to store objects
                stores = user.assignedStores.map(code => ({ storeCode: code, storeName: code }));
            } else if (!user._isImpersonating) {
                stores = await StoreService.getAreaAssignmentsForUser(user.id);
            }
            
            return res.json({ 
                success: true, 
                role: 'AreaManager',
                stores: stores
            });
        }
        
        // Admin/SuperAuditor - return empty (they see all)
        res.json({ 
            success: true, 
            role: user.role,
            brands: [],
            stores: []
        });
    } catch (error) {
        console.error('Error getting region info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Store management system loaded');

// ==========================================
// Brand Management System
// ==========================================
const BrandService = require('./admin/services/brand-service');

// Get all brands
app.get('/api/brands', requireAuth, async (req, res) => {
    try {
        const activeOnly = req.query.activeOnly !== 'false';
        const brands = await BrandService.getAllBrands(activeOnly);
        res.json({ success: true, data: brands });
    } catch (error) {
        console.error('Error getting brands:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single brand
app.get('/api/brands/:brandId', requireAuth, requirePagePermission(BRAND_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const brand = await BrandService.getBrandById(parseInt(req.params.brandId));
        if (!brand) {
            return res.status(404).json({ success: false, error: 'Brand not found' });
        }
        res.json({ success: true, data: brand });
    } catch (error) {
        console.error('Error getting brand:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new brand
app.post('/api/brands', requireAuth, requirePagePermission(BRAND_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const brand = await BrandService.createBrand(req.body, req.currentUser.email);
        console.log(`🏷️ [BRAND] Created brand "${brand.BrandName}" by ${req.currentUser.email}`);
        res.json({ success: true, data: brand });
    } catch (error) {
        console.error('Error creating brand:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Update brand
app.put('/api/brands/:brandId', requireAuth, requirePagePermission(BRAND_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const brand = await BrandService.updateBrand(parseInt(req.params.brandId), req.body);
        console.log(`🏷️ [BRAND] Updated brand "${brand.BrandName}" by ${req.currentUser.email}`);
        res.json({ success: true, data: brand });
    } catch (error) {
        console.error('Error updating brand:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Delete/deactivate brand
app.delete('/api/brands/:brandId', requireAuth, requirePagePermission(BRAND_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await BrandService.deleteBrand(parseInt(req.params.brandId));
        console.log(`🏷️ [BRAND] Deactivated brand ID ${req.params.brandId} by ${req.currentUser.email}`);
        res.json(result);
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

console.log('[APP] Brand management system loaded');

// ==========================================
// Admin Database Tools
// ==========================================

// Clear database (delete all audit data, keep configuration)
app.post('/api/admin/clear-database', requireAuth, requireRole('Admin'), async (req, res) => {
    console.log(`🗑️ [ADMIN] Clear database requested by ${req.currentUser.email}`);
    
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const details = [];
        
        // Tables to clear (in order due to foreign keys)
        const tablesToClear = [
            'AuditPictures',
            'AuditResponses', 
            'AuditSectionScores',
            'FridgeReadings',
            'ActionPlanAuditLog',
            'ActionPlanResponses',
            'Notifications',
            'SavedReports',
            'DepartmentReports',
            'PublishedReports',
            'AuditInstances'
        ];
        
        for (const table of tablesToClear) {
            try {
                const result = await pool.request().query(`DELETE FROM ${table}`);
                details.push({ table, deleted: result.rowsAffected[0] || 0 });
                console.log(`   ✅ Cleared ${table}: ${result.rowsAffected[0]} rows`);
            } catch (err) {
                console.log(`   ⚠️ Table ${table} not found or error: ${err.message}`);
                details.push({ table, deleted: 'N/A' });
            }
        }
        
        // Reset identity seeds
        for (const table of tablesToClear) {
            try {
                await pool.request().query(`DBCC CHECKIDENT ('${table}', RESEED, 0)`);
            } catch (err) {
                // Ignore errors for tables without identity
            }
        }
        
        // Also delete report files from disk
        const reportsDir = path.join(__dirname, 'reports');
        const fs = require('fs');
        if (fs.existsSync(reportsDir)) {
            const files = fs.readdirSync(reportsDir);
            for (const file of files) {
                if (file.endsWith('.html')) {
                    fs.unlinkSync(path.join(reportsDir, file));
                }
            }
            console.log(`   ✅ Deleted ${files.length} report files`);
        }
        
        console.log(`✅ [ADMIN] Database cleared successfully by ${req.currentUser.email}`);
        res.json({ success: true, details });
        
    } catch (error) {
        console.error('Error clearing database:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Clear Live database (delete ALL data from FoodSafetyDB_Live)
app.post('/api/admin/clear-live-database', requireAuth, requireRole('Admin'), async (req, res) => {
    console.log(`🧹 [ADMIN] Clear Live database requested by ${req.currentUser.email}`);
    
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        
        // IMPORTANT: Create a NEW connection pool for Live database (don't reuse global pool!)
        const liveConfig = { ...dbConfig, database: 'FoodSafetyDB_Live' };
        const pool = await new sql.ConnectionPool(liveConfig).connect();
        
        // Verify we're connected to the right database
        const dbCheck = await pool.request().query(`SELECT DB_NAME() as CurrentDB`);
        console.log(`   📌 Connected to database: ${dbCheck.recordset[0].CurrentDB}`);
        
        if (dbCheck.recordset[0].CurrentDB !== 'FoodSafetyDB_Live') {
            await pool.close();
            throw new Error('Safety check failed: Not connected to FoodSafetyDB_Live!');
        }
        
        // Get all tables
        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            ORDER BY TABLE_NAME
        `);
        const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
        
        const details = [];
        
        // First, disable all foreign key constraints
        await pool.request().query(`EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'`);
        
        // Delete from all tables
        for (const table of tables) {
            try {
                const result = await pool.request().query(`DELETE FROM [${table}]`);
                details.push({ table, deleted: result.rowsAffected[0] || 0 });
                console.log(`   ✅ Cleared ${table}: ${result.rowsAffected[0]} rows`);
            } catch (err) {
                console.log(`   ⚠️ Error clearing ${table}: ${err.message}`);
                details.push({ table, deleted: 'Error' });
            }
        }
        
        // Re-enable all foreign key constraints
        await pool.request().query(`EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'`);
        
        // Reset identity seeds
        for (const table of tables) {
            try {
                await pool.request().query(`DBCC CHECKIDENT ('${table}', RESEED, 0)`);
            } catch (err) {
                // Ignore errors for tables without identity
            }
        }
        
        await pool.close();
        
        console.log(`✅ [ADMIN] Live database cleared successfully by ${req.currentUser.email}`);
        res.json({ success: true, details });
        
    } catch (error) {
        console.error('Error clearing live database:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Copy FoodSafetyDB to FoodSafetyDB_Live
app.post('/api/admin/copy-to-live', requireAuth, requireRole('Admin'), async (req, res) => {
    console.log(`📦 [ADMIN] Copy to Live requested by ${req.currentUser.email}`);
    
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        
        // Connect to master database to create new database
        const masterConfig = { ...dbConfig, database: 'master' };
        let masterPool = await sql.connect(masterConfig);
        
        // Drop and recreate FoodSafetyDB_Live
        await masterPool.request().query(`
            IF EXISTS (SELECT name FROM sys.databases WHERE name = 'FoodSafetyDB_Live')
            BEGIN
                ALTER DATABASE FoodSafetyDB_Live SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                DROP DATABASE FoodSafetyDB_Live;
            END
        `);
        
        // Create fresh copy using BACKUP/RESTORE is not available, so use schema scripting
        await masterPool.request().query(`CREATE DATABASE FoodSafetyDB_Live`);
        console.log('   ✅ FoodSafetyDB_Live database created fresh');
        await masterPool.close();
        
        // Connect to source database
        const sourcePool = await sql.connect(dbConfig);
        
        // Get all tables in dependency order
        const tablesResult = await sourcePool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            ORDER BY TABLE_NAME
        `);
        const tables = tablesResult.recordset.map(r => r.TABLE_NAME);
        console.log(`   📋 Found ${tables.length} tables to copy`);
        
        // Connect to target database
        const targetConfig = { ...dbConfig, database: 'FoodSafetyDB_Live' };
        const targetPool = await new sql.ConnectionPool(targetConfig).connect();
        
        let tablesCopied = 0;
        let totalRows = 0;
        const tableDetails = [];
        
        // Copy each table
        for (const table of tables) {
            try {
                // Get full column definitions from source
                const colDefsResult = await sourcePool.request().query(`
                    SELECT 
                        c.COLUMN_NAME,
                        c.DATA_TYPE,
                        c.CHARACTER_MAXIMUM_LENGTH,
                        c.NUMERIC_PRECISION,
                        c.NUMERIC_SCALE,
                        c.IS_NULLABLE,
                        COLUMNPROPERTY(OBJECT_ID('${table}'), c.COLUMN_NAME, 'IsIdentity') as IsIdentity,
                        IDENT_SEED('${table}') as IdentitySeed,
                        IDENT_INCR('${table}') as IdentityIncrement
                    FROM INFORMATION_SCHEMA.COLUMNS c
                    WHERE c.TABLE_NAME = '${table}'
                    ORDER BY c.ORDINAL_POSITION
                `);
                
                // Build CREATE TABLE statement with proper types
                let hasIdentity = false;
                const colDefs = colDefsResult.recordset.map(col => {
                    let def = `[${col.COLUMN_NAME}] ${col.DATA_TYPE}`;
                    
                    // Add size/precision based on data type
                    if (['varchar', 'nvarchar', 'char', 'nchar', 'varbinary'].includes(col.DATA_TYPE.toLowerCase())) {
                        if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                            def += '(MAX)';
                        } else if (col.CHARACTER_MAXIMUM_LENGTH) {
                            def += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                        }
                    } else if (['decimal', 'numeric'].includes(col.DATA_TYPE.toLowerCase())) {
                        def += `(${col.NUMERIC_PRECISION || 18}, ${col.NUMERIC_SCALE || 0})`;
                    }
                    
                    // Add identity
                    if (col.IsIdentity === 1) {
                        def += ` IDENTITY(${col.IdentitySeed || 1}, ${col.IdentityIncrement || 1})`;
                        hasIdentity = true;
                    }
                    
                    // Add NULL/NOT NULL
                    def += col.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';
                    
                    return def;
                });
                
                const createTableSql = `CREATE TABLE [${table}] (${colDefs.join(', ')})`;
                await targetPool.request().query(createTableSql);
                
                // Get row count
                const countResult = await sourcePool.request().query(`SELECT COUNT(*) as cnt FROM [${table}]`);
                const rowCount = countResult.recordset[0].cnt;
                
                if (rowCount > 0) {
                    // Get column names for INSERT
                    const columnNames = colDefsResult.recordset.map(c => `[${c.COLUMN_NAME}]`).join(', ');
                    
                    // Build the copy SQL - include IDENTITY_INSERT in the same batch
                    let copySql = '';
                    if (hasIdentity) {
                        copySql = `
                            SET IDENTITY_INSERT [FoodSafetyDB_Live].[dbo].[${table}] ON;
                            INSERT INTO [FoodSafetyDB_Live].[dbo].[${table}] (${columnNames})
                            SELECT ${columnNames} FROM [FoodSafetyDB].[dbo].[${table}];
                            SET IDENTITY_INSERT [FoodSafetyDB_Live].[dbo].[${table}] OFF;
                        `;
                    } else {
                        copySql = `
                            INSERT INTO [FoodSafetyDB_Live].[dbo].[${table}] (${columnNames})
                            SELECT ${columnNames} FROM [FoodSafetyDB].[dbo].[${table}]
                        `;
                    }
                    
                    await targetPool.request().query(copySql);
                }
                
                tablesCopied++;
                totalRows += rowCount;
                tableDetails.push({ table, rows: rowCount });
                console.log(`   ✅ Copied ${table}: ${rowCount} rows`);
                
            } catch (tableErr) {
                console.error(`   ❌ Error copying ${table}:`, tableErr.message);
                tableDetails.push({ table, rows: 0, error: tableErr.message });
            }
        }
        
        await sourcePool.close();
        await targetPool.close();
        
        console.log(`✅ [ADMIN] Copy to Live completed: ${tablesCopied} tables, ${totalRows} rows`);
        res.json({ success: true, tablesCopied, totalRows, details: tableDetails });
        
    } catch (error) {
        console.error('Error copying to live:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Admin database tools loaded');

// ==========================================
// Advanced Analytics (Admin Dashboard)
// ==========================================

const AnalyticsPage = require('./admin/pages/analytics-page');

// Serve analytics page - uses auto role from MenuPermissions
app.get('/admin/analytics', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    AnalyticsPage.render(req, res);
});

// Analytics API - Get all analytics data
app.get('/api/admin/analytics', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const { year, cycle, storeId } = req.query;
        
        // Build WHERE clause for filters
        let whereClause = "WHERE ai.Status = 'Completed'";
        if (year) whereClause += ` AND ai.Year = ${parseInt(year)}`;
        if (cycle) whereClause += ` AND ai.Cycle = '${cycle}'`;
        if (storeId) whereClause += ` AND ai.StoreID = ${parseInt(storeId)}`;
        
        // 1. Summary Statistics
        const summaryResult = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalAudits,
                AVG(CAST(TotalScore as FLOAT)) as AvgScore,
                SUM(CASE WHEN TotalScore >= 83 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as PassRate
            FROM AuditInstances ai
            ${whereClause}
        `);
        
        const storesCount = await pool.request().query(`SELECT COUNT(*) as cnt FROM Stores WHERE IsActive = 1`);
        const auditorsCount = await pool.request().query(`
            SELECT COUNT(DISTINCT id) as cnt FROM Users 
            WHERE role IN ('Admin', 'Auditor', 'SuperAuditor')
            AND is_active = 1
        `);
        
        const summary = {
            totalAudits: summaryResult.recordset[0]?.TotalAudits || 0,
            avgScore: summaryResult.recordset[0]?.AvgScore || 0,
            passRate: summaryResult.recordset[0]?.PassRate || 0,
            totalStores: storesCount.recordset[0]?.cnt || 0,
            totalAuditors: auditorsCount.recordset[0]?.cnt || 0
        };
        
        // 2. Trend Data (by month/cycle)
        const trendsResult = await pool.request().query(`
            SELECT 
                CONCAT(ai.Year, '-', ai.Cycle) as Period,
                ai.Year,
                ai.Cycle,
                COUNT(*) as AuditCount,
                AVG(CAST(TotalScore as FLOAT)) as AvgScore
            FROM AuditInstances ai
            ${whereClause}
            GROUP BY ai.Year, ai.Cycle
            ORDER BY ai.Year, ai.Cycle
        `);
        
        const trends = trendsResult.recordset.map(r => ({
            period: r.Period,
            year: r.Year,
            cycle: r.Cycle,
            auditCount: r.AuditCount,
            avgScore: r.AvgScore || 0
        }));
        
        // 3. Auditor Performance
        const auditorResult = await pool.request().query(`
            SELECT 
                ai.Auditors as AuditorName,
                COUNT(*) as AuditCount,
                AVG(CAST(TotalScore as FLOAT)) as AvgScore,
                MIN(TotalScore) as MinScore,
                MAX(TotalScore) as MaxScore
            FROM AuditInstances ai
            ${whereClause}
            GROUP BY ai.Auditors
            ORDER BY AvgScore DESC
        `);
        
        const auditorPerformance = auditorResult.recordset.map(r => ({
            auditorName: r.AuditorName || 'Unknown',
            auditCount: r.AuditCount,
            avgScore: r.AvgScore || 0,
            minScore: r.MinScore || 0,
            maxScore: r.MaxScore || 0
        }));
        
        // 4. Section Weakness Report
        const sectionResult = await pool.request().query(`
            SELECT 
                ss.SectionName,
                COUNT(*) as TimesAudited,
                AVG(ss.Percentage) as AvgScore,
                SUM(CASE WHEN ss.Percentage < 83 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) as FailRate
            FROM AuditSectionScores ss
            INNER JOIN AuditInstances ai ON ss.AuditID = ai.AuditID
            ${whereClause}
            GROUP BY ss.SectionName
            ORDER BY AvgScore ASC
        `);
        
        const sectionWeakness = sectionResult.recordset.map(r => ({
            sectionName: r.SectionName,
            timesAudited: r.TimesAudited,
            avgScore: r.AvgScore || 0,
            failRate: r.FailRate || 0
        }));
        
        // 5. Heatmap Data (Store x Section)
        const heatmapResult = await pool.request().query(`
            SELECT 
                ai.StoreName,
                ss.SectionName,
                AVG(ss.Percentage) as AvgScore
            FROM AuditSectionScores ss
            INNER JOIN AuditInstances ai ON ss.AuditID = ai.AuditID
            ${whereClause}
            GROUP BY ai.StoreName, ss.SectionName
        `);
        
        // Also get overall scores per store
        const storeOverallResult = await pool.request().query(`
            SELECT 
                ai.StoreName,
                AVG(CAST(ai.TotalScore as FLOAT)) as OverallScore
            FROM AuditInstances ai
            ${whereClause}
            GROUP BY ai.StoreName
        `);
        
        // Build heatmap data structure
        const stores = [...new Set(heatmapResult.recordset.map(r => r.StoreName))];
        const sections = [...new Set(heatmapResult.recordset.map(r => r.SectionName))];
        const heatmapData = {};
        
        for (const row of heatmapResult.recordset) {
            if (!heatmapData[row.StoreName]) heatmapData[row.StoreName] = {};
            heatmapData[row.StoreName][row.SectionName] = row.AvgScore;
        }
        
        // Add overall scores
        for (const row of storeOverallResult.recordset) {
            if (!heatmapData[row.StoreName]) heatmapData[row.StoreName] = {};
            heatmapData[row.StoreName]._overall = row.OverallScore;
        }
        
        const heatmap = { stores, sections, data: heatmapData };
        
        // 6. Compliance Calendar
        const calendarResult = await pool.request().query(`
            SELECT 
                s.StoreName,
                s.StoreID,
                MAX(ai.AuditDate) as LastAuditDate,
                COUNT(ai.AuditID) as TotalAudits,
                (SELECT TOP 1 TotalScore FROM AuditInstances 
                 WHERE StoreID = s.StoreID AND Status = 'Completed' 
                 ORDER BY AuditDate DESC, AuditID DESC) as LastScore
            FROM Stores s
            LEFT JOIN AuditInstances ai ON s.StoreID = ai.StoreID AND ai.Status = 'Completed'
            WHERE s.IsActive = 1
            GROUP BY s.StoreID, s.StoreName
            ORDER BY LastAuditDate DESC
        `);
        
        const complianceCalendar = calendarResult.recordset.map(r => ({
            storeId: r.StoreID,
            storeName: r.StoreName,
            lastAuditDate: r.LastAuditDate,
            totalAudits: r.TotalAudits || 0,
            lastScore: r.LastScore
        }));
        
        res.json({
            success: true,
            summary,
            trends,
            auditorPerformance,
            sectionWeakness,
            heatmap,
            complianceCalendar
        });
        
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Custom Query API - Dynamic analytics queries
app.get('/api/admin/analytics/custom-query', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const { subject, metric, limit, year, cycle, storeId } = req.query;
        const limitNum = parseInt(limit) || 10;
        
        // Build WHERE clause for filters
        let whereClause = "WHERE ai.Status = 'Completed'";
        if (year) whereClause += ` AND ai.Year = ${parseInt(year)}`;
        if (cycle) whereClause += ` AND ai.Cycle = '${cycle}'`;
        if (storeId) whereClause += ` AND ai.StoreID = ${parseInt(storeId)}`;
        
        let query = '';
        let valueLabel = 'Value';
        let results = [];
        
        // Build query based on subject and metric
        if (subject === 'stores') {
            switch (metric) {
                case 'most_fails':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.StoreName as Name,
                            SUM(CASE WHEN ai.TotalScore < 83 THEN 1 ELSE 0 END) as Value,
                            COUNT(*) as TotalAudits,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as AvgScore
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.StoreName
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Failed Audits';
                    break;
                    
                case 'most_audits':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.StoreName as Name,
                            COUNT(*) as Value,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as AvgScore
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.StoreName
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Total Audits';
                    break;
                    
                case 'lowest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.StoreName as Name,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as Value,
                            COUNT(*) as TotalAudits
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.StoreName
                        ORDER BY Value ASC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'highest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.StoreName as Name,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as Value,
                            COUNT(*) as TotalAudits
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.StoreName
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'never_pass':
                    query = `
                        SELECT 
                            ai.StoreName as Name,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as Value,
                            COUNT(*) as TotalAudits,
                            SUM(CASE WHEN ai.TotalScore >= 83 THEN 1 ELSE 0 END) as PassCount
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.StoreName
                        HAVING SUM(CASE WHEN ai.TotalScore >= 83 THEN 1 ELSE 0 END) = 0
                        ORDER BY Value ASC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'always_pass':
                    query = `
                        SELECT 
                            ai.StoreName as Name,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as Value,
                            COUNT(*) as TotalAudits,
                            SUM(CASE WHEN ai.TotalScore < 83 THEN 1 ELSE 0 END) as FailCount
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.StoreName
                        HAVING SUM(CASE WHEN ai.TotalScore < 83 THEN 1 ELSE 0 END) = 0
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'biggest_improvement':
                case 'biggest_drop':
                    // Compare first and last audit scores
                    query = `
                        WITH RankedAudits AS (
                            SELECT 
                                ai.StoreName,
                                ai.TotalScore,
                                ROW_NUMBER() OVER (PARTITION BY ai.StoreID ORDER BY ai.AuditDate, ai.AuditID) as FirstRank,
                                ROW_NUMBER() OVER (PARTITION BY ai.StoreID ORDER BY ai.AuditDate DESC, ai.AuditID DESC) as LastRank
                            FROM AuditInstances ai
                            ${whereClause}
                        )
                        SELECT TOP ${limitNum}
                            f.StoreName as Name,
                            (l.TotalScore - f.TotalScore) as Value,
                            f.TotalScore as FirstScore,
                            l.TotalScore as LastScore
                        FROM RankedAudits f
                        INNER JOIN RankedAudits l ON f.StoreName = l.StoreName AND l.LastRank = 1
                        WHERE f.FirstRank = 1
                        ORDER BY Value ${metric === 'biggest_improvement' ? 'DESC' : 'ASC'}
                    `;
                    valueLabel = 'Score Change';
                    break;
            }
        }
        
        else if (subject === 'auditors') {
            switch (metric) {
                case 'most_audits':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.Auditors as Name,
                            COUNT(*) as Value,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as AvgScore
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.Auditors
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Total Audits';
                    break;
                    
                case 'highest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.Auditors as Name,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as Value,
                            COUNT(*) as TotalAudits
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.Auditors
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'lowest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.Auditors as Name,
                            ROUND(AVG(CAST(ai.TotalScore as FLOAT)), 1) as Value,
                            COUNT(*) as TotalAudits
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.Auditors
                        ORDER BY Value ASC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'most_fails':
                    query = `
                        SELECT TOP ${limitNum}
                            ai.Auditors as Name,
                            SUM(CASE WHEN ai.TotalScore < 83 THEN 1 ELSE 0 END) as Value,
                            COUNT(*) as TotalAudits
                        FROM AuditInstances ai
                        ${whereClause}
                        GROUP BY ai.Auditors
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Failed Audits';
                    break;
            }
        }
        
        else if (subject === 'sections') {
            switch (metric) {
                case 'lowest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ss.SectionName as Name,
                            ROUND(AVG(ss.Percentage), 1) as Value,
                            COUNT(*) as TimesAudited
                        FROM AuditSectionScores ss
                        INNER JOIN AuditInstances ai ON ss.AuditID = ai.AuditID
                        ${whereClause}
                        GROUP BY ss.SectionName
                        ORDER BY Value ASC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'highest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ss.SectionName as Name,
                            ROUND(AVG(ss.Percentage), 1) as Value,
                            COUNT(*) as TimesAudited
                        FROM AuditSectionScores ss
                        INNER JOIN AuditInstances ai ON ss.AuditID = ai.AuditID
                        ${whereClause}
                        GROUP BY ss.SectionName
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Avg Score (%)';
                    break;
                    
                case 'most_fails':
                    query = `
                        SELECT TOP ${limitNum}
                            ss.SectionName as Name,
                            ROUND(SUM(CASE WHEN ss.Percentage < 83 THEN 1.0 ELSE 0 END) * 100.0 / COUNT(*), 1) as Value,
                            COUNT(*) as TimesAudited
                        FROM AuditSectionScores ss
                        INNER JOIN AuditInstances ai ON ss.AuditID = ai.AuditID
                        ${whereClause}
                        GROUP BY ss.SectionName
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Fail Rate (%)';
                    break;
                    
                case 'most_repetitive':
                    query = `
                        SELECT TOP ${limitNum}
                            ss.SectionName as Name,
                            COUNT(CASE WHEN ss.Percentage < 83 THEN 1 END) as Value,
                            ROUND(AVG(ss.Percentage), 1) as AvgScore
                        FROM AuditSectionScores ss
                        INNER JOIN AuditInstances ai ON ss.AuditID = ai.AuditID
                        ${whereClause}
                        GROUP BY ss.SectionName
                        HAVING COUNT(CASE WHEN ss.Percentage < 83 THEN 1 END) > 0
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Times Failed';
                    break;
            }
        }
        
        else if (subject === 'items') {
            switch (metric) {
                case 'most_fails':
                case 'most_repetitive':
                    query = `
                        SELECT TOP ${limitNum}
                            ar.Title as Name,
                            SUM(CASE WHEN ar.SelectedChoice = 'No' THEN 1 ELSE 0 END) as Value,
                            ar.ReferenceValue as RefValue,
                            COUNT(*) as TimesAudited
                        FROM AuditResponses ar
                        INNER JOIN AuditInstances ai ON ar.AuditID = ai.AuditID
                        ${whereClause}
                        AND ar.SelectedChoice IS NOT NULL
                        GROUP BY ar.Title, ar.ReferenceValue
                        HAVING SUM(CASE WHEN ar.SelectedChoice = 'No' THEN 1 ELSE 0 END) > 0
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Times Failed';
                    break;
                    
                case 'never_pass':
                    query = `
                        SELECT TOP ${limitNum}
                            ar.Title as Name,
                            COUNT(*) as Value,
                            ar.ReferenceValue as RefValue
                        FROM AuditResponses ar
                        INNER JOIN AuditInstances ai ON ar.AuditID = ai.AuditID
                        ${whereClause}
                        AND ar.SelectedChoice IS NOT NULL
                        GROUP BY ar.Title, ar.ReferenceValue
                        HAVING SUM(CASE WHEN ar.SelectedChoice = 'Yes' THEN 1 ELSE 0 END) = 0
                        AND SUM(CASE WHEN ar.SelectedChoice = 'No' THEN 1 ELSE 0 END) > 0
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Times Audited';
                    break;
                    
                case 'always_pass':
                    query = `
                        SELECT TOP ${limitNum}
                            ar.Title as Name,
                            COUNT(*) as Value,
                            ar.ReferenceValue as RefValue
                        FROM AuditResponses ar
                        INNER JOIN AuditInstances ai ON ar.AuditID = ai.AuditID
                        ${whereClause}
                        AND ar.SelectedChoice IS NOT NULL
                        GROUP BY ar.Title, ar.ReferenceValue
                        HAVING SUM(CASE WHEN ar.SelectedChoice = 'No' THEN 1 ELSE 0 END) = 0
                        AND SUM(CASE WHEN ar.SelectedChoice = 'Yes' THEN 1 ELSE 0 END) > 0
                        ORDER BY Value DESC
                    `;
                    valueLabel = 'Times Passed';
                    break;
                    
                case 'lowest_score':
                    query = `
                        SELECT TOP ${limitNum}
                            ar.Title as Name,
                            ROUND(
                                SUM(CASE WHEN ar.SelectedChoice = 'Yes' THEN 1.0 
                                         WHEN ar.SelectedChoice = 'Partially' THEN 0.5 
                                         ELSE 0 END) * 100.0 / 
                                NULLIF(SUM(CASE WHEN ar.SelectedChoice IN ('Yes', 'No', 'Partially') THEN 1 ELSE 0 END), 0)
                            , 1) as Value,
                            ar.ReferenceValue as RefValue,
                            COUNT(*) as TimesAudited
                        FROM AuditResponses ar
                        INNER JOIN AuditInstances ai ON ar.AuditID = ai.AuditID
                        ${whereClause}
                        AND ar.SelectedChoice IN ('Yes', 'No', 'Partially')
                        GROUP BY ar.Title, ar.ReferenceValue
                        ORDER BY Value ASC
                    `;
                    valueLabel = 'Pass Rate (%)';
                    break;
            }
        }
        
        if (query) {
            const result = await pool.request().query(query);
            results = result.recordset.map(r => ({
                name: r.Name || 'Unknown',
                value: r.Value || 0,
                suffix: valueLabel.includes('%') ? '%' : '',
                extra: r.TotalAudits ? `${r.TotalAudits} audits` : 
                       r.TimesAudited ? `${r.TimesAudited} times` :
                       r.RefValue ? `Ref: ${r.RefValue}` :
                       r.AvgScore ? `Avg: ${r.AvgScore}%` :
                       r.FirstScore !== undefined ? `${r.FirstScore}% → ${r.LastScore}%` : null
            }));
        }
        
        res.json({ success: true, results, valueLabel });
        
    } catch (error) {
        console.error('Error running custom query:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Advanced analytics loaded');

// ==========================================
// System Settings
// ==========================================

const SystemSettingsService = require('./audit-app/services/system-settings-service');

// Serve System Settings page - uses auto role from MenuPermissions
app.get('/admin/system-settings', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/system-settings.html'));
});

// Brand Management Page - uses auto role from MenuPermissions
app.get('/admin/brand-management', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/pages/brand-management.html'));
});

// Get all schemas with settings
app.get('/api/system-settings/schemas', requireAuth, requirePagePermission(SYSTEM_SETTINGS_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const schemas = await SystemSettingsService.getSchemasWithSettings();
        res.json({ success: true, schemas });
    } catch (error) {
        console.error('Error getting schemas with settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get settings for a specific schema
app.get('/api/system-settings/schema/:schemaId', requireAuth, requirePagePermission(SYSTEM_SETTINGS_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const settings = await SystemSettingsService.getSchemaSettings(parseInt(req.params.schemaId));
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error getting schema settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save settings for a schema
app.post('/api/system-settings/schema/:schemaId', requireAuth, requirePagePermission(SYSTEM_SETTINGS_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await SystemSettingsService.saveSchemaSettings(
            parseInt(req.params.schemaId),
            req.body,
            req.currentUser.email
        );
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error saving schema settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] System settings loaded');

// ==========================================
// Schema Colors (integrated with System Settings)
// ==========================================

const SchemaColorsService = require('./audit-app/services/schema-colors-service');
const schemaColorsService = new SchemaColorsService();

// Get colors for a schema
app.get('/api/schema-colors/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const colors = await schemaColorsService.getSchemaColors(parseInt(req.params.schemaId));
        res.json({ success: true, colors });
    } catch (error) {
        console.error('Error getting schema colors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save colors for a schema
app.post('/api/schema-colors/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        await schemaColorsService.saveSchemaColors(parseInt(req.params.schemaId), req.body);
        res.json({ success: true, message: 'Colors saved successfully' });
    } catch (error) {
        console.error('Error saving schema colors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset colors to defaults
app.post('/api/schema-colors/:schemaId/reset', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await schemaColorsService.resetSchemaColors(parseInt(req.params.schemaId));
        res.json({ success: true, colors: result.colors });
    } catch (error) {
        console.error('Error resetting schema colors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get default colors
app.get('/api/schema-colors/defaults', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const colors = schemaColorsService.getDefaultColors();
        res.json({ success: true, colors });
    } catch (error) {
        console.error('Error getting default colors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Schema colors API loaded');

// ==========================================
// Menu Settings API (Admin Only)
// ==========================================

// Serve menu settings page - uses auto role from MenuPermissions
app.get('/admin/menu-settings', requireAuth, requireAutoRole('Admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'menu-settings.html'));
});

// Get all menu settings (all authenticated users can read - needed for dashboard permissions)
app.get('/api/menu/settings', requireAuth, async (req, res) => {
    try {
        const sql = require('mssql');
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        const result = await pool.request().query(`
            SELECT MenuID, ButtonID, ButtonName, Category, Icon, Url, ActionType, 
                   AllowedRoles, EditRoles, IsEnabled, SortOrder, CreatedAt, ModifiedAt
            FROM MenuPermissions
            ORDER BY Category, SortOrder
        `);
        
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('[MenuSettings] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save menu settings
app.post('/api/menu/settings', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({ success: false, error: 'Invalid settings data' });
        }
        
        const sql = require('mssql');
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        // Update each menu item
        for (const item of settings) {
            await pool.request()
                .input('menuId', sql.Int, item.MenuID)
                .input('allowedRoles', sql.VarChar(500), item.AllowedRoles || '')
                .input('editRoles', sql.VarChar(500), item.EditRoles || '')
                .input('isEnabled', sql.Bit, item.IsEnabled ? 1 : 0)
                .input('sortOrder', sql.Int, item.SortOrder || 0)
                .query(`
                    UPDATE MenuPermissions 
                    SET AllowedRoles = @allowedRoles, 
                        EditRoles = @editRoles,
                        IsEnabled = @isEnabled, 
                        SortOrder = @sortOrder,
                        ModifiedAt = GETDATE()
                    WHERE MenuID = @menuId
                `);
        }
        
        console.log(`[MenuSettings] Settings saved by ${req.currentUser.email}`);
        res.json({ success: true, message: 'Settings saved' });
    } catch (error) {
        console.error('[MenuSettings] Save error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset to defaults
app.post('/api/menu/settings/reset', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        // Reset all to default enabled state and roles
        await pool.request().query(`
            UPDATE MenuPermissions SET
                AllowedRoles = CASE ButtonID
                    WHEN 'viewAuditsBtn' THEN 'Admin,SuperAuditor,Auditor'
                    WHEN 'startAuditBtn' THEN 'Admin,SuperAuditor,Auditor'
                    WHEN 'calendarBtn' THEN 'Admin,SuperAuditor,Auditor'
                    WHEN 'scoreCalculatorBtn' THEN 'Admin,SuperAuditor'
                    WHEN 'viewReportsBtn' THEN 'Admin,SuperAuditor,Auditor'
                    WHEN 'notificationHistoryBtn' THEN 'Admin,Auditor'
                    WHEN 'broadcastBtn' THEN 'Admin,SuperAuditor'
                    WHEN 'emailTemplatesBtn' THEN 'Admin'
                    WHEN 'adminPanelBtn' THEN 'Admin'
                    WHEN 'storeManagementBtn' THEN 'Admin,SuperAuditor'
                    WHEN 'brandManagementBtn' THEN 'Admin,SuperAuditor'
                    WHEN 'templateBuilderBtn' THEN 'Admin,SuperAuditor'
                    WHEN 'systemSettingsBtn' THEN 'Admin,SuperAuditor'
                    WHEN 'activityLogBtn' THEN 'Admin'
                    WHEN 'dbInspectorBtn' THEN 'Admin'
                    ELSE AllowedRoles
                END,
                IsEnabled = 1,
                ModifiedAt = GETDATE()
        `);
        
        console.log(`[MenuSettings] Reset to defaults by ${req.currentUser.email}`);
        res.json({ success: true, message: 'Reset to defaults' });
    } catch (error) {
        console.error('[MenuSettings] Reset error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Menu settings API loaded');

// ==========================================
// Role Management API
// ==========================================

// Serve role management page - uses auto role from MenuPermissions
app.get('/admin/role-management', requireAuth, requireAutoRole('Admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'role-management.html'));
});

// Get all roles with user counts
app.get('/api/roles', requireAuth, requirePagePermission(ROLE_PAGE, 'Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        // Get roles
        const rolesResult = await pool.request().query(`
            SELECT RoleID, RoleName, Description, CreatedDate
            FROM UserRoles
            ORDER BY RoleID
        `);
        
        // Get total users count
        const usersResult = await pool.request().query(`SELECT COUNT(*) as total FROM Users`);
        
        console.log(`[Roles] Loaded ${rolesResult.recordset.length} roles`);
        
        res.json({ 
            success: true, 
            roles: rolesResult.recordset,
            totalUsers: usersResult.recordset[0].total
        });
    } catch (error) {
        console.error('[Roles] Load error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new role
app.post('/api/roles', requireAuth, requirePagePermission(ROLE_PAGE, 'Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const { roleName, description } = req.body;
        
        if (!roleName || !/^[A-Za-z][A-Za-z0-9]*$/.test(roleName)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Role name must start with a letter and contain only letters/numbers' 
            });
        }
        
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        // Check if role already exists
        const existing = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .query(`SELECT RoleID FROM UserRoles WHERE RoleName = @roleName`);
        
        if (existing.recordset.length > 0) {
            return res.status(400).json({ success: false, error: 'Role already exists' });
        }
        
        // Insert new role
        const result = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .input('description', sql.NVarChar, description || '')
            .query(`
                INSERT INTO UserRoles (RoleName, Description, CreatedDate)
                VALUES (@roleName, @description, GETDATE());
                SELECT SCOPE_IDENTITY() as newId;
            `);
        
        console.log(`[Roles] Created role "${roleName}" by ${req.currentUser.email}`);
        
        res.json({ success: true, roleId: result.recordset[0].newId });
    } catch (error) {
        console.error('[Roles] Create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update role (description only)
app.put('/api/roles/:roleId', requireAuth, requirePagePermission(ROLE_PAGE, 'Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const roleId = parseInt(req.params.roleId);
        const { description } = req.body;
        
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        await pool.request()
            .input('roleId', sql.Int, roleId)
            .input('description', sql.NVarChar, description || '')
            .query(`UPDATE UserRoles SET Description = @description WHERE RoleID = @roleId`);
        
        console.log(`[Roles] Updated role ID ${roleId} by ${req.currentUser.email}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Roles] Update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete role (with safety checks)
app.delete('/api/roles/:roleId', requireAuth, requirePagePermission(ROLE_PAGE, 'Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const roleId = parseInt(req.params.roleId);
        
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
        
        // Check if it's a protected role
        const roleResult = await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`SELECT RoleName FROM UserRoles WHERE RoleID = @roleId`);
        
        if (roleResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }
        
        const roleName = roleResult.recordset[0].RoleName;
        const protectedRoles = ['Admin', 'Auditor', 'SuperAuditor', 'StoreManager'];
        
        if (protectedRoles.includes(roleName)) {
            return res.status(400).json({ success: false, error: 'Protected roles cannot be deleted' });
        }
        
        // Check if any users have this role
        const usersWithRole = await pool.request()
            .input('roleName', sql.NVarChar, roleName)
            .query(`SELECT COUNT(*) as count FROM Users WHERE Role = @roleName`);
        
        if (usersWithRole.recordset[0].count > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete: ${usersWithRole.recordset[0].count} user(s) have this role` 
            });
        }
        
        // Delete the role
        await pool.request()
            .input('roleId', sql.Int, roleId)
            .query(`DELETE FROM UserRoles WHERE RoleID = @roleId`);
        
        console.log(`[Roles] Deleted role "${roleName}" (ID: ${roleId}) by ${req.currentUser.email}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Roles] Delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Role management API loaded');

// ==========================================
// Checklist Info API
// ==========================================

// Get checklist info for a schema
app.get('/api/schema-checklist-info/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const schemaId = parseInt(req.params.schemaId);
        console.log(`[ChecklistInfo] GET request for schema ${schemaId}`);
        
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: {
                encrypt: process.env.SQL_ENCRYPT === 'true',
                trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
            }
        });
        
        // Ensure columns exist first
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'CreationDate')
            BEGIN
                ALTER TABLE AuditSchemas ADD CreationDate DATE NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'RevisionDate')
            BEGIN
                ALTER TABLE AuditSchemas ADD RevisionDate DATE NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'Edition')
            BEGIN
                ALTER TABLE AuditSchemas ADD Edition NVARCHAR(50) NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'ReportTitle')
            BEGIN
                ALTER TABLE AuditSchemas ADD ReportTitle NVARCHAR(200) NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'DocumentPrefix')
            BEGIN
                ALTER TABLE AuditSchemas ADD DocumentPrefix NVARCHAR(50) NULL;
            END;
        `);
        
        const result = await pool.request()
            .input('SchemaID', sql.Int, schemaId)
            .query(`
                SELECT CreationDate, RevisionDate, Edition, ReportTitle, DocumentPrefix
                FROM AuditSchemas
                WHERE SchemaID = @SchemaID
            `);
        
        if (result.recordset.length > 0) {
            const row = result.recordset[0];
            res.json({ 
                success: true, 
                info: {
                    creationDate: row.CreationDate ? row.CreationDate.toISOString().split('T')[0] : '',
                    revisionDate: row.RevisionDate ? row.RevisionDate.toISOString().split('T')[0] : '',
                    edition: row.Edition || '',
                    reportTitle: row.ReportTitle || '',
                    documentPrefix: row.DocumentPrefix || ''
                }
            });
        } else {
            res.json({ success: true, info: { creationDate: '', revisionDate: '', edition: '', reportTitle: '', documentPrefix: '' } });
        }
    } catch (error) {
        console.error('Error getting checklist info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save checklist info for a schema
app.post('/api/schema-checklist-info/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const schemaId = parseInt(req.params.schemaId);
        const { creationDate, revisionDate, edition, reportTitle, documentPrefix } = req.body;
        
        // Parse dates properly - empty strings become null
        const parsedCreationDate = creationDate && creationDate.trim() ? new Date(creationDate) : null;
        const parsedRevisionDate = revisionDate && revisionDate.trim() ? new Date(revisionDate) : null;
        const parsedEdition = edition && edition.trim() ? edition.trim() : null;
        const parsedReportTitle = reportTitle && reportTitle.trim() ? reportTitle.trim() : null;
        const parsedDocumentPrefix = documentPrefix && documentPrefix.trim() ? documentPrefix.trim() : null;
        
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: {
                encrypt: process.env.SQL_ENCRYPT === 'true',
                trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
            }
        });
        
        // First ensure the columns exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'CreationDate')
            BEGIN
                ALTER TABLE AuditSchemas ADD CreationDate DATE NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'RevisionDate')
            BEGIN
                ALTER TABLE AuditSchemas ADD RevisionDate DATE NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'Edition')
            BEGIN
                ALTER TABLE AuditSchemas ADD Edition NVARCHAR(50) NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'ReportTitle')
            BEGIN
                ALTER TABLE AuditSchemas ADD ReportTitle NVARCHAR(200) NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'DocumentPrefix')
            BEGIN
                ALTER TABLE AuditSchemas ADD DocumentPrefix NVARCHAR(50) NULL;
            END;
        `);
        
        await pool.request()
            .input('SchemaID', sql.Int, schemaId)
            .input('CreationDate', sql.Date, parsedCreationDate)
            .input('RevisionDate', sql.Date, parsedRevisionDate)
            .input('Edition', sql.NVarChar(50), parsedEdition)
            .input('ReportTitle', sql.NVarChar(200), parsedReportTitle)
            .input('DocumentPrefix', sql.NVarChar(50), parsedDocumentPrefix)
            .query(`
                UPDATE AuditSchemas
                SET CreationDate = @CreationDate,
                    RevisionDate = @RevisionDate,
                    Edition = @Edition,
                    ReportTitle = @ReportTitle,
                    DocumentPrefix = @DocumentPrefix
                WHERE SchemaID = @SchemaID
            `);
        
        console.log(`✅ Saved checklist info for schema ${schemaId}: Edition=${parsedEdition}, ReportTitle=${parsedReportTitle}, DocumentPrefix=${parsedDocumentPrefix}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving checklist info:', error);
        console.error('Error details:', error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save section icons
app.post('/api/section-icons/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const { schemaId } = req.params;
        const { icons } = req.body;
        
        if (!icons || !Array.isArray(icons) || icons.length === 0) {
            return res.json({ success: true, message: 'No icons to update' });
        }
        
        const pool = await sql.connect({
            server: process.env.DB_SERVER || 'localhost',
            database: process.env.DB_NAME || 'FoodSafetyDB',
            user: process.env.DB_USER || 'aboraborsa',
            password: process.env.DB_PASSWORD || 'Jk@123456789',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        });
        
        // Update each section's icon
        for (const { sectionId, icon } of icons) {
            await pool.request()
                .input('SectionID', sql.Int, sectionId)
                .input('SectionIcon', sql.NVarChar(10), icon)
                .input('ModifiedBy', sql.NVarChar(255), req.currentUser.email)
                .query(`
                    UPDATE AuditSections
                    SET SectionIcon = @SectionIcon,
                        ModifiedBy = @ModifiedBy,
                        ModifiedDate = GETDATE()
                    WHERE SectionID = @SectionID
                `);
        }
        
        console.log(`✅ Saved ${icons.length} section icon(s) for schema ${schemaId}`);
        res.json({ success: true, updated: icons.length });
    } catch (error) {
        console.error('Error saving section icons:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get department names for a schema
app.get('/api/schema-department-names/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        });
        
        const schemaId = parseInt(req.params.schemaId);
        
        const result = await pool.request()
            .input('SchemaID', sql.Int, schemaId)
            .query(`
                SELECT DeptNameMaintenance, DeptNameProcurement, DeptNameCleaning
                FROM AuditSchemas
                WHERE SchemaID = @SchemaID
            `);
        
        if (result.recordset.length === 0) {
            return res.json({ success: true, names: {} });
        }
        
        const row = result.recordset[0];
        res.json({
            success: true,
            names: {
                Maintenance: row.DeptNameMaintenance || 'Maintenance',
                Procurement: row.DeptNameProcurement || 'Procurement',
                Cleaning: row.DeptNameCleaning || 'Cleaning'
            }
        });
    } catch (error) {
        console.error('Error loading department names:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save department names for a schema
app.post('/api/schema-department-names/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const pool = await sql.connect({
            server: process.env.SQL_SERVER,
            database: process.env.SQL_DATABASE,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        });
        
        const schemaId = parseInt(req.params.schemaId);
        const { names } = req.body;
        
        // Ensure columns exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'DeptNameMaintenance')
            BEGIN
                ALTER TABLE AuditSchemas ADD DeptNameMaintenance NVARCHAR(200) NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'DeptNameProcurement')
            BEGIN
                ALTER TABLE AuditSchemas ADD DeptNameProcurement NVARCHAR(200) NULL;
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditSchemas') AND name = 'DeptNameCleaning')
            BEGIN
                ALTER TABLE AuditSchemas ADD DeptNameCleaning NVARCHAR(200) NULL;
            END;
        `);
        
        await pool.request()
            .input('SchemaID', sql.Int, schemaId)
            .input('DeptNameMaintenance', sql.NVarChar(200), names.Maintenance || 'Maintenance')
            .input('DeptNameProcurement', sql.NVarChar(200), names.Procurement || 'Procurement')
            .input('DeptNameCleaning', sql.NVarChar(200), names.Cleaning || 'Cleaning')
            .query(`
                UPDATE AuditSchemas
                SET DeptNameMaintenance = @DeptNameMaintenance,
                    DeptNameProcurement = @DeptNameProcurement,
                    DeptNameCleaning = @DeptNameCleaning
                WHERE SchemaID = @SchemaID
            `);
        
        console.log(`✅ Saved department names for schema ${schemaId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving department names:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

console.log('[APP] Checklist info API loaded');

// ==========================================
// Audit App System
// ==========================================

// Serve Start Audit page
app.get('/auditor/start-audit', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/start-audit.html'));
});

// Start a new audit
app.post('/api/audits/start', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const auditData = {
            ...req.body,
            createdBy: req.currentUser.email
        };
        const result = await AuditService.startAudit(auditData);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error starting audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get audits list for Audit List page (MUST be before :auditId route)
app.get('/api/audits/list', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor', 'StoreManager', 'HeadOfOperations', 'AreaManager'), async (req, res) => {
    try {
        const user = req.currentUser;
        let audits = await AuditService.getAuditsList();
        
        // Filter audits for StoreManager - only show their assigned stores
        if (user && user.role === 'StoreManager') {
            let assignedStoreCodes = [];
            
            // Check if impersonating with assigned stores
            if (user._isImpersonating && user.assignedStores && user.assignedStores.length > 0) {
                // Use impersonation assigned stores (these are store names, need to look up codes)
                const allStores = await StoreService.getAllStores();
                assignedStoreCodes = allStores
                    .filter(s => user.assignedStores.includes(s.storeName))
                    .map(s => s.storeCode);
                console.log(`🎭 Impersonation: filtering by stores: ${user.assignedStores.join(', ')}`);
            } else {
                // Get store assignments for this user from StoreManagerAssignments table
                const assignments = await StoreService.getStoreAssignmentsForUser(user.id);
                assignedStoreCodes = assignments.map(a => a.storeCode);
            }
            
            if (assignedStoreCodes.length > 0) {
                // Filter audits by store code
                audits = audits.filter(audit => 
                    assignedStoreCodes.includes(audit.StoreCode)
                );
            } else {
                // No assigned stores - return empty list
                audits = [];
            }
        }
        
        // Filter audits for HeadOfOperations - show stores for their assigned brands
        if (user && user.role === 'HeadOfOperations') {
            // Check if impersonating with assignedBrands
            let assignedBrands = user.assignedBrands || [];
            
            // If not impersonating or no brands from impersonation, get from database
            if (assignedBrands.length === 0 && !user._isImpersonating) {
                assignedBrands = await StoreService.getBrandAssignmentsForUser(user.id);
            }
            
            if (assignedBrands.length > 0) {
                const brandStores = await StoreService.getStoresByBrands(assignedBrands);
                const brandStoreCodes = brandStores.map(s => s.storeCode);
                audits = audits.filter(audit => 
                    brandStoreCodes.includes(audit.StoreCode)
                );
            } else {
                audits = [];
            }
        }
        
        // Filter audits for AreaManager - show only their assigned stores
        if (user && user.role === 'AreaManager') {
            // Check if impersonating with assignedStores
            let areaStoreCodes = [];
            
            if (user._isImpersonating && user.assignedStores && user.assignedStores.length > 0) {
                // Use impersonation assigned stores directly
                areaStoreCodes = user.assignedStores;
            } else if (!user._isImpersonating) {
                // Get from database
                const areaStores = await StoreService.getAreaAssignmentsForUser(user.id);
                areaStoreCodes = areaStores.map(s => s.storeCode);
            }
            
            if (areaStoreCodes.length > 0) {
                audits = audits.filter(audit => 
                    areaStoreCodes.includes(audit.StoreCode)
                );
            } else {
                audits = [];
            }
        }
        
        res.json({ success: true, audits });
    } catch (error) {
        console.error('Error getting audits list:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get notification statuses for multiple audits
app.post('/api/audits/notification-statuses', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const { auditIds } = req.body;
        
        if (!auditIds || !Array.isArray(auditIds) || auditIds.length === 0) {
            return res.status(400).json({ success: false, error: 'auditIds array is required' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get document numbers for the audit IDs
        const auditIdsParam = auditIds.join(',');
        const auditsResult = await pool.request()
            .query(`SELECT AuditID, DocumentNumber FROM AuditInstances WHERE AuditID IN (${auditIdsParam})`);
        
        const auditDocMap = {};
        for (const row of auditsResult.recordset) {
            auditDocMap[row.AuditID] = row.DocumentNumber;
        }
        
        // Get all document numbers
        const docNumbers = Object.values(auditDocMap).filter(d => d);
        
        if (docNumbers.length === 0) {
            return res.json({ success: true, statuses: {} });
        }
        
        // Query notifications for these documents
        const docNumbersParam = docNumbers.map(d => `'${d.replace(/'/g, "''")}'`).join(',');
        
        const notificationsResult = await pool.request()
            .query(`
                SELECT document_number, notification_type, sent_at, sent_by_name
                FROM Notifications
                WHERE document_number IN (${docNumbersParam})
                  AND notification_type IN ('ReportPublished', 'FullReportGenerated', 'ActionPlanSubmitted')
                  AND status = 'Sent'
                ORDER BY document_number, sent_at DESC
            `);
        
        // Group by document number and find the relevant dates
        const docStatuses = {};
        for (const row of notificationsResult.recordset) {
            if (!docStatuses[row.document_number]) {
                docStatuses[row.document_number] = {};
            }
            
            // Only keep the first (most recent) of each type
            if ((row.notification_type === 'ReportPublished' || row.notification_type === 'FullReportGenerated') && !docStatuses[row.document_number].reportSentDate) {
                docStatuses[row.document_number].reportSentDate = row.sent_at;
                docStatuses[row.document_number].reportSentBy = row.sent_by_name || 'Unknown';
            }
            if (row.notification_type === 'ActionPlanSubmitted' && !docStatuses[row.document_number].actionPlanSubmittedDate) {
                docStatuses[row.document_number].actionPlanSubmittedDate = row.sent_at;
                docStatuses[row.document_number].actionPlanSubmittedBy = row.sent_by_name || 'Unknown';
            }
        }
        
        // Map back to audit IDs
        const statuses = {};
        for (const [auditId, docNumber] of Object.entries(auditDocMap)) {
            statuses[auditId] = docStatuses[docNumber] || {};
        }
        
        res.json({ success: true, statuses });
    } catch (error) {
        console.error('Error getting notification statuses:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Broadcast Feature API
// ==========================================

// Serve broadcast page - uses auto role from MenuPermissions
app.get('/admin/broadcast', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app', 'pages', 'broadcast.html'));
});

// Get recipient counts by role
app.get('/api/broadcast/recipient-counts', requireAuth, requirePagePermission(BROADCAST_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT role, COUNT(*) as count 
            FROM Users 
            WHERE is_active = 1 AND is_approved = 1 AND email IS NOT NULL
            GROUP BY role
        `);
        
        const counts = {};
        for (const row of result.recordset) {
            counts[row.role] = row.count;
        }
        
        res.json({ success: true, counts });
    } catch (error) {
        console.error('Error getting recipient counts:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send broadcast
app.post('/api/broadcast/send', requireAuth, requirePagePermission(BROADCAST_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { title, message, type, targetRoles } = req.body;
        
        if (!title || !message || !targetRoles || targetRoles.length === 0) {
            return res.status(400).json({ success: false, error: 'Title, message, and target roles are required' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get sender info from currentUser (set by requireAuth middleware)
        const currentUser = req.currentUser || {};
        const senderName = currentUser.displayName || currentUser.name || currentUser.email || 'System';
        const senderEmail = currentUser.email || '';
        const senderUserId = currentUser.id || null;
        
        console.log('📢 Broadcast sender:', senderName, senderEmail);
        
        // Create broadcast record
        const broadcastResult = await pool.request()
            .input('title', sql.NVarChar(255), title)
            .input('message', sql.NVarChar(sql.MAX), message)
            .input('type', sql.NVarChar(50), type || 'Announcement')
            .input('targetRoles', sql.NVarChar(500), targetRoles.join(','))
            .input('sentByUserId', sql.Int, senderUserId)
            .input('sentByName', sql.NVarChar(255), senderName)
            .input('sentByEmail', sql.NVarChar(255), senderEmail)
            .query(`
                INSERT INTO Broadcasts (title, message, broadcast_type, target_roles, sent_by_user_id, sent_by_name, sent_by_email, sent_at, status)
                OUTPUT INSERTED.id
                VALUES (@title, @message, @type, @targetRoles, @sentByUserId, @sentByName, @sentByEmail, GETDATE(), 'Sent')
            `);
        
        const broadcastId = broadcastResult.recordset[0].id;
        
        // Get recipients by role
        const rolesParam = targetRoles.map(r => `'${r}'`).join(',');
        const recipientsResult = await pool.request().query(`
            SELECT id, email, display_name, role 
            FROM Users 
            WHERE role IN (${rolesParam}) 
              AND is_active = 1 
              AND is_approved = 1 
              AND email IS NOT NULL
        `);
        
        const recipients = recipientsResult.recordset;
        let emailsSent = 0;
        
        // Insert recipients and send emails
        for (const recipient of recipients) {
            let emailSent = false;
            let emailError = null;
            
            // Try to send email
            try {
                const SimpleGraphConnector = require('./src/simple-graph-connector');
                const connector = new SimpleGraphConnector();
                const EmailService = require('./services/email-notification-service');
                const emailService = new EmailService(connector);
                const typeEmojis = { Announcement: '📢', Reminder: '⚠️', Urgent: '🚨' };
                
                // Use dynamic email template
                const emailTemplateService = require('./services/email-template-service');
                const emailData = await emailTemplateService.buildEmail('broadcast_announcement', {
                    broadcast_type: type,
                    type_emoji: typeEmojis[type] || '📢',
                    title: title,
                    message: message,
                    sender_name: senderName,
                    sender_email: senderEmail,
                    recipient_name: recipient.display_name || recipient.email
                });
                
                const emailSubject = emailData.subject;
                const emailBody = emailData.html;
                
                // Get valid access token (refresh if expired)
                const validAccessToken = await getValidAccessToken(req);
                if (!validAccessToken) {
                    throw new Error('Session expired. Please log in again.');
                }
                
                await emailService.sendEmail(
                    [recipient.email],  // to (array)
                    emailSubject,       // subject
                    emailBody,          // htmlBody
                    null,               // ccRecipients
                    validAccessToken,   // Use refreshed token
                    { email: currentUser.email, name: currentUser.displayName } // Sender verification
                );
                
                emailSent = true;
                emailsSent++;
            } catch (emailErr) {
                console.error(`Failed to send email to ${recipient.email}:`, emailErr.message);
                emailError = emailErr.message;
            }
            
            // Insert recipient record
            await pool.request()
                .input('broadcastId', sql.Int, broadcastId)
                .input('userId', sql.Int, recipient.id)
                .input('userEmail', sql.NVarChar(255), recipient.email)
                .input('userName', sql.NVarChar(255), recipient.display_name)
                .input('userRole', sql.NVarChar(50), recipient.role)
                .input('emailSent', sql.Bit, emailSent ? 1 : 0)
                .input('emailError', sql.NVarChar(sql.MAX), emailError)
                .query(`
                    INSERT INTO BroadcastRecipients (broadcast_id, user_id, user_email, user_name, user_role, email_sent, email_sent_at, email_error)
                    VALUES (@broadcastId, @userId, @userEmail, @userName, @userRole, @emailSent, ${emailSent ? 'GETDATE()' : 'NULL'}, @emailError)
                `);
        }
        
        // Update broadcast with counts
        await pool.request()
            .input('id', sql.Int, broadcastId)
            .input('recipientCount', sql.Int, recipients.length)
            .input('emailSentCount', sql.Int, emailsSent)
            .query(`
                UPDATE Broadcasts 
                SET recipient_count = @recipientCount, email_sent_count = @emailSentCount
                WHERE id = @id
            `);
        
        console.log(`Broadcast #${broadcastId} sent: ${recipients.length} recipients, ${emailsSent} emails`);
        
        // Log the broadcast activity
        logBroadcast(req.currentUser, recipients.length, title, req);
        
        res.json({ 
            success: true, 
            broadcastId,
            recipientCount: recipients.length,
            emailsSent
        });
    } catch (error) {
        console.error('Error sending broadcast:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get broadcast history
app.get('/api/broadcast/history', requireAuth, requirePagePermission(BROADCAST_PAGE, 'Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT TOP 50 
                id, title, message, broadcast_type, target_roles,
                sent_by_name, recipient_count, email_sent_count, status, sent_at
            FROM Broadcasts
            ORDER BY sent_at DESC
        `);
        
        res.json({ success: true, broadcasts: result.recordset });
    } catch (error) {
        console.error('Error getting broadcast history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unread broadcast count for current user (for notification bell)
app.get('/api/broadcast/unread-count', requireAuth, async (req, res) => {
    try {
        const userId = req.currentUser?.id;
        if (!userId) {
            return res.json({ success: true, count: 0 });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(*) as count 
                FROM BroadcastRecipients 
                WHERE user_id = @userId 
                  AND read_at IS NULL 
                  AND dismissed_at IS NULL
            `);
        
        res.json({ success: true, count: result.recordset[0].count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.json({ success: true, count: 0 });
    }
});

// Get user's broadcasts (for notification panel)
app.get('/api/broadcast/my-notifications', requireAuth, async (req, res) => {
    try {
        const userId = req.currentUser?.id;
        if (!userId) {
            return res.json({ success: true, notifications: [] });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT TOP 20
                    br.id as recipient_id,
                    b.id as broadcast_id,
                    b.title,
                    b.message,
                    b.broadcast_type,
                    b.sent_by_name,
                    b.sent_at,
                    br.read_at,
                    br.dismissed_at
                FROM BroadcastRecipients br
                INNER JOIN Broadcasts b ON br.broadcast_id = b.id
                WHERE br.user_id = @userId
                  AND br.dismissed_at IS NULL
                ORDER BY b.sent_at DESC
            `);
        
        res.json({ success: true, notifications: result.recordset });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.json({ success: true, notifications: [] });
    }
});

// Mark broadcast as read (by broadcast_id for current user)
app.post('/api/broadcast/mark-read/:broadcastId', requireAuth, async (req, res) => {
    try {
        const broadcastId = parseInt(req.params.broadcastId);
        const userId = req.currentUser?.id;
        
        if (!broadcastId || !userId) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('broadcastId', sql.Int, broadcastId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE BroadcastRecipients 
                SET read_at = GETDATE()
                WHERE broadcast_id = @broadcastId AND user_id = @userId AND read_at IS NULL
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark broadcast as read (legacy - by recipientId)
app.post('/api/broadcast/mark-read', requireAuth, async (req, res) => {
    try {
        const { recipientId } = req.body;
        const userId = req.currentUser?.id;
        
        if (!recipientId || !userId) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('recipientId', sql.Int, recipientId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE BroadcastRecipients 
                SET read_at = GETDATE()
                WHERE id = @recipientId AND user_id = @userId
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Dismiss broadcast notification
app.post('/api/broadcast/dismiss', requireAuth, async (req, res) => {
    try {
        const { recipientId } = req.body;
        const userId = req.currentUser?.id;
        
        if (!recipientId || !userId) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('recipientId', sql.Int, recipientId)
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE BroadcastRecipients 
                SET dismissed_at = GETDATE()
                WHERE id = @recipientId AND user_id = @userId
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error dismissing notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all as read
app.post('/api/broadcast/mark-all-read', requireAuth, async (req, res) => {
    try {
        const userId = req.currentUser?.id;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE BroadcastRecipients 
                SET read_at = GETDATE()
                WHERE user_id = @userId AND read_at IS NULL
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// AUDIT CALENDAR API ROUTES
// ==========================================

// Serve calendar page
app.get('/admin/audit-calendar', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app', 'pages', 'audit-calendar.html'));
});

// Get auditors list for calendar
app.get('/api/calendar/auditors', requireAuth, async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT id, display_name, email 
            FROM Users 
            WHERE role IN ('Auditor', 'SuperAuditor', 'Admin') 
            AND is_approved = 1
            ORDER BY display_name
        `);
        
        res.json({ success: true, auditors: result.recordset });
    } catch (error) {
        console.error('Error fetching auditors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get checklists for calendar
app.get('/api/calendar/checklists', requireAuth, async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT SchemaID as id, SchemaName as name, Description as description
            FROM AuditSchemas 
            WHERE IsActive = 1
            ORDER BY SchemaName
        `);
        
        res.json({ success: true, checklists: result.recordset });
    } catch (error) {
        console.error('Error fetching checklists:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get scheduled audits for calendar view
app.get('/api/calendar/audits', requireAuth, async (req, res) => {
    try {
        const { year, month, store_id, auditor_id } = req.query;
        const userRole = req.currentUser?.role;
        const userId = req.currentUser?.id;
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        let whereClause = '1=1';
        const request = pool.request();
        
        // Date range filter
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            whereClause += ` AND sa.scheduled_date BETWEEN @startDate AND @endDate`;
            request.input('startDate', sql.Date, startDate);
            request.input('endDate', sql.Date, endDate);
        }
        
        // Role-based filtering
        if (userRole === 'StoreManager') {
            // Store managers see audits for their assigned stores
            whereClause += ` AND sa.store_id IN (
                SELECT store_id FROM UserAssignments WHERE user_id = @userId
            )`;
            request.input('userId', sql.Int, userId);
        }
        
        // Optional filters
        if (store_id) {
            whereClause += ` AND sa.store_id = @storeId`;
            request.input('storeId', sql.Int, store_id);
        }
        if (auditor_id) {
            whereClause += ` AND sa.auditor_user_id = @auditorId`;
            request.input('auditorId', sql.Int, auditor_id);
        }
        
        const result = await request.query(`
            SELECT 
                sa.id,
                sa.store_id,
                COALESCE(s.StoreName, sa.store_name) AS store_name,
                sa.checklist_schema_id,
                COALESCE(cs.SchemaName, sa.checklist_name) AS checklist_name,
                sa.auditor_user_id,
                COALESCE(u.display_name, sa.auditor_name) AS auditor_name,
                CONVERT(VARCHAR(10), sa.scheduled_date, 120) AS scheduled_date,
                CONVERT(VARCHAR(5), sa.scheduled_time, 108) AS scheduled_time,
                sa.priority,
                sa.status,
                sa.notes,
                sa.recurring_rule_id,
                sa.actual_audit_id
            FROM ScheduledAudits sa
            LEFT JOIN Stores s ON sa.store_id = s.StoreID
            LEFT JOIN AuditSchemas cs ON sa.checklist_schema_id = cs.SchemaID
            LEFT JOIN Users u ON sa.auditor_user_id = u.id
            WHERE ${whereClause}
            ORDER BY sa.scheduled_date, sa.scheduled_time
        `);
        
        res.json({ success: true, audits: result.recordset });
    } catch (error) {
        console.error('Error fetching scheduled audits:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create scheduled audit
app.post('/api/calendar/audits', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { store_id, scheduled_date, scheduled_time, auditor_user_id, checklist_schema_id, priority, notes } = req.body;
        const createdBy = req.currentUser?.id;
        
        if (!store_id || !scheduled_date) {
            return res.status(400).json({ success: false, error: 'Store and date are required' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get store name
        const storeResult = await pool.request()
            .input('storeId', sql.Int, store_id)
            .query('SELECT StoreName FROM Stores WHERE StoreID = @storeId');
        const storeName = storeResult.recordset[0]?.StoreName;
        
        // Handle empty string as null for time
        const timeValue = scheduled_time && scheduled_time.trim() !== '' ? scheduled_time : null;
        
        const result = await pool.request()
            .input('storeId', sql.Int, store_id)
            .input('storeName', sql.NVarChar, storeName)
            .input('scheduledDate', sql.Date, scheduled_date)
            .input('scheduledTime', sql.NVarChar, timeValue)
            .input('auditorId', sql.Int, auditor_user_id || null)
            .input('checklistId', sql.Int, checklist_schema_id || null)
            .input('priority', sql.NVarChar, priority || 'Normal')
            .input('notes', sql.NVarChar, notes || null)
            .input('createdBy', sql.Int, createdBy)
            .query(`
                INSERT INTO ScheduledAudits 
                (store_id, store_name, scheduled_date, scheduled_time, auditor_user_id, checklist_schema_id, priority, notes, created_by)
                OUTPUT INSERTED.id
                VALUES (@storeId, @storeName, @scheduledDate, @scheduledTime, @auditorId, @checklistId, @priority, @notes, @createdBy)
            `);
        
        res.json({ success: true, id: result.recordset[0].id });
    } catch (error) {
        console.error('Error creating scheduled audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update scheduled audit
app.put('/api/calendar/audits/:id', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const auditId = req.params.id;
        const { store_id, scheduled_date, scheduled_time, auditor_user_id, checklist_schema_id, priority, notes, status } = req.body;
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get store name if store changed
        let storeName = null;
        if (store_id) {
            const storeResult = await pool.request()
                .input('storeId', sql.Int, store_id)
                .query('SELECT StoreName FROM Stores WHERE StoreID = @storeId');
            storeName = storeResult.recordset[0]?.StoreName;
        }
        
        // Handle empty string as null for time
        const timeValue = scheduled_time && scheduled_time.trim() !== '' ? scheduled_time : null;
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .input('storeId', sql.Int, store_id || null)
            .input('storeName', sql.NVarChar, storeName)
            .input('scheduledDate', sql.Date, scheduled_date || null)
            .input('scheduledTime', sql.NVarChar, timeValue)
            .input('auditorId', sql.Int, auditor_user_id || null)
            .input('checklistId', sql.Int, checklist_schema_id || null)
            .input('priority', sql.NVarChar, priority || null)
            .input('notes', sql.NVarChar, notes || null)
            .input('status', sql.NVarChar, status || null)
            .query(`
                UPDATE ScheduledAudits SET
                    store_id = COALESCE(@storeId, store_id),
                    store_name = COALESCE(@storeName, store_name),
                    scheduled_date = COALESCE(@scheduledDate, scheduled_date),
                    scheduled_time = @scheduledTime,
                    auditor_user_id = @auditorId,
                    checklist_schema_id = @checklistId,
                    priority = COALESCE(@priority, priority),
                    notes = @notes,
                    status = COALESCE(@status, status),
                    updated_at = GETDATE()
                WHERE id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating scheduled audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete (cancel) scheduled audit
app.delete('/api/calendar/audits/:id', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const auditId = req.params.id;
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, auditId)
            .query(`UPDATE ScheduledAudits SET status = 'Cancelled', updated_at = GETDATE() WHERE id = @id`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling scheduled audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create recurring audit rule
app.post('/api/calendar/recurring', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const { 
            store_id, frequency, day_of_week, day_of_month, week_of_month,
            preferred_time, auditor_user_id, checklist_schema_id, 
            start_date, end_date, notes 
        } = req.body;
        const createdBy = req.currentUser?.id;
        
        if (!store_id || !frequency || !start_date) {
            return res.status(400).json({ success: false, error: 'Store, frequency, and start date are required' });
        }
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get store name
        const storeResult = await pool.request()
            .input('storeId', sql.Int, store_id)
            .query('SELECT StoreName FROM Stores WHERE StoreID = @storeId');
        const storeName = storeResult.recordset[0]?.StoreName;
        
        // Create the recurring rule
        const ruleResult = await pool.request()
            .input('storeId', sql.Int, store_id)
            .input('storeName', sql.NVarChar, storeName)
            .input('frequency', sql.NVarChar, frequency)
            .input('dayOfWeek', sql.Int, day_of_week ?? null)
            .input('dayOfMonth', sql.Int, day_of_month ?? null)
            .input('weekOfMonth', sql.Int, week_of_month ?? null)
            .input('preferredTime', sql.Time, preferred_time || null)
            .input('auditorId', sql.Int, auditor_user_id || null)
            .input('checklistId', sql.Int, checklist_schema_id || null)
            .input('startDate', sql.Date, start_date)
            .input('endDate', sql.Date, end_date || null)
            .input('notes', sql.NVarChar, notes || null)
            .input('createdBy', sql.Int, createdBy)
            .query(`
                INSERT INTO RecurringAuditRules 
                (store_id, store_name, frequency, day_of_week, day_of_month, week_of_month, 
                 preferred_time, default_auditor_id, default_checklist_id, start_date, end_date, notes, created_by)
                OUTPUT INSERTED.id
                VALUES (@storeId, @storeName, @frequency, @dayOfWeek, @dayOfMonth, @weekOfMonth,
                        @preferredTime, @auditorId, @checklistId, @startDate, @endDate, @notes, @createdBy)
            `);
        
        const ruleId = ruleResult.recordset[0].id;
        
        // Generate initial scheduled audits for the next 3 months
        const auditsToCreate = generateRecurringDates(
            { frequency, day_of_week, day_of_month, week_of_month, start_date, end_date },
            90 // days ahead
        );
        
        for (const auditDate of auditsToCreate) {
            await pool.request()
                .input('storeId', sql.Int, store_id)
                .input('storeName', sql.NVarChar, storeName)
                .input('scheduledDate', sql.Date, auditDate)
                .input('scheduledTime', sql.Time, preferred_time || null)
                .input('auditorId', sql.Int, auditor_user_id || null)
                .input('checklistId', sql.Int, checklist_schema_id || null)
                .input('ruleId', sql.Int, ruleId)
                .input('createdBy', sql.Int, createdBy)
                .query(`
                    INSERT INTO ScheduledAudits 
                    (store_id, store_name, scheduled_date, scheduled_time, auditor_user_id, 
                     checklist_schema_id, recurring_rule_id, created_by)
                    VALUES (@storeId, @storeName, @scheduledDate, @scheduledTime, @auditorId, 
                            @checklistId, @ruleId, @createdBy)
                `);
        }
        
        res.json({ success: true, ruleId, auditsCreated: auditsToCreate.length });
    } catch (error) {
        console.error('Error creating recurring rule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to generate recurring dates
function generateRecurringDates(rule, daysAhead) {
    const dates = [];
    const startDate = new Date(rule.start_date);
    const endDate = rule.end_date ? new Date(rule.end_date) : new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const maxDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const actualEndDate = endDate < maxDate ? endDate : maxDate;
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= actualEndDate) {
        let targetDate = null;
        
        switch (rule.frequency) {
            case 'Weekly':
                if (rule.day_of_week !== null && rule.day_of_week !== undefined) {
                    const diff = (rule.day_of_week - currentDate.getDay() + 7) % 7;
                    targetDate = new Date(currentDate);
                    targetDate.setDate(currentDate.getDate() + (diff === 0 ? 0 : diff));
                    currentDate.setDate(currentDate.getDate() + 7);
                } else {
                    targetDate = new Date(currentDate);
                    currentDate.setDate(currentDate.getDate() + 7);
                }
                break;
                
            case 'BiWeekly':
                if (rule.day_of_week !== null && rule.day_of_week !== undefined) {
                    const diff = (rule.day_of_week - currentDate.getDay() + 7) % 7;
                    targetDate = new Date(currentDate);
                    targetDate.setDate(currentDate.getDate() + (diff === 0 ? 0 : diff));
                    currentDate.setDate(currentDate.getDate() + 14);
                } else {
                    targetDate = new Date(currentDate);
                    currentDate.setDate(currentDate.getDate() + 14);
                }
                break;
                
            case 'Monthly':
                if (rule.day_of_month === -1) {
                    // Last day of month
                    targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                } else if (rule.day_of_month) {
                    targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), rule.day_of_month);
                    // Handle months with fewer days
                    if (targetDate.getMonth() !== currentDate.getMonth()) {
                        targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                    }
                } else {
                    targetDate = new Date(currentDate);
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
                
            case 'Quarterly':
                if (rule.day_of_month === -1) {
                    targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                } else if (rule.day_of_month) {
                    targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), rule.day_of_month);
                    if (targetDate.getMonth() !== currentDate.getMonth()) {
                        targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                    }
                } else {
                    targetDate = new Date(currentDate);
                }
                currentDate.setMonth(currentDate.getMonth() + 3);
                break;
                
            default:
                currentDate.setDate(currentDate.getDate() + 7);
        }
        
        if (targetDate && targetDate >= startDate && targetDate <= actualEndDate) {
            dates.push(targetDate.toISOString().split('T')[0]);
        }
    }
    
    return dates;
}

// Get recurring rules
app.get('/api/calendar/recurring', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                r.*,
                s.name AS store_name,
                u.display_name AS auditor_name,
                cs.name AS checklist_name
            FROM RecurringAuditRules r
            LEFT JOIN Stores s ON r.store_id = s.id
            LEFT JOIN Users u ON r.default_auditor_id = u.id
            LEFT JOIN ChecklistSchemas cs ON r.default_checklist_id = cs.id
            WHERE r.is_active = 1
            ORDER BY r.created_at DESC
        `);
        
        res.json({ success: true, rules: result.recordset });
    } catch (error) {
        console.error('Error fetching recurring rules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deactivate recurring rule
app.delete('/api/calendar/recurring/:id', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const ruleId = req.params.id;
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, ruleId)
            .query(`UPDATE RecurringAuditRules SET is_active = 0, updated_at = GETDATE() WHERE id = @id`);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deactivating recurring rule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// END AUDIT CALENDAR API ROUTES
// ==========================================

// ==========================================
// EMAIL TEMPLATE MANAGEMENT API ROUTES
// ==========================================

const emailTemplateService = require('./services/email-template-service');

// Serve email templates management page - uses auto role from MenuPermissions
app.get('/admin/email-templates', requireAuth, requireAutoRole('Admin'), (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'audit-app', 'pages', 'email-templates.html'));
});

// Get all email templates
app.get('/api/admin/email-templates', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const templates = await emailTemplateService.getAllTemplates();
        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching email templates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update email template
app.put('/api/admin/email-templates/:key', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const templateKey = req.params.key;
        const updates = req.body;
        const userId = req.currentUser?.id;
        const userName = req.currentUser?.displayName || req.currentUser?.email;
        
        const result = await emailTemplateService.updateTemplate(templateKey, updates, userId, userName);
        
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error updating email template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Initialize default templates
app.post('/api/admin/email-templates/initialize', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const result = await emailTemplateService.insertDefaultTemplates();
        if (result.success) {
            res.json({ success: true, message: 'Default templates initialized' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error initializing templates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset template to default
app.post('/api/admin/email-templates/:key/reset', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const templateKey = req.params.key;
        const defaults = emailTemplateService.getDefaultTemplates();
        const defaultTemplate = defaults.find(t => t.template_key === templateKey);
        
        if (!defaultTemplate) {
            return res.status(404).json({ success: false, error: 'Default template not found' });
        }
        
        const updates = {
            template_name: defaultTemplate.template_name,
            description: defaultTemplate.description,
            subject_template: defaultTemplate.subject_template,
            html_body: defaultTemplate.html_body,
            is_active: true
        };
        
        const userId = req.currentUser?.id;
        const userName = req.currentUser?.displayName || req.currentUser?.email;
        
        const result = await emailTemplateService.updateTemplate(templateKey, updates, userId, userName);
        
        if (result.success) {
            res.json({ success: true, message: 'Template reset to default' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error resetting template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send test email
app.post('/api/admin/email-templates/test', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const { templateKey, recipientEmail, subject, body } = req.body;
        
        if (!recipientEmail) {
            return res.status(400).json({ success: false, error: 'Recipient email required' });
        }
        
        // Replace placeholders with sample data
        let testSubject = subject
            .replace(/\{\{storeName\}\}/gi, 'Spinneys Dbayeh')
            .replace(/\{\{documentNumber\}\}/gi, 'GMRL-FSACR-TEST')
            .replace(/\{\{typeEmoji\}\}/gi, '📧')
            .replace(/\{\{title\}\}/gi, 'Test Email');
            
        let testBody = body
            .replace(/\{\{recipientName\}\}/gi, 'Test User')
            .replace(/\{\{storeName\}\}/gi, 'Spinneys Dbayeh')
            .replace(/\{\{documentNumber\}\}/gi, 'GMRL-FSACR-TEST')
            .replace(/\{\{auditDate\}\}/gi, new Date().toLocaleDateString())
            .replace(/\{\{score\}\}/gi, '85%')
            .replace(/\{\{reportUrl\}\}/gi, '#')
            .replace(/\{\{dashboardUrl\}\}/gi, '#')
            .replace(/\{\{typeEmoji\}\}/gi, '📧')
            .replace(/\{\{type\}\}/gi, 'Test')
            .replace(/\{\{title\}\}/gi, 'Test Email')
            .replace(/\{\{message\}\}/gi, 'This is a test email.')
            .replace(/\{\{senderName\}\}/gi, req.currentUser?.displayName || 'Admin')
            .replace(/\{\{submittedBy\}\}/gi, 'Test User')
            .replace(/\{\{auditorName\}\}/gi, 'Test Auditor')
            .replace(/\{\{auditTime\}\}/gi, '10:00 AM')
            .replace(/\{\{checklistName\}\}/gi, 'Food Safety Audit')
            .replace(/\{\{notes\}\}/gi, 'Test notes')
            .replace(/\{\{calendarUrl\}\}/gi, '#');
        
        // Use email service to send
        const SimpleGraphConnector = require('./src/simple-graph-connector');
        const connector = new SimpleGraphConnector();
        const EmailService = require('./services/email-notification-service');
        const emailService = new EmailService(connector);
        
        const result = await emailService.sendEmail(
            [recipientEmail],
            `[TEST] ${testSubject}`,
            testBody,
            null,
            req.currentUser?.accessToken,
            { email: req.currentUser?.email, name: req.currentUser?.displayName } // Sender verification
        );
        
        if (result.success) {
            res.json({ success: true, message: 'Test email sent' });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// END EMAIL TEMPLATE MANAGEMENT API ROUTES
// ==========================================

// ==========================================
// SESSION MANAGEMENT API ROUTES (Admin Only)
// ==========================================

// Serve session management page
app.get('/admin/session-management', requireAuth, requireRole('Admin'), (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'audit-app', 'pages', 'session-management.html'));
});

// Get all sessions with stats
app.get('/api/admin/sessions', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get all sessions with user info
        const result = await pool.request().query(`
            SELECT 
                s.id,
                s.session_token,
                s.azure_access_token,
                s.user_id,
                u.email,
                u.display_name,
                u.role,
                s.expires_at,
                s.created_at,
                s.last_activity
            FROM Sessions s
            JOIN Users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
        `);
        
        const now = new Date();
        const sessions = result.recordset;
        
        // Calculate stats
        const stats = {
            total: sessions.length,
            active: sessions.filter(s => new Date(s.expires_at) > now).length,
            expired: sessions.filter(s => new Date(s.expires_at) <= now).length,
            duplicateUsers: 0,
            duplicateTokens: 0
        };
        
        // Count users with multiple sessions
        const emailCounts = {};
        sessions.forEach(s => {
            emailCounts[s.email] = (emailCounts[s.email] || 0) + 1;
        });
        stats.duplicateUsers = Object.values(emailCounts).filter(c => c > 1).length;
        
        // Count duplicate azure tokens (truncate to last 100 chars for comparison)
        const tokenCounts = {};
        sessions.forEach(s => {
            if (s.azure_access_token) {
                // Use last 100 chars of token for comparison (unique part)
                const tokenKey = s.azure_access_token.slice(-100);
                tokenCounts[tokenKey] = (tokenCounts[tokenKey] || 0) + 1;
            }
        });
        stats.duplicateTokens = Object.values(tokenCounts).filter(c => c > 1).length;
        
        // Mark sessions with duplicate tokens
        sessions.forEach(s => {
            if (s.azure_access_token) {
                const tokenKey = s.azure_access_token.slice(-100);
                s.hasDuplicateToken = tokenCounts[tokenKey] > 1;
                // Store last 50 chars for display preview
                s.azure_token_preview = '...' + s.azure_access_token.slice(-50);
                // Store full token for copy button (admin only)
                s.azure_token_full = s.azure_access_token;
            } else {
                s.hasDuplicateToken = false;
                s.azure_token_preview = null;
                s.azure_token_full = null;
            }
            // Remove the original field name
            delete s.azure_access_token;
        });
        
        res.json({
            success: true,
            sessions: sessions,
            stats: stats
        });
        
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Terminate single session
app.delete('/api/admin/sessions/:sessionId', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('sessionId', sql.Int, sessionId)
            .query('DELETE FROM Sessions WHERE id = @sessionId');
        
        console.log(`🔒 [SESSION] Admin ${req.currentUser.email} terminated session ${sessionId}`);
        
        res.json({ success: true, deleted: result.rowsAffected[0] });
        
    } catch (error) {
        console.error('Error terminating session:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Terminate all expired sessions
app.delete('/api/admin/sessions/expired', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            DELETE FROM Sessions WHERE expires_at < GETDATE()
        `);
        
        console.log(`🔒 [SESSION] Admin ${req.currentUser.email} cleared ${result.rowsAffected[0]} expired sessions`);
        
        res.json({ success: true, deleted: result.rowsAffected[0] });
        
    } catch (error) {
        console.error('Error clearing expired sessions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Terminate all sessions (nuclear option)
app.delete('/api/admin/sessions/all', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query('DELETE FROM Sessions');
        
        console.log(`🔒 [SESSION] Admin ${req.currentUser.email} TERMINATED ALL ${result.rowsAffected[0]} sessions`);
        
        res.json({ success: true, deleted: result.rowsAffected[0] });
        
    } catch (error) {
        console.error('Error terminating all sessions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// END SESSION MANAGEMENT API ROUTES
// ==========================================

// ==========================================
// ACTIVITY LOG MANAGEMENT API ROUTES (Admin Only)
// ==========================================

// Serve activity log page - uses auto role from MenuPermissions
app.get('/admin/activity-log', requireAuth, requireAutoRole('Admin'), (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'audit-app', 'pages', 'activity-log.html'));
});

// Get activity logs with pagination and filters
app.get('/api/admin/activity-log', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const { page, pageSize, category, userId, search, startDate, endDate, actionType } = req.query;
        const result = await activityLogService.getLogs({
            page: parseInt(page) || 1,
            pageSize: parseInt(pageSize) || 50,
            actionType,
            category,
            userId: userId ? parseInt(userId) : null,
            search,
            startDate,
            endDate
        });
        res.json(result);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single activity log by ID
app.get('/api/admin/activity-log/:id', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const result = await activityLogService.getLogs({
            page: 1,
            pageSize: 1,
            search: null
        });
        // Simple approach - fetch by searching
        const sql = require('mssql');
        const pool = await sql.connect({
            server: 'localhost',
            database: 'FoodSafetyDB_Live',
            user: 'sa',
            password: 'Kokowawa123@@',
            options: { encrypt: false, trustServerCertificate: true }
        });
        const logResult = await pool.request()
            .input('id', sql.Int, parseInt(req.params.id))
            .query('SELECT * FROM ActivityLog WHERE id = @id');
        
        if (logResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Log not found' });
        }
        
        const log = logResult.recordset[0];
        log.metadata = log.metadata ? JSON.parse(log.metadata) : null;
        res.json(log);
    } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get activity log stats
app.get('/api/admin/activity-log/stats', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const stats = await activityLogService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching activity log stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get active users for filter dropdown
app.get('/api/admin/activity-log/users', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const users = await activityLogService.getActiveUsers();
        res.json(users);
    } catch (error) {
        console.error('Error fetching active users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Run cleanup (delete logs older than 90 days)
app.post('/api/admin/activity-log/cleanup', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const result = await activityLogService.cleanup(90);
        res.json(result);
    } catch (error) {
        console.error('Error running cleanup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// END ACTIVITY LOG MANAGEMENT API ROUTES
// ==========================================

// ==========================================
// DATABASE INSPECTOR (Admin Only)
// ==========================================
const DatabaseInspectorService = require('./admin/services/database-inspector-service');

// Serve database inspector page - uses auto role from MenuPermissions
app.get('/admin/database-inspector', requireAuth, requireAutoRole('Admin'), (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(__dirname, 'admin', 'pages', 'database-inspector.html'));
});

// Execute database inspector query
app.get('/api/admin/db-inspector/:queryType', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const { queryType } = req.params;
        console.log(`🔍 [DB Inspector] Running query: ${queryType}`);
        
        const result = await DatabaseInspectorService.executeQuery(queryType);
        
        res.json({
            success: true,
            title: result.title,
            data: result.data,
            columns: result.columns
        });
    } catch (error) {
        console.error('❌ [DB Inspector] Query error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// END DATABASE INSPECTOR
// ==========================================

// Get audit by ID
app.get('/api/audits/:auditId', requireAuth, async (req, res) => {
    try {
        const audit = await AuditService.getAudit(parseInt(req.params.auditId));
        if (!audit) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        res.json({ success: true, data: audit });
    } catch (error) {
        console.error('Error getting audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all audits
app.get('/api/audits', requireAuth, async (req, res) => {
    try {
        const audits = await AuditService.getAllAudits();
        res.json({ success: true, data: audits });
    } catch (error) {
        console.error('Error getting all audits:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update audit response
app.put('/api/audits/response/:responseId', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const userRole = req.currentUser.role;
        const responseId = parseInt(req.params.responseId);
        
        // Check if audit is completed - only Admin and SuperAuditor can edit completed audits
        const auditStatus = await AuditService.getAuditStatusByResponseId(responseId);
        
        if (auditStatus === 'Completed' && !['Admin', 'SuperAuditor'].includes(userRole)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Only Admin and SuperAuditor can edit completed audits' 
            });
        }
        
        const result = await AuditService.updateResponse(responseId, req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete audit
app.post('/api/audits/:auditId/complete', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const result = await AuditService.completeAudit(parseInt(req.params.auditId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error completing audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload picture for a response
app.post('/api/audits/pictures', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const userRole = req.currentUser.role;
        const responseId = req.body.responseId;
        
        // Check if audit is completed - only Admin and SuperAuditor can edit completed audits
        if (responseId) {
            const auditStatus = await AuditService.getAuditStatusByResponseId(responseId);
            
            if (auditStatus === 'Completed' && !['Admin', 'SuperAuditor'].includes(userRole)) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Only Admin and SuperAuditor can edit completed audits' 
                });
            }
        }
        
        const result = await AuditService.uploadPicture(req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error uploading picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pictures for a response
app.get('/api/audits/pictures/:responseId', requireAuth, async (req, res) => {
    try {
        const pictures = await AuditService.getPictures(parseInt(req.params.responseId));
        res.json({ success: true, data: pictures });
    } catch (error) {
        console.error('Error getting pictures:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete picture
app.delete('/api/audits/pictures/:pictureId', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const result = await AuditService.deletePicture(parseInt(req.params.pictureId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete audit (Admin and SuperAuditor only)
app.delete('/api/audits/:auditId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        
        // Get audit info for logging
        const audit = await AuditService.getAudit(auditId);
        if (!audit) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        console.log(`[DELETE AUDIT] User ${req.currentUser.email} (${req.currentUser.role}) deleting audit ${audit.DocumentNumber}`);
        
        const result = await AuditService.deleteAudit(auditId);
        
        console.log(`[DELETE AUDIT] Successfully deleted audit ${audit.DocumentNumber}`);
        
        res.json({ success: true, data: result, deletedDocument: audit.DocumentNumber });
    } catch (error) {
        console.error('Error deleting audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Fridge Temperature Readings API
// ==========================================

// Save fridge readings
app.post('/api/audits/:auditId/fridge-readings', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber, goodReadings, badReadings, enabledSections } = req.body;
        const auditId = parseInt(req.params.auditId);
        
        console.log(`🌡️ Saving fridge readings for audit ${auditId}: ${goodReadings?.length || 0} good, ${badReadings?.length || 0} bad`);
        
        const result = await AuditService.saveFridgeReadings(auditId, documentNumber, goodReadings, badReadings, enabledSections);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error saving fridge readings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get fridge readings
app.get('/api/audits/:auditId/fridge-readings', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const readings = await AuditService.getFridgeReadings(auditId);
        res.json({ success: true, data: readings });
    } catch (error) {
        console.error('Error getting fridge readings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Department Report API
// ==========================================

// Get department report for an audit (and save it)
app.get('/api/audits/:auditId/department-report/:department', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const department = req.params.department;
        
        if (!['Maintenance', 'Procurement', 'Cleaning'].includes(department)) {
            return res.status(400).json({ success: false, error: 'Invalid department' });
        }
        
        const report = await AuditService.getDepartmentReport(auditId, department);
        
        // Save the report to SQL for later viewing by department heads
        if (report.items.length > 0) {
            const generatedBy = req.session?.user?.email || 'Unknown';
            await AuditService.saveDepartmentReport(auditId, department, report, generatedBy);
            console.log(`📋 [API] Saved ${department} report for audit ${auditId}`);
        }
        
        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error getting department report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// List saved department reports for a department
app.get('/api/department-reports/list/:department', requireAuth, async (req, res) => {
    try {
        const department = req.params.department;
        
        if (!['Maintenance', 'Procurement', 'Cleaning'].includes(department)) {
            return res.status(400).json({ success: false, error: 'Invalid department' });
        }
        
        const reports = await AuditService.getDepartmentReports(department);
        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('Error listing department reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get a saved department report by ID
app.get('/api/department-reports/view/:reportId', requireAuth, async (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        const report = await AuditService.getDepartmentReportById(reportId);
        
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        
        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error getting department report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve department reports page for department heads
app.get('/department/reports', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/department-reports.html'));
});

// Get section scores for an audit (for reports)
app.get('/api/audits/section-scores/:auditId', requireAuth, async (req, res) => {
    try {
        const scores = await AuditService.getSectionScores(parseInt(req.params.auditId));
        res.json({ success: true, data: scores });
    } catch (error) {
        console.error('Error getting section scores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Score Calculator API (Admin/SuperAuditor only)
// ==========================================

// Get audits list for score calculator dropdown
app.get('/api/score-calculator/audits', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const audits = await ScoreCalculatorService.getAuditsList();
        res.json({ success: true, data: audits });
    } catch (error) {
        console.error('Error getting audits for score calculator:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get audit sections with scores and exclusion status
app.get('/api/score-calculator/:auditId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const data = await ScoreCalculatorService.getAuditSectionsWithScores(auditId);
        res.json({ success: true, data: data });
    } catch (error) {
        console.error('Error getting score calculator data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save section exclusions
app.post('/api/score-calculator/:auditId/exclusions', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const { excludedSectionIds } = req.body;
        const username = req.currentUser.email || req.currentUser.username;
        
        const data = await ScoreCalculatorService.saveExclusions(auditId, excludedSectionIds || [], username);
        res.json({ success: true, data: data, message: 'Exclusions saved successfully' });
    } catch (error) {
        console.error('Error saving exclusions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get exclusion history for an audit
app.get('/api/score-calculator/:auditId/history', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const history = await ScoreCalculatorService.getExclusionHistory(auditId);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error getting exclusion history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all exclusion history across all audits
app.get('/api/score-calculator/history/all', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            changedBy: req.query.changedBy,
            auditId: req.query.auditId ? parseInt(req.query.auditId) : null
        };
        const history = await ScoreCalculatorService.getAllExclusionHistory(filters);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error getting all exclusion history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get exclusion statistics
app.get('/api/score-calculator/stats', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const stats = await ScoreCalculatorService.getExclusionStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error getting exclusion stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Audit Report Generator API (Modular)
// ==========================================

// Generate full audit report
app.post('/api/audits/:auditId/generate-report', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        console.log(`📊 [API] Generating report for audit ${auditId}`);
        
        const reportGenerator = new AuditReportGenerator();
        const result = await reportGenerator.generateReport(auditId);
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        res.json({ 
            success: true, 
            filePath: result.filePath,
            fileName: result.fileName,
            data: {
                documentNumber: result.data.documentNumber,
                storeName: result.data.storeName,
                totalScore: result.data.totalScore,
                threshold: result.data.threshold,
                sectionScores: result.data.sectionScores
            }
        });
    } catch (error) {
        console.error('Error generating audit report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate action plan report
app.post('/api/audits/:auditId/generate-action-plan', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        console.log(`📋 [API] Generating action plan for audit ${auditId}`);
        
        const reportGenerator = new AuditReportGenerator();
        const result = await reportGenerator.generateActionPlan(auditId);
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        res.json({ 
            success: true, 
            filePath: result.filePath,
            fileName: result.fileName,
            totalFindings: result.totalFindings,
            highPriority: result.highPriority,
            mediumPriority: result.mediumPriority,
            lowPriority: result.lowPriority
        });
    } catch (error) {
        console.error('Error generating action plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate PDF report (full version with proper page breaks)
app.post('/api/audits/:auditId/generate-pdf', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        console.log(`📄 [API] Generating PDF for audit ${auditId}`);
        
        const reportGenerator = new AuditReportGenerator();
        const result = await reportGenerator.generatePDF(auditId);
        
        // Clean up browser resources
        await reportGenerator.cleanup();
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        res.json({ 
            success: true, 
            filePath: result.filePath,
            fileName: result.fileName,
            htmlFilePath: result.htmlFilePath,
            data: {
                documentNumber: result.data.documentNumber,
                storeName: result.data.storeName,
                totalScore: result.data.totalScore
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate Summary PDF (2-3 pages, key info only)
app.post('/api/audits/:auditId/generate-summary-pdf', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        console.log(`📋 [API] Generating Summary PDF for audit ${auditId}`);
        
        const reportGenerator = new AuditReportGenerator();
        const result = await reportGenerator.generateSummaryPDF(auditId);
        
        // Clean up browser resources
        await reportGenerator.cleanup();
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        res.json({ 
            success: true, 
            filePath: result.filePath,
            fileName: result.fileName,
            isSummary: true,
            data: {
                documentNumber: result.data.documentNumber,
                storeName: result.data.storeName,
                totalScore: result.data.totalScore
            }
        });
    } catch (error) {
        console.error('Error generating summary PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download PDF file directly
app.get('/api/audits/:auditId/download-pdf', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const summary = req.query.summary === 'true';
        
        console.log(`📥 [API] Download ${summary ? 'Summary ' : ''}PDF for audit ${auditId}`);
        
        const reportGenerator = new AuditReportGenerator();
        
        let result;
        if (summary) {
            result = await reportGenerator.generateSummaryPDF(auditId);
        } else {
            result = await reportGenerator.generatePDF(auditId);
        }
        
        // Clean up browser resources
        await reportGenerator.cleanup();
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        // Send the PDF file for download
        res.download(result.filePath, result.fileName, (err) => {
            if (err) {
                console.error('Error downloading PDF:', err);
            }
        });
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate department-specific report (HTML file)
app.post('/api/audits/:auditId/generate-department-report/:department', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        const department = req.params.department;
        
        if (!['Maintenance', 'Procurement', 'Cleaning'].includes(department)) {
            return res.status(400).json({ success: false, error: 'Invalid department' });
        }
        
        console.log(`🏢 [API] Generating ${department} report for audit ${auditId}`);
        
        const reportGenerator = new AuditReportGenerator();
        const result = await reportGenerator.generateDepartmentReport(auditId, department);
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        // Also save to SQL for department heads
        const generatedBy = req.session?.user?.email || 'Unknown';
        const report = await AuditService.getDepartmentReport(auditId, department);
        if (report.items.length > 0) {
            await AuditService.saveDepartmentReport(auditId, department, report, generatedBy);
        }
        
        res.json({ 
            success: true, 
            filePath: result.filePath,
            fileName: result.fileName,
            department: result.department,
            totalFindings: result.totalFindings
        });
    } catch (error) {
        console.error('Error generating department report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get report data (JSON, no file generation)
app.get('/api/audits/:auditId/report-data', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        
        const reportGenerator = new AuditReportGenerator();
        const result = await reportGenerator.getReportData(auditId);
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('Error getting report data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get latest report file for an audit (for StoreManager to view already-generated reports)
app.get('/api/audits/:auditId/latest-report', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        
        // Get the document number for this audit
        const audit = await AuditService.getAudit(auditId);
        if (!audit) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const documentNumber = audit.DocumentNumber;
        const reportsDir = path.join(__dirname, 'reports');
        
        // Find report files for this document number
        const files = fs.readdirSync(reportsDir)
            .filter(f => f.includes(documentNumber) && f.startsWith('Audit_Report_'))
            .sort()
            .reverse(); // Most recent first (sorted by date in filename)
        
        if (files.length === 0) {
            // Try the older naming convention
            const oldFiles = fs.readdirSync(reportsDir)
                .filter(f => f.includes(documentNumber) && f.startsWith('Food_Safety_Audit_Report_'))
                .sort()
                .reverse();
            
            if (oldFiles.length === 0) {
                return res.json({ success: false, error: 'No report has been generated yet for this audit' });
            }
            
            return res.json({ success: true, fileName: oldFiles[0], hasReport: true });
        }
        
        res.json({ success: true, fileName: files[0], hasReport: true });
    } catch (error) {
        console.error('Error getting latest report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Publish report WITHOUT sending email (for testing)
app.post('/api/audits/publish-report-no-email', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber, auditId, fileName, storeName, totalScore } = req.body;
        const user = req.currentUser;
        
        console.log(`📝 [PUBLISH-NO-EMAIL] Publishing without email - auditId: ${auditId}, doc: ${documentNumber}`);
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Check if already saved
        const existing = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query('SELECT id FROM PublishedReports WHERE audit_id = @auditId');
        
        if (existing.recordset.length > 0) {
            // Update existing
            await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('fileName', sql.NVarChar(500), fileName)
                .input('publishedBy', sql.NVarChar(255), user.email)
                .input('publishedByName', sql.NVarChar(255), user.displayName || user.email)
                .query(`
                    UPDATE PublishedReports 
                    SET file_name = @fileName, 
                        published_by = @publishedBy,
                        published_by_name = @publishedByName,
                        published_at = GETDATE()
                    WHERE audit_id = @auditId
                `);
        } else {
            // Insert new
            await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('documentNumber', sql.NVarChar(50), documentNumber)
                .input('fileName', sql.NVarChar(500), fileName)
                .input('storeName', sql.NVarChar(255), storeName)
                .input('totalScore', sql.Decimal(5, 2), totalScore || 0)
                .input('publishedBy', sql.NVarChar(255), user.email)
                .input('publishedByName', sql.NVarChar(255), user.displayName || user.email)
                .query(`
                    INSERT INTO PublishedReports (audit_id, document_number, file_name, store_name, total_score, published_by, published_by_name)
                    VALUES (@auditId, @documentNumber, @fileName, @storeName, @totalScore, @publishedBy, @publishedByName)
                `);
        }
        
        console.log(`✅ Report published (NO EMAIL) for: ${documentNumber}`);
        
        res.json({
            success: true,
            message: 'Report published successfully (no email sent)',
            emailSent: false
        });
    } catch (error) {
        console.error('Error publishing report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Unpublish report (Admin only) - removes from PublishedReports so Store Managers can't see it
app.post('/api/audits/unpublish-report', requireAuth, requireRole('Admin'), async (req, res) => {
    try {
        const { auditId } = req.body;
        
        console.log(`🚫 [UNPUBLISH] Unpublishing report for audit ${auditId}`);
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Delete from PublishedReports
        const result = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query('DELETE FROM PublishedReports WHERE audit_id = @auditId');
        
        if (result.rowsAffected[0] > 0) {
            console.log(`✅ Report unpublished for audit ${auditId}`);
            res.json({ success: true, message: 'Report unpublished successfully' });
        } else {
            res.json({ success: true, message: 'Report was not published' });
        }
    } catch (error) {
        console.error('Error unpublishing report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save report for Store Manager (Admin/Auditor saves it so SM can view)
app.post('/api/audits/save-report-for-store-manager', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber, auditId, fileName, storeName, totalScore } = req.body;
        const user = req.currentUser;
        
        console.log(`🔔 [SAVE-REPORT] Starting - auditId: ${auditId}, doc: ${documentNumber}`);
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        console.log(`🔔 [SAVE-REPORT] Connected to database: ${dbConfig.database}`);
        
        // Check if already saved
        const existing = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query('SELECT id FROM PublishedReports WHERE audit_id = @auditId');
        
        if (existing.recordset.length > 0) {
            // Update existing
            await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('fileName', sql.NVarChar(500), fileName)
                .input('publishedBy', sql.NVarChar(255), user.email)
                .input('publishedByName', sql.NVarChar(255), user.displayName || user.email)
                .query(`
                    UPDATE PublishedReports 
                    SET file_name = @fileName, 
                        published_by = @publishedBy,
                        published_by_name = @publishedByName,
                        published_at = GETDATE()
                    WHERE audit_id = @auditId
                `);
        } else {
            // Insert new
            await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('documentNumber', sql.NVarChar(50), documentNumber)
                .input('fileName', sql.NVarChar(500), fileName)
                .input('storeName', sql.NVarChar(255), storeName)
                .input('totalScore', sql.Decimal(5, 2), totalScore || 0)
                .input('publishedBy', sql.NVarChar(255), user.email)
                .input('publishedByName', sql.NVarChar(255), user.displayName || user.email)
                .query(`
                    INSERT INTO PublishedReports (audit_id, document_number, file_name, store_name, total_score, published_by, published_by_name)
                    VALUES (@auditId, @documentNumber, @fileName, @storeName, @totalScore, @publishedBy, @publishedByName)
                `);
        }
        
        console.log(`✅ Report published for Store Manager: ${documentNumber} by ${user.email}`);
        
        // ========================================
        // Send Email Notification to Store Manager
        // ========================================
        let emailStatus = { sent: false, recipients: [] };
        
        console.log(`📧 [EMAIL] ========== STARTING EMAIL PROCESS ==========`);
        console.log(`📧 [EMAIL] auditId received: ${auditId}, type: ${typeof auditId}`);
        
        try {
            // Get store code from audit
            const auditResult = await pool.request()
                .input('auditId', sql.Int, auditId)
                .query('SELECT StoreCode FROM AuditInstances WHERE AuditID = @auditId');
            
            console.log(`📧 [EMAIL] AuditInstances query result: ${JSON.stringify(auditResult.recordset)}`);
            
            const storeCode = auditResult.recordset.length > 0 ? auditResult.recordset[0].StoreCode : null;
            console.log(`📧 [EMAIL] Store code for audit ${auditId}: ${storeCode}`);
            
            if (storeCode) {
                // Find store managers assigned to this store
                const storeManagersWithStores = await pool.request()
                    .query(`
                        SELECT id, email, display_name, assigned_stores
                        FROM Users
                        WHERE role = 'StoreManager'
                        AND is_active = 1
                        AND is_approved = 1
                    `);
                
                console.log(`📧 [EMAIL] Found ${storeManagersWithStores.recordset.length} total store managers`);
                
                const managers = [];
                for (const mgr of storeManagersWithStores.recordset) {
                    if (mgr.assigned_stores) {
                        try {
                            const stores = JSON.parse(mgr.assigned_stores);
                            // Check if store code matches exactly
                            if (stores.includes(storeCode)) {
                                managers.push(mgr);
                                console.log(`📧 [EMAIL] Matched store manager: ${mgr.email} (stores: ${mgr.assigned_stores})`);
                            }
                        } catch (e) {
                            // Skip if JSON parse fails
                        }
                    }
                }
                
                console.log(`📧 [EMAIL] Matched ${managers.length} store managers for store ${storeCode}`);
                
                if (managers.length > 0) {
                    // Build report URL
                    const baseUrl = process.env.BASE_URL || 'https://fsaudit.gmrlapps.com';
                    const reportUrl = `${baseUrl}/api/audits/reports/${fileName}`;
                    
                    // Create connector for email service
                    const SimpleGraphConnector = require('./src/simple-graph-connector');
                    const spConfig = require('./config/default').sharepoint || {};
                    const connector = new SimpleGraphConnector(spConfig);
                    await connector.connectToSharePoint();
                    
                    const emailService = new EmailNotificationService(connector);
                    
                    // Use dynamic email template from database
                    const emailTemplateService = require('./services/email-template-service');
                    
                    for (const manager of managers) {
                        const recipientName = manager.display_name || manager.email.split('@')[0];
                        const scoreColor = totalScore >= 83 ? '#10b981' : '#ef4444';
                        
                        // Build email using dynamic template
                        const emailData = await emailTemplateService.buildEmail('report_notification', {
                            recipientName: recipientName,
                            storeName: storeName,
                            documentNumber: documentNumber,
                            auditDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                            score: totalScore ? Math.round(totalScore) + '%' : 'N/A',
                            scoreColor: scoreColor,
                            reportUrl: reportUrl,
                            dashboardUrl: baseUrl + '/dashboard'
                        });
                        
                        let emailSubject, emailHtml;
                        if (emailData) {
                            emailSubject = emailData.subject;
                            emailHtml = emailData.html;
                            console.log(`📧 [EMAIL] Using dynamic template: report_notification`);
                        } else {
                            // Fallback to simple email if template not found
                            emailSubject = `Food Safety Audit Report - ${storeName} (${documentNumber})`;
                            emailHtml = `<p>Dear ${recipientName},</p><p>A new audit report is available for ${storeName}.</p><p><a href="${reportUrl}">View Report</a></p>`;
                            console.log(`📧 [EMAIL] Template not found, using fallback`);
                        }
                        // Use user's delegated token only (refresh if expired)
                        const validAccessToken = await getValidAccessToken(req);
                        if (!validAccessToken) {
                            throw new Error('Session expired. Please log in again.');
                        }
                        
                        const result = await emailService.sendEmail(
                            [manager.email],
                            emailSubject,
                            emailHtml,
                            null, // CC recipients
                            validAccessToken,
                            { email: user.email, name: user.displayName } // Sender verification
                        );
                        
                        if (result.success) {
                            emailStatus.recipients.push(manager.email);
                            console.log(`📧 Email sent to Store Manager: ${manager.email}`);
                        } else {
                            console.error(`❌ Email failed to ${manager.email}: ${result.error}`);
                        }
                        
                        // Log notification with error message if failed
                        await pool.request()
                            .input('documentNumber', sql.NVarChar(50), documentNumber)
                            .input('recipientEmail', sql.NVarChar(255), manager.email)
                            .input('recipientName', sql.NVarChar(255), recipientName)
                            .input('recipientRole', sql.NVarChar(50), 'StoreManager')
                            .input('notificationType', sql.NVarChar(50), 'ReportPublished')
                            .input('sentByEmail', sql.NVarChar(255), user.email)
                            .input('sentByName', sql.NVarChar(255), user.displayName || user.email)
                            .input('status', sql.NVarChar(50), result.success ? 'Sent' : 'Failed')
                            .input('errorMessage', sql.NVarChar(sql.MAX), result.error || null)
                            .input('emailSubject', sql.NVarChar(500), `Food Safety Audit Report - ${storeName}`)
                            .query(`
                                INSERT INTO Notifications (
                                    document_number, recipient_email, recipient_name, recipient_role,
                                    notification_type, sent_by_email, sent_by_name,
                                    status, error_message, email_subject, sent_at
                                )
                                VALUES (
                                    @documentNumber, @recipientEmail, @recipientName, @recipientRole,
                                    @notificationType, @sentByEmail, @sentByName,
                                    @status, @errorMessage, @emailSubject, GETDATE()
                                )
                            `);
                    }
                    
                    emailStatus.sent = emailStatus.recipients.length > 0;
                }
            }
        } catch (emailError) {
            console.error('⚠️ Email notification failed (report still saved):', emailError.message);
        }
        
        // Log the report generation activity
        logReportGenerated(req.currentUser, documentNumber, storeName, req);
        if (emailStatus.sent) {
            logEmailSent(req.currentUser, emailStatus.recipients, `Food Safety Audit Report - ${storeName}`, req);
        }
        
        res.json({ 
            success: true, 
            message: 'Report saved for Store Manager',
            emailSent: emailStatus.sent,
            emailRecipients: emailStatus.recipients
        });
    } catch (error) {
        console.error('Error saving report for store manager:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get published report for an audit (for Store Manager to view)
app.get('/api/audits/:auditId/published-report', requireAuth, async (req, res) => {
    try {
        const auditId = parseInt(req.params.auditId);
        
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query('SELECT * FROM PublishedReports WHERE audit_id = @auditId');
        
        if (result.recordset.length === 0) {
            return res.json({ success: false, hasReport: false, message: 'No report published yet' });
        }
        
        const report = result.recordset[0];
        res.json({ 
            success: true, 
            hasReport: true,
            fileName: report.file_name,
            publishedAt: report.published_at,
            publishedBy: report.published_by_name
        });
    } catch (error) {
        console.error('Error getting published report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// List all generated reports from disk
// ==========================================
app.get('/api/reports/list', requireAuth, async (req, res) => {
    console.log('[API] /api/reports/list called by:', req.currentUser?.email);
    try {
        const reportsDir = path.join(__dirname, 'reports');
        console.log('[API] Reading reports from:', reportsDir);
        
        if (!fs.existsSync(reportsDir)) {
            console.log('[API] Reports directory does not exist');
            return res.json({ success: true, data: [] });
        }
        
        const files = fs.readdirSync(reportsDir);
        console.log('[API] Found', files.length, 'items in reports folder');
        
        const reports = files
            .filter(f => f.endsWith('.html') || f.endsWith('.pdf'))
            .map(filename => {
                const filePath = path.join(reportsDir, filename);
                const stats = fs.statSync(filePath);
                
                // Determine report type
                let type = 'Other';
                let documentNumber = '';
                
                if (filename.startsWith('Audit_Report_')) {
                    type = 'Audit Report';
                    // Extract doc number: Audit_Report_GMRL-FSACR-0001.html
                    const match = filename.match(/Audit_Report_(.+?)\.html/);
                    if (match) documentNumber = match[1];
                } else if (filename.startsWith('Action_Plan_')) {
                    type = 'Action Plan';
                    const match = filename.match(/Action_Plan_(.+?)\.html/);
                    if (match) documentNumber = match[1];
                } else if (filename.includes('_Department_Report') || filename.includes('Maintenance') || filename.includes('Procurement') || filename.includes('Cleaning')) {
                    type = 'Department Report';
                    // Try to extract doc number
                    const match = filename.match(/(GMRL-[A-Z]+-\d+)/);
                    if (match) documentNumber = match[1];
                } else if (filename.endsWith('.pdf')) {
                    type = 'PDF';
                    const match = filename.match(/(GMRL-[A-Z]+-\d+)/);
                    if (match) documentNumber = match[1];
                }
                
                // Format file size
                let sizeFormatted;
                if (stats.size < 1024) {
                    sizeFormatted = `${stats.size} B`;
                } else if (stats.size < 1024 * 1024) {
                    sizeFormatted = `${(stats.size / 1024).toFixed(1)} KB`;
                } else {
                    sizeFormatted = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
                }
                
                return {
                    filename,
                    type,
                    documentNumber,
                    size: stats.size,
                    sizeFormatted,
                    modified: stats.mtime.toISOString(),
                    created: stats.birthtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified)); // Most recent first
        
        console.log('[API] Returning', reports.length, 'reports');
        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('[API] Error listing reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve generated report HTML file
app.get('/api/audits/reports/:fileName', requireAuth, (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'reports', fileName);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Report not found' });
    }
    
    // For StoreManager, inject script to hide the "Save for Store Manager" button
    if (req.currentUser && req.currentUser.role === 'StoreManager') {
        let html = fs.readFileSync(filePath, 'utf8');
        // Inject a script before </body> to hide the save button
        const hideButtonScript = `
            <script>
                // Auto-hide Save button for StoreManager
                document.addEventListener('DOMContentLoaded', function() {
                    const saveBtn = document.querySelector('.save-btn');
                    if (saveBtn) saveBtn.style.display = 'none';
                });
            </script>
        `;
        html = html.replace('</body>', hideButtonScript + '</body>');
        return res.send(html);
    }
    
    res.sendFile(filePath);
});

// Serve report images - matches pattern: /api/audits/reports/images/ReportName/pic_xxx.jpg
app.get('/api/audits/reports/images/:folderName/:imageName', requireAuth, (req, res) => {
    const { folderName, imageName } = req.params;
    const imagePath = path.join(__dirname, 'reports', `${folderName}_images`, imageName);
    
    if (!fs.existsSync(imagePath)) {
        console.log(`Image not found: ${imagePath}`);
        return res.status(404).json({ success: false, error: 'Image not found' });
    }
    
    res.sendFile(imagePath);
});

// Export audit report to PDF
app.post('/api/audits/export-pdf', requireAuth, async (req, res) => {
    let browser = null;
    try {
        let { fileName } = req.body;
        
        if (!fileName) {
            return res.status(400).json({ success: false, error: 'fileName is required' });
        }
        
        // Decode URL-encoded filename (spaces become %20 in URLs)
        fileName = decodeURIComponent(fileName);
        
        console.log(`📄 [API] Exporting PDF for: ${fileName}`);
        
        const htmlPath = path.join(__dirname, 'reports', fileName);
        const reportsDir = path.join(__dirname, 'reports');
        
        if (!fs.existsSync(htmlPath)) {
            return res.status(404).json({ success: false, error: 'HTML report not found' });
        }
        
        // Check file size
        const stats = fs.statSync(htmlPath);
        const sizeMB = stats.size / 1024 / 1024;
        console.log(`   📊 HTML file size: ${sizeMB.toFixed(2)} MB`);
        
        // Read HTML and convert relative image paths to absolute file:// URLs
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Convert relative image paths to absolute file:// URLs for Puppeteer
        // Pattern: images/FolderName/imageName.jpg -> file:///reportsDir/FolderName_images/imageName.jpg
        htmlContent = htmlContent.replace(/src="images\/([^\/]+)\/([^"]+)"/g, (match, folderName, imageName) => {
            const absPath = path.join(reportsDir, `${folderName}_images`, imageName).replace(/\\/g, '/');
            return `src="file:///${absPath}"`;
        });
        
        // Also handle click handlers in image links  
        htmlContent = htmlContent.replace(/openImageModal\('images\/([^\/]+)\/([^']+)'\)/g, (match, folderName, imageName) => {
            const absPath = path.join(reportsDir, `${folderName}_images`, imageName).replace(/\\/g, '/');
            return `openImageModal('file:///${absPath}')`;
        });
        
        console.log(`   📊 HTML size after path conversion: ${(htmlContent.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Convert to PDF using Puppeteer with memory-optimized settings
        const puppeteer = require('puppeteer');
        console.log(`   🔄 Converting HTML to PDF (this may take a few minutes for large reports)...`);
        
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-file-access-from-files',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--js-flags=--max-old-space-size=4096'  // 4GB memory limit
            ]
        });
        
        const page = await browser.newPage();
        
        // Lower viewport for memory savings
        await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
        
        // Set longer timeout for navigation
        page.setDefaultNavigationTimeout(300000); // 5 minutes
        page.setDefaultTimeout(300000);
        
        console.log(`   📄 Loading HTML content...`);
        
        // Set HTML content with longer timeout
        await page.setContent(htmlContent, { 
            waitUntil: 'domcontentloaded',  // Don't wait for all images initially
            timeout: 300000  // 5 minutes
        });
        
        console.log(`   🖼️ Waiting for images to load...`);
        
        // Wait for images to load with a maximum timeout
        try {
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    const images = document.querySelectorAll('img');
                    let loaded = 0;
                    const total = images.length;
                    
                    if (total === 0) {
                        resolve();
                        return;
                    }
                    
                    const checkDone = () => {
                        loaded++;
                        if (loaded >= total) resolve();
                    };
                    
                    images.forEach(img => {
                        if (img.complete) {
                            checkDone();
                        } else {
                            img.addEventListener('load', checkDone);
                            img.addEventListener('error', checkDone);
                        }
                    });
                    
                    // Maximum wait time of 2 minutes for all images
                    setTimeout(resolve, 120000);
                });
            });
        } catch (imgError) {
            console.log(`   ⚠️ Some images may not have loaded: ${imgError.message}`);
        }
        
        console.log(`   📝 Generating PDF...`);
        
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; width: 100%; text-align: center; color: #666; padding: 5px;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `,
            margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
            scale: 0.8,
            timeout: 300000  // 5 minutes
        });
        
        await browser.close();
        browser = null;
        
        const pdfSizeMB = pdfBuffer.length / 1024 / 1024;
        console.log(`   ✅ PDF generated: ${pdfSizeMB.toFixed(2)} MB`);
        
        // Save PDF to disk for large files (>50MB) to avoid memory issues during transfer
        const pdfFileName = fileName.replace('.html', '.pdf');
        const pdfPath = path.join(__dirname, 'reports', pdfFileName);
        
        if (pdfSizeMB > 50) {
            // Save to disk and return download URL
            fs.writeFileSync(pdfPath, pdfBuffer);
            console.log(`   💾 Large PDF saved to disk: ${pdfPath}`);
            
            // Return JSON with download URL
            return res.json({
                success: true,
                downloadUrl: `/api/audits/reports/${pdfFileName}`,
                fileName: pdfFileName,
                sizeMB: pdfSizeMB.toFixed(2)
            });
        }
        
        // For smaller PDFs, stream directly
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        
    } catch (error) {
        console.error('❌ PDF export error:', error);
        
        // Always close browser on error
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message || 'PDF generation failed'
        });
    }
});

// Delete audit
app.delete('/api/audits/:auditId', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const result = await AuditService.deleteAudit(parseInt(req.params.auditId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting audit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve Audit List page (StoreManager can view their assigned stores only)
app.get('/auditor/audit-list', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor', 'StoreManager'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/audit-list.html'));
});

// Serve Fill Audit page (with query params - for view/continue from audit list)
// StoreManager can view in readonly mode
app.get('/auditor/fill-audit', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor', 'StoreManager'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/fill-audit.html'));
});

// Serve Fill Audit page (with path param - legacy)
// StoreManager can view in readonly mode
app.get('/auditor/fill-audit/:auditId', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor', 'StoreManager'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/fill-audit.html'));
});

// Serve Action Plan page (StoreManager can view and respond to action plans)
app.get('/auditor/action-plan', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor', 'StoreManager'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/action-plan.html'));
});

console.log('[APP] Audit app system loaded');

// ==========================================
// Protected Dashboard Route (Phase 5)
// ==========================================

// Protect dashboard with authentication and serve with user context
app.get('/dashboard', requireAuth, async (req, res) => {
    const user = req.currentUser;
    
    // Redirect pending users to approval page
    if (user.role === 'Pending') {
        return res.redirect('/auth/pending');
    }
    
    // Serve dashboard with user context injection
    await DashboardPage.serveDashboard(req, res);
});

// ==========================================
// Document List API (Dashboard)
// ==========================================

// Get documents list with role-based filtering
app.get('/api/documents', requireAuth, async (req, res) => {
    try {
        const user = req.currentUser;
        console.log(`📡 [API] Fetching documents from SQL for ${user.username} (${user.role})...`);
        
        // Get audits from SQL database instead of SharePoint
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                ai.AuditID,
                ai.DocumentNumber,
                ai.StoreID,
                ai.StoreCode,
                ai.StoreName,
                ai.SchemaID,
                ai.AuditDate,
                ai.Cycle,
                ai.Year,
                ai.Auditors,
                ai.AccompaniedBy,
                ai.Status,
                ai.TotalScore,
                ai.CreatedBy,
                ai.CreatedAt,
                ai.CompletedAt,
                s.SchemaName,
                s.SchemaCode
            FROM AuditInstances ai
            LEFT JOIN AuditSchemas s ON ai.SchemaID = s.SchemaID
            ORDER BY ai.CreatedAt DESC
        `);
        
        // Get section scores for each audit
        const sectionScoresResult = await pool.request().query(`
            SELECT 
                ass.AuditID,
                sec.SectionName,
                ass.Score,
                ass.MaxScore,
                ass.Percentage
            FROM AuditSectionScores ass
            JOIN AuditSections sec ON ass.SectionID = sec.SectionID
        `);
        
        // Create a map of section scores by audit ID
        const sectionScoresByAudit = {};
        sectionScoresResult.recordset.forEach(score => {
            if (!sectionScoresByAudit[score.AuditID]) {
                sectionScoresByAudit[score.AuditID] = {};
            }
            sectionScoresByAudit[score.AuditID][score.SectionName] = score.Percentage || 0;
        });
        
        // Get dynamic threshold for overall passing score
        const configService = req.app.locals.configService;
        const overallThreshold = await configService.getOverallPassingScore();
        
        // Process and format the documents
        const allDocuments = result.recordset.map(item => {
            const score = parseFloat(item.TotalScore) || 0;
            const sections = sectionScoresByAudit[item.AuditID] || {};
            
            // Determine status
            let status = item.Status || 'pending';
            if (status === 'Completed') status = 'completed';
            else if (status === 'In Progress') status = 'pending';
            
            return {
                documentNumber: item.DocumentNumber,
                storeName: item.StoreName || 'Unknown Store',
                storeCode: item.StoreCode,
                cycle: item.Cycle || 'Unknown Cycle',
                year: item.Year,
                auditor: item.Auditors || item.CreatedBy || 'System Generated',
                accompaniedBy: item.AccompaniedBy,
                created: item.CreatedAt,
                auditDate: item.AuditDate,
                completedAt: item.CompletedAt,
                score: score,
                status: status,
                schemaName: item.SchemaName,
                schemaCode: item.SchemaCode,
                sections: {
                    foodStorage: sections['Food Storage & Dry Storage'] || 0,
                    fridges: sections['Fridges and Freezers'] || 0,
                    utensils: sections['Utensils and Equipment'] || 0,
                    foodHandling: sections['Food Handling'] || 0,
                    cleaning: sections['Cleaning and Disinfection'] || 0,
                    hygiene: sections['Personal Hygiene'] || 0,
                    restrooms: sections['Restrooms'] || 0,
                    garbage: sections['Garbage Storage & Disposal'] || 0,
                    maintenance: sections['Maintenance'] || 0,
                    chemicals: sections['Chemicals Available'] || 0,
                    monitoring: sections['Monitoring Sheets'] || 0,
                    culture: sections['Food Safety Culture'] || 0,
                    policies: sections['Policies & Procedures'] || 0
                }
            };
        });
        
        // Apply role-based filtering using DashboardFilterService
        const filteredDocuments = DashboardFilterService.filterReportsByRole(allDocuments, user);
        
        // Sort by creation date (newest first)
        filteredDocuments.sort((a, b) => new Date(b.created) - new Date(a.created));
        
        console.log(`✅ [API] Returning ${filteredDocuments.length} documents from SQL (filtered from ${allDocuments.length} total)`);
        
        res.json({
            success: true,
            documents: filteredDocuments,
            total: filteredDocuments.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error fetching documents from SQL:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch documents from database' 
        });
    }
});

// Get scoring thresholds API endpoint
app.get('/api/thresholds', requireAuth, async (req, res) => {
    try {
        console.log('📊 [API] Fetching scoring thresholds...');
        
        const configService = req.app.locals.configService;
        const thresholds = await configService.getScoringThresholds();
        
        res.json({
            success: true,
            thresholds: thresholds,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ [API] Error fetching thresholds:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch scoring thresholds' 
        });
    }
});

// ==========================================
// Report Access Routes
// ==========================================
// NOTE: Legacy /api/generate-report endpoint removed - use /api/audits/:auditId/report instead (SQL-based)

// Protected route to serve reports - requires authentication
app.get('/reports/:filename', requireAuth, async (req, res) => {
    try {
        const { filename } = req.params;
        const user = req.currentUser;
        
        // Validate filename to prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).send('Invalid filename');
        }
        
        const filePath = path.join(__dirname, 'reports', filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Report not found');
        }
        
        // Extract document number from filename (e.g., Food_Safety_Audit_Report_GMRL-FSACR-0001_2025-12-27.html)
        const docNumberMatch = filename.match(/_(GMRL-[^_]+)_/);
        const documentNumber = docNumberMatch ? docNumberMatch[1] : null;
        
        console.log(`📄 [REPORTS] User ${user.email} (${user.role}) requesting: ${filename}`);
        console.log(`📄 [REPORTS] Document Number: ${documentNumber}`);
        
        // Permission checks based on role
        if (user.role === 'Admin' || user.role === 'Auditor') {
            // Admins and Auditors can view all reports
            console.log(`✅ [REPORTS] Access granted - ${user.role} role`);
            return res.sendFile(filePath);
        }
        
        if (user.role === 'StoreManager' && documentNumber) {
            // Store Managers can only view reports for their assigned stores
            try {
                // Get store name from our database (NOT SharePoint - FS Survey is deleted)
                const dbConfig = require('./config/default').database;
                const pool = await sql.connect(dbConfig);
                
                const auditResult = await pool.request()
                    .input('documentNumber', sql.NVarChar(100), documentNumber)
                    .query(`
                        SELECT StoreName FROM AuditInstances 
                        WHERE DocumentNumber = @documentNumber
                    `);
                
                if (auditResult.recordset.length > 0) {
                    const reportStore = auditResult.recordset[0].StoreName;
                    
                    // Check if user is assigned to this store
                    const assignedStores = user.assignedStores || [];
                    
                    if (assignedStores.includes(reportStore)) {
                        console.log(`✅ [REPORTS] Access granted - Store Manager for: ${reportStore}`);
                        return res.sendFile(filePath);
                    } else {
                        console.log(`❌ [REPORTS] Access denied - Not assigned to store: ${reportStore}`);
                        console.log(`   User's stores: ${assignedStores.join(', ')}`);
                        return res.status(403).send('Access denied: You are not authorized to view this report');
                    }
                } else {
                    console.log(`⚠️  [REPORTS] Could not find store info for document: ${documentNumber}`);
                }
            } catch (error) {
                console.error('❌ [REPORTS] Error checking store permissions:', error);
                return res.status(500).send('Error verifying permissions');
            }
        }
        
        // Default deny
        console.log(`❌ [REPORTS] Access denied for user: ${user.email} (${user.role})`);
        return res.status(403).send('Access denied: Insufficient permissions');
        
    } catch (error) {
        console.error('❌ [REPORTS] Error serving report:', error);
        return res.status(500).send('Error loading report');
    }
});

// NOTE: Legacy /api/generate-action-plan endpoint removed - use /api/audits/:auditId/action-plan instead (SQL-based)
// NOTE: Legacy /api/export-pdf endpoint removed - use /api/audits/:auditId/export-pdf instead (SQL-based)

// Export report to DOC
app.post('/api/export-doc', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber } = req.body;
        
        if (!documentNumber) {
            return res.status(400).json({ 
                success: false,
                error: 'Document number is required' 
            });
        }
        
        console.log(`📝 [API] Exporting DOC for document: ${documentNumber}`);
        
        res.status(501).json({ 
            success: false,
            error: 'DOC export not yet implemented. Use PDF export instead.' 
        });
        
    } catch (error) {
        console.error('❌ [API] DOC export error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to export DOC: ' + error.message 
        });
    }
});

// ==========================================
// Action Plan Save/Load Endpoints
// ==========================================

/**
 * POST /api/action-plan/save
 * Save action plan data to MSSQL
 * Only StoreManager, SuperAuditor, and Admin can edit action plans
 * Auditors can only view (read-only access)
 */
app.post('/api/action-plan/save', requireAuth, async (req, res) => {
    try {
        const userRole = req.currentUser?.role;
        
        // Block Auditors from modifying action plan data
        // Only StoreManager, SuperAuditor, Admin, AreaManager, HeadOfOperations can edit
        const canEditRoles = ['StoreManager', 'SuperAuditor', 'Admin', 'AreaManager', 'HeadOfOperations'];
        if (!canEditRoles.includes(userRole)) {
            console.log(`⚠️ Action plan save blocked - User ${req.currentUser?.email} (${userRole}) not authorized to edit`);
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to edit action plan responses. Only Store Managers, SuperAuditors, and Admins can modify action plans.'
            });
        }
        
        const { documentNumber, actions, updatedBy } = req.body;
        
        if (!documentNumber || !actions || !Array.isArray(actions)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: documentNumber and actions array required'
            });
        }
        
        console.log(`📊 Saving ${actions.length} actions for document ${documentNumber}`);
        
        // Transform the data to match database schema
        const responses = actions.map(action => {
            const picturesJson = JSON.stringify(action.pictures || []);
            
            return {
                documentNumber: documentNumber,
                referenceValue: action.referenceValue,
                section: action.section,
                finding: action.finding,
                suggestedAction: action.existingCorrectiveAction || '',
                priority: action.priority,
                actionTaken: action.actionTaken,
                deadline: action.deadline || null,
                personInCharge: action.personInCharge,
                status: action.status,
                picturesPaths: picturesJson,
                updatedBy: updatedBy || req.currentUser?.email || 'Store Manager'
            };
        });
        
        // Save to database
        const result = await actionPlanService.saveMultipleResponses(responses, updatedBy || req.currentUser?.email || 'Store Manager');
        
        if (result.success) {
            console.log(`✅ Saved ${result.successCount} actions for ${documentNumber}`);
            
            // Log the activity
            logActionPlanSaved(req.currentUser, documentNumber, result.successCount, req);
            
            res.json({
                success: true,
                message: `Successfully saved ${result.successCount} actions`,
                data: result
            });
        } else {
            console.warn(`⚠️ Partial save: ${result.successCount} succeeded, ${result.errorCount} failed`);
            res.status(207).json({
                success: false,
                message: `Partial save: ${result.successCount} succeeded, ${result.errorCount} failed`,
                data: result
            });
        }
        
    } catch (error) {
        console.error('❌ Error saving action plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save action plan: ' + error.message
        });
    }
});

/**
 * GET /api/action-plan/:documentNumber
 * Retrieve saved action plan data from MSSQL
 */
app.get('/api/action-plan/:documentNumber', requireAuth, async (req, res) => {
    try {
        const { documentNumber } = req.params;
        
        const responses = await actionPlanService.getResponses(documentNumber);
        
        res.json({
            success: true,
            documentNumber: documentNumber,
            actions: responses
        });
        
    } catch (error) {
        console.error('❌ Error retrieving action plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve action plan: ' + error.message
        });
    }
});

/**
 * POST /api/action-plan/send-email
 * Send action plan email notification to store manager
 */
app.post('/api/action-plan/send-email', requireAuth, async (req, res) => {
    try {
        const { documentNumber, storeName, auditDate, score, testEmail } = req.body;
        const user = req.currentUser;
        
        if (!documentNumber || !storeName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: documentNumber and storeName'
            });
        }
        
        console.log(`📧 [API] Sending action plan email for ${documentNumber} - ${storeName}`);
        
        // Get SQL pool
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Initialize email service
        const connector = req.app.locals.sharePointConnector;
        const emailService = new EmailNotificationService(connector);
        
        let recipientEmails;
        
        // If testEmail provided (for testing), use that instead of looking up store managers
        if (testEmail) {
            console.log(`📧 [API] TEST MODE: Sending to ${testEmail}`);
            recipientEmails = [testEmail];
        } else {
            // Get store manager recipients for this store
            const recipients = await emailService.getReportRecipients(storeName, pool);
            
            if (recipients.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No store managers found for this store'
                });
            }
            
            // Extract recipient emails
            recipientEmails = recipients.map(r => r.email);
        }
        
        console.log(`📧 [API] Found recipients: ${recipientEmails.join(', ')}`);
        
        // Build email content using dynamic template
        const reportUrl = `${process.env.APP_BASE_URL || 'https://pappreports.gmrlapps.com:3001'}/reports/Action_Plan_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Use dynamic email template
        const emailTemplateService = require('./services/email-template-service');
        const emailData = await emailTemplateService.buildEmail('action_plan_ready', {
            document_number: documentNumber,
            store_name: storeName,
            audit_date: auditDate || 'N/A',
            score: score || 'N/A',
            score_color: parseFloat(score) >= 70 ? '#27ae60' : '#e74c3c',
            report_url: reportUrl,
            recipient_name: 'Store Manager'
        });
        
        const subject = emailData.subject;
        const htmlBody = emailData.html;
        
        // Get valid access token (refresh if expired)
        const validAccessToken = await getValidAccessToken(req);
        if (!validAccessToken) {
            return res.status(401).json({
                success: false,
                error: 'Session expired. Please log out and log in again.'
            });
        }
        
        // Send email using refreshed token with sender verification
        const result = await emailService.sendEmail(
            recipientEmails,
            subject,
            htmlBody,
            null,
            validAccessToken,
            { email: user.email, name: user.displayName } // Pass sender info for verification
        );
        
        if (result.success) {
            console.log(`✅ [API] Email sent successfully to ${recipientEmails.join(', ')}`);
            res.json({
                success: true,
                message: 'Email sent successfully',
                recipients: recipientEmails
            });
        } else {
            throw new Error(result.error || 'Failed to send email');
        }
        
    } catch (error) {
        console.error('❌ [API] Error sending action plan email:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/action-plan/submit-to-auditor
 * Send notification to auditor that store manager completed the action plan
 */
app.post('/api/action-plan/submit-to-auditor', requireAuth, async (req, res) => {
    try {
        const { documentNumber, storeName, auditDate, score } = req.body;
        const user = req.currentUser;
        
        if (!documentNumber || !storeName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: documentNumber and storeName'
            });
        }
        
        console.log(`📧 [API] Store manager submitting action plan ${documentNumber} to auditor`);
        
        // Get SQL pool
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Get the auditor who created this audit from AuditInstances table
        const auditResult = await pool.request()
            .input('DocumentNumber', sql.NVarChar(50), documentNumber)
            .query(`
                SELECT CreatedBy 
                FROM AuditInstances 
                WHERE DocumentNumber = @DocumentNumber
            `);
        
        let auditorEmail = null;
        if (auditResult.recordset.length > 0 && auditResult.recordset[0].CreatedBy) {
            auditorEmail = auditResult.recordset[0].CreatedBy;
        }
        
        // Get SuperAuditor users for CC
        const superAuditorQuery = `
            SELECT email, display_name
            FROM Users
            WHERE role = 'SuperAuditor'
            AND is_active = 1
            AND email_notifications_enabled = 1
        `;
        const superAuditorUsers = await pool.request().query(superAuditorQuery);
        
        const recipientEmails = [];
        const ccEmails = [];
        
        if (auditorEmail) {
            recipientEmails.push(auditorEmail);
            console.log(`📧 [API] Primary recipient (Auditor): ${auditorEmail}`);
        }
        
        // Add SuperAuditors as CC
        superAuditorUsers.recordset.forEach(sa => {
            if (sa.email && sa.email !== auditorEmail) {
                ccEmails.push(sa.email);
                console.log(`📧 [API] CC recipient (SuperAuditor): ${sa.email}`);
            }
        });
        
        if (recipientEmails.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No auditor found to notify'
            });
        }
        
        // Initialize email service with connector for fallback capability
        const connector = req.app.locals.sharePointConnector;
        const emailService = new EmailNotificationService(connector);
        
        // Use dynamic email template
        const emailTemplateService = require('./services/email-template-service');
        const emailData = await emailTemplateService.buildEmail('action_plan_submitted', {
            document_number: documentNumber,
            store_name: storeName,
            audit_date: auditDate || 'N/A',
            score: score || 'N/A',
            submitter_name: user.displayName || user.email,
            submitter_email: user.email
        });
        
        const subject = emailData.subject;
        const htmlBody = emailData.html;
        
        // Get valid access token (refresh if expired)
        const validAccessToken = await getValidAccessToken(req);
        if (!validAccessToken) {
            return res.status(401).json({
                success: false,
                error: 'Session expired. Please log out and log in again.'
            });
        }
        
        // Send email using refreshed token with sender verification
        const result = await emailService.sendEmail(
            recipientEmails,
            subject,
            htmlBody,
            ccEmails.length > 0 ? ccEmails : null,
            validAccessToken,
            { email: user.email, name: user.displayName } // Pass sender info for verification
        );
        
        if (result.success) {
            const allRecipients = [...recipientEmails, ...ccEmails];
            console.log(`✅ [API] Notification sent to ${recipientEmails.join(', ')}${ccEmails.length > 0 ? ' CC: ' + ccEmails.join(', ') : ''}`);
            
            // Log notification to history for each recipient
            for (const recipientEmail of allRecipients) {
                const isCC = ccEmails.includes(recipientEmail);
                await emailService.logNotification({
                    documentNumber: documentNumber,
                    recipientEmail: recipientEmail,
                    recipientName: recipientEmail,
                    recipientRole: isCC ? 'SuperAuditor' : 'Auditor',
                    notificationType: 'ActionPlanSubmitted',
                    sentByUserId: user.id,
                    sentByEmail: user.email,
                    sentByName: user.displayName || user.email,
                    status: 'Sent',
                    emailSubject: subject,
                    emailBody: htmlBody
                }, pool);
            }
            
            // Log the activity
            logActionPlanSubmitted(req.currentUser, documentNumber, req);
            
            res.json({
                success: true,
                message: 'Notification sent successfully',
                recipients: allRecipients
            });
        } else {
            // Log failed notification
            await emailService.logNotification({
                documentNumber: documentNumber,
                recipientEmail: recipientEmails.join(', '),
                recipientName: 'Auditor',
                recipientRole: 'Auditor',
                notificationType: 'ActionPlanSubmitted',
                sentByUserId: user.id,
                sentByEmail: user.email,
                sentByName: user.displayName || user.email,
                status: 'Failed',
                errorMessage: result.error,
                emailSubject: subject,
                emailBody: htmlBody
            }, pool);
            
            throw new Error(result.error || 'Failed to send notification');
        }
        
    } catch (error) {
        console.error('❌ [API] Error sending auditor notification:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/action-plan/:documentNumber/summary
 * Get summary statistics for a document
 */
app.get('/api/action-plan/:documentNumber/summary', requireAuth, async (req, res) => {
    try {
        const { documentNumber } = req.params;
        
        const summary = await actionPlanService.getSummary(documentNumber);
        
        res.json({
            success: true,
            documentNumber: documentNumber,
            summary: summary
        });
        
    } catch (error) {
        console.error('❌ Error retrieving summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve summary: ' + error.message
        });
    }
});

// NOTE: Legacy /api/generate-department-followup endpoint removed
// Department reports now use /api/audits/:auditId/department-report/:department (SQL-based)

// ==========================================
// Get Available Recipients for Notifications
// ==========================================

app.post('/api/notifications/get-recipients', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const { storeName } = req.body;
        
        if (!storeName) {
            return res.status(400).json({ 
                success: false,
                error: 'Store name is required' 
            });
        }
        
        console.log(`👥 [API] Getting recipients for store: ${storeName}`);
        
        // Connect to database
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Initialize email service to use its recipient logic
        const connector = req.app.locals.sharePointConnector;
        const EmailNotificationService = require('./services/email-notification-service');
        const emailService = new EmailNotificationService(connector);
        
        // Get recipients
        const recipients = await emailService.getReportRecipients(storeName, pool);
        
        // Group by role for better UI organization
        const grouped = {
            storeManagers: recipients.filter(r => r.role === 'StoreManager'),
            departmentHeads: recipients.filter(r => r.role !== 'StoreManager')
        };
        
        console.log(`✅ [API] Found ${recipients.length} recipients (${grouped.storeManagers.length} Store Managers, ${grouped.departmentHeads.length} Department Heads)`);
        
        res.json({
            success: true,
            recipients: grouped,
            total: recipients.length
        });
        
    } catch (error) {
        console.error('❌ [API] Error getting recipients:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get recipients: ' + error.message 
        });
    }
});

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get user ID from Users table by Azure user ID
 */
async function getUserIdByAzureId(azureUserId, pool) {
    try {
        const result = await pool.request()
            .input('azureUserId', sql.NVarChar(255), azureUserId)
            .query('SELECT id FROM Users WHERE azure_user_id = @azureUserId');
        
        return result.recordset.length > 0 ? result.recordset[0].id : null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}

// ==========================================
// Save Report to Database
// ==========================================

app.post('/api/reports/save', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const user = req.currentUser;
        const reportData = req.body;
        
        console.log(`💾 [API] Saving report: ${reportData.documentNumber} by ${user.email}`);
        
        // Validate required fields
        if (!reportData.documentNumber) {
            return res.status(400).json({ 
                success: false,
                message: 'Document number is required' 
            });
        }
        
        // Connect to database
        const sql = require('mssql');
        const dbConfig = require('./config/default').database;
        const pool = await sql.connect(dbConfig);
        
        // Check if report already exists
        const existingReport = await pool.request()
            .input('documentNumber', sql.NVarChar(50), reportData.documentNumber)
            .input('reportType', sql.NVarChar(50), reportData.reportType || 'Enhanced HTML')
            .query(`
                SELECT id FROM SavedReports 
                WHERE document_number = @documentNumber 
                AND report_type = @reportType
            `);
        
        if (existingReport.recordset.length > 0) {
            // Update existing report
            await pool.request()
                .input('id', sql.Int, existingReport.recordset[0].id)
                .input('reportData', sql.NVarChar(sql.MAX), JSON.stringify(reportData))
                .input('overallScore', sql.Decimal(5, 2), reportData.overallScore || 0)
                .input('storeName', sql.NVarChar(255), reportData.storeName || '')
                .input('auditDate', sql.Date, reportData.auditDate ? new Date(reportData.auditDate) : new Date())
                .input('savedByEmail', sql.NVarChar(255), user.email)
                .input('savedByName', sql.NVarChar(255), user.displayName || user.email)
                .query(`
                    UPDATE SavedReports
                    SET 
                        report_data = @reportData,
                        overall_score = @overallScore,
                        store_name = @storeName,
                        audit_date = @auditDate,
                        saved_by_email = @savedByEmail,
                        saved_by_name = @savedByName,
                        updated_at = GETDATE()
                    WHERE id = @id
                `);
            
            console.log(`✅ [API] Updated existing report: ${reportData.documentNumber} (Overwrite allowed)`);
            
            res.json({
                success: true,
                message: 'Report updated successfully - Previous version overwritten',
                reportId: existingReport.recordset[0].id,
                action: 'updated'
            });
            
        } else {
            // Insert new report
            // Note: user.id from requireAuth middleware is actually the user_id from Sessions table
            const userId = user.azureUserId ? await getUserIdByAzureId(user.azureUserId, pool) : null;
            
            const result = await pool.request()
                .input('documentNumber', sql.NVarChar(50), reportData.documentNumber)
                .input('reportType', sql.NVarChar(50), reportData.reportType || 'Enhanced HTML')
                .input('filePath', sql.NVarChar(500), reportData.filePath || '')
                .input('savedByUserId', sql.Int, userId)
                .input('savedByEmail', sql.NVarChar(255), user.email)
                .input('savedByName', sql.NVarChar(255), user.displayName || user.email)
                .input('reportData', sql.NVarChar(sql.MAX), JSON.stringify(reportData))
                .input('overallScore', sql.Decimal(5, 2), reportData.overallScore || 0)
                .input('storeName', sql.NVarChar(255), reportData.storeName || '')
                .input('auditDate', sql.Date, reportData.auditDate ? new Date(reportData.auditDate) : new Date())
                .query(`
                    INSERT INTO SavedReports (
                        document_number, report_type, file_path,
                        saved_by_user_id, saved_by_email, saved_by_name,
                        report_data, overall_score, store_name, audit_date,
                        saved_at, updated_at
                    )
                    OUTPUT INSERTED.id
                    VALUES (
                        @documentNumber, @reportType, @filePath,
                        @savedByUserId, @savedByEmail, @savedByName,
                        @reportData, @overallScore, @storeName, @auditDate,
                        GETDATE(), GETDATE()
                    )
                `);
            
            const reportId = result.recordset[0].id;
            
            console.log(`✅ [API] Saved new report: ${reportData.documentNumber} (ID: ${reportId})`);
            
            res.json({
                success: true,
                message: 'Report saved successfully',
                reportId: reportId,
                action: 'created'
            });
        }
        
    } catch (error) {
        console.error('❌ [API] Save report error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to save report: ' + error.message 
        });
    }
});

// ==========================================
// Department Follow-up Reports (existing)
// ==========================================

// Protect department reports with role checking
app.get('/api/department-reports/:department', requireAuth, async (req, res) => {
    try {
        const user = req.currentUser;
        const requestedDepartment = req.params.department;
        
        // Check if user has access to this department
        const hasAccess = 
            user.role === 'Admin' || 
            user.role === 'Auditor' ||
            user.assignedDepartment === requestedDepartment;
        
        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'You do not have access to this department\'s reports' 
            });
        }
        
        // TODO: Integrate with existing department-followup-reports
        res.json({ message: `${requestedDepartment} reports - coming soon` });
        
    } catch (error) {
        console.error('[API] Department reports error:', error);
        res.status(500).json({ error: 'Failed to fetch department reports' });
    }
});

// ==========================================
// Notification History Routes (Admin & Auditor Only)
// ==========================================

/**
 * GET /api/notifications
 * Get all notifications with filtering and pagination
 * Protected: SQL-driven via MenuPermissions
 */
app.get('/api/notifications', requireAuth, requirePagePermission(NOTIFICATION_PAGE, 'Admin', 'Auditor'), async (req, res) => {
    try {
        const { status, dateFrom, dateTo, recipient, documentNumber, sentBy, notificationType, page, pageSize, sortBy, sortOrder } = req.query;

        console.log(`📋 [API] Fetching notification history (User: ${req.currentUser.email})`);

        const pool = await require('./database/db-connection').getPool();
        const notificationService = new NotificationHistoryService();

        const filters = {
            status,
            dateFrom,
            dateTo,
            recipient,
            documentNumber,
            sentBy,
            notificationType
        };

        const options = {
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 50,
            sortBy,
            sortOrder
        };

        const result = await notificationService.getNotifications(pool, filters, options);

        console.log(`✅ [API] Retrieved ${result.notifications.length} notifications (Total: ${result.total})`);

        res.json({
            success: true,
            data: result.notifications,
            pagination: {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
                totalPages: result.totalPages
            }
        });

    } catch (error) {
        console.error('❌ [API] Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification history',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/statistics
 * Get notification statistics
 * Protected: SQL-driven via MenuPermissions
 */
app.get('/api/notifications/statistics', requireAuth, requirePagePermission(NOTIFICATION_PAGE, 'Admin', 'Auditor'), async (req, res) => {
    try {
        console.log(`📊 [API] Fetching notification statistics (User: ${req.currentUser.email})`);

        const pool = await require('./database/db-connection').getPool();
        const notificationService = new NotificationHistoryService();

        const stats = await notificationService.getStatistics(pool);

        console.log(`✅ [API] Retrieved statistics: ${stats.total} total notifications`);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ [API] Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/recent
 * Get recent notifications (last 24 hours)
 * Protected: SQL-driven via MenuPermissions
 */
app.get('/api/notifications/recent', requireAuth, requirePagePermission(NOTIFICATION_PAGE, 'Admin', 'Auditor'), async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;

        console.log(`🕐 [API] Fetching ${limit} recent notifications (User: ${req.currentUser.email})`);

        const pool = await require('./database/db-connection').getPool();
        const notificationService = new NotificationHistoryService();

        const notifications = await notificationService.getRecentNotifications(pool, limit);

        console.log(`✅ [API] Retrieved ${notifications.length} recent notifications`);

        res.json({
            success: true,
            data: notifications
        });

    } catch (error) {
        console.error('❌ [API] Error fetching recent notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent notifications',
            error: error.message
        });
    }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 * Protected: SQL-driven via MenuPermissions
 */
app.patch('/api/notifications/:id/read', requireAuth, requirePagePermission(NOTIFICATION_PAGE, 'Admin', 'Auditor'), async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        console.log(`✅ [API] Marking notification ${notificationId} as read (User: ${req.currentUser.email})`);

        const pool = await require('./database/db-connection').getPool();
        const notificationService = new NotificationHistoryService();

        await notificationService.markAsRead(pool, notificationId);

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('❌ [API] Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
});

// ==========================================
// Root Route
// ==========================================

app.get('/', (req, res) => {
    // Redirect to dashboard if authenticated, otherwise login
    if (req.cookies?.auth_token) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// ==========================================
// 404 Handler
// ==========================================

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Not Found</title>
            <style>
                body {
                    font-family: 'Segoe UI', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    text-align: center;
                    background: white;
                    padding: 50px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { color: #2c3e50; font-size: 5em; margin: 0; }
                p { color: #666; font-size: 1.5em; }
                a { 
                    display: inline-block;
                    margin-top: 20px;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: 600;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404</h1>
                <p>Page not found</p>
                <a href="/">Go to Home</a>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// Start Server (HTTP or HTTPS)
// ==========================================

// Check for SSL certificate configuration
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SSL_PFX_PATH = process.env.SSL_PFX_PATH;
const SSL_PFX_PASSWORD = process.env.SSL_PFX_PASSWORD;

// Determine if we can use HTTPS
const USE_HTTPS_PEM = SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);
const USE_HTTPS_PFX = SSL_PFX_PATH && fs.existsSync(SSL_PFX_PATH);
const USE_HTTPS = USE_HTTPS_PEM || USE_HTTPS_PFX;

// Get base URL from environment or construct it
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const BASE_URL = APP_URL.replace(/\/$/, ''); // Remove trailing slash if present

if (USE_HTTPS) {
    let httpsOptions;
    
    if (USE_HTTPS_PFX) {
        // Use PFX format (Windows-friendly)
        httpsOptions = {
            pfx: fs.readFileSync(SSL_PFX_PATH),
            passphrase: SSL_PFX_PASSWORD || ''
        };
        console.log('🔒 Using PFX certificate:', SSL_PFX_PATH);
    } else {
        // Use PEM format (key + cert)
        httpsOptions = {
            key: fs.readFileSync(SSL_KEY_PATH),
            cert: fs.readFileSync(SSL_CERT_PATH)
        };
        // Add CA bundle if provided
        if (process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)) {
            httpsOptions.ca = fs.readFileSync(process.env.SSL_CA_PATH);
        }
        console.log('🔒 Using PEM certificate:', SSL_CERT_PATH);
    }
    
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 FOOD SAFETY AUDIT SYSTEM (HTTPS)');
        console.log('='.repeat(60));
        console.log(`✅ Server running on ${BASE_URL}`);
        console.log(`📦 Environment: ${process.env.SQL_DATABASE || 'FoodSafetyDB'}`);
        console.log('');
        console.log('📋 Available Routes:');
        console.log(`   🔓 Login:           ${BASE_URL}/auth/login`);
        console.log(`   🔐 Dashboard:       ${BASE_URL}/dashboard`);
        console.log(`   👤 Admin Panel:     ${BASE_URL}/admin/users`);
        console.log(`   🛠️  Checklist Mgmt:  ${BASE_URL}/admin/checklist-management`);
        console.log(`   📝 Template Mgmt:   ${BASE_URL}/admin/checklist-templates`);
        console.log(`   📊 Auditor Select:  ${BASE_URL}/auditor/select`);
        console.log(`   🚪 Logout:          ${BASE_URL}/auth/logout`);
        console.log('');
        console.log('📌 Default Admin: muhammad.shammas@gmrlgroup.com');
        console.log('='.repeat(60));
    });
} else {
    // HTTP Server (fallback)
    http.createServer(app).listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 FOOD SAFETY AUDIT SYSTEM (HTTP)');
        console.log('='.repeat(60));
        console.log(`✅ Server running on ${BASE_URL}`);
        console.log(`📦 Database: ${process.env.SQL_DATABASE || 'FoodSafetyDB'}`);
        console.log('');
        if (!SSL_KEY_PATH && !SSL_CERT_PATH && !SSL_PFX_PATH) {
            console.log('ℹ️  Running in HTTP mode (SSL not configured)');
        } else {
            console.log('⚠️  SSL certificate files not found at specified paths');
        }
        console.log('');
        console.log('📋 Available Routes:');
        console.log(`   🔓 Login:           ${BASE_URL}/auth/login`);
        console.log(`   🔐 Dashboard:       ${BASE_URL}/dashboard`);
        console.log(`   👤 Admin Panel:     ${BASE_URL}/admin/users`);
        console.log(`   🛠️  Checklist Mgmt:  ${BASE_URL}/admin/checklist-management`);
        console.log(`   📝 Template Mgmt:   ${BASE_URL}/admin/checklist-templates`);
        console.log(`   📊 Auditor Select:  ${BASE_URL}/auditor/select`);
        console.log(`   🚪 Logout:          ${BASE_URL}/auth/logout`);
        console.log('');
        console.log('📌 Default Admin: muhammad.shammas@gmrlgroup.com');
        console.log('='.repeat(60));
    });
}

module.exports = app;
