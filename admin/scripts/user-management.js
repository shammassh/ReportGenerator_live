/**
 * User Management Client-Side JavaScript
 * Handles user list, search, filter, and interactions
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

// Global state
let allUsers = [];
let filteredUsers = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadUsers();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // Search input
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Filters
    document.getElementById('roleFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    
    // Action buttons
    document.getElementById('refreshBtn').addEventListener('click', loadUsers);
    document.getElementById('syncGraphBtn').addEventListener('click', syncFromMicrosoft);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Modal close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    
    // Close modal on outside click
    document.getElementById('editUserModal').addEventListener('click', (e) => {
        if (e.target.id === 'editUserModal') {
            closeModal();
        }
    });
}

/**
 * Filter users by clicking on stat cards
 */
function filterByStatCard(filterType) {
    // Reset search
    document.getElementById('searchInput').value = '';
    
    // Update stat card active state
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
    
    // Apply filter
    switch(filterType) {
        case 'all':
            document.getElementById('roleFilter').value = '';
            document.getElementById('statusFilter').value = '';
            break;
        case 'active':
            document.getElementById('roleFilter').value = '';
            document.getElementById('statusFilter').value = 'active';
            break;
        case 'pending':
            document.getElementById('roleFilter').value = 'Pending';
            document.getElementById('statusFilter').value = '';
            break;
        case 'admin':
            document.getElementById('roleFilter').value = 'Admin';
            document.getElementById('statusFilter').value = '';
            break;
    }
    
    applyFilters();
}

/**
 * Load users from server
 */
async function loadUsers() {
    try {
        showLoading(true);
        hideError();
        
        const response = await fetch('/api/admin/users');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        allUsers = data.users || [];
        
        applyFilters();
        updateStatistics();
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users. Please try again.');
        showLoading(false);
    }
}

/**
 * Sync users from Microsoft Graph
 */
async function syncFromMicrosoft() {
    if (!confirm('This will fetch all users from Microsoft Graph API. Continue?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/admin/sync-graph', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        showToast(`Successfully synced ${data.newUsers} new users from Microsoft`, 'success');
        
        // Reload users
        await loadUsers();
        
    } catch (error) {
        console.error('Error syncing from Microsoft:', error);
        showToast('Failed to sync users from Microsoft', 'error');
        showLoading(false);
    }
}

/**
 * Handle search input
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    
    if (searchTerm === '') {
        filteredUsers = allUsers;
    } else {
        filteredUsers = allUsers.filter(user => {
            return (
                user.display_name?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm) ||
                user.role?.toLowerCase().includes(searchTerm) ||
                user.department?.toLowerCase().includes(searchTerm)
            );
        });
    }
    
    applyFilters();
}

/**
 * Apply filters
 */
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Start with all users or search results
    let users = allUsers;
    
    // Apply search
    if (searchTerm) {
        users = users.filter(user => {
            return (
                user.display_name?.toLowerCase().includes(searchTerm) ||
                user.email?.toLowerCase().includes(searchTerm) ||
                user.role?.toLowerCase().includes(searchTerm) ||
                user.department?.toLowerCase().includes(searchTerm)
            );
        });
    }
    
    // Apply role filter
    if (roleFilter) {
        users = users.filter(user => user.role === roleFilter);
    }
    
    // Apply status filter
    if (statusFilter) {
        if (statusFilter === 'active') {
            users = users.filter(user => user.is_active && user.is_approved);
        } else if (statusFilter === 'inactive') {
            users = users.filter(user => !user.is_active);
        } else if (statusFilter === 'pending') {
            users = users.filter(user => user.role === 'Pending' || !user.is_approved);
        }
    }
    
    filteredUsers = users;
    renderUsersTable();
}

/**
 * Render users table
 */
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>
                <strong>${escapeHtml(user.display_name || 'N/A')}</strong>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>${getRoleBadge(user.role)}</td>
            <td>${formatAssignments(user)}</td>
            <td>${escapeHtml(user.assigned_department || user.department || '-')}</td>
            <td>${getStatusBadge(user)}</td>
            <td>${formatDate(user.last_login)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="editUser(${user.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn-toggle ${user.is_active ? 'active' : ''}" 
                            onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                        ${user.is_active ? '✓ Active' : '✗ Inactive'}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Update statistics
 */
function updateStatistics() {
    const total = allUsers.length;
    const active = allUsers.filter(u => u.is_active && u.is_approved).length;
    const pending = allUsers.filter(u => u.role === 'Pending' || !u.is_approved).length;
    const admins = allUsers.filter(u => u.role === 'Admin').length;
    
    document.getElementById('totalUsers').textContent = total;
    document.getElementById('activeUsers').textContent = active;
    document.getElementById('pendingUsers').textContent = pending;
    document.getElementById('adminUsers').textContent = admins;
}

/**
 * Edit user (opens modal)
 */
async function editUser(userId) {
    try {
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            showToast('User not found', 'error');
            return;
        }
        
        // Show modal with user data
        window.openEditUserModal(user);
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Failed to open edit dialog', 'error');
    }
}

/**
 * Toggle user active/inactive status
 */
async function toggleUserStatus(userId, newStatus) {
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_active: newStatus
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showToast(`User ${action}d successfully`, 'success');
        await loadUsers();
        
    } catch (error) {
        console.error(`Error ${action}ing user:`, error);
        showToast(`Failed to ${action} user`, 'error');
    }
}

/**
 * Export users to CSV
 */
function exportToCSV() {
    const headers = ['Name', 'Email', 'Role', 'Assigned Stores', 'Department', 'Status', 'Last Login'];
    const rows = filteredUsers.map(user => [
        user.display_name || 'N/A',
        user.email,
        user.role,
        formatStores(user.assigned_stores, true),
        user.assigned_department || user.department || '-',
        user.is_active && user.is_approved ? 'Active' : 'Inactive',
        formatDate(user.last_login, true)
    ]);
    
    let csv = headers.join(',') + '\n';
    csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Users exported successfully', 'success');
}

/**
 * Helper: Get role badge HTML
 */
function getRoleBadge(role) {
    const roleMap = {
        'Admin': 'badge-admin',
        'SuperAuditor': 'badge-superauditor',
        'Auditor': 'badge-auditor',
        'HeadOfOperations': 'badge-headofops',
        'AreaManager': 'badge-areamanager',
        'StoreManager': 'badge-storemanager',
        'CleaningHead': 'badge-depthead',
        'ProcurementHead': 'badge-depthead',
        'MaintenanceHead': 'badge-depthead',
        'Pending': 'badge-pending'
    };
    
    const displayNames = {
        'HeadOfOperations': 'Head of Ops',
        'AreaManager': 'Area Manager',
        'StoreManager': 'Store Manager',
        'SuperAuditor': 'Super Auditor',
        'CleaningHead': 'Cleaning Head',
        'ProcurementHead': 'Procurement Head',
        'MaintenanceHead': 'Maintenance Head'
    };
    
    const badgeClass = roleMap[role] || 'badge-pending';
    const displayName = displayNames[role] || role;
    return `<span class="${badgeClass}">${displayName}</span>`;
}

/**
 * Helper: Get status badge HTML
 */
function getStatusBadge(user) {
    if (user.is_active && user.is_approved) {
        return '<span class="badge-active">Active</span>';
    }
    return '<span class="badge-inactive">Inactive</span>';
}

/**
 * Helper: Format assignments based on role type
 */
function formatAssignments(user) {
    // HeadOfOperations - show brand assignments
    if (user.role === 'HeadOfOperations') {
        if (user.assigned_brands) {
            const brands = user.assigned_brands.split(', ');
            return `<span class="badge-brands">🏢 ${brands.join(', ')}</span>`;
        }
        return '<span style="color:#999;">No brands</span>';
    }
    
    // AreaManager - show area store assignments
    if (user.role === 'AreaManager') {
        if (user.assigned_area_stores) {
            const stores = user.assigned_area_stores.split(', ');
            const display = stores.length > 2 
                ? `${stores.slice(0, 2).join(', ')} +${stores.length - 2}`
                : stores.join(', ');
            return `<span class="badge-areas">📍 ${display}</span>`;
        }
        return '<span style="color:#999;">No stores</span>';
    }
    
    // StoreManager - show assigned stores
    if (user.role === 'StoreManager') {
        return formatStores(user.assigned_stores);
    }
    
    // Other roles - show dash
    return '-';
}

/**
 * Helper: Format stores list
 */
function formatStores(stores, forCSV = false) {
    if (!stores) return '-';
    
    try {
        const storeList = typeof stores === 'string' ? JSON.parse(stores) : stores;
        if (Array.isArray(storeList) && storeList.length > 0) {
            if (forCSV) {
                return storeList.join('; ');
            }
            return storeList.length > 2 
                ? `${storeList.slice(0, 2).join(', ')} +${storeList.length - 2}`
                : storeList.join(', ');
        }
    } catch (e) {
        console.error('Error parsing stores:', e);
    }
    
    return '-';
}

/**
 * Helper: Format date
 */
function formatDate(dateStr, forCSV = false) {
    if (!dateStr) return 'Never';
    
    const date = new Date(dateStr);
    if (forCSV) {
        return date.toLocaleDateString();
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

/**
 * UI Helper: Show/hide loading spinner
 */
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
    document.getElementById('usersTable').style.display = show ? 'none' : 'table';
}

/**
 * UI Helper: Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    document.getElementById('errorText').textContent = message;
    errorDiv.style.display = 'flex';
}

/**
 * UI Helper: Hide error message
 */
function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

/**
 * UI Helper: Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * UI Helper: Close modal
 */
function closeModal() {
    document.getElementById('editUserModal').classList.remove('show');
}
