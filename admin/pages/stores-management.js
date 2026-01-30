/**
 * Admin Stores Management Page Module
 * Page for managing store locations
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

class StoresManagementPage {
    /**
     * Render the stores management page
     */
    static render(req, res) {
        const user = req.currentUser;
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Store Management - Food Safety Audit System</title>
    <link rel="stylesheet" href="/admin/styles/stores-management.css">
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div class="logo-section">
                <h1>🏪 Store Management</h1>
                <p class="subtitle">Manage store locations and branches</p>
            </div>
            <div class="user-section">
                <span class="user-name">${user.displayName || user.email}</span>
                <span class="user-role badge-admin">Admin</span>
                <a href="/admin/users" class="btn-secondary">User Management</a>
                <a href="/dashboard" class="btn-secondary">Dashboard</a>
                <a href="/auth/logout" class="btn-logout">Logout</a>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container">
        <!-- Action Bar -->
        <section class="action-bar">
            <div class="search-section">
                <input 
                    type="text" 
                    id="searchInput" 
                    class="search-input" 
                    placeholder="🔍 Search by store name, code, or location..."
                >
            </div>
            <div class="filter-section">
                <select id="statusFilter" class="filter-select">
                    <option value="">All Statuses</option>
                    <option value="active" selected>Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
                <button id="refreshBtn" class="btn-primary">🔄 Refresh</button>
                <button id="addStoreBtn" class="btn-success">➕ Add New Store</button>
            </div>
        </section>

        <!-- Statistics Cards -->
        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">🏪</div>
                <div class="stat-content">
                    <div class="stat-value" id="totalStores">-</div>
                    <div class="stat-label">Total Stores</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-content">
                    <div class="stat-value" id="activeStores">-</div>
                    <div class="stat-label">Active Stores</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">❌</div>
                <div class="stat-content">
                    <div class="stat-value" id="inactiveStores">-</div>
                    <div class="stat-label">Inactive Stores</div>
                </div>
            </div>
        </section>

        <!-- Stores Table -->
        <section class="table-section">
            <div class="table-container">
                <table class="stores-table">
                    <thead>
                        <tr>
                            <th>Store Code</th>
                            <th>Store Name</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Created Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="storesTableBody">
                        <tr>
                            <td colspan="6" class="loading-cell">
                                <div class="spinner"></div>
                                <span>Loading stores...</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </main>

    <!-- Add/Edit Store Modal -->
    <div id="storeModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Add New Store</h2>
                <span class="modal-close" onclick="closeStoreModal()">&times;</span>
            </div>
            <form id="storeForm">
                <input type="hidden" id="storeId" name="storeId">
                
                <div class="form-group">
                    <label for="storeCode">Store Code *</label>
                    <input 
                        type="text" 
                        id="storeCode" 
                        name="store_code" 
                        required 
                        placeholder="e.g., GMRL-ABD"
                        pattern="[A-Z0-9-]+"
                        title="Only uppercase letters, numbers, and hyphens allowed"
                    >
                    <small>Use uppercase letters, numbers, and hyphens only</small>
                </div>
                
                <div class="form-group">
                    <label for="storeName">Store Name *</label>
                    <input 
                        type="text" 
                        id="storeName" 
                        name="store_name" 
                        required 
                        placeholder="e.g., GMRL Abu Dhabi"
                    >
                </div>
                
                <div class="form-group">
                    <label for="storeLocation">Location</label>
                    <input 
                        type="text" 
                        id="storeLocation" 
                        name="location" 
                        placeholder="e.g., Abu Dhabi, UAE"
                    >
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="closeStoreModal()">Cancel</button>
                    <button type="submit" class="btn-primary">Save Store</button>
                </div>
            </form>
        </div>
    </div>

    <script src="/admin/scripts/stores-management.js"></script>
</body>
</html>
        `;
        
        res.send(html);
    }
}

module.exports = StoresManagementPage;
