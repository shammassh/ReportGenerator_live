/**
 * Admin User Management Page Module
 * Main page for managing users, roles, and permissions
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

class UserManagementPage {
    /**
     * Render the user management page
     */
    static render(req, res) {
        const user = req.currentUser;
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management - Food Safety Audit System</title>
    <link rel="stylesheet" href="/admin/styles/user-management.css">
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div class="logo-section">
                <h1>👥 User Management</h1>
                <p class="subtitle">Manage users, roles, and permissions</p>
            </div>
            <div class="user-section">
                <span class="user-name">${user.displayName || user.email}</span>
                <span class="user-role badge-admin">Admin</span>
                <a href="/admin/analytics" class="btn-secondary">📈 Analytics</a>
                <a href="/admin/stores" class="btn-secondary">🏪 Stores</a>
                <a href="/dashboard" class="btn-secondary">Dashboard</a>
                <a href="/auth/logout" class="btn-logout">Logout</a>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container">
        <!-- Admin Tools Section -->
        <section class="admin-tools-section">
            <h2>🛠️ Admin Tools</h2>
            <div class="admin-tools-grid">
                <div class="admin-tool-card danger">
                    <div class="tool-icon">🗑️</div>
                    <h3>Clear Test Data</h3>
                    <p>Remove all test audit data from FoodSafetyDB while keeping configuration (users, stores, schemas, sections, items)</p>
                    <button id="clearDatabaseBtn" class="btn-danger" onclick="confirmClearDatabase()">
                        🗑️ Clear Audit Data
                    </button>
                </div>
                <div class="admin-tool-card warning">
                    <div class="tool-icon">🧹</div>
                    <h3>Clear Live Database</h3>
                    <p>Delete ALL data from FoodSafetyDB_Live (all tables) to prepare for fresh copy from dev</p>
                    <button id="clearLiveBtn" class="btn-warning" onclick="confirmClearLive()">
                        🧹 Clear Live DB
                    </button>
                </div>
                <div class="admin-tool-card primary">
                    <div class="tool-icon">📦</div>
                    <h3>Copy to Live</h3>
                    <p>Copy FoodSafetyDB to FoodSafetyDB_Live with all tables and data</p>
                    <button id="copyToLiveBtn" class="btn-primary" onclick="confirmCopyToLive()">
                        📦 Copy to Live
                    </button>
                </div>
            </div>
        </section>

        <!-- Action Bar -->
        <section class="action-bar">
            <div class="search-section">
                <input 
                    type="text" 
                    id="searchInput" 
                    class="search-input" 
                    placeholder="🔍 Search by name, email, or role..."
                >
            </div>
            <div class="filter-section">
                <select id="roleFilter" class="filter-select">
                    <option value="">All Roles</option>
                    <option value="Admin">Admin</option>
                    <option value="SuperAuditor">Super Auditor</option>
                    <option value="Auditor">Auditor</option>
                    <option value="HeadOfOperations">Head of Operations</option>
                    <option value="AreaManager">Area Manager</option>
                    <option value="StoreManager">Store Manager</option>
                    <option value="CleaningHead">Cleaning Head</option>
                    <option value="ProcurementHead">Procurement Head</option>
                    <option value="MaintenanceHead">Maintenance Head</option>
                    <option value="Pending">Pending Approval</option>
                </select>
                <select id="statusFilter" class="filter-select">
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                </select>
                <button id="refreshBtn" class="btn-primary">🔄 Refresh</button>
                <button id="syncGraphBtn" class="btn-primary">☁️ Sync from Microsoft</button>
            </div>
        </section>

        <!-- Statistics Cards -->
        <section class="stats-grid">
            <div class="stat-card" data-filter="all" onclick="filterByStatCard('all')">
                <div class="stat-icon">👥</div>
                <div class="stat-content">
                    <div class="stat-value" id="totalUsers">-</div>
                    <div class="stat-label">Total Users</div>
                </div>
            </div>
            <div class="stat-card" data-filter="active" onclick="filterByStatCard('active')">
                <div class="stat-icon">✅</div>
                <div class="stat-content">
                    <div class="stat-value" id="activeUsers">-</div>
                    <div class="stat-label">Active Users</div>
                </div>
            </div>
            <div class="stat-card" data-filter="pending" onclick="filterByStatCard('pending')">
                <div class="stat-icon">⏳</div>
                <div class="stat-content">
                    <div class="stat-value" id="pendingUsers">-</div>
                    <div class="stat-label">Pending Approval</div>
                </div>
            </div>
            <div class="stat-card" data-filter="admin" onclick="filterByStatCard('admin')">
                <div class="stat-icon">🔧</div>
                <div class="stat-content">
                    <div class="stat-value" id="adminUsers">-</div>
                    <div class="stat-label">Admins</div>
                </div>
            </div>
        </section>

        <!-- User Table -->
        <section class="table-section">
            <div class="table-header">
                <h2>Users List</h2>
                <div class="table-actions">
                    <button id="exportBtn" class="btn-secondary">📥 Export CSV</button>
                </div>
            </div>
            
            <!-- Loading Spinner -->
            <div id="loadingSpinner" class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading users...</p>
            </div>

            <!-- Error Message -->
            <div id="errorMessage" class="error-message" style="display: none;">
                <span class="error-icon">⚠️</span>
                <span id="errorText"></span>
            </div>

            <!-- Users Table -->
            <div class="table-wrapper">
                <table class="users-table" id="usersTable">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Assigned Stores</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <!-- Users will be populated here by JavaScript -->
                    </tbody>
                </table>
            </div>

            <!-- Empty State -->
            <div id="emptyState" class="empty-state" style="display: none;">
                <div class="empty-icon">📭</div>
                <h3>No users found</h3>
                <p>Try adjusting your search or filters</p>
            </div>
        </section>
    </main>

    <!-- Edit User Modal (will be loaded from separate component) -->
    <div id="editUserModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Edit User</h2>
                <button class="modal-close" id="closeModal">&times;</button>
            </div>
            <div class="modal-body" id="modalBody">
                <!-- Modal content will be populated by edit-user-modal.js -->
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="toast">
        <span id="toastMessage"></span>
    </div>

    <!-- Confirmation Modal for Admin Tools -->
    <div id="confirmModal" class="confirm-modal">
        <div class="confirm-modal-content">
            <h3 id="confirmModalTitle">Confirm Action</h3>
            <p id="confirmModalMessage">Are you sure you want to proceed?</p>
            <div id="confirmModalWarning" class="warning-text" style="display:none;"></div>
            <div id="confirmModalProgress" class="progress-info" style="display:none;"></div>
            <div class="confirm-modal-buttons" id="confirmModalButtons">
                <button class="btn-cancel" onclick="closeConfirmModal()">Cancel</button>
                <button id="confirmModalAction" class="btn-confirm-danger">Confirm</button>
            </div>
        </div>
    </div>

    <!-- Load Scripts (modular) -->
    <script src="/admin/scripts/user-management.js"></script>
    <script src="/admin/scripts/edit-user-modal.js"></script>
    
    <!-- Admin Tools Scripts -->
    <script>
        function confirmClearDatabase() {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmModalTitle').innerHTML = '🗑️ Clear Database';
            document.getElementById('confirmModalMessage').innerHTML = 
                'This will delete all audit data including:<br><br>' +
                '• All audit instances and responses<br>' +
                '• All pictures and findings<br>' +
                '• All action plans and notifications<br>' +
                '• All saved and published reports<br><br>' +
                '<strong>Configuration will be preserved:</strong> Users, Stores, Schemas, Sections, Items';
            document.getElementById('confirmModalWarning').innerHTML = 
                '⚠️ This action cannot be undone! Make sure you have a backup.';
            document.getElementById('confirmModalWarning').style.display = 'block';
            document.getElementById('confirmModalProgress').style.display = 'none';
            document.getElementById('confirmModalButtons').style.display = 'flex';
            
            const actionBtn = document.getElementById('confirmModalAction');
            actionBtn.className = 'btn-confirm-danger';
            actionBtn.innerHTML = '🗑️ Yes, Clear Database';
            actionBtn.onclick = executeClearDatabase;
            
            modal.classList.add('active');
        }
        
        function confirmCopyToLive() {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmModalTitle').innerHTML = '📦 Copy to Live Database';
            document.getElementById('confirmModalMessage').innerHTML = 
                'This will copy FoodSafetyDB to FoodSafetyDB_Live:<br><br>' +
                '• Creates database if it doesn\\'t exist<br>' +
                '• Drops and recreates all tables<br>' +
                '• Copies all data from current database<br>' +
                '• Includes all 26 tables with structure and data';
            document.getElementById('confirmModalWarning').innerHTML = 
                '⚠️ This will OVERWRITE the existing FoodSafetyDB_Live database!';
            document.getElementById('confirmModalWarning').style.display = 'block';
            document.getElementById('confirmModalProgress').style.display = 'none';
            document.getElementById('confirmModalButtons').style.display = 'flex';
            
            const actionBtn = document.getElementById('confirmModalAction');
            actionBtn.className = 'btn-confirm-primary';
            actionBtn.innerHTML = '📦 Yes, Copy to Live';
            actionBtn.onclick = executeCopyToLive;
            
            modal.classList.add('active');
        }
        
        function confirmClearLive() {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmModalTitle').innerHTML = '🧹 Clear Live Database';
            document.getElementById('confirmModalMessage').innerHTML = 
                'This will delete ALL data from FoodSafetyDB_Live:<br><br>' +
                '• Deletes data from ALL 26 tables<br>' +
                '• Resets all identity seeds to 0<br>' +
                '• Prepares database for fresh copy from dev';
            document.getElementById('confirmModalWarning').innerHTML = 
                '⚠️ ALL data in FoodSafetyDB_Live will be permanently deleted!';
            document.getElementById('confirmModalWarning').style.display = 'block';
            document.getElementById('confirmModalProgress').style.display = 'none';
            document.getElementById('confirmModalButtons').style.display = 'flex';
            
            const actionBtn = document.getElementById('confirmModalAction');
            actionBtn.className = 'btn-confirm-warning';
            actionBtn.innerHTML = '🧹 Yes, Clear Live DB';
            actionBtn.onclick = executeClearLive;
            
            modal.classList.add('active');
        }
        
        function closeConfirmModal() {
            document.getElementById('confirmModal').classList.remove('active');
        }
        
        async function executeClearDatabase() {
            const btn = document.getElementById('confirmModalAction');
            const cancelBtn = document.querySelector('.btn-cancel');
            const progress = document.getElementById('confirmModalProgress');
            
            btn.disabled = true;
            btn.innerHTML = '⏳ Clearing...';
            cancelBtn.style.display = 'none';
            progress.style.display = 'block';
            progress.innerHTML = '<div class="progress-item"><span>Clearing database...</span><span class="status pending">⏳</span></div>';
            
            try {
                const response = await fetch('/api/admin/clear-database', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    progress.innerHTML = result.details.map(d => 
                        '<div class="progress-item"><span>' + d.table + '</span><span class="status success">✅ ' + d.deleted + ' deleted</span></div>'
                    ).join('');
                    btn.innerHTML = '✅ Database Cleared!';
                    btn.className = 'btn-confirm-primary';
                    showToast('Database cleared successfully!', 'success');
                    
                    setTimeout(() => closeConfirmModal(), 3000);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                progress.innerHTML = '<div class="progress-item"><span>Error</span><span class="status error">❌ ' + error.message + '</span></div>';
                btn.innerHTML = '❌ Failed';
                btn.disabled = false;
                cancelBtn.style.display = 'block';
                showToast('Error: ' + error.message, 'error');
            }
        }
        
        async function executeCopyToLive() {
            const btn = document.getElementById('confirmModalAction');
            const cancelBtn = document.querySelector('.btn-cancel');
            const progress = document.getElementById('confirmModalProgress');
            
            btn.disabled = true;
            btn.innerHTML = '⏳ Copying...';
            cancelBtn.style.display = 'none';
            progress.style.display = 'block';
            progress.innerHTML = '<div class="progress-item"><span>Copying database to Live...</span><span class="status pending">⏳ This may take a few minutes</span></div>';
            
            try {
                const response = await fetch('/api/admin/copy-to-live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    progress.innerHTML = 
                        '<div class="progress-item"><span>Tables Copied</span><span class="status success">✅ ' + result.tablesCopied + '</span></div>' +
                        '<div class="progress-item"><span>Total Rows</span><span class="status success">✅ ' + result.totalRows + '</span></div>';
                    btn.innerHTML = '✅ Copy Complete!';
                    btn.className = 'btn-confirm-primary';
                    showToast('Database copied to Live successfully!', 'success');
                    
                    setTimeout(() => closeConfirmModal(), 3000);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                progress.innerHTML = '<div class="progress-item"><span>Error</span><span class="status error">❌ ' + error.message + '</span></div>';
                btn.innerHTML = '❌ Failed';
                btn.disabled = false;
                cancelBtn.style.display = 'block';
                showToast('Error: ' + error.message, 'error');
            }
        }
        
        async function executeClearLive() {
            const btn = document.getElementById('confirmModalAction');
            const cancelBtn = document.querySelector('.btn-cancel');
            const progress = document.getElementById('confirmModalProgress');
            
            btn.disabled = true;
            btn.innerHTML = '⏳ Clearing...';
            cancelBtn.style.display = 'none';
            progress.style.display = 'block';
            progress.innerHTML = '<div class="progress-item"><span>Clearing Live database...</span><span class="status pending">⏳</span></div>';
            
            try {
                const response = await fetch('/api/admin/clear-live-database', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    progress.innerHTML = result.details.map(d => 
                        '<div class="progress-item"><span>' + d.table + '</span><span class="status success">✅ ' + d.deleted + ' deleted</span></div>'
                    ).join('');
                    btn.innerHTML = '✅ Live DB Cleared!';
                    btn.className = 'btn-confirm-primary';
                    showToast('Live database cleared successfully!', 'success');
                    
                    setTimeout(() => closeConfirmModal(), 3000);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                progress.innerHTML = '<div class="progress-item"><span>Error</span><span class="status error">❌ ' + error.message + '</span></div>';
                btn.innerHTML = '❌ Failed';
                btn.disabled = false;
                cancelBtn.style.display = 'block';
                showToast('Error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>
        `;
        
        res.send(html);
    }
}

module.exports = UserManagementPage;
