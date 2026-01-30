/**
 * Checklist Management Page Module
 * Serves the checklist management UI and handles routing
 * Admin-only access
 */

const ChecklistService = require('../services/checklist-service');
const VersionControlService = require('../services/version-control-service');

class ChecklistManagementPage {
    constructor(app) {
        this.app = app;
        this.checklistService = new ChecklistService();
        this.versionService = new VersionControlService();
        this.setupRoutes();
    }

    /**
     * Setup all routes for checklist management
     */
    setupRoutes() {
        // Page routes
        this.app.get('/admin/checklist-management', this.requireAdmin.bind(this), this.servePage.bind(this));
        
        // API routes - Section operations
        this.app.get('/api/checklist/sections', this.requireAdmin.bind(this), this.getSections.bind(this));
        this.app.get('/api/checklist/sections/:section/questions', this.requireAdmin.bind(this), this.getQuestions.bind(this));
        this.app.get('/api/checklist/sections/:section/questions/:id', this.requireAdmin.bind(this), this.getQuestion.bind(this));
        this.app.post('/api/checklist/sections/:section/questions', this.requireAdmin.bind(this), this.addQuestion.bind(this));
        this.app.put('/api/checklist/sections/:section/questions/:id', this.requireAdmin.bind(this), this.updateQuestion.bind(this));
        this.app.delete('/api/checklist/sections/:section/questions/:id', this.requireAdmin.bind(this), this.deleteQuestion.bind(this));
        this.app.patch('/api/checklist/sections/:section/questions/:id/toggle', this.requireAdmin.bind(this), this.toggleQuestion.bind(this));
        
        // API routes - Utility operations
        this.app.get('/api/checklist/search', this.requireAdmin.bind(this), this.searchQuestions.bind(this));
        this.app.get('/api/checklist/statistics', this.requireAdmin.bind(this), this.getStatistics.bind(this));
        this.app.get('/api/checklist/sections/:section/next-reference', this.requireAdmin.bind(this), this.getNextReference.bind(this));
        
        // API routes - Version control
        this.app.get('/api/checklist/history', this.requireAdmin.bind(this), this.getHistory.bind(this));
        this.app.get('/api/checklist/history/recent', this.requireAdmin.bind(this), this.getRecentChanges.bind(this));
        this.app.get('/api/checklist/history/:section/:id', this.requireAdmin.bind(this), this.getQuestionHistory.bind(this));
        this.app.get('/api/checklist/statistics/changes', this.requireAdmin.bind(this), this.getChangeStatistics.bind(this));
    }

    /**
     * Middleware: Require admin role
     */
    requireAdmin(req, res, next) {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (req.session.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    }

    /**
     * Serve the checklist management page
     */
    async servePage(req, res) {
        try {
            const user = req.session.user;
            
            // Get initial statistics
            const stats = await this.checklistService.getStatistics();
            
            res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Checklist Management - Food Safety Audit System</title>
    <link rel="stylesheet" href="/checklist/styles/checklist-management.css">
</head>
<body>
    <div class="page-container">
        <!-- Header -->
        <header class="page-header">
            <div class="header-content">
                <h1>🗂️ Checklist Management</h1>
                <div class="header-actions">
                    <div class="user-info">
                        <span class="user-name">${user.name}</span>
                        <span class="user-role badge-admin">Admin</span>
                    </div>
                    <a href="/admin/dashboard" class="btn-secondary">← Back to Dashboard</a>
                </div>
            </div>
        </header>

        <!-- Statistics Overview -->
        <section class="stats-section">
            <div class="stat-card">
                <div class="stat-value">${stats.totalQuestions}</div>
                <div class="stat-label">Total Questions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activeQuestions}</div>
                <div class="stat-label">Active</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.inactiveQuestions}</div>
                <div class="stat-label">Inactive</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.sections.length}</div>
                <div class="stat-label">Sections</div>
            </div>
        </section>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Toolbar -->
            <div class="toolbar">
                <div class="toolbar-left">
                    <select id="sectionFilter" class="select-input">
                        <option value="">All Sections</option>
                        ${stats.sections.map(s => `
                            <option value="${s.name}">${s.name} (${s.total})</option>
                        `).join('')}
                    </select>
                    
                    <select id="statusFilter" class="select-input">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    
                    <input type="text" id="searchInput" class="search-input" placeholder="Search questions...">
                    <button id="searchBtn" class="btn-secondary">🔍 Search</button>
                </div>
                
                <div class="toolbar-right">
                    <button id="addQuestionBtn" class="btn-primary">➕ Add Question</button>
                    <button id="viewHistoryBtn" class="btn-secondary">📜 View History</button>
                </div>
            </div>

            <!-- Questions Table -->
            <div class="table-container">
                <table id="questionsTable" class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 60px;">#</th>
                            <th style="width: 200px;">Section</th>
                            <th>Question</th>
                            <th style="width: 80px;">Coeff</th>
                            <th style="width: 100px;">Answers</th>
                            <th style="width: 100px;">Status</th>
                            <th style="width: 150px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="questionsTableBody">
                        <tr>
                            <td colspan="7" class="loading-cell">Loading questions...</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div class="pagination" id="pagination">
                <!-- Populated by JavaScript -->
            </div>
        </main>

        <!-- Add/Edit Question Modal -->
        <div id="questionModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modalTitle">Add Question</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="questionForm">
                        <input type="hidden" id="questionId">
                        <input type="hidden" id="originalSection">
                        
                        <div class="form-group">
                            <label for="questionSection">Section *</label>
                            <select id="questionSection" class="form-control" required>
                                <option value="">Select section...</option>
                                ${stats.sections.map(s => `
                                    <option value="${s.name}">${s.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="questionReference">Reference Value</label>
                            <input type="text" id="questionReference" class="form-control" 
                                   placeholder="e.g., 1.1" pattern="\\d+\\.\\d+">
                            <small>Suggested: <span id="suggestedReference">-</span></small>
                        </div>
                        
                        <div class="form-group">
                            <label for="questionTitle">Question Text *</label>
                            <textarea id="questionTitle" class="form-control" rows="3" 
                                      required placeholder="Enter the audit question..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="questionCr">Criterion/Requirement</label>
                            <textarea id="questionCr" class="form-control" rows="2" 
                                      placeholder="Enter the criterion or requirement..."></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="questionCoeff">Coefficient *</label>
                                <select id="questionCoeff" class="form-control" required>
                                    <option value="2">2 (Standard)</option>
                                    <option value="4">4 (Critical)</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="questionAnswer">Answer Options *</label>
                                <select id="questionAnswer" class="form-control" required>
                                    <option value="Yes,Partially,No,NA">Yes, Partially, No, N/A</option>
                                    <option value="Yes,No,NA">Yes, No, N/A</option>
                                    <option value="Yes,No">Yes, No</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="questionReason">Reason for Change</label>
                            <textarea id="questionReason" class="form-control" rows="2" 
                                      placeholder="Why are you making this change?"></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary modal-close">Cancel</button>
                            <button type="submit" class="btn-primary">Save Question</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- History Modal -->
        <div id="historyModal" class="modal">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2>Change History</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="historyContent">
                        <p>Loading history...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="/checklist/scripts/checklist-manager.js"></script>
    <script src="/checklist/scripts/question-editor.js"></script>
    <script src="/checklist/scripts/version-history.js"></script>
</body>
</html>
            `);
        } catch (error) {
            console.error('❌ Error serving checklist management page:', error);
            res.status(500).send('Error loading page');
        }
    }

    /**
     * API: Get all sections
     */
    async getSections(req, res) {
        try {
            const sections = this.checklistService.getAllSections();
            res.json({ sections });
        } catch (error) {
            console.error('❌ Error getting sections:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get questions from a section
     */
    async getQuestions(req, res) {
        try {
            const { section } = req.params;
            const questions = await this.checklistService.getSectionQuestions(section);
            res.json({ questions });
        } catch (error) {
            console.error('❌ Error getting questions:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get single question
     */
    async getQuestion(req, res) {
        try {
            const { section, id } = req.params;
            const question = await this.checklistService.getQuestionById(section, id);
            res.json({ question });
        } catch (error) {
            console.error('❌ Error getting question:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Add new question
     */
    async addQuestion(req, res) {
        try {
            const { section } = req.params;
            const questionData = req.body;
            
            // Add question to SharePoint
            const newQuestion = await this.checklistService.addQuestion(section, questionData);
            
            // Log the change
            await this.versionService.logChange({
                userId: req.session.user.id,
                userEmail: req.session.user.email,
                section,
                action: 'add',
                questionId: newQuestion.id,
                questionData: newQuestion,
                reason: req.body.reason,
                ipAddress: req.ip
            });
            
            res.json({ success: true, question: newQuestion });
        } catch (error) {
            console.error('❌ Error adding question:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Update question
     */
    async updateQuestion(req, res) {
        try {
            const { section, id } = req.params;
            const questionData = req.body;
            
            // Get before state
            const beforeState = await this.checklistService.getQuestionById(section, id);
            
            // Update question
            const updatedQuestion = await this.checklistService.updateQuestion(section, id, questionData);
            
            // Log the change
            await this.versionService.logChange({
                userId: req.session.user.id,
                userEmail: req.session.user.email,
                section,
                action: 'update',
                questionId: id,
                questionData: updatedQuestion,
                beforeState,
                reason: req.body.reason,
                ipAddress: req.ip
            });
            
            res.json({ success: true, question: updatedQuestion });
        } catch (error) {
            console.error('❌ Error updating question:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Delete question (soft delete)
     */
    async deleteQuestion(req, res) {
        try {
            const { section, id } = req.params;
            
            // Get before state
            const beforeState = await this.checklistService.getQuestionById(section, id);
            
            // Soft delete
            const deletedQuestion = await this.checklistService.deleteQuestion(section, id);
            
            // Log the change
            await this.versionService.logChange({
                userId: req.session.user.id,
                userEmail: req.session.user.email,
                section,
                action: 'delete',
                questionId: id,
                beforeState,
                reason: req.body.reason || 'Question deactivated',
                ipAddress: req.ip
            });
            
            res.json({ success: true, question: deletedQuestion });
        } catch (error) {
            console.error('❌ Error deleting question:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Toggle question status
     */
    async toggleQuestion(req, res) {
        try {
            const { section, id } = req.params;
            const { isActive } = req.body;
            
            // Get before state
            const beforeState = await this.checklistService.getQuestionById(section, id);
            
            // Toggle status
            const updatedQuestion = await this.checklistService.toggleQuestionStatus(section, id, isActive);
            
            // Log the change
            await this.versionService.logChange({
                userId: req.session.user.id,
                userEmail: req.session.user.email,
                section,
                action: 'toggle',
                questionId: id,
                questionData: updatedQuestion,
                beforeState,
                reason: `Status changed to ${isActive ? 'active' : 'inactive'}`,
                ipAddress: req.ip
            });
            
            res.json({ success: true, question: updatedQuestion });
        } catch (error) {
            console.error('❌ Error toggling question:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Search questions
     */
    async searchQuestions(req, res) {
        try {
            const { q, section, isActive, coeff } = req.query;
            
            const filters = {};
            if (section) filters.section = section;
            if (isActive !== undefined) filters.isActive = isActive === 'true';
            if (coeff) filters.coeff = parseInt(coeff);
            
            const questions = await this.checklistService.searchQuestions(q || '', filters);
            res.json({ questions });
        } catch (error) {
            console.error('❌ Error searching questions:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get statistics
     */
    async getStatistics(req, res) {
        try {
            const stats = await this.checklistService.getStatistics();
            res.json({ stats });
        } catch (error) {
            console.error('❌ Error getting statistics:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get next reference value suggestion
     */
    async getNextReference(req, res) {
        try {
            const { section } = req.params;
            const nextRef = await this.checklistService.getNextReferenceValue(section);
            res.json({ nextReference: nextRef });
        } catch (error) {
            console.error('❌ Error getting next reference:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get change history
     */
    async getHistory(req, res) {
        try {
            const filters = {
                section: req.query.section,
                userId: req.query.userId,
                action: req.query.action,
                limit: req.query.limit ? parseInt(req.query.limit) : 100
            };
            
            const history = await this.versionService.getChangeHistory(filters);
            res.json({ history });
        } catch (error) {
            console.error('❌ Error getting history:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get recent changes
     */
    async getRecentChanges(req, res) {
        try {
            const hours = req.query.hours ? parseInt(req.query.hours) : 24;
            const changes = await this.versionService.getRecentChanges(hours);
            res.json({ changes });
        } catch (error) {
            console.error('❌ Error getting recent changes:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get question history
     */
    async getQuestionHistory(req, res) {
        try {
            const { section, id } = req.params;
            const history = await this.versionService.getQuestionHistory(section, id);
            res.json({ history });
        } catch (error) {
            console.error('❌ Error getting question history:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * API: Get change statistics
     */
    async getChangeStatistics(req, res) {
        try {
            const filters = {};
            if (req.query.section) filters.section = req.query.section;
            if (req.query.startDate) filters.startDate = new Date(req.query.startDate);
            if (req.query.endDate) filters.endDate = new Date(req.query.endDate);
            
            const stats = await this.versionService.getChangeStatistics(filters);
            res.json({ stats });
        } catch (error) {
            console.error('❌ Error getting change statistics:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ChecklistManagementPage;
