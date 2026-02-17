/**
 * Session Manager Module
 * Handles user session management (24-hour expiration)
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const sql = require('mssql');
const crypto = require('crypto');
const config = require('../../config/default');

class SessionManager {
    /**
     * Create a new session for user
     * SECURITY: Only allow ONE session per user - delete all existing sessions first
     */
    static async createSession(userId, azureTokens) {
        const pool = await sql.connect(config.database);
        
        // SECURITY FIX: Delete ALL existing sessions for this user before creating new one
        // This prevents session confusion and token mixup
        const deleteResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM Sessions WHERE user_id = @userId');
        
        if (deleteResult.rowsAffected[0] > 0) {
            console.log(`🔒 [SESSION] Deleted ${deleteResult.rowsAffected[0]} old session(s) for user ${userId}`);
        }
        
        // Generate unique session token with userId embedded for guaranteed uniqueness
        const sessionToken = this.generateSessionToken(userId);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        console.log(`🔐 [SESSION] Creating new session for user ${userId}`);
        
        const result = await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .input('userId', sql.Int, userId)
            .input('accessToken', sql.NVarChar, azureTokens.accessToken)
            .input('refreshToken', sql.NVarChar, azureTokens.refreshToken || null)
            .input('expiresAt', sql.DateTime, expiresAt)
            .query(`
                INSERT INTO Sessions (
                    session_token, user_id, azure_access_token,
                    azure_refresh_token, expires_at
                )
                OUTPUT INSERTED.*
                VALUES (
                    @sessionToken, @userId, @accessToken,
                    @refreshToken, @expiresAt
                )
            `);
        
        console.log(`✅ Session created for user ${userId}, expires in 24 hours`);
        return result.recordset[0];
    }
    
    /**
     * Get session by token
     */
    static async getSession(sessionToken) {
        const pool = await sql.connect(config.database);
        
        const result = await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query(`
                SELECT 
                    s.id AS session_id,
                    s.session_token,
                    s.user_id,
                    s.azure_access_token,
                    s.azure_refresh_token,
                    s.expires_at,
                    s.created_at AS session_created_at,
                    s.last_activity,
                    u.id AS user_db_id,
                    u.azure_user_id,
                    u.email,
                    u.display_name,
                    u.photo_url,
                    u.job_title,
                    u.department,
                    u.role,
                    u.assigned_stores,
                    u.assigned_department,
                    u.is_active,
                    u.is_approved,
                    u.created_at AS user_created_at,
                    u.last_login
                FROM Sessions s
                INNER JOIN Users u ON s.user_id = u.id
                WHERE s.session_token = @sessionToken
                AND s.expires_at > GETDATE()
                AND u.is_active = 1
            `);
        
        return result.recordset[0] || null;
    }
    
    /**
     * Update session last activity
     */
    static async updateActivity(sessionToken) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query(`
                UPDATE Sessions
                SET last_activity = GETDATE()
                WHERE session_token = @sessionToken
            `);
    }
    
    /**
     * Delete session (logout)
     */
    static async deleteSession(sessionToken) {
        const pool = await sql.connect(config.database);
        
        await pool.request()
            .input('sessionToken', sql.NVarChar, sessionToken)
            .query('DELETE FROM Sessions WHERE session_token = @sessionToken');
        
        console.log('✅ Session deleted');
    }
    
    /**
     * Cleanup expired sessions
     */
    static async cleanupExpiredSessions() {
        const pool = await sql.connect(config.database);
        
        const result = await pool.request()
            .query('DELETE FROM Sessions WHERE expires_at < GETDATE()');
        
        const count = result.rowsAffected[0];
        if (count > 0) {
            console.log(`✅ Cleaned up ${count} expired session(s)`);
        }
        
        return count;
    }
    
    /**
     * Generate unique session token
     * Format: timestamp_userId_randomBytes to guarantee uniqueness
     * This ensures NO two sessions can ever have the same token
     */
    static generateSessionToken(userId) {
        const timestamp = Date.now().toString(36); // Base36 timestamp
        const random = crypto.randomBytes(24).toString('hex'); // 48 chars random
        return `${timestamp}_${userId}_${random}`;
    }
    
    /**
     * Validate session token format
     * Accepts both old format (64 hex chars) and new format (timestamp_userId_random)
     */
    static isValidTokenFormat(token) {
        if (typeof token !== 'string' || token.length < 20) {
            return false;
        }
        // Old format: 64 hex characters
        if (token.length === 64 && /^[0-9a-f]+$/.test(token)) {
            return true;
        }
        // New format: timestamp_userId_random (contains underscores)
        if (token.includes('_') && token.length >= 50) {
            return true;
        }
        return false;
    }
}
module.exports = SessionManager;