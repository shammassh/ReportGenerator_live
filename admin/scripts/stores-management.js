/**
 * Stores Management Page JavaScript
 * Handles CRUD operations for store locations
 */

let allStores = [];
let currentEditingStoreId = null;

// ===========================
// Initialize
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    loadStores();
    
    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', loadStores);
    document.getElementById('addStoreBtn').addEventListener('click', openAddStoreModal);
    document.getElementById('searchInput').addEventListener('input', filterStores);
    document.getElementById('statusFilter').addEventListener('change', filterStores);
    document.getElementById('storeForm').addEventListener('submit', handleStoreSubmit);
    
    // Auto-uppercase store code
    document.getElementById('storeCode').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
});

// ===========================
// API Calls
// ===========================
async function loadStores() {
    try {
        const response = await fetch('/api/admin/stores/all');
        const data = await response.json();
        
        allStores = data.stores || [];
        updateStatistics();
        filterStores();
        
    } catch (error) {
        console.error('Error loading stores:', error);
        showError('Failed to load stores');
    }
}

async function createStore(storeData) {
    try {
        const response = await fetch('/api/admin/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(storeData)
        });
        
        if (!response.ok) throw new Error('Failed to create store');
        
        const data = await response.json();
        showSuccess(`Store "${storeData.store_name}" created successfully`);
        return data.store;
        
    } catch (error) {
        console.error('Error creating store:', error);
        throw error;
    }
}

async function updateStore(storeId, storeData) {
    try {
        const response = await fetch(`/api/admin/stores/${storeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(storeData)
        });
        
        if (!response.ok) throw new Error('Failed to update store');
        
        const data = await response.json();
        showSuccess(`Store "${storeData.store_name}" updated successfully`);
        return data.store;
        
    } catch (error) {
        console.error('Error updating store:', error);
        throw error;
    }
}

async function toggleStoreStatus(storeId, isActive, storeName) {
    try {
        const confirmed = confirm(
            `Are you sure you want to ${isActive ? 'activate' : 'deactivate'} "${storeName}"?\n\n` +
            (isActive ? 'This store will be available for assignment.' : 'This store will no longer be available for new assignments.')
        );
        
        if (!confirmed) return;
        
        const response = await fetch(`/api/admin/stores/${storeId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive })
        });
        
        if (!response.ok) throw new Error('Failed to toggle store status');
        
        showSuccess(`Store "${storeName}" ${isActive ? 'activated' : 'deactivated'} successfully`);
        loadStores();
        
    } catch (error) {
        console.error('Error toggling store status:', error);
        showError('Failed to update store status');
    }
}

// ===========================
// UI Updates
// ===========================
function updateStatistics() {
    const total = allStores.length;
    const active = allStores.filter(s => s.is_active).length;
    const inactive = total - active;
    
    document.getElementById('totalStores').textContent = total;
    document.getElementById('activeStores').textContent = active;
    document.getElementById('inactiveStores').textContent = inactive;
}

function filterStores() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    let filtered = allStores;
    
    // Status filter
    if (statusFilter === 'active') {
        filtered = filtered.filter(s => s.is_active);
    } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(s => !s.is_active);
    }
    
    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(store => 
            store.store_code.toLowerCase().includes(searchTerm) ||
            store.store_name.toLowerCase().includes(searchTerm) ||
            (store.location && store.location.toLowerCase().includes(searchTerm))
        );
    }
    
    renderStoresTable(filtered);
}

function renderStoresTable(stores) {
    const tbody = document.getElementById('storesTableBody');
    
    if (stores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">
                    <div class="empty-state">
                        <div class="empty-icon">🏪</div>
                        <div class="empty-text">No stores found</div>
                        <button class="btn-primary" onclick="openAddStoreModal()">Add First Store</button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = stores.map(store => `
        <tr data-store-id="${store.id}">
            <td><strong>${escapeHtml(store.store_code)}</strong></td>
            <td>${escapeHtml(store.store_name)}</td>
            <td>${escapeHtml(store.location || '-')}</td>
            <td>
                <span class="badge ${store.is_active ? 'badge-success' : 'badge-inactive'}">
                    ${store.is_active ? '✓ Active' : '✗ Inactive'}
                </span>
            </td>
            <td>${formatDate(store.created_at)}</td>
            <td class="actions-cell">
                <button class="btn-small btn-primary" onclick="openEditStoreModal(${store.id})" title="Edit">
                    ✏️ Edit
                </button>
                <button 
                    class="btn-small ${store.is_active ? 'btn-warning' : 'btn-success'}" 
                    onclick="toggleStoreStatus(${store.id}, ${!store.is_active}, '${escapeHtml(store.store_name)}')"
                    title="${store.is_active ? 'Deactivate' : 'Activate'}"
                >
                    ${store.is_active ? '🔒 Deactivate' : '✓ Activate'}
                </button>
            </td>
        </tr>
    `).join('');
}

// ===========================
// Modal Management
// ===========================
function openAddStoreModal() {
    currentEditingStoreId = null;
    document.getElementById('modalTitle').textContent = 'Add New Store';
    document.getElementById('storeForm').reset();
    document.getElementById('storeId').value = '';
    document.getElementById('storeCode').disabled = false;
    document.getElementById('storeModal').classList.add('show');
}

function openEditStoreModal(storeId) {
    const store = allStores.find(s => s.id === storeId);
    if (!store) return;
    
    currentEditingStoreId = storeId;
    document.getElementById('modalTitle').textContent = 'Edit Store';
    document.getElementById('storeId').value = store.id;
    document.getElementById('storeCode').value = store.store_code;
    document.getElementById('storeCode').disabled = true; // Don't allow changing store code
    document.getElementById('storeName').value = store.store_name;
    document.getElementById('storeLocation').value = store.location || '';
    document.getElementById('storeModal').classList.add('show');
}

function closeStoreModal() {
    document.getElementById('storeModal').classList.remove('show');
    document.getElementById('storeForm').reset();
    currentEditingStoreId = null;
}

async function handleStoreSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const storeData = {
        store_code: formData.get('store_code'),
        store_name: formData.get('store_name'),
        location: formData.get('location')
    };
    
    try {
        if (currentEditingStoreId) {
            await updateStore(currentEditingStoreId, storeData);
        } else {
            await createStore(storeData);
        }
        
        closeStoreModal();
        loadStores();
        
    } catch (error) {
        showError(currentEditingStoreId ? 'Failed to update store' : 'Failed to create store');
    }
}

// ===========================
// Utilities
// ===========================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showSuccess(message) {
    alert(`✅ ${message}`);
}

function showError(message) {
    alert(`❌ ${message}`);
}
