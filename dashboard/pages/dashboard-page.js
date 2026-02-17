/**
 * Dashboard Page Module
 * Serves the protected dashboard with user context
 */

const path = require('path');
const fs = require('fs').promises;
const DashboardFilterService = require('../services/dashboard-filter-service');

class DashboardPage {
    /**
     * Serve the dashboard page with user context
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async serveDashboard(req, res) {
        try {
            // Get user from session (added by requireAuth middleware)
            const user = req.currentUser;

            if (!user) {
                return res.redirect('/login');
            }

            // DEBUG: Log exactly what we're injecting into USER_CONTEXT
            console.log(`📊 [DASHBOARD] Serving dashboard to: ${user.email}`);
            console.log(`📊 [DASHBOARD] User role from req.currentUser: ${user.role}`);
            console.log(`📊 [DASHBOARD] isImpersonating: ${user._isImpersonating || false}`);

            // Get user permissions
            const permissions = DashboardFilterService.getUserPermissions(user);

            // Read the dashboard HTML file
            const dashboardPath = path.join(__dirname, '../../dashboard.html');
            let dashboardHtml = await fs.readFile(dashboardPath, 'utf8');

            // Inject user context and permissions into the page
            // We'll add a script tag with user data before the closing </head> tag
            const userContextScript = `
    <script>
        // User context injected server-side
        window.USER_CONTEXT = ${JSON.stringify({
            email: user.email,
            name: user.displayName || user.email,
            role: user.role,
            isImpersonating: user._isImpersonating || false,
            originalRole: user._originalRole || null,
            permissions: permissions
        })};
    </script>
    <!-- Dashboard Filter Client Script -->
    <script src="/dashboard/scripts/dashboard-filter.js"></script>
    <!-- User Context UI Component -->
    <script src="/dashboard/scripts/user-context.js"></script>
    <!-- Dashboard Styles -->
    <link rel="stylesheet" href="/dashboard/styles/dashboard.css">
`;

            // Insert before closing </head> tag
            dashboardHtml = dashboardHtml.replace('</head>', `${userContextScript}</head>`);

            // Send the modified HTML
            res.send(dashboardHtml);

        } catch (error) {
            console.error('❌ Error serving dashboard:', error);
            res.status(500).send('Error loading dashboard');
        }
    }

    /**
     * API endpoint to get filtered documents
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getFilteredDocuments(req, res) {
        try {
            const user = req.currentUser;

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // This endpoint would typically fetch documents from SharePoint
            // For now, we'll pass through to the existing /api/documents endpoint
            // but filter based on user role
            
            // The actual filtering will be done by the existing API
            // We're just adding role-based filtering on top
            res.json({ 
                message: 'Use existing /api/documents endpoint',
                user: {
                    email: user.email,
                    role: user.role,
                    permissions: DashboardFilterService.getUserPermissions(user)
                }
            });

        } catch (error) {
            console.error('❌ Error getting filtered documents:', error);
            res.status(500).json({ error: 'Error fetching documents' });
        }
    }
}

module.exports = DashboardPage;
