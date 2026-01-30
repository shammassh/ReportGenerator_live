/**
 * Dashboard Filter Service
 * Role-based filtering logic for dashboard reports
 * 
 * Roles:
 * - Admin: All stores, all reports, can generate
 * - Auditor: All stores, all reports, can generate
 * - StoreManager: Assigned stores only, view only
 * - CleaningHead: All stores, cleaning reports only, view only
 * - ProcurementHead: All stores, procurement reports only, view only
 * - MaintenanceHead: All stores, maintenance reports only, view only
 */

const sql = require('mssql');
const config = require('../../config/default');

class DashboardFilterService {
    /**
     * Filter reports based on user role and permissions
     * @param {Array} reports - All available reports
     * @param {Object} user - User object with role and assignments
     * @returns {Array} Filtered reports
     */
    static filterReportsByRole(reports, user) {
        if (!user || !user.role) {
            return [];
        }

        const role = user.role;

        // Admin and Auditor see everything
        if (role === 'Admin' || role === 'Auditor') {
            return reports;
        }

        // StoreManager sees only assigned stores
        if (role === 'StoreManager') {
            return this.filterByStores(reports, user.assigned_stores);
        }

        // Department Heads see all stores but different report types
        if (role === 'CleaningHead' || role === 'ProcurementHead' || role === 'MaintenanceHead') {
            // For department heads, we don't filter by store
            // They see all reports, but the client will show only department-specific buttons
            return reports;
        }

        // Unknown role or Pending users see nothing
        return [];
    }

    /**
     * Filter reports by store assignments
     * @param {Array} reports - All reports
     * @param {string|null} assignedStores - Comma-separated store names or null
     * @returns {Array} Filtered reports
     */
    static filterByStores(reports, assignedStores) {
        if (!assignedStores) {
            return [];
        }

        // Parse assigned stores - could be string or array
        let storeList;
        if (Array.isArray(assignedStores)) {
            storeList = assignedStores.map(s => s.trim().toUpperCase());
        } else {
            // Format: "GMRL Reef Mall,GMRL Discovery Gardens"
            storeList = assignedStores.split(',').map(s => s.trim().toUpperCase());
        }

        return reports.filter(report => {
            const storeName = (report.storeName || report.Title || '').toUpperCase();
            return storeList.some(assignedStore => 
                storeName.includes(assignedStore) || assignedStore.includes(storeName)
            );
        });
    }

    /**
     * Check if user can generate reports
     * @param {Object} user - User object with role
     * @returns {boolean} True if user can generate reports
     */
    static canGenerateReports(user) {
        if (!user || !user.role) {
            return false;
        }
        return user.role === 'Admin' || user.role === 'Auditor';
    }

    /**
     * Check if user can view a specific report type
     * @param {Object} user - User object with role and assigned_department
     * @param {string} reportType - Type of report ('main', 'action-plan', 'department')
     * @param {string} department - Department name (for department reports)
     * @returns {boolean} True if user can view this report type
     */
    static canViewReport(user, reportType, department = null) {
        if (!user || !user.role) {
            return false;
        }

        const role = user.role;

        // Admin and Auditor can view everything
        if (role === 'Admin' || role === 'Auditor') {
            return true;
        }

        // StoreManager can view main and action plan reports
        if (role === 'StoreManager') {
            return reportType === 'main' || reportType === 'action-plan';
        }

        // Department Heads can view their department reports only
        if (reportType === 'department' && department) {
            if (role === 'CleaningHead' && department === 'Cleaning') return true;
            if (role === 'ProcurementHead' && department === 'Procurement') return true;
            if (role === 'MaintenanceHead' && department === 'Maintenance') return true;
        }

        return false;
    }

    /**
     * Get accessible stores for a user
     * @param {Object} user - User object
     * @returns {Array} Array of store names
     */
    static getAccessibleStores(user) {
        if (!user || !user.role) {
            return [];
        }

        // Admin and Auditor see all stores
        if (user.role === 'Admin' || user.role === 'Auditor') {
            return ['ALL']; // Special marker for all stores
        }

        // StoreManager sees assigned stores only
        if (user.role === 'StoreManager') {
            if (Array.isArray(user.assignedStores)) {
                return user.assignedStores;
            }
            if (user.assignedStores && typeof user.assignedStores === 'string') {
                return user.assignedStores.split(',').map(s => s.trim());
            }
            return [];
        }

        // Department Heads see all stores
        if (user.role === 'CleaningHead' || user.role === 'ProcurementHead' || user.role === 'MaintenanceHead') {
            return ['ALL'];
        }

        return [];
    }

    /**
     * Get user's accessible department (for department heads)
     * @param {Object} user - User object
     * @returns {string|null} Department name or null
     */
    static getAccessibleDepartment(user) {
        if (!user || !user.role) {
            return null;
        }

        const roleMapping = {
            'CleaningHead': 'Cleaning',
            'ProcurementHead': 'Procurement',
            'MaintenanceHead': 'Maintenance'
        };

        return roleMapping[user.role] || null;
    }

    /**
     * Check if user can access admin panel
     * @param {Object} user - User object
     * @returns {boolean} True if user can access admin panel
     */
    static canAccessAdminPanel(user) {
        return user && user.role === 'Admin';
    }

    /**
     * Check if user can access auditor selection page
     * @param {Object} user - User object
     * @returns {boolean} True if user can access auditor selection
     */
    static canAccessAuditorSelection(user) {
        return user && user.role === 'Auditor';
    }

    /**
     * Get user permissions summary
     * @param {Object} user - User object
     * @returns {Object} Permissions object
     */
    static getUserPermissions(user) {
        if (!user || !user.role) {
            return {
                canGenerate: false,
                canViewMain: false,
                canViewActionPlan: false,
                canViewDepartment: false,
                canAccessAdmin: false,
                canAccessAuditorSelection: false,
                accessibleStores: [],
                accessibleDepartment: null,
                role: 'None'
            };
        }

        return {
            canGenerate: this.canGenerateReports(user),
            canViewMain: this.canViewReport(user, 'main'),
            canViewActionPlan: this.canViewReport(user, 'action-plan'),
            canViewDepartment: this.canViewReport(user, 'department', this.getAccessibleDepartment(user)),
            canAccessAdmin: this.canAccessAdminPanel(user),
            canAccessAuditorSelection: this.canAccessAuditorSelection(user),
            accessibleStores: this.getAccessibleStores(user),
            accessibleDepartment: this.getAccessibleDepartment(user),
            role: user.role,
            email: user.email,
            name: user.displayName || user.email
        };
    }
}

module.exports = DashboardFilterService;
