/**
 * Authentication & Authorization Middleware
 * Validates user sessions and checks for Admin/SuperAuditor roles
 * @module checklist/middleware/auth-check
 */

const SQLConnector = require('../../sql-connector');

/**
 * Middleware to check if user is authenticated
 */
async function requireAuth(req, res, next) {
  try {
    // Check if session exists
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Please log in to access this resource'
      });
    }

    // Attach user info to request
    req.user = {
      userId: req.session.userId,
      username: req.session.username,
      email: req.session.email
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error validating session'
    });
  }
}

/**
 * Middleware to check if user has Admin or SuperAuditor role
 */
async function requireChecklistAccess(req, res, next) {
  try {
    // First check authentication
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Please log in to access this resource'
      });
    }

    const userId = req.user.userId;
    
    // Check user role in database
    const connector = new SQLConnector();
    const pool = await connector.connect();
    
    const result = await pool.request()
      .input('UserID', userId)
      .query(`
        SELECT RoleName 
        FROM UserRoles 
        WHERE UserID = @UserID 
        AND RoleName IN ('Admin', 'SuperAuditor')
      `);

    if (result.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to manage checklists. Only Admin and SuperAuditor roles are allowed.'
      });
    }

    // Attach role to request
    req.user.role = result.recordset[0].RoleName;
    console.log(`User ${userId} authorized with role: ${req.user.role}`);

    next();
  } catch (error) {
    console.error('Authorization middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error validating permissions'
    });
  }
}

/**
 * Middleware to check if user has Admin role specifically
 */
async function requireAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Please log in to access this resource'
      });
    }

    const userId = req.user.userId;
    
    const connector = new SQLConnector();
    const pool = await connector.connect();
    
    const result = await pool.request()
      .input('UserID', userId)
      .query(`
        SELECT RoleName 
        FROM UserRoles 
        WHERE UserID = @UserID 
        AND RoleName = 'Admin'
      `);

    if (result.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'This action requires Admin role'
      });
    }

    req.user.role = 'Admin';
    console.log(`Admin user ${userId} authorized`);

    next();
  } catch (error) {
    console.error('Admin middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error validating admin permissions'
    });
  }
}

/**
 * Helper function to check if user has a specific role
 * @param {number} userId - User ID
 * @param {string} roleName - Role name to check
 * @returns {Promise<boolean>} True if user has the role
 */
async function hasRole(userId, roleName) {
  try {
    const connector = new SQLConnector();
    const pool = await connector.connect();
    
    const result = await pool.request()
      .input('UserID', userId)
      .input('RoleName', roleName)
      .query(`
        SELECT 1 
        FROM UserRoles 
        WHERE UserID = @UserID 
        AND RoleName = @RoleName
      `);

    return result.recordset.length > 0;
  } catch (error) {
    console.error('Error checking role:', error.message);
    return false;
  }
}

/**
 * Helper function to get all roles for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array<string>>} Array of role names
 */
async function getUserRoles(userId) {
  try {
    const connector = new SQLConnector();
    const pool = await connector.connect();
    
    const result = await pool.request()
      .input('UserID', userId)
      .query(`
        SELECT RoleName 
        FROM UserRoles 
        WHERE UserID = @UserID
      `);

    return result.recordset.map(row => row.RoleName);
  } catch (error) {
    console.error('Error fetching user roles:', error.message);
    return [];
  }
}

module.exports = {
  requireAuth,
  requireChecklistAccess,
  requireAdmin,
  hasRole,
  getUserRoles
};
