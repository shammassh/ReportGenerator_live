/**
 * User Context UI Component
 * Displays user information in the dashboard header
 */

(function() {
    'use strict';

    // Wait for user context to be available
    if (!window.USER_CONTEXT) {
        console.error('❌ User context not available');
        return;
    }

    const userContext = window.USER_CONTEXT;

    /**
     * Create user info header element
     */
    function createUserInfoHeader() {
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info-header';
        
        // Check if impersonating
        const isImpersonating = userContext.isImpersonating || false;
        const roleBadgeClass = isImpersonating ? 'role-badge role-impersonating' : `role-badge role-${userContext.role.toLowerCase()}`;
        const roleLabel = isImpersonating 
            ? `🎭 Impersonating: ${getRoleLabel(userContext.role)}` 
            : getRoleLabel(userContext.role);
        
        userInfo.innerHTML = `
            <div class="user-details">
                <div class="user-avatar">
                    ${getInitials(userContext.name)}
                </div>
                <div class="user-text">
                    <div class="user-name">${userContext.name}</div>
                    <div class="user-role">
                        <span class="${roleBadgeClass}">${roleLabel}</span>
                        ${isImpersonating ? '<button class="stop-impersonation-btn" onclick="stopImpersonationNow()">⛔ Stop</button>' : ''}
                    </div>
                </div>
            </div>
            <div class="user-actions">
                ${getNavigationLinks()}
                <button class="logout-btn" onclick="handleLogout()">
                    🚪 Logout
                </button>
            </div>
        `;
        return userInfo;
    }

    /**
     * Get user initials for avatar
     */
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Get friendly role label
     */
    function getRoleLabel(role) {
        const labels = {
            'Admin': '👑 Administrator',
            'Auditor': '📋 Auditor',
            'StoreManager': '🏪 Store Manager',
            'CleaningHead': '🧹 Cleaning Head',
            'ProcurementHead': '📦 Procurement Head',
            'MaintenanceHead': '🔧 Maintenance Head'
        };
        return labels[role] || role;
    }

    /**
     * Get navigation links based on role
     */
    function getNavigationLinks() {
        let links = '<div class="nav-links">';
        
        // Admin can access user management
        if (userContext.permissions.canAccessAdmin) {
            links += '<a href="/admin/user-management" class="nav-link">👥 User Management</a>';
        }

        // Auditor can access selection page
        if (userContext.permissions.canAccessAuditorSelection) {
            links += '<a href="/auditor/selection" class="nav-link">📝 New Audit</a>';
        }

        // Dashboard link (always visible)
        links += '<a href="/dashboard" class="nav-link active">📊 Dashboard</a>';

        links += '</div>';
        return links;
    }

    /**
     * Handle logout
     */
    window.handleLogout = async function() {
        if (!confirm('Are you sure you want to logout?')) {
            return;
        }

        try {
            // Redirect to logout endpoint (GET request)
            window.location.href = '/auth/logout';
        } catch (error) {
            console.error('❌ Logout error:', error);
            alert('Logout failed. Please try again.');
        }
    };

    /**
     * Stop impersonation immediately
     */
    window.stopImpersonationNow = async function() {
        try {
            const response = await fetch('/api/impersonation/stop', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                alert('Impersonation stopped. Returning to Admin role.');
                window.location.reload();
            } else {
                alert('Failed to stop impersonation: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Stop impersonation error:', error);
            alert('Failed to stop impersonation. Please clear cookies manually.');
        }
    };

    /**
     * Create impersonation warning banner
     */
    function createImpersonationBanner() {
        if (!userContext.isImpersonating) return;
        
        const banner = document.createElement('div');
        banner.className = 'impersonation-warning-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">🎭</span>
                <span class="banner-text">
                    <strong>IMPERSONATION ACTIVE:</strong> You are viewing the system as <strong>${userContext.role}</strong>. 
                    Your real role is <strong>${userContext.originalRole || 'Admin'}</strong>.
                </span>
                <button class="banner-stop-btn" onclick="stopImpersonationNow()">⛔ Stop Impersonation</button>
            </div>
        `;
        document.body.insertBefore(banner, document.body.firstChild);
    }

    /**
     * Insert user info header into dashboard
     */
    function insertUserInfoHeader() {
        const dashboardHeader = document.querySelector('.dashboard-header');
        if (!dashboardHeader) {
            console.error('❌ Dashboard header not found');
            return;
        }

        const userInfoHeader = createUserInfoHeader();
        
        // Insert at the top of dashboard header
        dashboardHeader.insertBefore(userInfoHeader, dashboardHeader.firstChild);

        console.log('✅ User info header added');
    }

    /**
     * Add store assignment info for Store Managers
     */
    function addStoreAssignmentInfo() {
        if (userContext.role !== 'StoreManager') return;

        const stores = userContext.permissions.accessibleStores || [];
        if (stores.length === 0) return;

        const statsBar = document.querySelector('.stats-bar');
        if (!statsBar) return;

        const storeInfo = document.createElement('div');
        storeInfo.className = 'store-assignment-info';
        storeInfo.innerHTML = `
            <div class="info-label">📍 Assigned Stores:</div>
            <div class="store-list">
                ${stores.map(store => `<span class="store-tag">${store}</span>`).join('')}
            </div>
        `;

        statsBar.parentNode.insertBefore(storeInfo, statsBar);
    }

    /**
     * Add department info for Department Heads
     */
    function addDepartmentInfo() {
        const dept = userContext.permissions.accessibleDepartment;
        if (!dept) return;

        const statsBar = document.querySelector('.stats-bar');
        if (!statsBar) return;

        const deptInfo = document.createElement('div');
        deptInfo.className = 'department-info';
        deptInfo.innerHTML = `
            <div class="info-label">🏢 Department:</div>
            <div class="dept-badge dept-${dept.toLowerCase()}">${dept}</div>
        `;

        statsBar.parentNode.insertBefore(deptInfo, statsBar);
    }

    /**
     * Initialize user context UI
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                createImpersonationBanner();
                insertUserInfoHeader();
                addStoreAssignmentInfo();
                addDepartmentInfo();
            });
        } else {
            createImpersonationBanner();
            insertUserInfoHeader();
            addStoreAssignmentInfo();
            addDepartmentInfo();
        }
    }

    // Initialize
    init();

})();
