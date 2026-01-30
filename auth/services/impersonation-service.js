/**
 * Impersonation Service Module
 * Allows Admins to temporarily impersonate different roles for testing
 * 
 * This feature is for DEVELOPMENT/TESTING purposes only
 * Impersonation state is stored in a cookie, not in the database
 */

const ALLOWED_ROLES = ['Admin', 'Auditor', 'SuperAuditor', 'StoreManager', 'HeadOfOperations', 'AreaManager', 'Maintenance', 'Procurement', 'Cleaning', 'Pending'];

// Cache for stores list (5 minute cache)
let storesCache = null;
let storesCacheTime = 0;
const STORES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SAMPLE_DEPARTMENTS = ['Maintenance', 'Procurement', 'Cleaning'];

class ImpersonationService {
    /**
     * Check if user can impersonate other roles
     * Only Admins can impersonate
     */
    static canImpersonate(user) {
        return user && user.role === 'Admin';
    }

    /**
     * Get available roles for impersonation
     */
    static getAvailableRoles() {
        return ALLOWED_ROLES.map(role => ({
            role,
            description: this.getRoleDescription(role)
        }));
    }

    /**
     * Get role description
     */
    static getRoleDescription(role) {
        const descriptions = {
            'Admin': 'Full system access, user management, all features',
            'Auditor': 'Create audits, generate reports, manage action plans',
            'SuperAuditor': 'Template management + Auditor permissions',
            'StoreManager': 'View reports for assigned stores, action plan responses',
            'HeadOfOperations': 'View all audits for assigned brands (read-only)',
            'AreaManager': 'View audits for assigned stores (read-only)',
            'Maintenance': 'Department Head - Maintenance followup reports',
            'Procurement': 'Department Head - Procurement followup reports',
            'Cleaning': 'Department Head - Cleaning followup reports',
            'Pending': 'Awaiting approval - limited access'
        };
        return descriptions[role] || 'Unknown role';
    }
    
    /**
     * Get cached stores list
     */
    static getCachedStores() {
        if (storesCache && (Date.now() - storesCacheTime) < STORES_CACHE_TTL) {
            return storesCache;
        }
        return null;
    }
    
    /**
     * Set stores cache
     */
    static setCachedStores(stores) {
        storesCache = stores;
        storesCacheTime = Date.now();
    }

    /**
     * Start impersonation
     * @param {Object} originalUser - The admin user starting impersonation
     * @param {string} targetRole - The role to impersonate
     * @param {Object} options - Additional options (assignedStores, assignedDepartment)
     * @returns {Object} - Impersonation data to store
     */
    static startImpersonation(originalUser, targetRole, options = {}) {
        if (!this.canImpersonate(originalUser)) {
            throw new Error('Only Admins can impersonate other roles');
        }

        if (!ALLOWED_ROLES.includes(targetRole)) {
            throw new Error(`Invalid role: ${targetRole}. Allowed: ${ALLOWED_ROLES.join(', ')}`);
        }

        const impersonationData = {
            active: true,
            originalRole: originalUser.role,
            originalUserId: originalUser.id,
            originalEmail: originalUser.email,
            originalDisplayName: originalUser.displayName,
            targetRole: targetRole,
            assignedStores: options.assignedStores || (targetRole === 'StoreManager' ? [SAMPLE_STORES[0]] : []),
            assignedBrands: options.assignedBrands || [],
            assignedDepartment: options.assignedDepartment || (SAMPLE_DEPARTMENTS.includes(targetRole) ? targetRole : null),
            startedAt: new Date().toISOString()
        };

        console.log(`🎭 Impersonation started: ${originalUser.email} → ${targetRole}`);
        return impersonationData;
    }

    /**
     * Stop impersonation
     */
    static stopImpersonation(originalUser) {
        console.log(`🎭 Impersonation stopped for: ${originalUser.email}`);
        return null;
    }

    /**
     * Apply impersonation to user object
     * @param {Object} user - Original user object
     * @param {Object} impersonationData - Impersonation cookie data
     * @returns {Object} - Modified user object with impersonated role
     */
    static applyImpersonation(user, impersonationData) {
        if (!impersonationData || !impersonationData.active) {
            return user;
        }

        // Verify the impersonation was started by this user
        if (impersonationData.originalUserId !== user.id) {
            console.warn('⚠️ Impersonation mismatch - ignoring');
            return user;
        }

        // Create impersonated user object
        return {
            ...user,
            role: impersonationData.targetRole,
            assignedStores: impersonationData.assignedStores || user.assignedStores,
            assignedBrands: impersonationData.assignedBrands || [],
            assignedDepartment: impersonationData.assignedDepartment || user.assignedDepartment,
            _isImpersonating: true,
            _originalRole: impersonationData.originalRole,
            _originalEmail: impersonationData.originalEmail,
            _impersonationStartedAt: impersonationData.startedAt
        };
    }

    /**
     * Get sample stores for StoreManager impersonation
     */
    static getSampleStores() {
        return SAMPLE_STORES;
    }

    /**
     * Get sample departments for department head impersonation
     */
    static getSampleDepartments() {
        return SAMPLE_DEPARTMENTS;
    }
}

module.exports = ImpersonationService;
