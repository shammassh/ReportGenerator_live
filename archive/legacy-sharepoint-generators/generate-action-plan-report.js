#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Debug flag - set to false to reduce console output
const DEBUG_VERBOSE = process.env.DEBUG_ACTION_PLAN === 'true' || false;

// Choose connector based on AUTH_METHOD
function getConnector(config = {}) {
    const authMethod = process.env.AUTH_METHOD || 'auto';
    
    switch (authMethod) {
        case 'graph':
            const SimpleGraphConnector = require('./src/simple-graph-connector.js');
            return new SimpleGraphConnector(config);
        case 'interactive':
            const InteractiveConnector = require('./src/simple-graph-connector.js');
            return new InteractiveConnector(config);
        case 'auto':
        default:
            // Auto-detect: use graph if Azure credentials available
            if (process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
                const SimpleGraphConnectorAuto = require('./src/simple-graph-connector.js');
                return new SimpleGraphConnectorAuto(config);
            } else {
                const TruePersistentConnector = require('./src/true-persistent-connector.js');
                return new TruePersistentConnector(config);
            }
    }
}

/**
 * Action Plan Report Generator
 * Extracts all corrective actions from existing reports and creates an editable action plan
 */
class ActionPlanReportGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './reports';
        this.reportGenerator = options.reportGenerator || null; // Will be set from external source
        
        // Section mappings - ONLY these specific lists
        this.sectionMappings = {
            'Food Storage': { 
                templateListName: 'Food Storage & Dry Storage',  // Template questions
                answerListName: 'Survey Responses List',         // Answer data with ResponseJSON
                icon: '🥫', 
                title: 'Food Storage and Dry Storage',
                scoreField: 'FoodScore'
            },
            'Fridges': { 
                templateListName: 'Fridges and Freezers',        // Template questions
                answerListName: 'SRA Fridges',                   // Answer data with ResponseJSON
                icon: '❄️', 
                title: 'Fridges and Freezers',
                scoreField: 'FridgesScore'
            },
            'Utensils': { 
                templateListName: 'Utensils and Equipment',      // Template questions
                answerListName: 'SRA Utensils and Equipment',    // Answer data with ResponseJSON
                icon: '🍽️', 
                title: 'Utensils and Equipment',
                scoreField: 'UtensilsScore'
            },
            'Food Handling': { 
                templateListName: 'Food Handling',               // Template questions
                answerListName: 'SRA Food Handling',             // Answer data with ResponseJSON
                icon: '👨‍🍳', 
                title: 'Food Handling',
                scoreField: 'FoodHScore'
            },
            'Cleaning': { 
                templateListName: 'Cleaning and Disinfection',   // Template questions
                answerListName: 'SRA Cleaning and Disinfection', // Answer data with ResponseJSON
                icon: '🧹', 
                title: 'Cleaning and Disinfection',
                scoreField: 'CNDScore'
            },
            'Hygiene': { 
                templateListName: 'Personal Hygiene',            // Template questions
                answerListName: 'SRA Personal Hygiene',          // Answer data with ResponseJSON
                icon: '🧼', 
                title: 'Personal Hygiene',
                scoreField: 'HygScore'
            },
            'Restrooms': { 
                templateListName: 'Restrooms',                   // Template questions
                answerListName: 'SRA Restrooms',                 // Answer data with ResponseJSON
                icon: '🚻', 
                title: 'Restrooms',
                scoreField: 'RestroomScore'
            },
            'Garbage': { 
                templateListName: 'Garbage Storage & Disposal',  // Template questions
                answerListName: 'SRA Garbage Storage and Disposal', // Answer data with ResponseJSON
                icon: '🗑️', 
                title: 'Garbage Storage and Disposal',
                scoreField: 'GarScore'
            },
            'Maintenance': { 
                templateListName: 'Maintenance',                 // Template questions
                answerListName: 'SRA Maintenance',               // Answer data with ResponseJSON
                icon: '🛠️', 
                title: 'Maintenance',
                scoreField: 'MaintScore'
            },
            'Chemicals': { 
                templateListName: 'Chemicals Available',         // Template questions
                answerListName: 'SRA Chemicals Available',       // Answer data with ResponseJSON
                icon: '🧪', 
                title: 'Chemicals Available',
                scoreField: 'ChemScore'
            },
            'Monitoring': { 
                templateListName: 'Monitoring Sheets',           // Template questions
                answerListName: 'SRA Monitoring Sheets are Properly Filled/ Documents Present', // Answer data with ResponseJSON
                icon: '📋', 
                title: 'Monitoring Sheets',
                scoreField: 'MonitScore'
            },
            'Culture': { 
                templateListName: 'Food Safety Culture',         // Template questions
                answerListName: 'SRA Culture',                   // Answer data with ResponseJSON
                icon: '🏛️', 
                title: 'Food Safety Culture',
                scoreField: 'CultScore'
            },
            'Policies': { 
                templateListName: 'Policies & Procedures',       // Template questions
                answerListName: 'SRA Policies, Procedures & Posters', // Answer data with ResponseJSON
                icon: '📜', 
                title: 'Policies & Procedures',
                scoreField: 'PolScore'
            }
        };
    }

    /**
     * Extract corrective actions from all sections of a report
     */
    extractCorrectiveActions(sectionsData, requestedDocumentNumber) {
        if (DEBUG_VERBOSE) {
            console.log(`🔍 DEBUG: extractCorrectiveActions called with document: "${requestedDocumentNumber}"`);
            console.log(`🔍 DEBUG: Sections received:`, Object.keys(sectionsData));
        }
        
        const correctiveActions = [];
        let actionCounter = 1;

        for (const [sectionName, sectionData] of Object.entries(sectionsData)) {
            if (!sectionData || !Array.isArray(sectionData)) continue;

            // Filter items that need corrective actions - ONLY show "Partially" or "No" answers
            if (DEBUG_VERBOSE) {
                console.log(`\n🔍 SECTION: ${sectionName} - Processing ${sectionData.length} items`);
                console.log(`🔍 DEBUG: Section data sample:`, sectionData.slice(0, 1).map(item => ({
                    Title: item?.Title,
                    Document_x0020_Number: item?.Document_x0020_Number,
                    hasResponseJSON: !!item?.ResponseJSON
                })));
            }
            
            const correctiveItems = sectionData.filter((item, index) => {
                // Validate that this item actually belongs to the requested document
                const itemDocNumber = item.Document_x0020_Number || '';
                if (itemDocNumber !== requestedDocumentNumber) {
                    if (DEBUG_VERBOSE) console.log(`⚠️ Skipping item ${index + 1} - belongs to document '${itemDocNumber}', not '${requestedDocumentNumber}'`);
                    return false;
                }
                
                if (DEBUG_VERBOSE) {
                    console.log(`\nItem ${index + 1}: "${item.Title || 'NO TITLE'}" (Document: ${itemDocNumber})`);
                    console.log(`  Available fields:`, Object.keys(item));
                }
                
                // Parse ResponseJSON to get SelectedChoice
                let selectedChoice = null;
                let originalChoice = null;
                
                if (item.ResponseJSON) {
                    if (DEBUG_VERBOSE) console.log(`  ResponseJSON found, attempting to parse...`);
                    try {
                        const responseData = JSON.parse(item.ResponseJSON);
                        if (DEBUG_VERBOSE) console.log(`  ResponseJSON structure: ${Array.isArray(responseData) ? 'Array' : 'Object'} with ${Array.isArray(responseData) ? responseData.length : Object.keys(responseData).length} items`);
                        
                        // ResponseJSON is an array of survey responses
                        if (Array.isArray(responseData)) {
                            if (DEBUG_VERBOSE) {
                                console.log(`🔍 DEBUG: Processing ${responseData.length} survey responses in ResponseJSON array`);
                                // Show sample responses for debugging
                                if (responseData.length > 0) {
                                    console.log(`🔍 DEBUG: Sample responses:`, responseData.slice(0, 3).map(r => ({
                                        Id: r.Id,
                                        SelectedChoice: r.SelectedChoice,
                                        Title: r.Title
                                    })));
                                }
                            }
                            
                            // Look for items with SelectedChoice that are "partially" or "no"
                            const actionableResponses = responseData.filter(response => {
                                const choice = response.SelectedChoice;
                                const isActionable = choice && (choice.toLowerCase() === "partially" || choice.toLowerCase() === "no");
                                if (isActionable && DEBUG_VERBOSE) {
                                    console.log(`🔍 DEBUG: Found actionable response: "${response.Title}" (Choice: "${choice}")`);
                                }
                                return isActionable;
                            });
                            
                            if (actionableResponses.length > 0) {
                                // Use the first actionable response
                                const selectedResponse = actionableResponses[0];
                                originalChoice = selectedResponse.SelectedChoice;
                                if (DEBUG_VERBOSE) console.log(`  Found ${actionableResponses.length} actionable responses, using: "${originalChoice}"`);
                                
                                // Store the response data for later use in content extraction
                                item._selectedResponse = selectedResponse;
                            } else {
                                // No actionable responses found
                                if (DEBUG_VERBOSE) console.log(`  No actionable responses found in ${responseData.length} survey items`);
                                return false;
                            }
                        } else {
                            // Single object structure
                            originalChoice = responseData.SelectedChoice || responseData.selectedChoice;
                            if (DEBUG_VERBOSE) console.log(`  Single response parsed - SelectedChoice: "${originalChoice}"`);
                        }
                    } catch (error) {
                        if (DEBUG_VERBOSE) {
                            console.log(`  ❌ ERROR parsing ResponseJSON: ${error.message}`);
                            console.log(`  ResponseJSON content:`, item.ResponseJSON.substring(0, 200) + '...');
                        }
                        return false;
                    }
                } else {
                    if (DEBUG_VERBOSE) console.log(`  ❌ No ResponseJSON field found`);
                    // Fallback to direct SelectedChoice field if ResponseJSON not available
                    originalChoice = item.SelectedChoice;
                    if (DEBUG_VERBOSE) console.log(`  Using direct SelectedChoice: "${originalChoice}"`);
                }
                
                // Skip items with no SelectedChoice
                if (!originalChoice) {
                    if (DEBUG_VERBOSE) console.log(`  ❌ REJECTED - No SelectedChoice found`);
                    return false;
                }
                
                selectedChoice = originalChoice.toString().trim().toLowerCase();
                if (DEBUG_VERBOSE) console.log(`  Normalized: "${selectedChoice}"`);
                
                // STRICT FILTERING: Only include "partially" or "no" answers
                const isActionRequired = (selectedChoice === "partially" || selectedChoice === "no");
                
                // Check for content - look in survey response data or item fields
                let hasContentForAction = false;
                if (item._selectedResponse) {
                    // Check survey response fields
                    hasContentForAction = (
                        item._selectedResponse.Title || 
                        item._selectedResponse.Finding || 
                        item._selectedResponse.cr || 
                        item._selectedResponse.correctedaction ||
                        item._selectedResponse.ReferenceValue
                    );
                } else {
                    // Fallback to item fields
                    hasContentForAction = (item.Finding || item.correctedaction || item.cr || item.Title);
                }
                
                if (DEBUG_VERBOSE) {
                    console.log(`  Action Required: ${isActionRequired} (is "partially" or "no")`);
                    console.log(`  Has Content: ${hasContentForAction}`);
                }
                
                const shouldInclude = isActionRequired && hasContentForAction;
                
                if (DEBUG_VERBOSE) {
                    if (shouldInclude) {
                        console.log(`  ✅ ACCEPTED - Will be included in Action Plan`);
                    } else {
                        console.log(`  ❌ REJECTED - ${!isActionRequired ? `Answer is "${selectedChoice}"` : 'No content'}`);
                    }
                }
                
                return shouldInclude;
            });
            
            if (DEBUG_VERBOSE) {
                console.log(`\n📊 SECTION ${sectionName} RESULTS: ${correctiveItems.length} items selected out of ${sectionData.length}`);
                if (correctiveItems.length > 0) {
                    console.log(`Selected items:`);
                    correctiveItems.forEach((item, i) => {
                        // Get the SelectedChoice from ResponseJSON or direct field for logging
                        let displayChoice = 'Unknown';
                        if (item.ResponseJSON) {
                            try {
                                const responseData = JSON.parse(item.ResponseJSON);
                                if (Array.isArray(responseData)) {
                                    // Find actionable responses
                                    const actionableResponses = responseData.filter(response => {
                                        const choice = response.SelectedChoice;
                                        return choice && (choice.toLowerCase() === "partially" || choice.toLowerCase() === "no");
                                    });
                                    if (actionableResponses.length > 0) {
                                        displayChoice = actionableResponses[0].SelectedChoice;
                                    }
                                } else {
                                    displayChoice = responseData.SelectedChoice || responseData.selectedChoice || 'Unknown';
                                }
                            } catch (error) {
                                displayChoice = item.SelectedChoice || 'Unknown';
                            }
                        } else {
                            displayChoice = item.SelectedChoice || 'Unknown';
                        }
                        console.log(`  ${i + 1}. "${item.Title}" (Answer: "${displayChoice}")`);
                    });
                }
            }

            correctiveItems.forEach(item => {
                let finding, referenceValue, priority, existingAction;
                
                if (item._selectedResponse) {
                    // Use data from the survey response
                    const response = item._selectedResponse;
                    finding = response.Title || response.Finding || 'Finding not specified';
                    referenceValue = response.ReferenceValue || actionCounter;
                    priority = response.Priority || this.determinePriority(response.Value, response.Coeff);
                    existingAction = response.correctedaction || response.cr || '';
                } else {
                    // Fallback to item fields
                    finding = item.Finding || item.Title || 'Finding not specified';
                    referenceValue = item.ReferenceValue || actionCounter;
                    priority = item.Priority || this.determinePriority(item.Value, item.Coeff);
                    existingAction = item.correctedaction || item.cr || '';
                }

                correctiveActions.push({
                    actionId: actionCounter++,
                    section: sectionName,
                    referenceValue: referenceValue,
                    finding: finding,
                    priority: priority,
                    existingCorrectiveAction: existingAction,
                    // Editable fields - these will be filled by store manager
                    actionTaken: '',
                    deadline: '',
                    personInCharge: '',
                    status: 'Pending',
                    pictures: [],
                    notes: ''
                });
            });
        }

        return correctiveActions;
    }

    /**
     * Determine priority based on score deviation
     */
    determinePriority(value, coeff) {
        const deviation = Math.abs((parseFloat(coeff) || 0) - (parseFloat(value) || 0));
        
        if (deviation >= 2) return 'High';
        if (deviation >= 1) return 'Medium';
        return 'Low';
    }

    /**
     * Generate HTML Action Plan Report
     */
    generateActionPlanHTML(correctiveActions, reportMetadata = {}) {
        const actionRows = correctiveActions.map(action => `
            <tr class="action-row">
                <td class="ref-col">${action.referenceValue}</td>
                <td class="finding-col">${this.escapeHtml(action.finding)}</td>
                <td class="section-col">${this.escapeHtml(action.section)}</td>
                <td class="priority-col priority-${action.priority.toLowerCase()}">${action.priority}</td>
                <td class="input-col">
                    <textarea class="action-input" placeholder="Describe action taken...">${action.actionTaken}</textarea>
                </td>
                <td class="input-col">
                    <input type="date" class="deadline-input" value="${action.deadline}">
                </td>
                <td class="input-col">
                    <input type="text" class="person-input" placeholder="Name" value="${action.personInCharge}">
                </td>
                <td class="input-col">
                    <select class="status-input">
                        <option value="Pending" ${action.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="In Progress" ${action.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Completed" ${action.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Deferred" ${action.status === 'Deferred' ? 'selected' : ''}>Deferred</option>
                    </select>
                </td>
                <td class="input-col">
                    <input type="file" class="picture-input" accept="image/*" multiple>
                    <div class="picture-preview"></div>
                </td>
            </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Action Plan Report - ${reportMetadata.documentNumber || 'Unknown'}</title>
            <style>
                ${this.getActionPlanCSS()}
            </style>
        </head>
        <body>
            <div class="action-plan-container">
                <!-- Header Section -->
                <div class="report-header">
                    <div class="header-content">
                        <h1>🎯 ACTION PLAN REPORT</h1>
                        <div class="report-info">
                            <div class="info-group">
                                <label>Document Number:</label>
                                <span class="info-value">${reportMetadata.documentNumber || 'N/A'}</span>
                            </div>
                            <div class="info-group">
                                <label>Store Name:</label>
                                <span class="info-value">${reportMetadata.storeName || 'N/A'}</span>
                            </div>
                            <div class="info-group">
                                <label>Auditor:</label>
                                <span class="info-value">${reportMetadata.auditor || 'N/A'}</span>
                            </div>
                            <div class="info-group">
                                <label>Audit Date:</label>
                                <span class="info-value">${reportMetadata.auditDate || 'N/A'}</span>
                            </div>
                            <div class="info-group">
                                <label>Overall Score:</label>
                                <span class="info-value">${reportMetadata.overallScore || 'N/A'}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="print-controls">
                        <button onclick="window.print()" class="print-btn">🖨️ Print Report</button>
                        <button onclick="saveActionPlan()" class="save-btn">💾 Save Data</button>
                        <button onclick="exportToCSV()" class="export-btn">📊 Export CSV</button>
                        <button onclick="sendEmailToStoreManager()" class="email-btn admin-auditor-only" style="display: none;">📧 Email Store Manager</button>
                        <button onclick="submitToAuditor()" class="submit-btn storemanager-only" style="display: none;">✅ Submit to Auditor</button>
                    </div>
                </div>

                <!-- Summary Section -->
                <div class="summary-section">
                    <h2>📋 Action Plan Summary</h2>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-number">${correctiveActions.length}</span>
                            <span class="stat-label">Total Actions</span>
                        </div>
                        <div class="stat-item critical">
                            <span class="stat-number">${correctiveActions.filter(a => a.priority === 'Critical').length}</span>
                            <span class="stat-label">Critical</span>
                        </div>
                        <div class="stat-item high">
                            <span class="stat-number">${correctiveActions.filter(a => a.priority === 'High').length}</span>
                            <span class="stat-label">High Priority</span>
                        </div>
                        <div class="stat-item medium">
                            <span class="stat-number">${correctiveActions.filter(a => a.priority === 'Medium').length}</span>
                            <span class="stat-label">Medium Priority</span>
                        </div>
                    </div>
                </div>

                <!-- Instructions Section -->
                <div class="instructions-section">
                    <h3>📝 Instructions for Store Manager</h3>
                    <ol>
                        <li><strong>Review each finding</strong> and understand the corrective action needed</li>
                        <li><strong>Fill in the Action to be Taken</strong> column with specific actions you will implement</li>
                        <li><strong>Set realistic deadlines</strong> for each action by Priority</li>
                        <li><strong>Assign responsible person</strong> for each action</li>
                        <li><strong>Update status</strong> as actions progress</li>
                        <li><strong>Upload pictures</strong> of completed actions where applicable</li>
                        <li><strong>Write down the updates and comments related to each finding</li>
                    </ol>
                </div>

                <!-- Action Plan Table -->
                <div class="table-container">
                    <table class="action-plan-table">
                        <thead>
                            <tr>
                                <th class="ref-header">Ref #</th>
                                <th class="finding-header">Finding</th>
                                <th class="section-header">Section</th>
                                <th class="priority-header">Priority</th>
                                <th class="action-header">Action Taken</th>
                                <th class="deadline-header">Deadline</th>
                                <th class="person-header">Person in Charge</th>
                                <th class="status-header">Status</th>
                                <th class="pictures-header">Pictures</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${actionRows}
                        </tbody>
                    </table>
                </div>

                <!-- Footer -->
                <div class="report-footer">
                    <div class="signature-section">
                        <div class="signature-box">
                            <div class="signature-line">Store Manager Signature</div>
                            <div class="date-line">Date: _______________</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-line">Regional Manager Signature</div>
                            <div class="date-line">Date: _______________</div>
                        </div>
                    </div>
                    <div class="footer-info">
                        <p>Generated on ${new Date().toLocaleDateString()} | Food Safety Action Plan Report</p>
                        <p>This document is confidential and proprietary to Spinneys Operations</p>
                    </div>
                </div>

                <!-- Lightbox for viewing images -->
                <div class="lightbox-overlay" id="lightbox">
                    <div class="lightbox-content">
                        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
                        <img class="lightbox-image" id="lightbox-img" src="" alt="Full size image">
                        <div class="lightbox-info" id="lightbox-info"></div>
                    </div>
                </div>
            </div>

            <script>
                ${this.getActionPlanJavaScript()}
            </script>
        </body>
        </html>
        `;
    }

    /**
     * Get CSS styles for Action Plan Report
     */
    getActionPlanCSS() {
        return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }

        .action-plan-container {
            max-width: 1400px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        /* Header Styles */
        .report-header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }

        .report-header h1 {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 15px;
        }

        .report-info {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .info-group {
            display: flex;
            flex-direction: column;
        }

        .info-group label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 2px;
        }

        .info-value {
            font-size: 14px;
            font-weight: bold;
        }

        .print-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .print-controls button {
            padding: 10px 15px;
            border: none;
            border-radius: 5px;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }

        .print-controls button:hover {
            background: rgba(255,255,255,0.3);
        }

        /* Summary Section */
        .summary-section {
            padding: 25px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }

        .summary-section h2 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 20px;
        }

        .summary-stats {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .stat-item {
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            min-width: 120px;
        }

        .stat-number {
            display: block;
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }

        .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }

        .stat-item.critical .stat-number { color: #dc3545; }
        .stat-item.high .stat-number { color: #fd7e14; }
        .stat-item.medium .stat-number { color: #ffc107; }

        /* Instructions */
        .instructions-section {
            padding: 25px;
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
        }

        .instructions-section h3 {
            color: #1565c0;
            margin-bottom: 15px;
            font-size: 18px;
        }

        .instructions-section ol {
            margin-left: 20px;
            color: #333;
        }

        .instructions-section li {
            margin-bottom: 8px;
        }

        /* Table Styles */
        .table-container {
            padding: 25px;
            overflow-x: auto;
        }

        .action-plan-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            min-width: 1200px;
        }

        .action-plan-table th {
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #2c3e50;
        }

        .action-plan-table td {
            padding: 10px 8px;
            border: 1px solid #ddd;
            vertical-align: top;
            background: white;
        }

        .action-plan-table tbody tr:nth-child(even) td {
            background: #f8f9fa;
        }

        .action-plan-table tbody tr:hover td {
            background: #e3f2fd;
        }

        /* Column Widths */
        .ref-col, .ref-header { width: 60px; text-align: center; }
        .finding-col, .finding-header { width: 250px; }
        .section-col, .section-header { width: 120px; }
        .priority-col, .priority-header { width: 80px; text-align: center; }
        .action-header { width: 200px; }
        .deadline-header { width: 110px; }
        .person-header { width: 130px; }
        .status-header { width: 100px; }
        .pictures-header { width: 120px; }

        /* Priority Styling */
        .priority-critical { background: #ffebee !important; color: #c62828; font-weight: bold; }
        .priority-high { background: #fff3e0 !important; color: #ef6c00; font-weight: bold; }
        .priority-medium { background: #fffde7 !important; color: #f57f17; font-weight: bold; }
        .priority-low { background: #e8f5e8 !important; color: #2e7d32; }

        /* Input Styles */
        .action-input, .person-input {
            width: 100%;
            border: 1px solid #ddd;
            padding: 6px;
            border-radius: 4px;
            font-size: 11px;
            min-height: 60px;
        }

        .action-input {
            resize: vertical;
        }

        .deadline-input, .status-input {
            width: 100%;
            border: 1px solid #ddd;
            padding: 6px;
            border-radius: 4px;
            font-size: 11px;
        }

        .picture-input {
            width: 100%;
            font-size: 10px;
        }

        .picture-preview {
            margin-top: 5px;
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
        }

        .picture-preview img {
            width: 30px;
            height: 30px;
            object-fit: cover;
            border-radius: 3px;
            border: 1px solid #ddd;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .picture-preview img:hover {
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        /* Lightbox styles */
        .lightbox-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 100000;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.3s;
        }

        .lightbox-overlay.active {
            display: flex;
        }

        .lightbox-content {
            max-width: 90%;
            max-height: 90%;
            position: relative;
            animation: zoomIn 0.3s;
        }

        .lightbox-image {
            max-width: 100%;
            max-height: 90vh;
            object-fit: contain;
            border-radius: 4px;
        }

        .lightbox-close {
            position: absolute;
            top: -40px;
            right: 0;
            background: white;
            color: black;
            border: none;
            font-size: 30px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-weight: bold;
            transition: transform 0.2s;
        }

        .lightbox-close:hover {
            transform: scale(1.1);
            background: #f0f0f0;
        }

        .lightbox-info {
            position: absolute;
            bottom: -35px;
            left: 0;
            right: 0;
            text-align: center;
            color: white;
            font-size: 14px;
            padding: 5px;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes zoomIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }

        /* Footer */
        .report-footer {
            padding: 25px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
        }

        .signature-section {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
        }

        .signature-box {
            text-align: center;
            min-width: 200px;
        }

        .signature-line {
            border-bottom: 2px solid #333;
            margin-bottom: 10px;
            padding: 20px 0 5px 0;
            font-weight: bold;
        }

        .date-line {
            font-size: 12px;
            color: #666;
        }

        .footer-info {
            text-align: center;
            color: #666;
            font-size: 11px;
        }

        .footer-info p {
            margin-bottom: 5px;
        }

        /* Print Styles */
        @media print {
            body { background: white; }
            .action-plan-container { 
                box-shadow: none; 
                border-radius: 0; 
                margin: 0;
                max-width: none;
            }
            .print-controls { display: none !important; }
            .action-plan-table { font-size: 10px; }
            .table-container { padding: 15px; }
            .report-header { page-break-inside: avoid; }
            .signature-section { page-break-inside: avoid; }
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .action-plan-container {
                margin: 10px;
                border-radius: 5px;
            }
            
            .report-header {
                padding: 15px;
                flex-direction: column;
                text-align: center;
                gap: 15px;
            }
            
            .summary-stats {
                justify-content: center;
            }
            
            .table-container {
                padding: 15px;
            }
        }
        `;
    }

    /**
     * Get JavaScript for Action Plan Report functionality
     */
    getActionPlanJavaScript() {
        return `
        // Action Plan Report JavaScript Functions
        
        // Configuration - use same protocol and host as current page
        const API_BASE_URL = window.location.protocol + '//' + window.location.host;
        
        // Lightbox functions
        function openLightbox(imageSrc, imageName) {
            const lightbox = document.getElementById('lightbox');
            const lightboxImg = document.getElementById('lightbox-img');
            const lightboxInfo = document.getElementById('lightbox-info');
            
            lightboxImg.src = imageSrc;
            lightboxInfo.textContent = imageName || 'Image';
            lightbox.classList.add('active');
            
            // Prevent body scrolling when lightbox is open
            document.body.style.overflow = 'hidden';
        }
        
        function closeLightbox() {
            const lightbox = document.getElementById('lightbox');
            lightbox.classList.remove('active');
            
            // Restore body scrolling
            document.body.style.overflow = 'auto';
        }
        
        // Close lightbox on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeLightbox();
            }
        });
        
        // Close lightbox when clicking outside the image
        document.addEventListener('click', function(e) {
            const lightbox = document.getElementById('lightbox');
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
        
        // Helper function to convert file to base64
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
        }
        
        async function saveActionPlan() {
            const actionData = [];
            const rows = document.querySelectorAll('.action-row');
            
            console.log('[SAVE] Starting save process for ' + rows.length + ' action rows');
            
            // Collect form data and convert pictures to base64
            const promises = Array.from(rows).map(async (row, index) => {
                // Handle picture files - convert to base64
                const pictureInput = row.querySelector('.picture-input');
                const pictureFiles = Array.from(pictureInput.files);
                const picturesData = [];
                
                console.log('[SAVE] Row ' + (index + 1) + ' has ' + pictureFiles.length + ' picture file(s)');
                
                for (const file of pictureFiles) {
                    try {
                        console.log('[SAVE] Converting file: ' + file.name + ' (' + (file.size / 1024).toFixed(2) + ' KB)');
                        const base64 = await fileToBase64(file);
                        const picData = {
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            data: base64
                        };
                        picturesData.push(picData);
                        console.log('[SAVE] Successfully converted ' + file.name + ' to base64 (' + (base64.length / 1024).toFixed(2) + ' KB)');
                    } catch (error) {
                        console.error('[SAVE] Error converting file to base64:', error);
                    }
                }
                
                const data = {
                    referenceValue: row.querySelector('.ref-col').textContent.trim(),
                    finding: row.querySelector('.finding-col').textContent.trim(),
                    section: row.querySelector('.section-col').textContent.trim(),
                    priority: row.querySelector('.priority-col').textContent.trim(),
                    existingCorrectiveAction: row.querySelector('.finding-col').getAttribute('data-corrective-action') || '',
                    actionTaken: row.querySelector('.action-input').value,
                    deadline: row.querySelector('.deadline-input').value,
                    personInCharge: row.querySelector('.person-input').value,
                    status: row.querySelector('.status-input').value,
                    pictures: picturesData // Now includes actual file data
                };
                
                if (picturesData.length > 0) {
                    console.log('[SAVE] Row ' + (index + 1) + ' (Ref: ' + data.referenceValue + ') has ' + picturesData.length + ' pictures ready for upload');
                }
                
                return data;
            });
            
            const collectedData = await Promise.all(promises);
            collectedData.forEach(data => actionData.push(data));
            
            // Log summary of what we're about to save
            const totalPictures = actionData.reduce((sum, action) => sum + action.pictures.length, 0);
            console.log('[SAVE] Prepared ' + actionData.length + ' actions with ' + totalPictures + ' total pictures');
            
            // Get document number from page (first info-value is Document Number)
            const documentNumber = document.querySelectorAll('.info-value')[0].textContent.trim();
            
            // Show loading indicator
            const saveBtn = document.querySelector('.save-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '💾 Saving...';
            saveBtn.disabled = true;
            
            try {
                // Send to server
                console.log('[SAVE] Sending to:', API_BASE_URL + '/api/action-plan/save');
                console.log('[SAVE] Document:', documentNumber);
                console.log('[SAVE] Actions count:', actionData.length);
                
                const response = await fetch(API_BASE_URL + '/api/action-plan/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        documentNumber: documentNumber,
                        actions: actionData,
                        updatedBy: 'Store Manager'
                    })
                });
                
                console.log('[SAVE] Response status:', response.status, response.statusText);
                
                if (!response.ok) {
                    throw new Error('Server returned ' + response.status + ': ' + response.statusText);
                }
                
                const result = await response.json();
                console.log('[SAVE] Result:', result);
                
                if (result.success) {
                    alert('✅ Action plan saved successfully to database!\\n\\n' +
                          'Saved: ' + result.data.successCount + ' actions');
                    
                    // Clear the autosave localStorage
                    localStorage.removeItem('actionPlanData');
                } else {
                    alert('⚠️ Partial save completed:\\n\\n' +
                          'Succeeded: ' + result.data.successCount + '\\n' +
                          'Failed: ' + result.data.errorCount + '\\n\\n' +
                          'Please check the console for details.');
                    console.error('Save errors:', result.data.results.filter(r => !r.success));
                }
                
            } catch (error) {
                console.error('[SAVE] Error details:', error);
                console.error('[SAVE] Error stack:', error.stack);
                alert('❌ Failed to save action plan to database!\\n\\n' +
                      'Error: ' + error.message + '\\n\\n' +
                      'Check browser console (F12) for details.');
            } finally {
                // Reset button
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        }
        
        async function sendEmailToStoreManager() {
            try {
                console.log('[EMAIL] Sending email to store manager...');
                
                const documentNumber = document.querySelectorAll('.info-value')[0].textContent.trim();
                const storeName = document.querySelectorAll('.info-value')[1].textContent.trim();
                const auditor = document.querySelectorAll('.info-value')[2].textContent.trim();
                const auditDate = document.querySelectorAll('.info-value')[3].textContent.trim();
                const score = document.querySelectorAll('.info-value')[4].textContent.trim();
                
                // Show loading state
                const emailBtn = event.target;
                const originalText = emailBtn.innerHTML;
                emailBtn.innerHTML = '⏳ Sending...';
                emailBtn.disabled = true;
                
                const API_BASE_URL = window.location.protocol + '//' + window.location.host;
                const response = await fetch(API_BASE_URL + '/api/action-plan/send-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        documentNumber,
                        storeName,
                        auditDate,
                        score
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    alert('✅ Email sent successfully to store manager!\\n\\nRecipients: ' + result.recipients.join(', '));
                    console.log('[EMAIL] Success:', result);
                } else {
                    throw new Error(result.error || 'Failed to send email');
                }
                
                // Restore button
                emailBtn.innerHTML = originalText;
                emailBtn.disabled = false;
                
            } catch (error) {
                console.error('[EMAIL] Error:', error);
                alert('❌ Failed to send email: ' + error.message);
                
                // Restore button
                const emailBtn = event.target;
                emailBtn.innerHTML = '📧 Email Store Manager';
                emailBtn.disabled = false;
            }
        }
        
        async function submitToAuditor() {
            try {
                console.log('[SUBMIT] Submitting action plan to auditor...');
                
                const documentNumber = document.querySelectorAll('.info-value')[0].textContent.trim();
                const storeName = document.querySelectorAll('.info-value')[1].textContent.trim();
                const auditor = document.querySelectorAll('.info-value')[2].textContent.trim();
                const auditDate = document.querySelectorAll('.info-value')[3].textContent.trim();
                const score = document.querySelectorAll('.info-value')[4].textContent.trim();
                
                // Show loading state
                const submitBtn = event.target;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '⏳ Submitting...';
                submitBtn.disabled = true;
                
                const API_BASE_URL = window.location.protocol + '//' + window.location.host;
                const response = await fetch(API_BASE_URL + '/api/action-plan/submit-to-auditor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        documentNumber,
                        storeName,
                        auditDate,
                        score
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    alert('✅ Action plan submitted successfully to auditor!\\n\\nNotified: ' + result.recipients.join(', '));
                    console.log('[SUBMIT] Success:', result);
                } else {
                    throw new Error(result.error || 'Failed to submit');
                }
                
                // Restore button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                
            } catch (error) {
                console.error('[SUBMIT] Error:', error);
                alert('❌ Failed to submit: ' + error.message);
                
                // Restore button
                const submitBtn = event.target;
                submitBtn.innerHTML = '✅ Submit to Auditor';
                submitBtn.disabled = false;
            }
        }
        
        function exportToCSV() {
            const rows = document.querySelectorAll('.action-row');
            let csvContent = 'Reference,Finding,Section,Priority,Action Taken,Deadline,Person in Charge,Status\\n';
            
            rows.forEach(row => {
                const data = [
                    row.querySelector('.ref-col').textContent.trim(),
                    '"' + row.querySelector('.finding-col').textContent.trim().replace(/"/g, '""') + '"',
                    row.querySelector('.section-col').textContent.trim(),
                    row.querySelector('.priority-col').textContent.trim(),
                    '"' + row.querySelector('.action-input').value.replace(/"/g, '""') + '"',
                    row.querySelector('.deadline-input').value,
                    row.querySelector('.person-input').value,
                    row.querySelector('.status-input').value
                ];
                csvContent += data.join(',') + '\\n';
            });
            
            const dataBlob = new Blob([csvContent], {type: 'text/csv'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'action-plan-export-' + new Date().toISOString().split('T')[0] + '.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
        
        // Handle image preview
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('picture-input')) {
                const previewDiv = e.target.nextElementSibling;
                previewDiv.innerHTML = '';
                
                Array.from(e.target.files).forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const img = document.createElement('img');
                            img.src = e.target.result;
                            img.title = file.name + ' - Click to view full size';
                            img.onclick = function() {
                                openLightbox(e.target.result, file.name);
                            };
                            previewDiv.appendChild(img);
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        });
        
        // Auto-save to localStorage
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('action-input') || 
                e.target.classList.contains('deadline-input') || 
                e.target.classList.contains('person-input') || 
                e.target.classList.contains('status-input')) {
                
                localStorage.setItem('actionPlanData', JSON.stringify(gatherFormData()));
            }
        });
        
        function gatherFormData() {
            const data = {};
            document.querySelectorAll('.action-row').forEach((row, index) => {
                data[index] = {
                    actionTaken: row.querySelector('.action-input').value,
                    deadline: row.querySelector('.deadline-input').value,
                    personInCharge: row.querySelector('.person-input').value,
                    status: row.querySelector('.status-input').value
                };
            });
            return data;
        }
        
        // Check user role and show appropriate buttons
        async function checkUserRole() {
            try {
                const API_BASE_URL = window.location.protocol + '//' + window.location.host;
                const response = await fetch(API_BASE_URL + '/auth/session');
                if (response.ok) {
                    const session = await response.json();
                    const userRole = session.user?.role;
                    
                    console.log('[ROLE] User role:', userRole);
                    console.log('[ROLE] Full session:', session);
                    
                    // Show/hide buttons based on role
                    if (userRole === 'Admin' || userRole === 'Auditor') {
                        console.log('[ROLE] Showing Admin/Auditor buttons');
                        document.querySelector('.admin-auditor-only').style.display = 'inline-block';
                        document.querySelector('.storemanager-only').style.display = 'none';
                    } else if (userRole === 'StoreManager') {
                        console.log('[ROLE] Showing Store Manager buttons');
                        document.querySelector('.admin-auditor-only').style.display = 'none';
                        document.querySelector('.storemanager-only').style.display = 'inline-block';
                    } else {
                        console.log('[ROLE] Unknown role, defaulting to Store Manager view');
                        // Default: if role is unknown, assume Store Manager (they received the email)
                        document.querySelector('.admin-auditor-only').style.display = 'none';
                        document.querySelector('.storemanager-only').style.display = 'inline-block';
                    }
                } else {
                    console.warn('[ROLE] Session check failed, defaulting to Store Manager view');
                    // If not logged in properly, assume Store Manager (they received the email)
                    document.querySelector('.admin-auditor-only').style.display = 'none';
                    document.querySelector('.storemanager-only').style.display = 'inline-block';
                }
            } catch (error) {
                console.error('[ROLE] Error checking user role:', error);
                // On error, assume Store Manager view (they received the email)
                document.querySelector('.admin-auditor-only').style.display = 'none';
                document.querySelector('.storemanager-only').style.display = 'inline-block';
            }
        }
        
        // Load saved data from database on page load
        window.addEventListener('load', async function() {
            // Check user role first
            await checkUserRole();
            
            // Get document number from first info-group (Document Number is first)
            const documentNumber = document.querySelectorAll('.info-value')[0].textContent.trim();
            
            console.log('[LOAD] Checking for saved action plan data for:', documentNumber);
            
            try {
                // Try to fetch from database first
                const response = await fetch(API_BASE_URL + '/api/action-plan/' + documentNumber);
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.success && result.actions && result.actions.length > 0) {
                        console.log('[LOAD] Found ' + result.actions.length + ' saved actions in database');
                        
                        // Create a map of saved data by reference value for quick lookup
                        const savedDataMap = {};
                        result.actions.forEach(action => {
                            savedDataMap[action.ReferenceValue] = action;
                        });
                        
                        // Populate form fields with saved data
                        let populatedCount = 0;
                        document.querySelectorAll('.action-row').forEach((row) => {
                            const refValue = row.querySelector('.ref-col').textContent.trim();
                            const savedAction = savedDataMap[refValue];
                            
                            if (savedAction) {
                                row.querySelector('.action-input').value = savedAction.ActionTaken || '';
                                row.querySelector('.deadline-input').value = savedAction.Deadline ? savedAction.Deadline.split('T')[0] : '';
                                row.querySelector('.person-input').value = savedAction.PersonInCharge || '';
                                row.querySelector('.status-input').value = savedAction.Status || 'Pending';
                                
                                // Load and display saved pictures
                                if (savedAction.PicturesPaths) {
                                    try {
                                        const pictures = JSON.parse(savedAction.PicturesPaths);
                                        if (Array.isArray(pictures) && pictures.length > 0) {
                                            const previewDiv = row.querySelector('.picture-preview');
                                            previewDiv.innerHTML = '';
                                            
                                            pictures.forEach(pic => {
                                                if (pic.data) {
                                                    const img = document.createElement('img');
                                                    img.src = pic.data; // Base64 data URL
                                                    img.title = (pic.name || 'Saved image') + ' - Click to view full size';
                                                    img.onclick = function() {
                                                        openLightbox(pic.data, pic.name || 'Saved image');
                                                    };
                                                    previewDiv.appendChild(img);
                                                }
                                            });
                                            
                                            console.log('[LOAD] Loaded ' + pictures.length + ' pictures for ref ' + refValue);
                                        }
                                    } catch (parseError) {
                                        console.warn('[LOAD] Error parsing pictures for ref ' + refValue + ':', parseError);
                                    }
                                }
                                
                                populatedCount++;
                                
                                // Highlight populated rows
                                row.style.backgroundColor = '#e8f5e9';
                            }
                        });
                        
                        console.log('[LOAD] Populated ' + populatedCount + ' action items from database');
                        
                        // Show notification
                        const notification = document.createElement('div');
                        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 15px 20px; border-radius: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); z-index: 10000; font-size: 14px;';
                        notification.innerHTML = '✓ Loaded ' + populatedCount + ' saved actions from database';
                        document.body.appendChild(notification);
                        
                        setTimeout(() => {
                            notification.style.transition = 'opacity 0.5s';
                            notification.style.opacity = '0';
                            setTimeout(() => notification.remove(), 500);
                        }, 3000);
                        
                        return; // Exit early if database data was loaded
                    }
                }
            } catch (error) {
                console.log('[LOAD] Could not fetch from database (server may be offline):', error.message);
            }
            
            // Fallback to localStorage if database fetch failed
            console.log('[LOAD] Checking localStorage for autosaved data...');
            const saved = localStorage.getItem('actionPlanData');
            if (saved) {
                console.log('[LOAD] Found autosaved data in localStorage');
                const data = JSON.parse(saved);
                let restoredCount = 0;
                document.querySelectorAll('.action-row').forEach((row, index) => {
                    if (data[index]) {
                        row.querySelector('.action-input').value = data[index].actionTaken || '';
                        row.querySelector('.deadline-input').value = data[index].deadline || '';
                        row.querySelector('.person-input').value = data[index].personInCharge || '';
                        row.querySelector('.status-input').value = data[index].status || 'Pending';
                        restoredCount++;
                    }
                });
                console.log('[LOAD] Restored ' + restoredCount + ' items from localStorage');
            } else {
                console.log('[LOAD] No saved data found');
            }
        });
        `;
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Generate Action Plan Report from document number using live SharePoint data
     */
    async generateActionPlanForDocument(documentNumber, reportData = null) {
        try {
            console.log(`🎯 Generating Action Plan Report for document: ${documentNumber}`);
            console.log(`🔍 DEBUG: Starting generation process...`);
            
            // DEBUG: Add breakpoint functionality
            if (process.env.DEBUG_BREAKPOINT === 'true') {
                console.log('🛑 BREAKPOINT: Press any key to continue...');
                await new Promise(resolve => {
                    process.stdin.once('data', () => resolve());
                });
            }
            
            // Always get live data from SharePoint
            console.log('📡 Fetching live data from SharePoint...');
            console.log(`🔍 DEBUG: About to call getLiveSharePointData(${documentNumber})`);
            reportData = await this.getLiveSharePointData(documentNumber);
            
            console.log(`🔍 DEBUG: SharePoint data received:`, {
                hasData: !!reportData,
                hasSections: !!(reportData && reportData.sections),
                sectionCount: reportData && reportData.sections ? Object.keys(reportData.sections).length : 0,
                sectionNames: reportData && reportData.sections ? Object.keys(reportData.sections) : []
            });

            if (!reportData || !reportData.sections) {
                throw new Error(`No report data available for document ${documentNumber} from SharePoint`);
            }

            // DEBUG: Add breakpoint before extracting actions
            if (process.env.DEBUG_BREAKPOINT === 'true') {
                console.log('🛑 BREAKPOINT: About to extract corrective actions. Press any key to continue...');
                await new Promise(resolve => {
                    process.stdin.once('data', () => resolve());
                });
            }

            // Extract corrective actions from all sections
            console.log(`🔍 DEBUG: About to call extractCorrectiveActions with ${Object.keys(reportData.sections).length} sections`);
            const correctiveActions = this.extractCorrectiveActions(reportData.sections, documentNumber);
            
            console.log(`✅ Found ${correctiveActions.length} corrective actions from live data`);
            console.log(`🔍 DEBUG: Corrective actions summary:`, correctiveActions.map(a => ({
                section: a.section,
                finding: a.finding.substring(0, 50) + '...',
                priority: a.priority
            })));

            // Prepare metadata
            const metadata = {
                documentNumber: documentNumber,
                storeName: reportData.storeName || 'Unknown Store',
                auditor: reportData.auditor || 'System Generated',
                auditDate: reportData.auditDate || new Date().toISOString().split('T')[0],
                overallScore: reportData.overallScore || 0
            };

            // Generate HTML report
            const htmlContent = this.generateActionPlanHTML(correctiveActions, metadata);
            
            // Save report
            const fileName = `Action_Plan_Report_${documentNumber}_${new Date().toISOString().split('T')[0]}.html`;
            const filePath = path.join(this.outputDir, fileName);
            
            // Ensure output directory exists
            await fs.mkdir(this.outputDir, { recursive: true });
            await fs.writeFile(filePath, htmlContent, 'utf8');
            
            console.log(`✅ Action Plan Report saved: ${fileName}`);
            
            return {
                success: true,
                filePath: filePath,
                fileName: fileName,
                correctiveActionsCount: correctiveActions.length,
                metadata: metadata
            };

        } catch (error) {
            console.error(`❌ Error generating Action Plan Report:`, error);
            throw error;
        }
    }

    /**
     * Get live SharePoint data for action plan using Enhanced HTML Report logic
     */
    async getLiveSharePointData(documentNumber) {
        try {
            console.log(`📡 Connecting to SharePoint to fetch data for ${documentNumber}...`);
            console.log(`🔍 DEBUG: Document number received: "${documentNumber}" (type: ${typeof documentNumber})`);
            
            // DEBUG: Add breakpoint for SharePoint connection
            if (process.env.DEBUG_BREAKPOINT === 'true') {
                console.log('🛑 BREAKPOINT: About to connect to SharePoint. Press any key to continue...');
                await new Promise(resolve => {
                    process.stdin.once('data', () => resolve());
                });
            }
            
            // Use the connector with authentication auto-detection
            const connector = getConnector({
                siteUrl: process.env.SHAREPOINT_SITE_URL
            });
            
            console.log('🔗 Establishing persistent SharePoint connection...');
            await connector.connectToSharePoint();
            
            console.log('📋 Fetching survey response lists...');
            const lists = await connector.getSharePointLists();
            
            // Debug: Show first few lists to understand the structure
            console.log(`📋 Total lists found: ${lists.length}`);
            console.log('📋 First few lists:');
            lists.slice(0, 10).forEach(list => {
                console.log(`   - ${list.Title} (Items: ${list.ItemCount})`);
            });
            
            // Use ONLY the specific section mappings defined in constructor
            const targetLists = Object.values(this.sectionMappings).map(section => section.answerListName);
            console.log('🎯 Target lists from section mappings:', targetLists);
            
            const surveyLists = lists.filter(list => 
                targetLists.includes(list.Title) && list.ItemCount > 0
            );
            
            console.log(`📊 Matching lists found: ${surveyLists.length}`);
            if (surveyLists.length === 0) {
                // Show what lists might be survey-related
                const possibleSurveyLists = lists.filter(list => 
                    list.Title && (
                        list.Title.toLowerCase().includes('survey') ||
                        list.Title.toLowerCase().includes('response') ||
                        list.Title.toLowerCase().includes('sra') ||
                        list.Title.toLowerCase().includes('audit')
                    )
                );
                console.log('📋 Possible survey-related lists found:');
                possibleSurveyLists.forEach(list => {
                    console.log(`   - ${list.Title} (Items: ${list.ItemCount})`);
                });
                throw new Error('No matching survey lists found in SharePoint from section mappings');
            }
            
            console.log(`📊 Found ${surveyLists.length} survey response lists`);
            
            const sectionsData = {};
            let totalItems = 0;
            let filteredItems = 0;
            
            // Process each list/section using Enhanced HTML Report logic
            for (const listInfo of surveyLists) {
                // Find the section mapping that matches this list
                const sectionMapping = Object.entries(this.sectionMappings).find(([key, mapping]) => 
                    mapping.answerListName === listInfo.Title
                );
                
                if (!sectionMapping) {
                    console.log(`⚠️ No section mapping found for list: ${listInfo.Title}`);
                    continue;
                }
                
                const [sectionKey, sectionConfig] = sectionMapping;
                const sectionName = sectionConfig.title; // Use the proper title from mapping
                console.log(`📊 Processing section: ${sectionName} (${listInfo.Title})`);
                
                // Use Enhanced HTML Report logic for getting answer data
                const answerData = await this.getAnswerDataWithResponseJSON(connector, sectionConfig.answerListName, documentNumber);
                
                if (!answerData || answerData.length === 0) {
                    console.log(`⚠️ No answer data found in ${sectionName}`);
                    continue;
                }
                
                // Process ResponseJSON to get answered questions (Enhanced HTML Report logic)
                const answeredQuestions = this.processResponseJSONItems(answerData, sectionName, documentNumber);
                
                if (answeredQuestions.length > 0) {
                    sectionsData[sectionName] = answeredQuestions;
                    filteredItems += answeredQuestions.length;
                    console.log(`✅ Found ${answeredQuestions.length} processed responses for ${documentNumber} in ${sectionName}`);
                } else {
                    console.log(`⚠️ No processed responses found for ${documentNumber} in ${sectionName}`);
                }
                
                totalItems += answerData.length;
            }
            
            console.log(`� Summary: Processed ${filteredItems} responses for document ${documentNumber} out of ${totalItems} total items`);
            
            if (filteredItems === 0) {
                throw new Error(`No data found for document number ${documentNumber}. Please verify the document number exists in SharePoint.`);
            }
            
            // Extract metadata from database (FS Survey SharePoint list is deleted)
            let metadata = {
                documentNumber: documentNumber,
                storeName: 'Unknown Store',
                auditor: 'Unknown',
                auditDate: new Date().toISOString().split('T')[0],
                overallScore: 0
            };
            
            // Fetch metadata from AuditInstances table
            try {
                console.log('📊 Fetching metadata from AuditInstances table...');
                const sql = require('mssql');
                const dbConfig = require('./config/default').database;
                const pool = await sql.connect(dbConfig);
                
                const result = await pool.request()
                    .input('documentNumber', sql.NVarChar(100), documentNumber)
                    .query(`
                        SELECT StoreName, Auditors, TotalScore, AuditDate, CreatedAt
                        FROM AuditInstances 
                        WHERE DocumentNumber = @documentNumber
                    `);
                
                if (result.recordset.length > 0) {
                    const dbItem = result.recordset[0];
                    metadata.storeName = dbItem.StoreName || metadata.storeName;
                    metadata.auditor = dbItem.Auditors || metadata.auditor;
                    metadata.overallScore = parseFloat(dbItem.TotalScore) || 0;
                    
                    const dateToUse = dbItem.AuditDate || dbItem.CreatedAt;
                    if (dateToUse) {
                        try {
                            const createdDate = new Date(dateToUse);
                            if (!isNaN(createdDate.getTime())) {
                                metadata.auditDate = createdDate.toISOString().split('T')[0];
                            }
                        } catch (error) {
                            console.warn('Could not parse date:', dateToUse);
                        }
                    }
                    
                    console.log('✅ Metadata from database:', metadata);
                }
            } catch (dbError) {
                console.warn('⚠️  Could not fetch database metadata:', dbError.message);
                // Continue with default metadata
            }
            
            // Try to extract additional metadata from the first section item
            const firstSection = Object.values(sectionsData)[0];
            if (firstSection && firstSection.length > 0) {
                const firstItem = firstSection[0];
                if (firstItem.Author && firstItem.Author.DisplayName && metadata.auditor === 'Unknown') {
                    metadata.auditor = firstItem.Author.DisplayName;
                }
                if (firstItem.Created && metadata.auditDate === new Date().toISOString().split('T')[0]) {
                    try {
                        const createdDate = new Date(firstItem.Created);
                        if (!isNaN(createdDate.getTime())) {
                            metadata.auditDate = createdDate.toISOString().split('T')[0];
                        }
                    } catch (error) {
                        console.warn('Could not parse Created date:', firstItem.Created);
                    }
                }
                if (firstItem.Editor && firstItem.Editor.DisplayName) {
                    metadata.lastModifiedBy = firstItem.Editor.DisplayName;
                }
            }
            
            return {
                sections: sectionsData,
                ...metadata
            };
            
        } catch (error) {
            console.error('❌ Error fetching live SharePoint data:', error);
            throw new Error(`Failed to fetch live data for ${documentNumber}: ${error.message}`);
        }
    }

    /**
     * Get answer data with ResponseJSON from answer lists (Enhanced HTML Report logic)
     */
    async getAnswerDataWithResponseJSON(connector, answerListName, documentNumber) {
        try {
            let answerItems = [];
            
            // Try different filter patterns to find the document's answer item
            try {
                // Try with Document_x0020_Number field first
                answerItems = await connector.getListItems(answerListName, {
                    filter: `Document_x0020_Number eq '${documentNumber}'`,
                    top: 10
                });
                
                if (!answerItems || answerItems.length === 0) {
                    // Try with Title field containing document number
                    answerItems = await connector.getListItems(answerListName, {
                        filter: `substringof('${documentNumber}', Title)`,
                        top: 10
                    });
                }
                
            } catch (filterError) {
                console.warn(`⚠️ Error with filtering ${answerListName}, trying manual search:`, filterError.message);
                try {
                    const allItems = await connector.getListItems(answerListName, { top: 100 });
                    // Filter manually by document number
                    answerItems = allItems.filter(item => 
                        (item.Title && item.Title.includes(documentNumber)) ||
                        item.Document_x0020_Number === documentNumber ||
                        item.DocumentNumber === documentNumber ||
                        item.Document_Number === documentNumber
                    );
                } catch (getAllError) {
                    console.error(`❌ Could not get items from ${answerListName}:`, getAllError.message);
                    return [];
                }
            }

            console.log(`   ✅ Found ${answerItems.length} answer item(s) in ${answerListName}`);
            return answerItems;

        } catch (error) {
            console.error(`❌ Error getting answer data from ${answerListName}:`, error.message);
            return [];
        }
    }

    /**
     * Process ResponseJSON items (Enhanced HTML Report logic)
     */
    processResponseJSONItems(answerItems, sectionTitle, requestedDocumentNumber) {
        const allSectionData = [];

        for (let i = 0; i < answerItems.length; i++) {
            const answerItem = answerItems[i];
            console.log(`   Processing item ${i + 1}: ${answerItem.Title} (ID: ${answerItem.ID || answerItem.Id})`);

            // Look for ResponseJSON field
            const responseField = answerItem.ResponseJSON;
            
            if (!responseField) {
                console.log(`   ⚠️ No ResponseJSON field found in item ${i + 1}`);
                console.log(`      Available fields: ${Object.keys(answerItem).join(', ')}`);
                continue;
            }

            // Parse the ResponseJSON field
            let responseData;
            try {
                // Handle both string and object cases
                if (typeof responseField === 'string') {
                    // Clean up the JSON string
                    let cleanJSON = responseField.trim();
                    
                    // Handle common JSON issues
                    cleanJSON = cleanJSON.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
                    cleanJSON = cleanJSON.replace(/\\/g, '\\\\'); // Escape backslashes properly
                    
                    responseData = JSON.parse(cleanJSON);
                } else {
                    responseData = responseField; // Already parsed object
                }
                
                console.log(`   ✅ Parsed ${Array.isArray(responseData) ? responseData.length : 'unknown'} items from ResponseJSON`);
            } catch (parseError) {
                console.error(`   ❌ JSON Parse Error in ${answerItem.Title}:`, parseError.message);
                console.log(`      Raw JSON preview: ${String(responseField).substring(0, 200)}...`);
                continue;
            }

            // Process the parsed ResponseJSON data
            if (Array.isArray(responseData)) {
                for (const response of responseData) {
                    // Create a processed response item with all necessary fields
                    const processedItem = {
                        ...response,
                        // Add metadata from the SharePoint item
                        Author: answerItem.Author,
                        Created: answerItem.Created,
                        Editor: answerItem.Editor,
                        Modified: answerItem.Modified,
                        Document_x0020_Number: answerItem.Document_x0020_Number,
                        // Ensure we have the fields needed for Action Plan
                        Title: response.Title || response.Question || 'No Title',
                        SelectedChoice: response.SelectedChoice || response.Answer,
                        Finding: response.Finding || response.Title,
                        correctedaction: response.correctedaction || response.CorrectiveAction,
                        cr: response.cr || response.CR,
                        Value: response.Value,
                        Coeff: response.Coeff,
                        ReferenceValue: response.ReferenceValue || response.Id,
                        Priority: response.Priority || this.determinePriority(response.Value, response.Coeff)
                    };
                    
                    allSectionData.push(processedItem);
                }
            } else {
                console.log(`   ⚠️ ResponseJSON is not an array for item ${i + 1}`);
            }
        }

        console.log(`   📊 Total processed responses: ${allSectionData.length}`);
        return allSectionData;
    }

    /**
     * Get summary of corrective actions by priority
     */
    getSummaryByPriority(correctiveActions) {
        const summary = {
            total: correctiveActions.length,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            bySection: {}
        };

        correctiveActions.forEach(action => {
            // Count by priority
            const priority = action.priority.toLowerCase();
            if (summary[priority] !== undefined) {
                summary[priority]++;
            }

            // Count by section
            if (!summary.bySection[action.section]) {
                summary.bySection[action.section] = 0;
            }
            summary.bySection[action.section]++;
        });

        return summary;
    }
}

module.exports = ActionPlanReportGenerator;

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: node generate-action-plan-report.js <document-number>');
        console.log('Example: node generate-action-plan-report.js GMRL-FSACR-0042');
        return;
    }

    const documentNumber = args[0];
    
    // Import the enhanced HTML report generator
    const EnhancedHTMLReportGenerator = require('./generate-enhanced-html-report');
    
    const generator = new ActionPlanReportGenerator({
        outputDir: './reports',
        reportGenerator: new EnhancedHTMLReportGenerator()
    });
    
    generator.generateActionPlanForDocument(documentNumber)
        .then(result => {
            console.log(`🎯 Action Plan Report generated successfully:`);
            console.log(`   File: ${result.fileName}`);
            console.log(`   Actions: ${result.correctiveActionsCount}`);
        })
        .catch(error => {
            console.error('❌ Failed to generate Action Plan Report:', error.message);
        });
}