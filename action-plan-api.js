#!/usr/bin/env node

/**
 * Action Plan API Server
 * Provides REST API endpoints for saving action plan data to MSSQL
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const ActionPlanService = require('./src/action-plan-service');

const app = express();
const PORT = process.env.ACTION_PLAN_API_PORT || 3001;

// Debug flag - set DEBUG_ACTION_PLAN=true to enable verbose logging
const DEBUG_VERBOSE = process.env.DEBUG_ACTION_PLAN === 'true' || false;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large payloads with images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from reports directory
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Initialize service
const actionPlanService = new ActionPlanService();

/**
 * POST /api/action-plan/save
 * Save action plan data to MSSQL
 */
app.post('/api/action-plan/save', async (req, res) => {
    try {
        if (DEBUG_VERBOSE) console.log('📥 Received action plan save request');
        
        const { documentNumber, actions, updatedBy } = req.body;
        
        if (!documentNumber || !actions || !Array.isArray(actions)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request: documentNumber and actions array required'
            });
        }
        
        if (DEBUG_VERBOSE) console.log(`📊 Saving ${actions.length} actions for document ${documentNumber}`);
        
        // Log picture statistics
        const totalPictures = actions.reduce((sum, action) => {
            const pics = action.pictures || [];
            return sum + pics.length;
        }, 0);
        if (DEBUG_VERBOSE) console.log(`📸 Total pictures to save: ${totalPictures}`);
        
        // Transform the data to match database schema
        const responses = actions.map(action => {
            const picturesJson = JSON.stringify(action.pictures || []);
            if (DEBUG_VERBOSE) console.log(`📸 Action ${action.referenceValue}: ${action.pictures ? action.pictures.length : 0} pictures (${(picturesJson.length / 1024).toFixed(2)} KB JSON)`);
            
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
                updatedBy: updatedBy || 'Store Manager'
            };
        });
        
        // Save to database
        const result = await actionPlanService.saveMultipleResponses(responses, updatedBy);
        
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
app.get('/api/action-plan/:documentNumber', async (req, res) => {
    try {
        const { documentNumber } = req.params;
        
        if (DEBUG_VERBOSE) console.log(`📋 Retrieving action plan for document ${documentNumber}`);
        
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
 * GET /api/action-plan/:documentNumber/summary
 * Get summary statistics for a document
 */
app.get('/api/action-plan/:documentNumber/summary', async (req, res) => {
    try {
        const { documentNumber } = req.params;
        
        if (DEBUG_VERBOSE) console.log(`📊 Retrieving summary for document ${documentNumber}`);
        
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

/**
 * POST /api/generate-action-plan
 * Generate action plan report for a specific document
 */
app.post('/api/generate-action-plan', async (req, res) => {
    try {
        const { documentNumber } = req.body;
        
        if (!documentNumber) {
            return res.status(400).json({
                success: false,
                message: 'Document number required'
            });
        }

        console.log(`🎯 Generating Action Plan Report for ${documentNumber}`);

        // Import and run the action plan generator
        const { execSync } = require('child_process');
        const result = execSync(`node generate-action-plan-report.js ${documentNumber}`, {
            encoding: 'utf-8',
            timeout: 120000 // 2 minute timeout
        });

        if (DEBUG_VERBOSE) console.log(result);

        // Check if file was generated
        const filename = `Action_Plan_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        const filePath = path.join(__dirname, 'reports', filename);

        res.json({
            success: true,
            message: `Action Plan Report generated successfully for ${documentNumber}`,
            reportUrl: `/reports/${filename}`,
            filePath: filePath,
            correctiveActionsCount: 0 // Can be enhanced to parse from result
        });

    } catch (error) {
        console.error('❌ Error generating action plan report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate action plan report: ' + error.message
        });
    }
});

/**
 * POST /api/generate-department-followup
 * Generate department follow-up report
 */
app.post('/api/generate-department-followup', async (req, res) => {
    try {
        const { department } = req.body;
        
        if (!department) {
            return res.status(400).json({
                success: false,
                message: 'Department parameter required'
            });
        }

        if (DEBUG_VERBOSE) console.log(`📋 Generating ${department} Department Follow-up Report`);

        // Import and run the department report generator
        const DepartmentFollowupReportGenerator = require('./department-followup-reports');
        const generator = new DepartmentFollowupReportGenerator();
        
        const result = await generator.generateReport(department);

        if (result.success) {
            // Extract filename from path
            const filename = path.basename(result.filePath);
            
            res.json({
                success: true,
                message: `${department} Department Report generated successfully`,
                reportUrl: `/reports/${filename}`,
                filePath: result.filePath,
                itemsCount: result.itemsCount,
                statistics: result.statistics
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.error || 'Failed to generate department report'
            });
        }

    } catch (error) {
        console.error('❌ Error generating department follow-up report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate department report: ' + error.message
        });
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Action Plan API',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Action Plan API Server started');
    console.log(`📡 Listening on http://localhost:${PORT}`);
    console.log('📋 Available endpoints:');
    console.log(`   POST   /api/action-plan/save`);
    console.log(`   GET    /api/action-plan/:documentNumber`);
    console.log(`   GET    /api/action-plan/:documentNumber/summary`);
    console.log(`   POST   /api/generate-action-plan`);
    console.log(`   POST   /api/generate-department-followup`);
    console.log(`   GET    /health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Action Plan API Server...');
    process.exit(0);
});

module.exports = app;
