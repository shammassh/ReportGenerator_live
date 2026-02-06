/**
 * Token Refresh Service
 * Handles refreshing Azure AD access tokens when they expire
 */

const sql = require('mssql');
const config = require('../../config/default');

class TokenRefreshService {
    /**
     * Refresh an expired access token using the refresh token
     * @param {string} sessionToken - The session token
     * @param {string} refreshToken - The refresh token stored in the session
     * @returns {Promise<{accessToken: string, refreshToken: string}|null>}
     */
    static async refreshAccessToken(sessionToken, refreshToken) {
        if (!refreshToken) {
            console.log('❌ [TOKEN] No refresh token available');
            return null;
        }

        try {
            const clientId = process.env.AZURE_CLIENT_ID;
            const clientSecret = process.env.AZURE_CLIENT_SECRET;
            const tenantId = process.env.AZURE_TENANT_ID;

            const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                scope: 'User.Read User.ReadBasic.All Mail.Send offline_access'
            });

            console.log('🔄 [TOKEN] Attempting to refresh access token...');

            const response = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [TOKEN] Refresh failed:', response.status, errorText);
                return null;
            }

            const tokenData = await response.json();

            // Update the session with new tokens
            const pool = await sql.connect(config.database);
            await pool.request()
                .input('sessionToken', sql.NVarChar, sessionToken)
                .input('accessToken', sql.NVarChar, tokenData.access_token)
                .input('refreshToken', sql.NVarChar, tokenData.refresh_token || refreshToken)
                .query(`
                    UPDATE Sessions
                    SET azure_access_token = @accessToken,
                        azure_refresh_token = @refreshToken,
                        last_activity = GETDATE()
                    WHERE session_token = @sessionToken
                `);

            console.log('✅ [TOKEN] Access token refreshed successfully');

            return {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || refreshToken
            };

        } catch (error) {
            console.error('❌ [TOKEN] Error refreshing token:', error);
            return null;
        }
    }

    /**
     * Get a valid access token, refreshing if necessary
     * @param {string} sessionToken - The session token
     * @param {string} currentAccessToken - Current access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<string|null>} Valid access token or null
     */
    static async getValidAccessToken(sessionToken, currentAccessToken, refreshToken) {
        // First try the current token
        if (currentAccessToken) {
            const isValid = await this.isTokenValid(currentAccessToken);
            if (isValid) {
                return currentAccessToken;
            }
        }

        // Token is expired or invalid, try to refresh
        console.log('⏰ [TOKEN] Access token expired, attempting refresh...');
        const newTokens = await this.refreshAccessToken(sessionToken, refreshToken);
        
        if (newTokens) {
            return newTokens.accessToken;
        }

        return null;
    }

    /**
     * Check if an access token is still valid
     * @param {string} accessToken - The access token to check
     * @returns {Promise<boolean>}
     */
    static async isTokenValid(accessToken) {
        try {
            const response = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

module.exports = TokenRefreshService;
