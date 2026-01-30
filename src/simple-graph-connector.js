#!/usr/bin/env node

require('dotenv').config();

// Use native fetch if available (Node 18+), otherwise require node-fetch
const fetch = globalThis.fetch || require('node-fetch');

// Simple SharePoint GraphQL connector using app registration
class SimpleGraphQLConnector {
    constructor(config = {}) {
        this.config = {
            clientId: config.clientId || process.env.AZURE_CLIENT_ID,
            tenantId: config.tenantId || process.env.AZURE_TENANT_ID,
            clientSecret: config.clientSecret || process.env.AZURE_CLIENT_SECRET,
            siteUrl: config.siteUrl || process.env.SHAREPOINT_SITE_URL,
            ...config
        };
        
        this.accessToken = null;
        this.tokenExpiry = null;
        this.graphToken = null;  // Separate token for Microsoft Graph API
        this.graphTokenExpiry = null;  // Separate expiry for Graph token
        this.isConnected = false;
    }

    /**
     * Get OAuth2 access token for SharePoint
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        console.log('🔑 Getting access token for SharePoint...');
        
        const tokenUrl = `https://accounts.accesscontrol.windows.net/${this.config.tenantId}/tokens/OAuth/2`;
        
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', `${this.config.clientId}@${this.config.tenantId}`);
        params.append('client_secret', this.config.clientSecret);
        params.append('resource', `00000003-0000-0ff1-ce00-000000000000/${this.config.siteUrl.split('//')[1].split('/')[0]}@${this.config.tenantId}`);

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (!response.ok) {
                // Fallback to Microsoft Graph API token
                console.log('⚠️ SharePoint token failed, trying Graph API token...');
                return await this.getGraphToken();
            }

            const tokenData = await response.json();
            
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 300000; // 5 min buffer
            
            console.log('✅ SharePoint access token obtained');
            return this.accessToken;
        } catch (error) {
            console.log('⚠️ SharePoint token failed, trying Graph API token...');
            return await this.getGraphToken();
        }
    }

    /**
     * Get Microsoft Graph API token as fallback
     * Automatically refreshes if token is expired or about to expire
     */
    async getGraphToken() {
        // Check if Graph token exists and is still valid (with 5 min buffer)
        if (this.graphToken && this.graphTokenExpiry && Date.now() < this.graphTokenExpiry) {
            console.log('✅ Using cached Graph token (still valid)');
            return this.graphToken;
        }
        
        console.log('🔄 Refreshing Microsoft Graph token...');
        const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
        
        const params = new URLSearchParams();
        params.append('client_id', this.config.clientId);
        params.append('client_secret', this.config.clientSecret);
        params.append('scope', 'https://graph.microsoft.com/.default');
        params.append('grant_type', 'client_credentials');

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Graph token request failed: ${response.status} - ${error}`);
            }

            const tokenData = await response.json();
            
            this.graphToken = tokenData.access_token;
            this.graphTokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 300000; // 5 min buffer
            
            console.log('✅ Microsoft Graph access token refreshed');
            return this.graphToken;
        } catch (error) {
            console.error('❌ Failed to get access token:', error.message);
            throw error;
        }
    }

    /**
     * Connect to SharePoint
     */
    async connect() {
        try {
            if (this.isConnected) {
                console.log('✅ Already connected to SharePoint');
                return true;
            }

            console.log('🚀 Connecting to SharePoint with App Registration...');
            console.log(`📍 Site URL: ${this.config.siteUrl}`);
            console.log(`🆔 Client ID: ${this.config.clientId}`);

            await this.getAccessToken();

            this.isConnected = true;
            console.log('✅ Successfully connected to SharePoint');
            return true;
        } catch (error) {
            console.error('❌ Connection failed:', error.message);
            throw error;
        }
    }

    /**
     * Alias for compatibility
     */
    async connectToSharePoint() {
        return await this.connect();
    }

    /**
     * Get SharePoint lists using REST API
     */
    async getSharePointLists() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            console.log('📋 Retrieving SharePoint lists via REST API...');

            const token = await this.getAccessToken();
            const listsUrl = `${this.config.siteUrl}/_api/web/lists`;

            const response = await fetch(listsUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json;odata=verbose',
                }
            });

            if (!response.ok) {
                throw new Error(`Lists request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const lists = data.d.results.map(list => ({
                Title: list.Title,
                Id: list.Id,
                ItemCount: list.ItemCount,
                BaseType: list.BaseType,
                ListType: list.BaseTemplate
            }));

            console.log(`✅ Found ${lists.length} SharePoint lists via REST API`);
            return lists;
        } catch (error) {
            console.error('❌ Error retrieving lists:', error.message);
            throw error;
        }
    }

    /**
     * Get list items using REST API
     */
    async getListItems(listName, options = {}) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            console.log(`📊 Retrieving items from list: ${listName} via REST API...`);

            const token = await this.getAccessToken();
            let itemsUrl = `${this.config.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;

            // Apply options
            const queryParams = [];
            if (options.top) {
                queryParams.push(`$top=${options.top}`);
            }
            if (options.filter) {
                queryParams.push(`$filter=${options.filter}`);
            }
            if (options.orderby) {
                queryParams.push(`$orderby=${options.orderby}`);
            }
            if (options.select) {
                queryParams.push(`$select=${options.select}`);
            }
            if (options.expand) {
                queryParams.push(`$expand=${options.expand}`);
            }

            if (queryParams.length > 0) {
                itemsUrl += '?' + queryParams.join('&');
            }

            const response = await fetch(itemsUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json;odata=verbose',
                }
            });

            if (!response.ok) {
                throw new Error(`Items request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const items = data.d.results;

            console.log(`✅ Retrieved ${items.length} items from ${listName}`);
            return items;
        } catch (error) {
            console.error(`❌ Error retrieving items from ${listName}:`, error.message);
            throw error;
        }
    }

    /**
     * Execute a custom GraphQL-style query (simulated with REST)
     */
    async executeGraphQLQuery(query) {
        try {
            console.log('🔍 Executing GraphQL-style query...');
            
            // This is a simplified GraphQL simulation using REST API
            // You can expand this to parse actual GraphQL queries
            
            if (query.includes('lists')) {
                return await this.getSharePointLists();
            }
            
            if (query.includes('items')) {
                // Extract list name from query (simplified)
                const listMatch = query.match(/list\s*:\s*"([^"]+)"/);
                const listName = listMatch ? listMatch[1] : 'FS Survey';
                return await this.getListItems(listName, { top: 10 });
            }

            console.log('✅ GraphQL-style query executed');
            return { message: 'Query executed successfully' };
        } catch (error) {
            console.error('❌ GraphQL query failed:', error.message);
            throw error;
        }
    }

    /**
     * Disconnect and cleanup
     */
    async disconnect() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.isConnected = false;
        console.log('🔌 Disconnected from SharePoint');
    }

    /**
     * Test the connection
     */
    async testConnection() {
        try {
            await this.connect();
            const lists = await this.getSharePointLists();
            console.log(`✅ Connection test successful - found ${lists.length} lists`);
            return true;
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = SimpleGraphQLConnector;