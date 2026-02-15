/**
 * Role Authorization Middleware Module
 * Checks if user has required role(s)
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

/**
 * Require specific role(s) middleware
 * Must be used AFTER requireAuth middleware
 * 
 * Usage:
 *   app.get('/admin/users', requireAuth, requireRole('Admin'), (req, res) => { ... });
 *   app.get('/reports', requireAuth, requireRole('Admin', 'Auditor'), (req, res) => { ... });
 * 
 * @param {...string} allowedRoles - One or more roles that are allowed
 */
function requireRole(...allowedRoles) {
    return function(req, res, next) {
        // Check if user is authenticated (should be set by requireAuth middleware)
        if (!req.currentUser) {
            console.error('❌ requireRole called without requireAuth middleware');
            return res.status(500).send('Server configuration error');
        }
        
        const userRole = req.currentUser.role;
        
        // Check if user has one of the allowed roles
        if (allowedRoles.includes(userRole)) {
            console.log(`✅ Authorized: ${req.currentUser.email} has role ${userRole}`);
            return next();
        }
        
        // User does not have required role
        console.log(`❌ Access denied: ${req.currentUser.email} (${userRole}) tried to access ${req.path}`);
        console.log(`   Required roles: ${allowedRoles.join(', ')}`);
        
        // For API requests, return JSON
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                error: 'Access denied',
                message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
                userRole: userRole,
                requiredRoles: allowedRoles
            });
        }
        
        // For page requests, show access denied page
        return res.status(403).send(generateAccessDeniedHTML(userRole, allowedRoles));
    };
}

/**
 * Generate access denied HTML page
 */
function generateAccessDeniedHTML(userRole, requiredRoles) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .access-denied-container {
            background: white;
            border-radius: 20px;
            padding: 50px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .icon {
            font-size: 5em;
            margin-bottom: 20px;
        }
        h1 {
            color: #e74c3c;
            margin-bottom: 20px;
            font-size: 2.5em;
        }
        p {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 15px;
            line-height: 1.6;
        }
        .role-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
        }
        .role-info strong {
            color: #2c3e50;
        }
        .back-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.3s ease;
        }
        .back-btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="access-denied-container">
        <div class="icon">🚫</div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        
        <div class="role-info">
            <p><strong>Your Role:</strong> ${userRole}</p>
            <p><strong>Required Role(s):</strong> ${requiredRoles.join(', ')}</p>
        </div>
        
        <p>If you believe this is an error, please contact your administrator.</p>
        
        <a href="/dashboard" class="back-btn">← Back to Dashboard</a>
    </div>
</body>
</html>
    `;
}

/**
 * Dynamic role check middleware - reads allowed roles from MenuPermissions table
 * Falls back to provided roles if database check fails
 * 
 * Usage:
 *   app.get('/admin/store-management', requireAuth, requireDynamicRole('/admin/store-management', 'Admin', 'SuperAuditor'), handler);
 * 
 * @param {string} pageUrl - The URL path to check in MenuPermissions
 * @param {...string} fallbackRoles - Fallback roles if database check fails
 */
function requireDynamicRole(pageUrl, ...fallbackRoles) {
    return async function(req, res, next) {
        if (!req.currentUser) {
            console.error('❌ requireDynamicRole called without requireAuth middleware');
            return res.status(500).send('Server configuration error');
        }
        
        const userRole = req.currentUser.role;
        
        try {
            // Try to get allowed roles from database
            const sql = require('mssql');
            const pool = await sql.connect({
                server: process.env.SQL_SERVER,
                database: process.env.SQL_DATABASE,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                options: { encrypt: false, trustServerCertificate: true }
            });
            
            const result = await pool.request()
                .input('url', sql.NVarChar, pageUrl)
                .query(`SELECT AllowedRoles, IsEnabled FROM MenuPermissions WHERE Url = @url`);
            
            if (result.recordset.length > 0) {
                const button = result.recordset[0];
                
                // Check if button is disabled
                if (!button.IsEnabled) {
                    console.log(`❌ Page ${pageUrl} is disabled in MenuPermissions`);
                    return res.status(403).send(generateAccessDeniedHTML(userRole, ['Page disabled']));
                }
                
                // Check if user role is allowed
                const allowedRoles = button.AllowedRoles ? button.AllowedRoles.split(',') : [];
                if (allowedRoles.includes(userRole)) {
                    console.log(`✅ [Dynamic] Authorized: ${req.currentUser.email} (${userRole}) for ${pageUrl}`);
                    return next();
                }
                
                console.log(`❌ [Dynamic] Access denied: ${req.currentUser.email} (${userRole}) for ${pageUrl}`);
                console.log(`   Allowed roles from DB: ${allowedRoles.join(', ')}`);
                
                if (req.path.startsWith('/api/')) {
                    return res.status(403).json({
                        error: 'Access denied',
                        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
                        userRole: userRole,
                        requiredRoles: allowedRoles
                    });
                }
                return res.status(403).send(generateAccessDeniedHTML(userRole, allowedRoles));
            }
            
            // URL not found in database, fall back to hardcoded roles
            console.log(`⚠️ [Dynamic] URL ${pageUrl} not in MenuPermissions, using fallback roles`);
        } catch (error) {
            console.error('❌ [Dynamic] Database error, using fallback:', error.message);
        }
        
        // Fallback to hardcoded roles
        if (fallbackRoles.includes(userRole)) {
            console.log(`✅ [Fallback] Authorized: ${req.currentUser.email} (${userRole})`);
            return next();
        }
        
        console.log(`❌ [Fallback] Access denied: ${req.currentUser.email} (${userRole})`);
        
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                error: 'Access denied',
                message: `This action requires one of these roles: ${fallbackRoles.join(', ')}`,
                userRole: userRole,
                requiredRoles: fallbackRoles
            });
        }
        return res.status(403).send(generateAccessDeniedHTML(userRole, fallbackRoles));
    };
}

module.exports = requireRole;
module.exports.requireDynamicRole = requireDynamicRole;

/**
 * AUTO-DETECT Dynamic role middleware - automatically uses req.path to lookup permissions
 * No need to specify URL for each route!
 * 
 * Usage:
 *   app.get('/admin/system-settings', requireAuth, requireAutoRole('Admin', 'SuperAuditor'), handler);
 * 
 * The middleware will automatically use the request path to check MenuPermissions.
 * 
 * @param {...string} fallbackRoles - Fallback roles if URL not in database
 */
function requireAutoRole(...fallbackRoles) {
    return async function(req, res, next) {
        if (!req.currentUser) {
            console.error('❌ requireAutoRole called without requireAuth middleware');
            return res.status(500).send('Server configuration error');
        }
        
        const userRole = req.currentUser.role;
        const pageUrl = req.path; // Auto-detect from request
        
        try {
            const sql = require('mssql');
            const pool = await sql.connect({
                server: process.env.SQL_SERVER,
                database: process.env.SQL_DATABASE,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                options: { encrypt: false, trustServerCertificate: true }
            });
            
            const result = await pool.request()
                .input('url', sql.NVarChar, pageUrl)
                .query(`SELECT AllowedRoles, IsEnabled FROM MenuPermissions WHERE Url = @url`);
            
            if (result.recordset.length > 0) {
                const button = result.recordset[0];
                
                if (!button.IsEnabled) {
                    console.log(`❌ [Auto] Page ${pageUrl} is disabled`);
                    return res.status(403).send(generateAccessDeniedHTML(userRole, ['Page disabled']));
                }
                
                const allowedRoles = button.AllowedRoles ? button.AllowedRoles.split(',') : [];
                if (allowedRoles.includes(userRole)) {
                    console.log(`✅ [Auto] Authorized: ${req.currentUser.email} (${userRole}) for ${pageUrl}`);
                    return next();
                }
                
                console.log(`❌ [Auto] Denied: ${req.currentUser.email} (${userRole}) for ${pageUrl}`);
                
                if (req.path.startsWith('/api/')) {
                    return res.status(403).json({
                        error: 'Access denied',
                        message: `Requires: ${allowedRoles.join(', ')}`,
                        userRole, requiredRoles: allowedRoles
                    });
                }
                return res.status(403).send(generateAccessDeniedHTML(userRole, allowedRoles));
            }
            
            // URL not in database, use fallback
            console.log(`⚠️ [Auto] URL ${pageUrl} not in MenuPermissions, using fallback`);
        } catch (error) {
            console.error('❌ [Auto] DB error, using fallback:', error.message);
        }
        
        // Fallback to hardcoded roles
        if (fallbackRoles.includes(userRole)) {
            console.log(`✅ [Fallback] Authorized: ${req.currentUser.email} (${userRole})`);
            return next();
        }
        
        console.log(`❌ [Fallback] Denied: ${req.currentUser.email} (${userRole})`);
        
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                error: 'Access denied',
                message: `Requires: ${fallbackRoles.join(', ')}`,
                userRole, requiredRoles: fallbackRoles
            });
        }
        return res.status(403).send(generateAccessDeniedHTML(userRole, fallbackRoles));
    };
}

module.exports.requireAutoRole = requireAutoRole;

/**
 * Check API permission based on parent page URL
 * - GET requests: Check AllowedRoles (read access)
 * - POST/PUT/DELETE requests: Check EditRoles (write access)
 * 
 * Usage:
 *   app.get('/api/audit-templates/schemas', requireAuth, requirePagePermission('/admin/template-builder', 'Admin'), handler);
 * 
 * @param {string} pageUrl - The parent page URL to check in MenuPermissions
 * @param {...string} fallbackRoles - Fallback roles if URL not in database
 */
function requirePagePermission(pageUrl, ...fallbackRoles) {
    return async function(req, res, next) {
        if (!req.currentUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const userRole = req.currentUser.role;
        const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
        
        try {
            const sql = require('mssql');
            const pool = await sql.connect({
                server: process.env.SQL_SERVER,
                database: process.env.SQL_DATABASE,
                user: process.env.SQL_USER,
                password: process.env.SQL_PASSWORD,
                options: { encrypt: false, trustServerCertificate: true }
            });
            
            const result = await pool.request()
                .input('url', sql.NVarChar, pageUrl)
                .query(`SELECT AllowedRoles, EditRoles, IsEnabled FROM MenuPermissions WHERE Url = @url`);
            
            if (result.recordset.length > 0) {
                const button = result.recordset[0];
                
                if (!button.IsEnabled) {
                    return res.status(403).json({ error: 'Access denied', message: 'Feature disabled' });
                }
                
                const allowedRoles = button.AllowedRoles ? button.AllowedRoles.split(',') : [];
                const editRoles = button.EditRoles ? button.EditRoles.split(',') : [];
                
                // For write operations, check EditRoles
                if (isWriteOperation) {
                    // If EditRoles is empty, Admin can always edit (backward compatibility)
                    if (editRoles.length === 0) {
                        if (userRole === 'Admin') {
                            return next(); // Admin can always edit if no EditRoles specified
                        }
                        // Other roles can't edit if EditRoles is empty
                        console.log(`❌ [PagePerm] Write denied: ${req.currentUser.email} (${userRole}) - EditRoles not configured`);
                        return res.status(403).json({
                            error: 'Access denied',
                            message: 'Edit permission not configured for this page',
                            userRole,
                            readOnly: true
                        });
                    }
                    
                    // Check if user's role is in EditRoles
                    if (editRoles.includes(userRole)) {
                        return next();
                    }
                    
                    console.log(`❌ [PagePerm] Write denied: ${req.currentUser.email} (${userRole}) for ${req.method} ${req.path}`);
                    console.log(`   EditRoles: ${editRoles.join(', ')}`);
                    
                    return res.status(403).json({
                        error: 'Access denied',
                        message: `Edit requires: ${editRoles.join(', ')}`,
                        userRole,
                        readOnly: true
                    });
                }
                
                // For read operations, check AllowedRoles
                if (allowedRoles.includes(userRole)) {
                    return next();
                }
                
                return res.status(403).json({
                    error: 'Access denied',
                    message: `Requires: ${allowedRoles.join(', ')}`,
                    userRole
                });
            }
        } catch (error) {
            console.error('❌ [PagePerm] DB error:', error.message);
        }
        
        // Fallback to hardcoded roles
        if (fallbackRoles.includes(userRole)) {
            return next();
        }
        
        return res.status(403).json({
            error: 'Access denied',
            message: `Requires: ${fallbackRoles.join(', ')}`,
            userRole
        });
    };
}

module.exports.requirePagePermission = requirePagePermission;
