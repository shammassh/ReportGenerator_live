/**
 * Edit User Modal Component
 * Modal popup for editing user roles, stores, and departments
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

/**
 * Open the edit user modal
 */
window.openEditUserModal = async function(user) {
    try {
        const modal = document.getElementById('editUserModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalTitle || !modalBody) {
            throw new Error('Modal elements not found in DOM');
        }
        
        modalTitle.textContent = `Edit User: ${user.display_name || user.email}`;
        
        // Render modal content
        modalBody.innerHTML = `
            <form id="editUserForm" onsubmit="handleSubmitEditUser(event, ${user.id})">
                <!-- User Info -->
                <div class="form-section">
                    <h3>User Information</h3>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="text" value="${escapeHtml(user.email)}" disabled class="form-control-disabled">
                    </div>
                    <div class="form-group">
                        <label>Display Name</label>
                        <input type="text" value="${escapeHtml(user.display_name || '')}" disabled class="form-control-disabled">
                    </div>
                    <div class="form-group">
                        <label>Department (from Microsoft)</label>
                        <input type="text" value="${escapeHtml(user.department || '')}" disabled class="form-control-disabled">
                    </div>
                </div>

                <!-- Role Assignment -->
                <div class="form-section">
                    <h3>Role Assignment</h3>
                    <div class="form-group">
                        <label for="userRole">Role *</label>
                        <select id="userRole" name="role" class="form-control" required onchange="handleRoleChange()">
                            <option value="Pending" ${user.role === 'Pending' ? 'selected' : ''}>Pending Approval</option>
                            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                            <option value="SuperAuditor" ${user.role === 'SuperAuditor' ? 'selected' : ''}>Super Auditor</option>
                            <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                            <option value="HeadOfOperations" ${user.role === 'HeadOfOperations' ? 'selected' : ''}>Head of Operations</option>
                            <option value="AreaManager" ${user.role === 'AreaManager' ? 'selected' : ''}>Area Manager</option>
                            <option value="StoreManager" ${user.role === 'StoreManager' ? 'selected' : ''}>Store Manager</option>
                            <option value="CleaningHead" ${user.role === 'CleaningHead' ? 'selected' : ''}>Cleaning Head</option>
                            <option value="ProcurementHead" ${user.role === 'ProcurementHead' ? 'selected' : ''}>Procurement Head</option>
                            <option value="MaintenanceHead" ${user.role === 'MaintenanceHead' ? 'selected' : ''}>Maintenance Head</option>
                        </select>
                        <small class="form-hint">Assign appropriate role based on user's responsibilities</small>
                    </div>
                </div>

                <!-- Brand Assignment (for HeadOfOperations) -->
                <div class="form-section" id="brandAssignmentSection" style="display: ${user.role === 'HeadOfOperations' ? 'block' : 'none'};">
                    <h3>Brand Assignment</h3>
                    <div class="form-group">
                        <label>Assigned Brands *</label>
                        <div id="brandCheckboxes" class="checkbox-group">
                            <p class="loading-text">Loading brands...</p>
                        </div>
                        <small class="form-hint">Head of Operations can view all stores for selected brands</small>
                    </div>
                </div>

                <!-- Area Store Assignment (for AreaManager) -->
                <div class="form-section" id="areaAssignmentSection" style="display: ${user.role === 'AreaManager' ? 'block' : 'none'};">
                    <h3>Area Manager Assignment</h3>
                    <div class="form-group">
                        <label>Filter by Brand</label>
                        <select id="areaBrandFilter" class="form-control" onchange="filterAreaStoresByBrand()">
                            <option value="">All Brands</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Assigned Stores *</label>
                        <div id="areaStoreCheckboxes" class="checkbox-group" style="max-height: 300px; overflow-y: auto;">
                            <p class="loading-text">Loading stores...</p>
                        </div>
                        <small class="form-hint">Area managers can view audits for selected stores (read-only access)</small>
                    </div>
                </div>

                <!-- Store Assignment (only for StoreManager) -->
                <div class="form-section" id="storeAssignmentSection" style="display: ${user.role === 'StoreManager' ? 'block' : 'none'};">
                    <h3>Store Assignment</h3>
                    <div class="form-group">
                        <label for="assignedStores">Assigned Stores *</label>
                        <div id="storeCheckboxes" class="checkbox-group">
                            <p class="loading-text">Loading stores...</p>
                        </div>
                        <small class="form-hint">Store managers can only access their assigned stores</small>
                    </div>
                </div>

                <!-- Department Assignment (only for Department Heads) -->
                <div class="form-section" id="departmentAssignmentSection" style="display: ${['CleaningHead', 'ProcurementHead', 'MaintenanceHead'].includes(user.role) ? 'block' : 'none'};">
                    <h3>Department Assignment</h3>
                    <div class="form-group">
                        <label for="assignedDepartment">Assigned Department *</label>
                        <select id="assignedDepartment" name="assigned_department" class="form-control">
                            <option value="">Select Department</option>
                            <option value="Cleaning" ${user.assigned_department === 'Cleaning' ? 'selected' : ''}>Cleaning</option>
                            <option value="Procurement" ${user.assigned_department === 'Procurement' ? 'selected' : ''}>Procurement</option>
                            <option value="Maintenance" ${user.assigned_department === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                        </select>
                        <small class="form-hint">Department heads see department-specific reports</small>
                    </div>
                </div>

                <!-- Approval Status -->
                <div class="form-section">
                    <h3>Account Status</h3>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="isApproved" name="is_approved" ${user.is_approved ? 'checked' : ''}>
                            <span>Account Approved</span>
                        </label>
                        <small class="form-hint">User must be approved to access the system</small>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="isActive" name="is_active" ${user.is_active ? 'checked' : ''}>
                            <span>Account Active</span>
                        </label>
                        <small class="form-hint">Inactive accounts cannot log in</small>
                    </div>
                </div>

                <!-- Form Actions -->
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn-primary">💾 Save Changes</button>
                </div>
            </form>
        `;
        
        // Load stores list for checkbox selection
        await loadStoresForModal(user);
        
        // Load brands for HeadOfOperations
        await loadBrandsForModal(user);
        
        // Show modal
        modal.classList.add('show');
        
    } catch (error) {
        console.error('Error opening edit user modal:', error);
        alert('Failed to open edit dialog: ' + error.message);
    }
};

/**
 * Load stores list for checkbox selection
 */
async function loadStoresForModal(user) {
    try {
        const response = await fetch('/api/admin/stores');
        if (!response.ok) {
            throw new Error('Failed to fetch stores');
        }
        
        const data = await response.json();
        const stores = data.stores || [];
        
        // Parse user's assigned stores (stored as JSON array of store_codes)
        const userStores = user.assigned_stores 
            ? (typeof user.assigned_stores === 'string' ? JSON.parse(user.assigned_stores) : user.assigned_stores)
            : [];
        
        const storeCheckboxes = document.getElementById('storeCheckboxes');
        
        if (stores.length === 0) {
            storeCheckboxes.innerHTML = '<p class="form-hint">No stores available. Please add stores in Store Management.</p>';
            return;
        }
        
        storeCheckboxes.innerHTML = stores.map((store, index) => `
            <label class="checkbox-label store-checkbox">
                <input 
                    type="checkbox" 
                    name="assigned_stores" 
                    value="${escapeHtml(store.store_code)}"
                    ${userStores.includes(store.store_code) ? 'checked' : ''}
                    id="store_${index}"
                >
                <span><strong>${escapeHtml(store.store_code)}</strong> - ${escapeHtml(store.store_name)}</span>
                ${store.location ? `<small style="color:#666; margin-left:0.5rem;">(${escapeHtml(store.location)})</small>` : ''}
            </label>
        `).join('');
        
    } catch (error) {
        console.error('Error loading stores:', error);
        const storeCheckboxes = document.getElementById('storeCheckboxes');
        if (storeCheckboxes) {
            storeCheckboxes.innerHTML = '<p class="form-hint text-error">Failed to load stores</p>';
        }
    }
}

/**
 * Load brands dynamically for HeadOfOperations and AreaManager
 */
async function loadBrandsForModal(user) {
    try {
        const response = await fetch('/api/brands');
        if (!response.ok) {
            throw new Error('Failed to fetch brands');
        }
        
        const data = await response.json();
        const brands = data.data || [];
        
        // Store brands globally for other functions
        window._modalBrands = brands;
        
        // Parse user's assigned brands
        const userBrands = user.assigned_brands || [];
        
        // Update brand checkboxes
        const brandCheckboxes = document.getElementById('brandCheckboxes');
        if (brandCheckboxes) {
            if (brands.length === 0) {
                brandCheckboxes.innerHTML = '<p class="form-hint">No brands available. Please add brands in System Settings.</p>';
            } else {
                brandCheckboxes.innerHTML = brands.map(brand => `
                    <label class="checkbox-label">
                        <input type="checkbox" name="assigned_brands" value="${escapeHtml(brand.BrandName)}" 
                            ${userBrands.includes(brand.BrandName) ? 'checked' : ''}>
                        <span>${brand.BrandIcon || '🏬'} ${escapeHtml(brand.BrandName)}</span>
                        <small style="color:#666; margin-left:0.5rem;">(${brand.StoreCount || 0} stores)</small>
                    </label>
                `).join('');
            }
        }
        
        // Update area brand filter dropdown
        const areaBrandFilter = document.getElementById('areaBrandFilter');
        if (areaBrandFilter) {
            areaBrandFilter.innerHTML = '<option value="">All Brands</option>' + 
                brands.map(brand => `
                    <option value="${escapeHtml(brand.BrandName)}">${brand.BrandIcon || '🏬'} ${escapeHtml(brand.BrandName)}</option>
                `).join('');
        }
        
    } catch (error) {
        console.error('Error loading brands:', error);
        const brandCheckboxes = document.getElementById('brandCheckboxes');
        if (brandCheckboxes) {
            brandCheckboxes.innerHTML = '<p class="form-hint text-error">Failed to load brands</p>';
        }
    }
}

/**
 * Handle role change (show/hide relevant sections)
 */
window.handleRoleChange = function() {
    const role = document.getElementById('userRole').value;
    
    // Show/hide store assignment (for StoreManager)
    const storeSection = document.getElementById('storeAssignmentSection');
    storeSection.style.display = role === 'StoreManager' ? 'block' : 'none';
    
    // Show/hide brand assignment (for HeadOfOperations)
    const brandSection = document.getElementById('brandAssignmentSection');
    if (brandSection) {
        brandSection.style.display = role === 'HeadOfOperations' ? 'block' : 'none';
    }
    
    // Show/hide area assignment (for AreaManager)
    const areaSection = document.getElementById('areaAssignmentSection');
    if (areaSection) {
        areaSection.style.display = role === 'AreaManager' ? 'block' : 'none';
        if (role === 'AreaManager') {
            loadAreaStoresForModal();
        }
    }
    
    // Show/hide department assignment
    const deptSection = document.getElementById('departmentAssignmentSection');
    const isDeptHead = ['CleaningHead', 'ProcurementHead', 'MaintenanceHead'].includes(role);
    deptSection.style.display = isDeptHead ? 'block' : 'none';
    
    // Auto-select department based on role
    if (isDeptHead) {
        const deptSelect = document.getElementById('assignedDepartment');
        if (role === 'CleaningHead') deptSelect.value = 'Cleaning';
        if (role === 'ProcurementHead') deptSelect.value = 'Procurement';
        if (role === 'MaintenanceHead') deptSelect.value = 'Maintenance';
    }
};

/**
 * Load stores for area manager assignment
 */
async function loadAreaStoresForModal(brandFilter = '') {
    try {
        const response = await fetch('/api/admin/stores');
        if (!response.ok) {
            throw new Error('Failed to fetch stores');
        }
        
        const data = await response.json();
        let stores = data.stores || [];
        
        // Store all stores for filtering
        window.allAreaStores = stores;
        
        // Apply brand filter if specified
        if (brandFilter) {
            stores = stores.filter(s => s.brand === brandFilter);
        }
        
        // Get current user's area assignments
        const areaStoreCheckboxes = document.getElementById('areaStoreCheckboxes');
        
        if (stores.length === 0) {
            areaStoreCheckboxes.innerHTML = '<p class="form-hint">No stores available for selected brand.</p>';
            return;
        }
        
        // Parse current assigned area stores (will be populated from user data)
        const currentAreaStores = window.currentEditingUser?.assigned_area_stores || [];
        
        areaStoreCheckboxes.innerHTML = stores.map((store, index) => `
            <label class="checkbox-label store-checkbox" data-brand="${store.brand || ''}">
                <input 
                    type="checkbox" 
                    name="assigned_area_stores" 
                    value="${store.store_id}"
                    ${currentAreaStores.includes(store.store_id) ? 'checked' : ''}
                    id="area_store_${index}"
                >
                <span><strong>${escapeHtml(store.store_code)}</strong> - ${escapeHtml(store.store_name)}</span>
                <small style="color:#666; margin-left:4px;">(${store.brand || 'Unknown'})</small>
            </label>
        `).join('');
        
    } catch (error) {
        console.error('Error loading area stores:', error);
        const areaStoreCheckboxes = document.getElementById('areaStoreCheckboxes');
        if (areaStoreCheckboxes) {
            areaStoreCheckboxes.innerHTML = '<p class="form-hint text-error">Failed to load stores</p>';
        }
    }
}

/**
 * Filter area stores by brand
 */
window.filterAreaStoresByBrand = function() {
    const brandFilter = document.getElementById('areaBrandFilter').value;
    loadAreaStoresForModal(brandFilter);
};

/**
 * Handle form submission
 */
window.handleSubmitEditUser = async function(event, userId) {
    event.preventDefault();
    
    try {
        const form = event.target;
        const formData = new FormData(form);
        
        // Get selected stores (for StoreManager)
        const selectedStores = Array.from(form.querySelectorAll('input[name="assigned_stores"]:checked'))
            .map(cb => cb.value);
        
        // Get selected brands (for HeadOfOperations)
        const selectedBrands = Array.from(form.querySelectorAll('input[name="assigned_brands"]:checked'))
            .map(cb => cb.value);
        
        // Get selected area stores (for AreaManager)
        const selectedAreaStores = Array.from(form.querySelectorAll('input[name="assigned_area_stores"]:checked'))
            .map(cb => parseInt(cb.value));
        
        // Build update payload
        const updateData = {
            role: formData.get('role'),
            assigned_stores: selectedStores.length > 0 ? JSON.stringify(selectedStores) : null,
            assigned_brands: selectedBrands.length > 0 ? JSON.stringify(selectedBrands) : null,
            assigned_area_stores: selectedAreaStores.length > 0 ? JSON.stringify(selectedAreaStores) : null,
            assigned_department: formData.get('assigned_department') || null,
            is_approved: form.querySelector('#isApproved').checked,
            is_active: form.querySelector('#isActive').checked
        };
        
        // Validate store manager has stores
        if (updateData.role === 'StoreManager' && selectedStores.length === 0) {
            showToast('Store managers must have at least one assigned store', 'error');
            return;
        }
        
        // Validate HeadOfOperations has brands
        if (updateData.role === 'HeadOfOperations' && selectedBrands.length === 0) {
            showToast('Head of Operations must have at least one assigned brand', 'error');
            return;
        }
        
        // Validate AreaManager has stores
        if (updateData.role === 'AreaManager' && selectedAreaStores.length === 0) {
            showToast('Area Manager must have at least one assigned store', 'error');
            return;
        }
        
        // Validate department heads have department
        const isDeptHead = ['CleaningHead', 'ProcurementHead', 'MaintenanceHead'].includes(updateData.role);
        if (isDeptHead && !updateData.assigned_department) {
            showToast('Department heads must have an assigned department', 'error');
            return;
        }
        
        // Send update request
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update user');
        }
        
        showToast('User updated successfully', 'success');
        closeModal();
        await loadUsers(); // Reload users list
        
    } catch (error) {
        console.error('Error updating user:', error);
        showToast(error.message || 'Failed to update user', 'error');
    }
};

/**
 * Helper: Escape HTML (duplicate from main script for modal context)
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

// Add modal-specific styles
const style = document.createElement('style');
style.textContent = `
    .form-section {
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid #e0e0e0;
    }
    
    .form-section:last-of-type {
        border-bottom: none;
    }
    
    .form-section h3 {
        color: #2c3e50;
        margin-bottom: 20px;
        font-size: 1.2em;
    }
    
    .form-group {
        margin-bottom: 20px;
    }
    
    .form-group label {
        display: block;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 8px;
    }
    
    .form-control {
        width: 100%;
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 1em;
        transition: all 0.3s ease;
    }
    
    .form-control:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .form-control-disabled {
        width: 100%;
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        background: #f5f5f5;
        color: #7f8c8d;
        cursor: not-allowed;
    }
    
    .form-hint {
        display: block;
        color: #7f8c8d;
        font-size: 0.85em;
        margin-top: 5px;
    }
    
    .checkbox-group {
        max-height: 200px;
        overflow-y: auto;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
    }
    
    .checkbox-label {
        display: flex;
        align-items: center;
        padding: 8px 0;
        cursor: pointer;
        font-weight: normal;
    }
    
    .checkbox-label input[type="checkbox"] {
        margin-right: 10px;
        width: 18px;
        height: 18px;
        cursor: pointer;
    }
    
    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #e0e0e0;
    }
    
    .loading-text {
        color: #7f8c8d;
        font-style: italic;
    }
    
    .error-text {
        color: #e74c3c;
    }
`;
document.head.appendChild(style);
