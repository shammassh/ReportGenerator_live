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
const { initializeAuth, requireAuth, requireRole } = require('./auth/auth-server');
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

// Serve the template builder page (Admin/SuperAuditor only)
app.get('/admin/template-builder', requireAuth, requireRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-template-builder.html'));
});

// API Routes for Audit Templates
// Get all schemas
app.get('/api/audit-templates/schemas', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const schemas = await auditTemplateService.getAllSchemas();
        res.json({ success: true, data: schemas });
    } catch (error) {
        console.error('Error fetching schemas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create schema
app.post('/api/audit-templates/schemas', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.get('/api/audit-templates/schemas/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const schema = await auditTemplateService.getFullSchema(parseInt(req.params.schemaId));
        res.json({ success: true, data: schema });
    } catch (error) {
        console.error('Error fetching schema:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update schema (rename)
app.put('/api/audit-templates/schemas/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.delete('/api/audit-templates/schemas/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.get('/api/audit-templates/schemas/:schemaId/sections', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const sections = await auditTemplateService.getSectionsBySchema(parseInt(req.params.schemaId));
        res.json({ success: true, data: sections });
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create section
app.post('/api/audit-templates/schemas/:schemaId/sections', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.get('/api/audit-templates/sections/:sectionId/items', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const items = await auditTemplateService.getItemsBySection(parseInt(req.params.sectionId));
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create item
app.post('/api/audit-templates/sections/:sectionId/items', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.post('/api/audit-templates/sections/:sectionId/items/bulk', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.put('/api/audit-templates/items/:itemId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.delete('/api/audit-templates/items/:itemId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await auditTemplateService.deleteItem(parseInt(req.params.itemId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete ALL items in a section
app.delete('/api/audit-templates/sections/:sectionId/items/all', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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

// Serve Category Management page
app.get('/admin/category-management', requireAuth, requireRole('Admin', 'SuperAuditor'), (req, res) => {
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

// Serve Store Management page
app.get('/admin/store-management', requireAuth, requireRole('Admin', 'SuperAuditor'), (req, res) => {
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
app.get('/api/stores/available-managers', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.get('/api/stores/manager-assignments', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const assignments = await StoreService.getAllStoreManagerAssignments();
        res.json({ success: true, data: assignments });
    } catch (error) {
        console.error('Error getting store manager assignments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create store
app.post('/api/stores', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.put('/api/stores/:storeId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await StoreService.updateStore(parseInt(req.params.storeId), req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating store:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete store
app.delete('/api/stores/:storeId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const result = await StoreService.deleteStore(parseInt(req.params.storeId));
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error deleting store:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get store managers for a specific store
app.get('/api/stores/:storeId/managers', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const managers = await StoreService.getStoreManagers(parseInt(req.params.storeId));
        res.json({ success: true, data: managers });
    } catch (error) {
        console.error('Error getting store managers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Assign store managers to a store
app.post('/api/stores/:storeId/managers', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
app.delete('/api/stores/:storeId/managers/:userId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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

// Serve analytics page
app.get('/admin/analytics', requireAuth, requireRole('Admin', 'SuperAuditor'), (req, res) => {
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

// Serve System Settings page
app.get('/admin/system-settings', requireAuth, requireRole('Admin', 'SuperAuditor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'audit-app/pages/system-settings.html'));
});

// Get all schemas with settings
app.get('/api/system-settings/schemas', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const schemas = await SystemSettingsService.getSchemasWithSettings();
        res.json({ success: true, schemas });
    } catch (error) {
        console.error('Error getting schemas with settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get settings for a specific schema
app.get('/api/system-settings/schema/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
    try {
        const settings = await SystemSettingsService.getSchemaSettings(parseInt(req.params.schemaId));
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error getting schema settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save settings for a schema
app.post('/api/system-settings/schema/:schemaId', requireAuth, requireRole('Admin', 'SuperAuditor'), async (req, res) => {
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
        const result = await AuditService.updateResponse(parseInt(req.params.responseId), req.body);
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

// Save report for Store Manager (Admin/Auditor saves it so SM can view)
app.post('/api/audits/save-report-for-store-manager', requireAuth, requireRole('Admin', 'SuperAuditor', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber, auditId, fileName, storeName, totalScore } = req.body;
        const user = req.currentUser;
        
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
        
        console.log(`✅ Report published for Store Manager: ${documentNumber} by ${user.email}`);
        res.json({ success: true, message: 'Report saved for Store Manager' });
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
// Existing Report Generation Routes
// ==========================================

// Generate enhanced HTML report (POST request)
app.post('/api/generate-report', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber, sendNotifications = false, selectedRecipients = null } = req.body;
        const user = req.currentUser;
        
        if (!documentNumber) {
            return res.status(400).json({ 
                success: false,
                error: 'Document number is required' 
            });
        }
        
        console.log(`📊 [API] Generating report for document: ${documentNumber}`);
        if (sendNotifications) {
            console.log(`📧 [API] Email notifications will be sent after generation`);
            if (selectedRecipients && selectedRecipients.length > 0) {
                console.log(`📧 [API] Selected ${selectedRecipients.length} recipient(s)`);
            }
        }
        
        // Get SharePoint connector
        const connector = req.app.locals.sharePointConnector;
        if (!connector) {
            throw new Error('SharePoint connector not available');
        }
        
        // Ensure connected
        if (!connector.isConnected) {
            await connector.connectToSharePoint();
        }
        
        // Initialize report generator
        const reportGenerator = new ReportGenerator(connector, {
            outputDir: path.join(__dirname, 'reports'),
            templatesDir: path.join(__dirname, 'enhanced-report-generator', 'templates'),
            reportOptions: {
                convertImagesToBase64: true,
                includeImages: true,
                format: 'html'
            }
        });
        
        // Generate the report
        const result = await reportGenerator.generateReport(documentNumber);
        
        if (result.success) {
            // Get the relative path for the URL
            const relativePath = path.relative(__dirname, result.filePath);
            const reportUrl = `/reports/${path.basename(result.filePath)}`;
            const absoluteReportUrl = `https://pappreports.gmrlapps.com:3001${reportUrl}`;
            
            console.log(`✅ [API] Report generated: ${result.filePath}`);
            console.log(`📊 [API] Report URL: ${absoluteReportUrl}`);
            
            // Send email notifications if enabled
            let notificationResult = null;
            if (sendNotifications) {
                try {
                    console.log(`📧 [API] Fetching report metadata for notifications...`);
                    
                    // Get report metadata from SharePoint
                    const surveyItems = await connector.getListItems('FS Survey', {
                        filter: `Document_x0020_Number eq '${documentNumber}'`,
                        select: 'Store_x0020_Name,Created,Auditor,Scor',
                        top: 1
                    });
                    
                    if (surveyItems && surveyItems.length > 0) {
                        const surveyItem = surveyItems[0];
                        const reportData = {
                            documentNumber,
                            storeName: surveyItem['Store_x0020_Name'] || 'Unknown Store',
                            auditDate: surveyItem.Created || new Date().toISOString(),
                            overallScore: parseFloat(surveyItem.Scor) || 0,
                            auditor: surveyItem.Auditor || user.displayName || user.email,
                            reportUrl: absoluteReportUrl
                        };
                        
                        console.log(`📧 [API] Report metadata:`, {
                            store: reportData.storeName,
                            score: reportData.overallScore,
                            auditor: reportData.auditor
                        });
                        
                        // Initialize email service
                        const emailService = new EmailNotificationService(connector);
                        
                        // Connect to database
                        const sql = require('mssql');
                        const dbConfig = require('./config/default').database;
                        const pool = await sql.connect(dbConfig);
                        
                        // Send notifications using user's delegated token
                        notificationResult = await emailService.notifyReportGeneration(
                            reportData,
                            { 
                                email: user.email, 
                                name: user.displayName || user.email,
                                azureUserId: user.azureUserId,
                                accessToken: user.accessToken // Use user's delegated token from session
                            },
                            pool,
                            selectedRecipients // Pass selected recipients array
                        );
                        
                        console.log(`📧 [API] ${notificationResult.message}`);
                    } else {
                        console.warn(`⚠️  [API] No survey data found for ${documentNumber} - skipping notifications`);
                    }
                } catch (emailError) {
                    console.error('⚠️  [API] Email notification failed (report still generated):', emailError.message);
                    // Don't fail the whole request if email fails
                    notificationResult = {
                        success: false,
                        sent: 0,
                        failed: 0,
                        total: 0,
                        error: emailError.message
                    };
                }
            }
            
            res.json({
                success: true,
                message: 'Report generated successfully',
                reportUrl: reportUrl,
                filePath: result.filePath,
                documentNumber: documentNumber,
                notifications: notificationResult
            });
        } else {
            throw new Error('Report generation failed');
        }
        
    } catch (error) {
        console.error('❌ [API] Report generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate report: ' + error.message 
        });
    }
});

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
                // Connect to SharePoint to get the store name for this document
                if (!connector.isConnected) {
                    await connector.connectToSharePoint();
                }
                
                const surveyItems = await connector.getListItems('FS Survey', {
                    filter: `Document_x0020_Number eq '${documentNumber}'`,
                    select: 'Store_x0020_Name',
                    top: 1
                });
                
                if (surveyItems && surveyItems.length > 0) {
                    const reportStore = surveyItems[0]['Store_x0020_Name'];
                    
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

// Generate Action Plan Report (POST request)
app.post('/api/generate-action-plan', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber } = req.body;
        
        if (!documentNumber) {
            return res.status(400).json({ 
                success: false,
                error: 'Document number is required' 
            });
        }
        
        console.log(`🎯 [API] Generating action plan for document: ${documentNumber}`);
        
        // Get SharePoint connector
        const connector = req.app.locals.sharePointConnector;
        if (!connector) {
            throw new Error('SharePoint connector not available');
        }
        
        // Ensure connected
        if (!connector.isConnected) {
            await connector.connectToSharePoint();
        }
        
        // Initialize action plan report generator
        const actionPlanGenerator = new ActionPlanReportGenerator({
            outputDir: path.join(__dirname, 'reports'),
            connector: connector
        });
        
        // Set the connector
        actionPlanGenerator.connector = connector;
        
        // Generate the action plan
        const result = await actionPlanGenerator.generateActionPlanForDocument(documentNumber);
        
        if (result.success) {
            // Get the relative path for the URL
            const reportUrl = `/reports/${result.fileName}`;
            
            console.log(`✅ [API] Action plan generated: ${result.filePath}`);
            console.log(`📋 [API] Found ${result.correctiveActionsCount} corrective actions`);
            
            res.json({
                success: true,
                message: 'Action plan generated successfully',
                reportUrl: reportUrl,
                filePath: result.filePath,
                fileName: result.fileName,
                correctiveActionsCount: result.correctiveActionsCount,
                documentNumber: documentNumber
            });
        } else {
            throw new Error('Action plan generation failed');
        }
        
    } catch (error) {
        console.error('❌ [API] Action plan generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate action plan: ' + error.message 
        });
    }
});

// ==========================================
// PDF/DOC Export Routes
// ==========================================

// Export report to PDF
app.post('/api/export-pdf', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const { documentNumber } = req.body;
        
        if (!documentNumber) {
            return res.status(400).json({ 
                success: false,
                error: 'Document number is required' 
            });
        }
        
        console.log(`📄 [API] Exporting PDF for document: ${documentNumber}`);
        
        // Get SharePoint connector
        const connector = req.app.locals.sharePointConnector;
        if (!connector) {
            throw new Error('SharePoint connector not available');
        }
        
        // Ensure connected
        if (!connector.isConnected) {
            await connector.connectToSharePoint();
        }
        
        // Check if HTML report exists
        const reportsDir = path.join(__dirname, 'reports');
        const fs = require('fs').promises;
        let htmlPath = null;
        
        try {
            const files = await fs.readdir(reportsDir);
            const htmlFiles = files.filter(file => 
                file.startsWith(`Food_Safety_Audit_Report_${documentNumber}_`) && 
                file.endsWith('.html')
            );
            
            if (htmlFiles.length > 0) {
                const latestFile = htmlFiles.sort().reverse()[0];
                htmlPath = path.join(reportsDir, latestFile);
                console.log(`✅ [API] Found existing HTML report: ${latestFile}`);
            }
        } catch (err) {
            console.error('Error finding HTML report:', err);
        }
        
        // Generate HTML report if it doesn't exist
        if (!htmlPath) {
            console.log(`📊 [API] Generating HTML report first...`);
            
            const reportGenerator = new ReportGenerator(connector, {
                outputDir: reportsDir,
                templatesDir: path.join(__dirname, 'enhanced-report-generator', 'templates'),
                reportOptions: {
                    convertImagesToBase64: true,
                    includeImages: true,
                    format: 'html'
                }
            });
            
            const result = await reportGenerator.generateReport(documentNumber);
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to generate HTML report');
            }
            
            htmlPath = result.filePath;
            console.log(`✅ [API] HTML report generated: ${htmlPath}`);
        }
        
        // Convert to PDF using Puppeteer
        const puppeteer = require('puppeteer');
        console.log(`🔄 [API] Converting HTML to PDF...`);
        
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-dev-shm-usage'
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
        
        const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
        await page.goto(fileUrl, { waitUntil: ['load', 'networkidle0'], timeout: 90000 });
        await page.waitForTimeout(2000);
        
        const pdfBuffer = await page.pdf({ 
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 11px; width: 100%; text-align: center; color: #555; 
                            padding: 10px 0; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif;">
                    <span style="font-weight: 500;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                </div>
            `,
            margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
            scale: 0.9
        });
        
        await browser.close();
        
        console.log(`✅ [API] PDF generated successfully (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        
        // Send PDF as download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Food_Safety_Audit_Report_${documentNumber}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
        
    } catch (error) {
        console.error('❌ [API] PDF export error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to export PDF: ' + error.message 
        });
    }
});

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
 */
app.post('/api/action-plan/save', requireAuth, async (req, res) => {
    try {
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
        const { documentNumber, storeName, auditDate, score } = req.body;
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
        
        // Get store manager recipients for this store
        const recipients = await emailService.getReportRecipients(storeName, pool);
        
        if (recipients.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No store managers found for this store'
            });
        }
        
        // Extract recipient emails
        const recipientEmails = recipients.map(r => r.email);
        
        console.log(`📧 [API] Found recipients: ${recipientEmails.join(', ')}`);
        
        // Build email content
        const reportUrl = `${process.env.APP_BASE_URL || 'https://pappreports.gmrlapps.com:3001'}/reports/Action_Plan_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        const subject = `🎯 Action Plan Ready - ${storeName} - ${documentNumber}`;
        
        const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎯 Action Plan Report</h1>
                                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Food Safety Audit System</p>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 22px;">Dear Store Manager,</h2>
                                    
                                    <p style="font-size: 16px; line-height: 1.8; color: #34495e; margin: 0 0 30px 0;">
                                        The Action Plan for your store audit is now ready for your review and action.
                                    </p>
                                    
                                    <!-- Info Box -->
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8f9fa; border-radius: 8px; margin: 0 0 30px 0; border: 1px solid #e9ecef;">
                                        <tr>
                                            <td style="padding: 25px;">
                                                <table width="100%" cellpadding="8" cellspacing="0" border="0">
                                                    <tr>
                                                        <td style="color: #7f8c8d; font-size: 14px; width: 40%; vertical-align: top;">📄 Document Number:</td>
                                                        <td style="font-weight: bold; color: #2c3e50; font-size: 15px;">${documentNumber}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="color: #7f8c8d; font-size: 14px; padding-top: 15px; vertical-align: top;">🏪 Store Name:</td>
                                                        <td style="font-weight: bold; color: #2c3e50; font-size: 15px; padding-top: 15px;">${storeName}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="color: #7f8c8d; font-size: 14px; padding-top: 15px; vertical-align: top;">📅 Audit Date:</td>
                                                        <td style="font-weight: bold; color: #2c3e50; font-size: 15px; padding-top: 15px;">${auditDate || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="color: #7f8c8d; font-size: 14px; padding-top: 15px; vertical-align: top;">📊 Audit Score:</td>
                                                        <td style="font-weight: bold; color: ${parseFloat(score) >= 70 ? '#27ae60' : '#e74c3c'}; font-size: 18px; padding-top: 15px;">${score || 'N/A'}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- CTA Button -->
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td align="center" style="padding: 20px 0;">
                                                <a href="${reportUrl}" style="display: inline-block; background: #2c3e50; color: white; padding: 18px 50px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 17px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); border: 2px solid #2c3e50;">
                                                    📋 View Action Plan
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Warning Box -->
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px; margin: 30px 0 0 0;">
                                        <tr>
                                            <td style="padding: 20px;">
                                                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                                    <strong>⚠️ Important:</strong> Please review the findings and take necessary corrective actions. Update the action plan with your progress.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="font-size: 14px; color: #7f8c8d; margin: 30px 0 0 0; line-height: 1.6;">
                                        Best regards,<br>
                                        <strong style="color: #2c3e50;">Food Safety Audit Team</strong>
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="text-align: center; padding: 25px 30px; background: #f8f9fa; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
                                    <p style="margin: 0; color: #95a5a6; font-size: 12px; line-height: 1.5;">
                                        This is an automated notification from the Food Safety Audit System.<br>
                                        Please do not reply to this email.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;
        
        // Send email using user's delegated token
        const result = await emailService.sendEmail(
            recipientEmails,
            subject,
            htmlBody,
            null,
            user.accessToken // Use delegated token from logged-in user
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
        
        // Get the auditor who created this report from FS Survey
        const connector = req.app.locals.sharePointConnector;
        const surveyItems = await connector.getListItems('FS Survey', {
            filter: `Document_x0020_Number eq '${documentNumber}'`,
            select: 'Auditor',
            top: 1
        });
        
        let auditorEmail = null;
        if (surveyItems && surveyItems.length > 0 && surveyItems[0].Auditor) {
            auditorEmail = surveyItems[0].Auditor;
        }
        
        // Get admin users as fallback
        const adminQuery = `
            SELECT email, display_name
            FROM Users
            WHERE role = 'Admin'
            AND is_active = 1
            AND email_notifications_enabled = 1
        `;
        const adminUsers = await pool.request().query(adminQuery);
        
        const recipientEmails = [];
        if (auditorEmail) {
            recipientEmails.push(auditorEmail);
            console.log(`📧 [API] Primary recipient (Auditor): ${auditorEmail}`);
        }
        
        // Add admins as CC
        adminUsers.recordset.forEach(admin => {
            if (!recipientEmails.includes(admin.email)) {
                recipientEmails.push(admin.email);
                console.log(`📧 [API] CC recipient (Admin): ${admin.email}`);
            }
        });
        
        if (recipientEmails.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No auditors or admins found to notify'
            });
        }
        
        // Initialize email service
        const emailService = new EmailNotificationService(connector);
        
        // Build email content
        const reportUrl = `${process.env.APP_BASE_URL || 'https://pappreports.gmrlapps.com:3001'}/reports/Action_Plan_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        const subject = `✅ Action Plan Completed - ${storeName} - ${documentNumber}`;
        
        const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">✅ Action Plan Completed</h1>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
                <h2 style="color: #2c3e50;">Dear Auditor,</h2>
                
                <p style="font-size: 16px; line-height: 1.6; color: #34495e;">
                    The store manager has completed the Action Plan for the audit and submitted it for your review.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; color: #7f8c8d; font-size: 14px;">Document Number:</td>
                            <td style="padding: 10px; font-weight: bold; color: #2c3e50;">${documentNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #7f8c8d; font-size: 14px;">Store Name:</td>
                            <td style="padding: 10px; font-weight: bold; color: #2c3e50;">${storeName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #7f8c8d; font-size: 14px;">Audit Date:</td>
                            <td style="padding: 10px; font-weight: bold; color: #2c3e50;">${auditDate || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #7f8c8d; font-size: 14px;">Audit Score:</td>
                            <td style="padding: 10px; font-weight: bold; color: #2c3e50;">${score || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #7f8c8d; font-size: 14px;">Submitted By:</td>
                            <td style="padding: 10px; font-weight: bold; color: #2c3e50;">${user.displayName || user.email}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${reportUrl}" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);">
                        📋 Review Action Plan
                    </a>
                </div>
                
                <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p style="margin: 0; color: #0c5460; font-size: 14px;">
                        <strong>ℹ️ Note:</strong> Please review the submitted action plan and verify all corrective actions have been properly documented.
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #7f8c8d; margin-top: 30px;">
                    Best regards,<br>
                    <strong>Food Safety Audit System</strong>
                </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #95a5a6; font-size: 12px;">
                <p>This is an automated notification from the Food Safety Audit System.</p>
            </div>
        </div>
        `;
        
        // Send email using user's delegated token
        const result = await emailService.sendEmail(
            recipientEmails,
            subject,
            htmlBody,
            null,
            user.accessToken
        );
        
        if (result.success) {
            console.log(`✅ [API] Notification sent to ${recipientEmails.join(', ')}`);
            res.json({
                success: true,
                message: 'Notification sent successfully',
                recipients: recipientEmails
            });
        } else {
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

// Generate Department Follow-up Report (POST request)
app.post('/api/generate-department-followup', requireAuth, requireRole('Admin', 'Auditor', 'MaintenanceHead', 'ProcurementHead', 'CleaningHead'), async (req, res) => {
    try {
        const { department } = req.body;
        
        if (!department) {
            return res.status(400).json({ 
                success: false,
                error: 'Department name is required' 
            });
        }
        
        // Validate department
        const validDepartments = ['Maintenance', 'Procurement', 'Cleaning'];
        if (!validDepartments.includes(department)) {
            return res.status(400).json({ 
                success: false,
                error: `Invalid department: ${department}. Valid departments: ${validDepartments.join(', ')}` 
            });
        }
        
        console.log(`📋 [API] Generating department follow-up report for: ${department}`);
        
        // Get SharePoint connector
        const connector = req.app.locals.sharePointConnector;
        if (!connector) {
            throw new Error('SharePoint connector not available');
        }
        
        // Ensure connected
        if (!connector.isConnected) {
            await connector.connectToSharePoint();
        }
        
        // Initialize department follow-up report generator
        const departmentReportGenerator = new DepartmentFollowupReportGenerator({
            outputDir: path.join(__dirname, 'reports')
        });
        
        // Set the connector
        departmentReportGenerator.connector = connector;
        
        // Generate the department report
        const result = await departmentReportGenerator.generateReport(department);
        
        if (result.success) {
            // Check if there are no items (no report generated)
            if (result.itemsCount === 0 || !result.filePath) {
                console.log(`ℹ️ [API] No follow-up items found for ${department}`);
                return res.json({
                    success: true,
                    message: `No follow-up items found for ${department} department`,
                    reportUrl: null,
                    filePath: null,
                    fileName: null,
                    itemsCount: 0,
                    department: department
                });
            }
            
            // Extract file name from file path
            const fileName = path.basename(result.filePath);
            // Get the relative path for the URL
            const reportUrl = `/reports/${fileName}`;
            
            console.log(`✅ [API] Department report generated: ${result.filePath}`);
            console.log(`📋 [API] Found ${result.itemsCount} follow-up items`);
            
            res.json({
                success: true,
                message: `${department} department report generated successfully`,
                reportUrl: reportUrl,
                filePath: result.filePath,
                fileName: fileName,
                itemsCount: result.itemsCount,
                department: department
            });
        } else {
            throw new Error('Department report generation failed');
        }
        
    } catch (error) {
        console.error('❌ [API] Department report generation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate department report: ' + error.message 
        });
    }
});

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
// Notification History Routes (Admin & Auditor Only)
// ==========================================

/**
 * GET /api/notifications
 * Get all notifications with filtering and pagination
 * Protected: Admin and Auditor roles only
 */
app.get('/api/notifications', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const { status, dateFrom, dateTo, recipient, documentNumber, sentBy, page, pageSize, sortBy, sortOrder } = req.query;

        console.log(`📋 [API] Fetching notification history (User: ${req.session.user.email})`);

        const pool = await require('./database/db-connection').getPool();
        const notificationService = new NotificationHistoryService();

        const filters = {
            status,
            dateFrom,
            dateTo,
            recipient,
            documentNumber,
            sentBy
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
 * Protected: Admin and Auditor roles only
 */
app.get('/api/notifications/statistics', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        console.log(`📊 [API] Fetching notification statistics (User: ${req.session.user.email})`);

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
 * Protected: Admin and Auditor roles only
 */
app.get('/api/notifications/recent', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;

        console.log(`🕐 [API] Fetching ${limit} recent notifications (User: ${req.session.user.email})`);

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
 * Protected: Admin and Auditor roles only
 */
app.patch('/api/notifications/:id/read', requireAuth, requireRole('Admin', 'Auditor'), async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        console.log(`✅ [API] Marking notification ${notificationId} as read (User: ${req.session.user.email})`);

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
