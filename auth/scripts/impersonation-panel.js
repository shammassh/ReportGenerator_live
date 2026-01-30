/**
 * Impersonation Panel Component
 * A reusable UI component for role impersonation testing
 * 
 * Usage: Include this script in any page and call initImpersonationPanel()
 * 
 * Example:
 *   <script src="/auth/scripts/impersonation-panel.js"></script>
 *   <script>
 *     document.addEventListener('DOMContentLoaded', () => initImpersonationPanel());
 *   </script>
 */

// Global state
let impersonationState = {
    canImpersonate: false,
    active: false,
    currentRole: null,
    originalRole: null,
    availableRoles: [],
    sampleStores: [],
    sampleDepartments: []
};

/**
 * Initialize the impersonation panel
 */
async function initImpersonationPanel() {
    console.log('🎭 Initializing impersonation panel...');
    try {
        // Fetch impersonation status
        const response = await fetch('/api/impersonation', { credentials: 'same-origin' });
        const data = await response.json();
        
        console.log('🎭 Impersonation API response:', data);
        
        impersonationState = data;
        
        if (data.canImpersonate) {
            console.log('🎭 User can impersonate - creating panel');
            createImpersonationPanel();
        } else {
            console.log('🎭 User cannot impersonate (not Admin)');
        }
    } catch (error) {
        console.error('🎭 Failed to initialize impersonation panel:', error);
    }
}

/**
 * Create the impersonation panel UI
 */
function createImpersonationPanel() {
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .impersonation-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            color: white;
            border: none;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            transition: all 0.3s ease;
        }
        
        .impersonation-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
        }
        
        .impersonation-toggle.active {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); }
            50% { box-shadow: 0 4px 25px rgba(239, 68, 68, 0.6); }
        }
        
        .impersonation-panel {
            position: fixed;
            bottom: 90px;
            right: 20px;
            z-index: 9998;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            width: 350px;
            max-height: 500px;
            overflow-y: auto;
            display: none;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .impersonation-panel.visible {
            display: block;
        }
        
        .impersonation-panel-header {
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 16px 16px 0 0;
        }
        
        .impersonation-panel-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        
        .impersonation-panel-header p {
            margin: 5px 0 0;
            font-size: 12px;
            opacity: 0.9;
        }
        
        .impersonation-status {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 0;
        }
        
        .impersonation-status.active {
            background: #fee2e2;
            border-left-color: #ef4444;
        }
        
        .impersonation-status p {
            margin: 0;
            font-size: 13px;
            color: #92400e;
        }
        
        .impersonation-status.active p {
            color: #991b1b;
        }
        
        .impersonation-panel-body {
            padding: 16px 20px;
        }
        
        .role-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .role-btn {
            padding: 10px 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
        }
        
        .role-btn:hover {
            border-color: #8b5cf6;
            background: #f5f3ff;
        }
        
        .role-btn.selected {
            border-color: #8b5cf6;
            background: #f5f3ff;
        }
        
        .role-btn .role-name {
            font-weight: 600;
            font-size: 13px;
            color: #1f2937;
            margin-bottom: 2px;
        }
        
        .role-btn .role-desc {
            font-size: 10px;
            color: #6b7280;
            line-height: 1.3;
        }
        
        .options-section {
            margin-bottom: 16px;
        }
        
        .options-section label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 6px;
        }
        
        .options-section select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
        }
        
        .impersonation-actions {
            display: flex;
            gap: 8px;
        }
        
        .impersonation-actions button {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-impersonate {
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            color: white;
        }
        
        .btn-impersonate:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
        
        .btn-impersonate:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .btn-stop {
            background: #ef4444;
            color: white;
        }
        
        .btn-stop:hover {
            background: #dc2626;
        }
        
        .impersonation-badge {
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
            display: none;
        }
        
        .impersonation-badge.visible {
            display: flex;
            align-items: center;
            gap: 8px;
        }
    `;
    document.head.appendChild(style);
    
    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'impersonation-toggle' + (impersonationState.active ? ' active' : '');
    toggle.innerHTML = '🎭';
    toggle.title = 'Role Impersonation (Admin Testing)';
    toggle.onclick = togglePanel;
    document.body.appendChild(toggle);
    
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'impersonation-panel';
    panel.id = 'impersonationPanel';
    panel.innerHTML = generatePanelHTML();
    document.body.appendChild(panel);
    
    // Create badge for active impersonation
    const badge = document.createElement('div');
    badge.className = 'impersonation-badge' + (impersonationState.active ? ' visible' : '');
    badge.id = 'impersonationBadge';
    badge.innerHTML = `
        🎭 Impersonating: <strong>${impersonationState.currentRole || ''}</strong>
        <button id="badgeStopBtn" style="background:white; color:#dc2626; border:none; padding:2px 8px; border-radius:10px; cursor:pointer; font-size:11px; margin-left:5px;">Stop</button>
    `;
    document.body.appendChild(badge);
    
    // Add click handler for badge stop button
    const badgeStopBtn = document.getElementById('badgeStopBtn');
    if (badgeStopBtn) {
        badgeStopBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🎭 Badge stop button clicked');
            await stopImpersonation();
        });
    }
    
    // Attach event listeners to panel buttons
    attachPanelEventListeners();
}

/**
 * Generate panel HTML
 */
function generatePanelHTML() {
    const rolesHTML = impersonationState.availableRoles.map(r => `
        <button class="role-btn" data-role="${r.role}">
            <div class="role-name">${getRoleIcon(r.role)} ${r.role}</div>
            <div class="role-desc">${truncate(r.description, 50)}</div>
        </button>
    `).join('');
    
    const storesOptions = impersonationState.sampleStores.map(s => 
        `<option value="${s}">${s}</option>`
    ).join('');
    
    const deptOptions = impersonationState.sampleDepartments.map(d => 
        `<option value="${d}">${d}</option>`
    ).join('');
    
    // Brand options for HeadOfOperations
    const brands = ['Spinneys', 'Happy', 'GNG'];
    const brandCheckboxes = brands.map(b => 
        `<label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="checkbox" class="brand-checkbox" value="${b}" checked> ${b}
        </label>`
    ).join('');
    
    return `
        <div class="impersonation-panel-header">
            <h3>🎭 Role Impersonation</h3>
            <p>Test the app as different user roles</p>
        </div>
        
        ${impersonationState.active ? `
            <div class="impersonation-status active">
                <p>⚠️ Currently impersonating: <strong>${impersonationState.currentRole}</strong></p>
            </div>
        ` : `
            <div class="impersonation-status">
                <p>ℹ️ Click a role to impersonate instantly</p>
            </div>
        `}
        
        <div class="impersonation-panel-body">
            <div class="role-grid" id="roleGrid">
                ${rolesHTML}
            </div>
            
            <div class="options-section" id="storeOptions" style="display:none;">
                <label>Select Store, then click "Go"</label>
                <div style="display:flex; gap:8px;">
                    <select id="impersonateStore" style="flex:1;">
                        ${storesOptions}
                    </select>
                    <button id="goStoreBtn" class="btn-impersonate" style="flex:0; padding:8px 16px;">Go</button>
                </div>
            </div>
            
            <div class="options-section" id="brandOptions" style="display:none;">
                <label>Select Brands, then click "Go"</label>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                    ${brandCheckboxes}
                </div>
                <button id="goBrandBtn" class="btn-impersonate" style="padding:8px 16px;">Go as HeadOfOperations</button>
            </div>
            
            <div class="options-section" id="areaStoreOptions" style="display:none;">
                <label>Select Brand first:</label>
                <select id="impersonateAreaBrand" style="margin-bottom:8px; width:100%;" onchange="filterImpersonateStoresByBrand()">
                    <option value="">-- Select Brand --</option>
                    <option value="Spinneys">Spinneys</option>
                    <option value="Happy">Happy</option>
                    <option value="GNG">GNG</option>
                </select>
                <label>Then select Store:</label>
                <div style="display:flex; gap:8px;">
                    <select id="impersonateAreaStore" style="flex:1;">
                        <option value="">-- Select brand first --</option>
                    </select>
                    <button id="goAreaBtn" class="btn-impersonate" style="flex:0; padding:8px 16px;">Go</button>
                </div>
            </div>
            
            <div class="options-section" id="deptOptions" style="display:none;">
                <label>Department (for Dept Head)</label>
                <select id="impersonateDept">
                    ${deptOptions}
                </select>
            </div>
            
            ${impersonationState.active ? `
                <div class="impersonation-actions">
                    <button class="btn-stop" id="btnStopImpersonation">🚫 Stop Impersonation</button>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Attach event listeners after panel is created
 */
function attachPanelEventListeners() {
    // Role buttons - click to impersonate directly
    const roleGrid = document.getElementById('roleGrid');
    if (roleGrid) {
        roleGrid.addEventListener('click', async (e) => {
            const btn = e.target.closest('.role-btn');
            if (!btn) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const role = btn.dataset.role;
            console.log('🎭 Role button clicked:', role);
            
            // Hide all options first
            document.getElementById('storeOptions').style.display = 'none';
            document.getElementById('brandOptions').style.display = 'none';
            document.getElementById('areaStoreOptions').style.display = 'none';
            document.getElementById('deptOptions').style.display = 'none';
            
            // For StoreManager, show store selector first
            if (role === 'StoreManager') {
                selectedRole = role;
                document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('storeOptions').style.display = 'block';
                return;
            }
            
            // For HeadOfOperations, show brand selector
            if (role === 'HeadOfOperations') {
                selectedRole = role;
                document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('brandOptions').style.display = 'block';
                return;
            }
            
            // For AreaManager, show store selector
            if (role === 'AreaManager') {
                selectedRole = role;
                document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('areaStoreOptions').style.display = 'block';
                return;
            }
            
            // For department heads, go directly
            if (['Maintenance', 'Procurement', 'Cleaning'].includes(role)) {
                selectedRole = role;
                await startImpersonationDirect(role, null, role);
                return;
            }
            
            // For all other roles, impersonate directly
            await startImpersonationDirect(role);
        });
    }
    
    // Go button for HeadOfOperations (brands)
    const goBrandBtn = document.getElementById('goBrandBtn');
    if (goBrandBtn) {
        goBrandBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const checkedBrands = Array.from(document.querySelectorAll('.brand-checkbox:checked')).map(cb => cb.value);
            if (checkedBrands.length === 0) {
                alert('Please select at least one brand');
                return;
            }
            await startImpersonationWithBrands('HeadOfOperations', checkedBrands);
        });
    }
    
    // Go button for AreaManager
    const goAreaBtn = document.getElementById('goAreaBtn');
    if (goAreaBtn) {
        goAreaBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const store = document.getElementById('impersonateAreaStore').value;
            await startImpersonationDirect('AreaManager', [store]);
        });
    }
    
    // Go button for StoreManager
    const goStoreBtn = document.getElementById('goStoreBtn');
    if (goStoreBtn) {
        goStoreBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const store = document.getElementById('impersonateStore').value;
            await startImpersonationDirect('StoreManager', [store]);
        });
    }
    
    // Stop button
    const stopBtn = document.getElementById('btnStopImpersonation');
    if (stopBtn) {
        stopBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await stopImpersonation();
        });
    }
}

/**
 * Get role icon
 */
function getRoleIcon(role) {
    const icons = {
        'Admin': '👑',
        'Auditor': '📋',
        'SuperAuditor': '⭐',
        'StoreManager': '🏪',
        'HeadOfOperations': '🏢',
        'AreaManager': '📍',
        'Maintenance': '🔧',
        'Procurement': '📦',
        'Cleaning': '🧹',
        'Pending': '⏳'
    };
    return icons[role] || '👤';
}

/**
 * Filter impersonation stores by brand for AreaManager
 */
async function filterImpersonateStoresByBrand() {
    const brand = document.getElementById('impersonateAreaBrand').value;
    const storeSelect = document.getElementById('impersonateAreaStore');
    
    if (!brand) {
        storeSelect.innerHTML = '<option value="">-- Select brand first --</option>';
        return;
    }
    
    try {
        // Fetch stores with brand filter
        const response = await fetch('/api/admin/stores');
        const data = await response.json();
        const stores = (data.stores || []).filter(s => s.brand === brand);
        
        if (stores.length === 0) {
            storeSelect.innerHTML = '<option value="">No stores for this brand</option>';
            return;
        }
        
        storeSelect.innerHTML = stores.map(s => 
            `<option value="${s.store_code}">${s.store_code} - ${s.store_name}</option>`
        ).join('');
    } catch (error) {
        console.error('Error loading stores:', error);
        storeSelect.innerHTML = '<option value="">Error loading stores</option>';
    }
}

/**
 * Truncate text
 */
function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '...' : str;
}

/**
 * Toggle panel visibility
 */
function togglePanel() {
    const panel = document.getElementById('impersonationPanel');
    panel.classList.toggle('visible');
}

/**
 * Select a role
 */
let selectedRole = null;
function selectRole(role) {
    selectedRole = role;
    
    // Update button states
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.role === role);
    });
    
    // Show/hide options
    const storeOptions = document.getElementById('storeOptions');
    const deptOptions = document.getElementById('deptOptions');
    
    if (storeOptions) storeOptions.style.display = role === 'StoreManager' ? 'block' : 'none';
    if (deptOptions) deptOptions.style.display = ['Maintenance', 'Procurement', 'Cleaning'].includes(role) ? 'block' : 'none';
    
    // Update button
    const btn = document.getElementById('btnStartImpersonation');
    if (btn) {
        btn.disabled = false;
        btn.textContent = `🎭 Impersonate ${role}`;
    }
}

/**
 * Start impersonation directly with a role (one-click)
 */
async function startImpersonationDirect(role, assignedStores = null, assignedDepartment = null) {
    console.log('🎭 Starting impersonation directly:', role);
    
    // Show loading on all role buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
        if (btn.dataset.role === role) {
            btn.innerHTML = `<div class="role-name">⏳ Switching...</div>`;
            btn.style.pointerEvents = 'none';
        }
    });
    
    const body = { role };
    if (assignedStores) body.assignedStores = assignedStores;
    if (assignedDepartment) body.assignedDepartment = assignedDepartment;
    
    try {
        const response = await fetch('/api/impersonation/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        console.log('🎭 Start impersonation result:', result);
        
        if (result.success) {
            // Force reload with cache buster
            window.location.href = window.location.pathname + '?_=' + Date.now();
        } else {
            alert('Failed to start impersonation: ' + result.error);
            window.location.href = window.location.pathname + '?_=' + Date.now();
        }
    } catch (error) {
        console.error('Impersonation error:', error);
        alert('Failed to start impersonation: ' + error.message);
        window.location.href = window.location.pathname + '?_=' + Date.now();
    }
}

/**
 * Start impersonation with brands (for HeadOfOperations)
 */
async function startImpersonationWithBrands(role, assignedBrands) {
    console.log('🎭 Starting impersonation with brands:', role, assignedBrands);
    
    // Show loading
    const btn = document.getElementById('goBrandBtn');
    if (btn) {
        btn.innerHTML = '⏳ Switching...';
        btn.disabled = true;
    }
    
    try {
        const response = await fetch('/api/impersonation/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ role, assignedBrands })
        });
        
        const result = await response.json();
        console.log('🎭 Start impersonation result:', result);
        
        if (result.success) {
            window.location.href = window.location.pathname + '?_=' + Date.now();
        } else {
            alert('Failed to start impersonation: ' + result.error);
            window.location.href = window.location.pathname + '?_=' + Date.now();
        }
    } catch (error) {
        console.error('Impersonation error:', error);
        alert('Failed to start impersonation: ' + error.message);
        window.location.href = window.location.pathname + '?_=' + Date.now();
    }
}

/**
 * Start impersonation (legacy - kept for compatibility)
 */
async function startImpersonation() {
    if (!selectedRole) return;
    
    const storeSelect = document.getElementById('impersonateStore');
    const deptSelect = document.getElementById('impersonateDept');
    
    const body = {
        role: selectedRole
    };
    
    if (selectedRole === 'StoreManager' && storeSelect) {
        body.assignedStores = [storeSelect.value];
    }
    
    if (['Maintenance', 'Procurement', 'Cleaning'].includes(selectedRole)) {
        body.assignedDepartment = selectedRole;
    }
    
    // Disable button and show loading
    const btn = document.getElementById('btnStartImpersonation');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Switching...';
    }
    
    try {
        const response = await fetch('/api/impersonation/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        console.log('🎭 Start impersonation result:', result);
        
        if (result.success) {
            // Navigate to same page
            window.location.href = window.location.pathname;
        } else {
            alert('Failed to start impersonation: ' + result.error);
            if (btn) {
                btn.disabled = false;
                btn.textContent = `🎭 Impersonate ${selectedRole}`;
            }
        }
    } catch (error) {
        console.error('Impersonation error:', error);
        alert('Failed to start impersonation: ' + error.message);
        if (btn) {
            btn.disabled = false;
            btn.textContent = `🎭 Impersonate ${selectedRole}`;
        }
    }
}

/**
 * Force a hard reload bypassing cache
 */
function forceReload() {
    // Clear any cached data
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    
    // Force reload with true to bypass cache
    window.location.reload(true);
}

/**
 * Stop impersonation
 */
async function stopImpersonation() {
    console.log('🎭 stopImpersonation() called');
    try {
        const response = await fetch('/api/impersonation/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        console.log('🎭 Stop impersonation result:', result);
        
        if (result.success) {
            // Hide the badge immediately
            const badge = document.getElementById('impersonationBadge');
            if (badge) badge.style.display = 'none';
            
            // Force reload with cache buster
            window.location.href = window.location.pathname + '?_=' + Date.now();
        } else {
            alert('Failed to stop impersonation: ' + result.error);
        }
    } catch (error) {
        console.error('Stop impersonation error:', error);
        alert('Failed to stop impersonation: ' + error.message);
    }
}

// Make functions globally available
window.initImpersonationPanel = initImpersonationPanel;
window.stopImpersonation = stopImpersonation;
window.startImpersonation = startImpersonation;
window.startImpersonationDirect = startImpersonationDirect;
window.selectRole = selectRole;
window.togglePanel = togglePanel;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initImpersonationPanel };
}
