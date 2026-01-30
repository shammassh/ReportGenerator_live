/**
 * Auditor Selection Page Module
 * Page for auditors to select store and checklist before generating reports
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

class AuditorSelectionPage {
    /**
     * Render the auditor selection page
     */
    static render(req, res) {
        const user = req.currentUser;
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auditor Selection - Food Safety Audit System</title>
    <link rel="stylesheet" href="/auditor/styles/selection-page.css">
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div class="logo-section">
                <h1>📋 Food Safety Audit</h1>
                <p class="subtitle">Select store and checklist to begin audit</p>
            </div>
            <div class="user-section">
                <span class="user-name">${user.displayName || user.email}</span>
                <span class="user-role badge-auditor">Auditor</span>
                <a href="/dashboard" class="btn-secondary">View Reports</a>
                <a href="/auth/logout" class="btn-logout">Logout</a>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container">
        <!-- Welcome Section -->
        <section class="welcome-section">
            <div class="welcome-icon">👋</div>
            <h2>Welcome, ${user.displayName?.split(' ')[0] || 'Auditor'}!</h2>
            <p>Select a store and checklist to begin your food safety audit</p>
        </section>

        <!-- Selection Form -->
        <section class="selection-section">
            <div class="selection-card">
                <form id="auditSelectionForm">
                    <!-- Store Selection -->
                    <div class="form-section">
                        <div class="section-header">
                            <div class="section-icon">🏪</div>
                            <div>
                                <h3>Select Store</h3>
                                <p class="section-description">Choose which store location to audit</p>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="storeSelect">Store Location *</label>
                            <div class="select-wrapper">
                                <select id="storeSelect" name="store" class="form-control" required>
                                    <option value="">-- Select a store --</option>
                                </select>
                            </div>
                            <small class="form-hint">Loading stores from audit documents...</small>
                        </div>
                    </div>

                    <!-- Checklist Selection -->
                    <div class="form-section">
                        <div class="section-header">
                            <div class="section-icon">📝</div>
                            <div>
                                <h3>Select Checklist Type</h3>
                                <p class="section-description">Choose which audit checklist to use</p>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="checklistSelect">Audit Checklist *</label>
                            <div class="select-wrapper">
                                <select id="checklistSelect" name="checklist" class="form-control" required>
                                    <option value="">-- Select a checklist --</option>
                                </select>
                            </div>
                            <small class="form-hint">Loading available checklists from SharePoint...</small>
                        </div>
                        
                        <!-- Checklist Preview (shown when checklist selected) -->
                        <div id="checklistPreview" class="checklist-preview" style="display: none;">
                            <div class="preview-header">
                                <strong>📄 Checklist Details:</strong>
                            </div>
                            <div id="checklistDetails" class="preview-content">
                                <!-- Populated by JavaScript -->
                            </div>
                        </div>
                    </div>

                    <!-- Audit Date & Reference -->
                    <div class="form-section">
                        <div class="section-header">
                            <div class="section-icon">📅</div>
                            <div>
                                <h3>Audit Information</h3>
                                <p class="section-description">Provide audit date and reference details</p>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="auditDate">Audit Date *</label>
                                <input 
                                    type="date" 
                                    id="auditDate" 
                                    name="auditDate" 
                                    class="form-control" 
                                    required
                                >
                            </div>
                            
                            <div class="form-group">
                                <label for="auditTime">Audit Time</label>
                                <input 
                                    type="time" 
                                    id="auditTime" 
                                    name="auditTime" 
                                    class="form-control"
                                >
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="auditNotes">Notes (Optional)</label>
                            <textarea 
                                id="auditNotes" 
                                name="notes" 
                                class="form-control" 
                                rows="3"
                                placeholder="Add any notes or special instructions for this audit..."
                            ></textarea>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="window.location.href='/dashboard'">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary" id="startAuditBtn">
                            🚀 Start Audit
                        </button>
                    </div>
                </form>
            </div>

            <!-- Recent Audits Sidebar -->
            <aside class="recent-audits">
                <h3>📊 Recent Audits</h3>
                <div id="recentAuditsList" class="recent-list">
                    <div class="loading-text">Loading recent audits...</div>
                </div>
            </aside>
        </section>

        <!-- Quick Stats -->
        <section class="stats-section">
            <div class="stat-box">
                <div class="stat-icon">📋</div>
                <div class="stat-content">
                    <div class="stat-value" id="totalAudits">-</div>
                    <div class="stat-label">Total Audits</div>
                </div>
            </div>
            <div class="stat-box">
                <div class="stat-icon">✅</div>
                <div class="stat-content">
                    <div class="stat-value" id="completedAudits">-</div>
                    <div class="stat-label">Completed</div>
                </div>
            </div>
            <div class="stat-box">
                <div class="stat-icon">📈</div>
                <div class="stat-content">
                    <div class="stat-value" id="avgScore">-</div>
                    <div class="stat-label">Avg Score</div>
                </div>
            </div>
            <div class="stat-box">
                <div class="stat-icon">🏪</div>
                <div class="stat-content">
                    <div class="stat-value" id="totalStores">-</div>
                    <div class="stat-label">Stores</div>
                </div>
            </div>
        </section>
    </main>

    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-content">
            <div class="spinner-large"></div>
            <p>Starting audit...</p>
        </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="toast">
        <span id="toastMessage"></span>
    </div>

    <!-- Load Scripts (modular) -->
    <script src="/auditor/scripts/selection-page.js"></script>
</body>
</html>
        `;
        
        res.send(html);
    }
}

module.exports = AuditorSelectionPage;
