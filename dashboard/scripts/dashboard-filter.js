/**
 * Dashboard Filter - Client Side
 * Role-based filtering and UI control logic
 */

(function() {
    'use strict';

    // Wait for user context to be available
    if (!window.USER_CONTEXT) {
        console.error('❌ User context not available');
        return;
    }

    const userContext = window.USER_CONTEXT;
    const permissions = userContext.permissions;

    console.log('🔐 Dashboard Filter initialized for:', userContext.name, 'Role:', userContext.role);

    /**
     * Filter documents based on user role
     * This function is called by the existing dashboard code
     */
    window.applyRoleBasedFiltering = function(documents) {
        if (!documents || !Array.isArray(documents)) {
            return [];
        }

        const role = userContext.role;

        // Admin and Auditor see everything
        if (role === 'Admin' || role === 'Auditor') {
            return documents;
        }

        // StoreManager sees only assigned stores
        if (role === 'StoreManager') {
            const assignedStores = permissions.accessibleStores || [];
            return documents.filter(doc => {
                const storeName = (doc.storeName || doc.Title || '').toUpperCase();
                return assignedStores.some(assigned => 
                    storeName.includes(assigned.toUpperCase()) || 
                    assigned.toUpperCase().includes(storeName)
                );
            });
        }

        // Department Heads see all documents (filtering happens at button level)
        if (role === 'CleaningHead' || role === 'ProcurementHead' || role === 'MaintenanceHead') {
            return documents;
        }

        // Unknown role
        return [];
    };

    /**
     * Apply UI controls based on user permissions
     */
    function applyUIControls() {
        // Hide/show generate buttons
        if (!permissions.canGenerate) {
            console.log('🔒 Hiding generate buttons for role:', userContext.role);
            hideGenerateButtons();
        }

        // Hide department buttons for non-department users
        if (!permissions.canViewDepartment) {
            console.log('🔒 Hiding department buttons for role:', userContext.role);
            hideDepartmentButtons();
        } else {
            // Show only the accessible department button
            showOnlyAccessibleDepartment();
        }

        // For Store Managers, hide PDF/DOC export buttons (they can only view)
        if (userContext.role === 'StoreManager') {
            console.log('🔒 Hiding export buttons for Store Manager');
            hideExportButtons();
        }
    }

    /**
     * Hide generate buttons (Generate Report and Action Plan)
     */
    function hideGenerateButtons() {
        const style = document.createElement('style');
        style.id = 'role-filter-style';
        style.textContent = `
            .btn-generate,
            .btn-action-plan {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Hide all department buttons
     */
    function hideDepartmentButtons() {
        const style = document.createElement('style');
        style.id = 'dept-filter-style';
        style.textContent = `
            .btn-dept {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show only the accessible department button
     */
    function showOnlyAccessibleDepartment() {
        const accessibleDept = permissions.accessibleDepartment;
        if (!accessibleDept) return;

        const style = document.createElement('style');
        style.id = 'dept-show-style';
        style.textContent = `
            /* Hide all department buttons first */
            .btn-dept {
                display: none !important;
            }
            /* Show only accessible department */
            .btn-dept.btn-${accessibleDept.toLowerCase()} {
                display: inline-block !important;
            }
        `;
        document.head.appendChild(style);

        console.log(`✅ Showing only ${accessibleDept} department button`);
    }

    /**
     * Hide PDF/DOC export buttons
     */
    function hideExportButtons() {
        const style = document.createElement('style');
        style.id = 'export-filter-style';
        style.textContent = `
            .btn-pdf,
            .btn-doc {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Override the existing loadDocuments function to add filtering
     */
    const originalDisplayDocuments = window.displayDocuments;
    if (originalDisplayDocuments) {
        window.displayDocuments = function(documents) {
            // Apply role-based filtering
            const filteredDocs = window.applyRoleBasedFiltering(documents);
            console.log(`📊 Filtered ${documents.length} documents to ${filteredDocs.length} for role: ${userContext.role}`);
            
            // Call original display function with filtered documents
            originalDisplayDocuments.call(this, filteredDocs);
        };
    }

    /**
     * Initialize UI controls when DOM is ready
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyUIControls);
        } else {
            applyUIControls();
        }
    }

    // Initialize
    init();

    // Export for debugging
    window.DashboardFilter = {
        userContext,
        permissions,
        applyRoleBasedFiltering: window.applyRoleBasedFiltering,
        applyUIControls
    };

})();
