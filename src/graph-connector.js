const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');

// Use native fetch if available (Node 18+), otherwise require node-fetch
const fetch = globalThis.fetch || require('node-fetch');

/**
 * Microsoft Graph API Connector with GraphQL support
 * Uses modern OAuth2 authentication and Graph API endpoints
 */
class GraphConnector {
    constructor(config = {}) {
        this.config = {
            clientId: config.clientId || process.env.AZURE_CLIENT_ID,
            tenantId: config.tenantId || process.env.AZURE_TENANT_ID,
            clientSecret: config.clientSecret || process.env.AZURE_CLIENT_SECRET,
            siteUrl: config.siteUrl || process.env.SHAREPOINT_SITE_URL,
            scopes: config.scopes || ['https://graph.microsoft.com/.default'],
            ...config
        };
        
        this.accessToken = null;
        this.tokenExpiry = null;
        this.graphClient = null;
        this.siteId = null;
        this.isConnected = false;
    }

    /**
     * Get OAuth2 access token for Microsoft Graph
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        console.log('🔑 Getting Microsoft Graph access token...');
        
        const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
        
        const params = new URLSearchParams();
        params.append('client_id', this.config.clientId);
        params.append('client_secret', this.config.clientSecret);
        params.append('scope', this.config.scopes.join(' '));
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
                throw new Error(`Token request failed: ${response.status} - ${error}`);
            }

            const tokenData = await response.json();
            
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 300000; // 5 min buffer
            
            console.log('✅ Microsoft Graph access token obtained');
            return this.accessToken;
        } catch (error) {
            console.error('❌ Failed to get access token:', error.message);
            throw error;
        }
    }

    /**
     * Initialize Microsoft Graph client
     */
    async initializeGraphClient() {
        const token = await this.getAccessToken();
        
        // Custom authentication provider
        const authProvider = {
            getAccessToken: async () => {
                return await this.getAccessToken();
            }
        };

        this.graphClient = Client.initWithMiddleware({ authProvider });
        console.log('✅ Microsoft Graph client initialized');
    }

    /**
     * Get SharePoint site ID from URL
     */
    async getSiteId() {
        if (this.siteId) {
            return this.siteId;
        }

        try {
            // Extract hostname and site path from URL
            const url = new URL(this.config.siteUrl);
            const hostname = url.hostname;
            const sitePath = url.pathname;

            console.log(`🔍 Getting site ID for: ${hostname}${sitePath}`);

            // Try different API approaches for site ID
            let siteInfo;
            
            // Method 1: Try direct site path
            try {
                siteInfo = await this.graphClient
                    .api(`/sites/${hostname}:${sitePath}`)
                    .get();
            } catch (error) {
                console.log('⚠️ Direct site path failed, trying root site...');
                
                // Method 2: Try root site
                try {
                    siteInfo = await this.graphClient
                        .api(`/sites/${hostname}:/`)
                        .get();
                } catch (rootError) {
                    console.log('⚠️ Root site failed, trying search...');
                    
                    // Method 3: Search for the site
                    const searchResponse = await this.graphClient
                        .api('/sites')
                        .filter(`webUrl eq '${this.config.siteUrl}'`)
                        .get();
                    
                    if (searchResponse.value && searchResponse.value.length > 0) {
                        siteInfo = searchResponse.value[0];
                    } else {
                        throw new Error('Site not found in search results');
                    }
                }
            }

            this.siteId = siteInfo.id;
            console.log(`✅ Site ID: ${this.siteId}`);
            return this.siteId;
        } catch (error) {
            console.error('❌ Failed to get site ID:', error.message);
            throw error;
        }
    }

    /**
     * Connect to SharePoint using Microsoft Graph
     */
    async connect() {
        try {
            if (this.isConnected) {
                console.log('✅ Already connected to Microsoft Graph');
                return true;
            }

            console.log('🚀 Connecting to SharePoint via Microsoft Graph...');
            console.log(`📍 Site URL: ${this.config.siteUrl}`);
            console.log(`🆔 Client ID: ${this.config.clientId}`);

            await this.initializeGraphClient();
            await this.getSiteId();

            this.isConnected = true;
            console.log('✅ Successfully connected to Microsoft Graph');
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
     * Get SharePoint lists using Microsoft Graph
     */
    async getSharePointLists() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            console.log('📋 Retrieving SharePoint lists via Microsoft Graph...');

            const listsResponse = await this.graphClient
                .api(`/sites/${this.siteId}/lists`)
                .select('id,name,displayName,list')
                .get();

            const lists = listsResponse.value.map(list => ({
                Title: list.displayName || list.name,
                Id: list.id,
                ItemCount: list.list ? list.list.itemCount : 0,
                BaseType: 0, // Generic list
                ListType: 100 // Custom list
            }));

            console.log(`✅ Found ${lists.length} SharePoint lists via Graph API`);
            return lists;
        } catch (error) {
            console.error('❌ Error retrieving lists:', error.message);
            throw error;
        }
    }

    /**
     * Get list items using Microsoft Graph REST API
     */
    async getListItems(listName, options = {}) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            console.log(`📊 Retrieving items from list: ${listName} via Graph API...`);

            // Get list ID first
            const lists = await this.getSharePointLists();
            const targetList = lists.find(list => list.Title === listName);
            
            if (!targetList) {
                throw new Error(`List '${listName}' not found`);
            }

            let query = this.graphClient.api(`/sites/${this.siteId}/lists/${targetList.Id}/items`)
                .expand('fields');

            // Apply options
            if (options.top) {
                query = query.top(options.top);
            }
            if (options.filter) {
                query = query.filter(options.filter);
            }
            if (options.orderby) {
                query = query.orderby(options.orderby);
            }

            const itemsResponse = await query.get();
            const items = itemsResponse.value.map(item => item.fields);

            console.log(`✅ Retrieved ${items.length} items from ${listName}`);
            return items;
        } catch (error) {
            console.error(`❌ Error retrieving items from ${listName}:`, error.message);
            throw error;
        }
    }

    /**
     * Execute GraphQL query against Microsoft Graph
     */
    async executeGraphQL(query, variables = {}) {
        try {
            const token = await this.getAccessToken();
            
            console.log('🔍 Executing GraphQL query...');
            
            const response = await fetch('https://graph.microsoft.com/beta/$graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
            }

            console.log('✅ GraphQL query executed successfully');
            return result.data;
        } catch (error) {
            console.error('❌ GraphQL query failed:', error.message);
            throw error;
        }
    }

    /**
     * Get SharePoint lists using GraphQL
     */
    async getListsWithGraphQL() {
        const query = `
            query GetSharePointLists($siteId: String!) {
                sites(ids: [$siteId]) {
                    lists {
                        id
                        displayName
                        name
                        list {
                            contentTypesEnabled
                            hidden
                            template
                        }
                        items {
                            id
                        }
                    }
                }
            }
        `;

        const variables = {
            siteId: this.siteId
        };

        try {
            const data = await this.executeGraphQL(query, variables);
            return data.sites[0].lists;
        } catch (error) {
            console.warn('⚠️ GraphQL query failed, falling back to REST API');
            return await this.getSharePointLists();
        }
    }

    /**
     * Get list items using GraphQL
     */
    async getListItemsWithGraphQL(listId, options = {}) {
        const query = `
            query GetListItems($siteId: String!, $listId: String!, $top: Int) {
                sites(ids: [$siteId]) {
                    lists(ids: [$listId]) {
                        items(top: $top) {
                            id
                            fields
                        }
                    }
                }
            }
        `;

        const variables = {
            siteId: this.siteId,
            listId: listId,
            top: options.top || 100
        };

        try {
            const data = await this.executeGraphQL(query, variables);
            return data.sites[0].lists[0].items;
        } catch (error) {
            console.warn('⚠️ GraphQL query failed, falling back to REST API');
            // Fallback to REST API
            throw error;
        }
    }

    /**
     * Disconnect and cleanup
     */
    async disconnect() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.graphClient = null;
        this.siteId = null;
        this.isConnected = false;
        console.log('🔌 Disconnected from Microsoft Graph');
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

module.exports = GraphConnector;