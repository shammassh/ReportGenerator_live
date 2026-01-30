/**
 * Stores Service
 * Fetches store list from SharePoint audit documents
 * 
 * This is a SEPARATE, MODULAR file - can be edited independently
 */

const { SimpleGraphConnector } = require('../../src/simple-graph-connector');

class StoresService {
    constructor() {
        this.graphConnector = null;
        this.cachedStores = null;
        this.cacheTimestamp = null;
        this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
    }
    
    /**
     * Initialize Graph connector
     */
    async initialize() {
        if (!this.graphConnector) {
            this.graphConnector = new SimpleGraphConnector();
            await this.graphConnector.initialize();
        }
    }
    
    /**
     * Get list of stores from SharePoint audit documents
     */
    async getStoresList() {
        try {
            // Check cache
            if (this.cachedStores && this.cacheTimestamp && 
                (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
                console.log('[STORES] Returning cached stores');
                return this.cachedStores;
            }
            
            await this.initialize();
            
            console.log('[STORES] Fetching stores from SharePoint FS Survey list...');
            
            // Fetch from FS Survey list (main audit list)
            const items = await this.graphConnector.getListItems('FS Survey', {
                select: 'fields',
                top: 1000
            });
            
            // Extract unique store names from Title or StoreName field
            const storeSet = new Set();
            
            items.forEach(item => {
                const fields = item.fields;
                
                // Try different field names that might contain store name
                const storeName = fields.StoreName || 
                                 fields.Store || 
                                 fields.Location ||
                                 this.extractStoreFromTitle(fields.Title);
                
                if (storeName && storeName.trim()) {
                    storeSet.add(storeName.trim());
                }
            });
            
            // Convert to sorted array
            const stores = Array.from(storeSet).sort();
            
            console.log(`[STORES] Found ${stores.length} unique stores`);
            
            // Cache the results
            this.cachedStores = stores;
            this.cacheTimestamp = Date.now();
            
            return stores;
            
        } catch (error) {
            console.error('[STORES] Error fetching stores:', error);
            
            // Return fallback stores if API fails
            return this.getFallbackStores();
        }
    }
    
    /**
     * Extract store name from Title field
     * Handles formats like: "GMRL Abu Dhabi - 2024-01-15"
     */
    extractStoreFromTitle(title) {
        if (!title) return null;
        
        // Common patterns in titles
        const patterns = [
            /^(.*?)\s*-\s*\d{4}/,  // "Store Name - 2024"
            /^(.*?)\s*-\s*/,        // "Store Name - anything"
            /^(GMRL[^-]+)/i,        // "GMRL Something"
            /^(.*?)\s+\d{4}/        // "Store Name 2024"
        ];
        
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return null;
    }
    
    /**
     * Get fallback stores (in case SharePoint is unavailable)
     */
    getFallbackStores() {
        console.log('[STORES] Using fallback store list');
        
        return [
            'GMRL Abu Dhabi',
            'GMRL Dubai Marina',
            'GMRL Sharjah',
            'GMRL Al Ain',
            'GMRL Fujairah',
            'GMRL Ras Al Khaimah',
            'GMRL Ajman',
            'GMRL Umm Al Quwain'
        ];
    }
    
    /**
     * Get recent audits for a specific store
     */
    async getStoreAudits(storeName, limit = 10) {
        try {
            await this.initialize();
            
            console.log(`[STORES] Fetching recent audits for: ${storeName}`);
            
            const items = await this.graphConnector.getListItems('FS Survey', {
                select: 'fields',
                filter: `fields/StoreName eq '${storeName}' or fields/Store eq '${storeName}'`,
                orderby: 'fields/Created desc',
                top: limit
            });
            
            return items.map(item => ({
                documentNumber: item.fields.Document_x0020_Number || item.fields.DocumentNumber,
                store: storeName,
                date: item.fields.Created || item.fields.AuditDate,
                score: item.fields.Score,
                status: item.fields.Status
            }));
            
        } catch (error) {
            console.error(`[STORES] Error fetching audits for ${storeName}:`, error);
            return [];
        }
    }
    
    /**
     * Clear cache (useful for testing or after updates)
     */
    clearCache() {
        this.cachedStores = null;
        this.cacheTimestamp = null;
        console.log('[STORES] Cache cleared');
    }
}

module.exports = StoresService;
