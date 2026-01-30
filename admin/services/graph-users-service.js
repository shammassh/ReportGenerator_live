/**
 * Microsoft Graph Users Service
 * Fetches users from Microsoft Graph API
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const SimpleGraphConnector = require('../../src/simple-graph-connector');
const fetch = globalThis.fetch || require('node-fetch');

class GraphUsersService {
    constructor() {
        this.graphConnector = null;
    }
    
    /**
     * Initialize Graph connector
     */
    async initialize() {
        if (!this.graphConnector) {
            this.graphConnector = new SimpleGraphConnector();
            await this.graphConnector.connectToSharePoint();
        }
    }
    
    /**
     * Get SharePoint-specific token (not Graph token)
     */
    async getSharePointToken() {
        const { clientId, clientSecret, tenantId, siteUrl } = this.graphConnector.config;
        
        console.log('[SHAREPOINT] Getting SharePoint REST API token...');
        
        const tokenUrl = `https://accounts.accesscontrol.windows.net/${tenantId}/tokens/OAuth/2`;
        const siteDomain = siteUrl.split('//')[1].split('/')[0];
        
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', `${clientId}@${tenantId}`);
        params.append('client_secret', clientSecret);
        params.append('resource', `00000003-0000-0ff1-ce00-000000000000/${siteDomain}@${tenantId}`);
        
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SharePoint token request failed: ${response.status} - ${errorText}`);
        }
        
        const tokenData = await response.json();
        console.log('✅ SharePoint REST API token obtained');
        return tokenData.access_token;
    }
    
    /**
     * Fetch all users from Microsoft Graph (with SharePoint fallback)
     */
    async getAllUsers() {
        try {
            await this.initialize();
            
            console.log('[GRAPH] Fetching all users from Microsoft Graph API...');
            
            // Try Microsoft Graph first
            try {
                const token = await this.graphConnector.getGraphToken();
                
                const response = await fetch('https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation&$top=999', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const users = data.value || [];
                    
                    console.log(`[GRAPH] Retrieved ${users.length} users from Microsoft Graph`);
                    
                    return users.map(user => ({
                        azure_user_id: user.id,
                        email: user.mail || user.userPrincipalName,
                        display_name: user.displayName,
                        department: user.department,
                        job_title: user.jobTitle,
                        office_location: user.officeLocation
                    }));
                }
                
                // If 403, fall through to SharePoint method
                console.log('⚠️ Graph API returned 403 - App needs User.Read.All permission');
                console.log('📋 Falling back to SharePoint Site Users...');
                
            } catch (graphError) {
                console.log('⚠️ Graph API failed, trying SharePoint Site Users...');
            }
            
            // Fallback: Get users from SharePoint Site Users
            return await this.getUsersFromSharePoint();
            
        } catch (error) {
            console.error('[GRAPH] Error fetching users:', error);
            throw new Error('Failed to fetch users from Microsoft Graph');
        }
    }
    
    /**
     * Fetch users from SharePoint Site Users (fallback method)
     */
    async getUsersFromSharePoint() {
        try {
            console.log('[SHAREPOINT] Fetching users from SharePoint Site Users...');
            
            // Get SharePoint-specific token (not Graph token)
            const token = await this.getSharePointToken();
            const siteUrl = this.graphConnector.config.siteUrl;
            
            // Fetch site users with correct OData format
            const response = await fetch(`${siteUrl}/_api/web/siteusers`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json;odata=verbose'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SHAREPOINT] Error response:', errorText);
                throw new Error(`SharePoint API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            const users = data.d?.results || [];
            
            console.log(`[SHAREPOINT] Retrieved ${users.length} site users from SharePoint`);
            
            // Filter out system accounts and groups, map to our format
            return users
                .filter(user => user.Email && user.Email.includes('@') && !user.Email.includes('#'))
                .map(user => ({
                    azure_user_id: user.Id.toString(),
                    email: user.Email,
                    display_name: user.Title || user.Email.split('@')[0],
                    department: null,
                    job_title: null,
                    office_location: null
                }));
            
        } catch (error) {
            console.error('[SHAREPOINT] Error fetching site users:', error);
            throw error;
        }
    }
    
    /**
     * Fetch a single user by email
     */
    async getUserByEmail(email) {
        try {
            await this.initialize();
            
            console.log(`[GRAPH] Fetching user: ${email}`);
            
            const response = await this.graphConnector.getGraphClient()
                .api(`/users/${email}`)
                .select('id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation')
                .get();
            
            return {
                azure_user_id: response.id,
                email: response.mail || response.userPrincipalName,
                display_name: response.displayName,
                department: response.department,
                job_title: response.jobTitle,
                office_location: response.officeLocation
            };
            
        } catch (error) {
            console.error(`[GRAPH] Error fetching user ${email}:`, error);
            throw new Error('Failed to fetch user from Microsoft Graph');
        }
    }
    
    /**
     * Search users by query
     */
    async searchUsers(query) {
        try {
            await this.initialize();
            
            console.log(`[GRAPH] Searching users: ${query}`);
            
            const response = await this.graphConnector.getGraphClient()
                .api('/users')
                .select('id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation')
                .filter(`startswith(displayName,'${query}') or startswith(mail,'${query}')`)
                .top(50)
                .get();
            
            const users = response.value || [];
            
            return users.map(user => ({
                azure_user_id: user.id,
                email: user.mail || user.userPrincipalName,
                display_name: user.displayName,
                department: user.department,
                job_title: user.jobTitle,
                office_location: user.officeLocation
            }));
            
        } catch (error) {
            console.error(`[GRAPH] Error searching users:`, error);
            throw new Error('Failed to search users in Microsoft Graph');
        }
    }
}

module.exports = GraphUsersService;
