/**
 * Auditor Selection Page Client-Side JavaScript
 * Handles store/checklist selection and audit initiation
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

// Global state
let stores = [];
let checklists = [];
let recentAudits = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setDefaultDate();
});

/**
 * Initialize page - load all data
 */
async function initializePage() {
    try {
        await Promise.all([
            loadStores(),
            loadChecklists(),
            loadRecentAudits(),
            loadStatistics()
        ]);
        
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing page:', error);
        showToast('Failed to load page data. Please refresh.', 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Form submission
    document.getElementById('auditSelectionForm').addEventListener('submit', handleFormSubmit);
    
    // Checklist selection - show preview
    document.getElementById('checklistSelect').addEventListener('change', handleChecklistChange);
}

/**
 * Set default audit date to today
 */
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('auditDate').value = today;
    
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('auditTime').value = time;
}

/**
 * Load stores from API
 */
async function loadStores() {
    try {
        const response = await fetch('/api/auditor/stores');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        stores = data.stores || [];
        
        // Populate store dropdown
        const storeSelect = document.getElementById('storeSelect');
        const hint = storeSelect.nextElementSibling;
        
        if (stores.length === 0) {
            hint.textContent = 'No stores found in audit documents';
            hint.style.color = '#e74c3c';
            return;
        }
        
        storeSelect.innerHTML = '<option value="">-- Select a store --</option>' +
            stores.map(store => `<option value="${escapeHtml(store)}">${escapeHtml(store)}</option>`).join('');
        
        hint.textContent = `${stores.length} stores available`;
        hint.style.color = '#27ae60';
        
    } catch (error) {
        console.error('Error loading stores:', error);
        const hint = document.getElementById('storeSelect').nextElementSibling;
        hint.textContent = 'Failed to load stores';
        hint.style.color = '#e74c3c';
    }
}

/**
 * Load checklists from API
 */
async function loadChecklists() {
    try {
        const response = await fetch('/api/auditor/checklists');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        checklists = data.checklists || [];
        
        // Populate checklist dropdown
        const checklistSelect = document.getElementById('checklistSelect');
        const hint = checklistSelect.nextElementSibling;
        
        if (checklists.length === 0) {
            hint.textContent = 'No checklists found in SharePoint';
            hint.style.color = '#e74c3c';
            return;
        }
        
        checklistSelect.innerHTML = '<option value="">-- Select a checklist --</option>' +
            checklists.map(checklist => 
                `<option value="${checklist.id}">${escapeHtml(checklist.name)}</option>`
            ).join('');
        
        hint.textContent = `${checklists.length} checklists available`;
        hint.style.color = '#27ae60';
        
    } catch (error) {
        console.error('Error loading checklists:', error);
        const hint = document.getElementById('checklistSelect').nextElementSibling;
        hint.textContent = 'Failed to load checklists';
        hint.style.color = '#e74c3c';
    }
}

/**
 * Handle checklist selection change - show preview
 */
function handleChecklistChange(event) {
    const checklistId = event.target.value;
    const preview = document.getElementById('checklistPreview');
    const details = document.getElementById('checklistDetails');
    
    if (!checklistId) {
        preview.style.display = 'none';
        return;
    }
    
    const checklist = checklists.find(c => c.id === checklistId);
    
    if (!checklist) {
        preview.style.display = 'none';
        return;
    }
    
    // Show checklist details
    details.innerHTML = `
        <div class="preview-item">
            <span>Type:</span>
            <strong>${escapeHtml(checklist.type || 'Standard Audit')}</strong>
        </div>
        <div class="preview-item">
            <span>Sections:</span>
            <strong>${checklist.sections || 'N/A'}</strong>
        </div>
        <div class="preview-item">
            <span>Total Questions:</span>
            <strong>${checklist.questionCount || 'N/A'}</strong>
        </div>
        <div class="preview-item">
            <span>Est. Duration:</span>
            <strong>${checklist.duration || '60-90 min'}</strong>
        </div>
    `;
    
    preview.style.display = 'block';
}

/**
 * Load recent audits
 */
async function loadRecentAudits() {
    try {
        const response = await fetch('/api/auditor/recent-audits');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        recentAudits = data.audits || [];
        
        renderRecentAudits();
        
    } catch (error) {
        console.error('Error loading recent audits:', error);
        document.getElementById('recentAuditsList').innerHTML = 
            '<div class="loading-text" style="color: #e74c3c;">Failed to load recent audits</div>';
    }
}

/**
 * Render recent audits list
 */
function renderRecentAudits() {
    const container = document.getElementById('recentAuditsList');
    
    if (recentAudits.length === 0) {
        container.innerHTML = '<div class="loading-text">No recent audits found</div>';
        return;
    }
    
    container.innerHTML = recentAudits.slice(0, 5).map(audit => `
        <div class="recent-item" onclick="viewAuditReport('${audit.documentNumber}')">
            <div class="recent-item-header">
                <span class="recent-item-store">${escapeHtml(audit.store || 'Unknown Store')}</span>
                <span class="recent-item-score">${audit.score || 'N/A'}%</span>
            </div>
            <div class="recent-item-date">${formatDate(audit.date)}</div>
        </div>
    `).join('');
}

/**
 * Load statistics
 */
async function loadStatistics() {
    try {
        const response = await fetch('/api/auditor/statistics');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        document.getElementById('totalAudits').textContent = data.totalAudits || '0';
        document.getElementById('completedAudits').textContent = data.completedAudits || '0';
        document.getElementById('avgScore').textContent = data.avgScore ? `${data.avgScore}%` : 'N/A';
        document.getElementById('totalStores').textContent = data.totalStores || '0';
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        // Leave as default '-'
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Validate
    const store = formData.get('store');
    const checklistId = formData.get('checklist');
    const auditDate = formData.get('auditDate');
    
    if (!store || !checklistId || !auditDate) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Get checklist details
    const checklist = checklists.find(c => c.id === checklistId);
    
    // Build audit data
    const auditData = {
        store: store,
        checklistId: checklistId,
        checklistName: checklist?.name || 'Unknown',
        auditDate: auditDate,
        auditTime: formData.get('auditTime') || null,
        notes: formData.get('notes') || null
    };
    
    // Show loading overlay
    showLoadingOverlay(true);
    
    try {
        // Start audit session
        const response = await fetch('/api/auditor/start-audit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(auditData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to start audit');
        }
        
        const result = await response.json();
        
        // Redirect to audit interface or report generation
        showToast('Audit started successfully!', 'success');
        
        setTimeout(() => {
            // TODO: Redirect to actual audit interface when built
            // For now, redirect to report generation
            window.location.href = `/generate-report?documentNumber=${result.documentNumber}`;
        }, 1000);
        
    } catch (error) {
        console.error('Error starting audit:', error);
        showToast(error.message || 'Failed to start audit', 'error');
        showLoadingOverlay(false);
    }
}

/**
 * View audit report (from recent audits)
 */
function viewAuditReport(documentNumber) {
    window.location.href = `/reports/${documentNumber}`;
}

/**
 * Helper: Format date
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown date';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
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
 * UI Helper: Show loading overlay
 */
function showLoadingOverlay(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
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
