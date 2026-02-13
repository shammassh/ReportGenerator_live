/**
 * Configuration Service
 * Fetches and caches system settings from SharePoint "fs system setting" list
 */

class ConfigService {
    constructor(connector) {
        this.connector = connector;
        this.cache = null;
        this.cacheExpiry = null;
        this.cacheDurationMs = 5 * 60 * 1000; // 5 minutes cache
        this.listName = 'fs system setting';
        
        // Default values (fallback if SharePoint unavailable)
        this.defaults = {
            OverallPassingScore: 83,
            SectionPassingScore: 89,
            CategoryPassingScore: 83
        };
    }

    /**
     * Fetch all settings from SharePoint list
     * @returns {Promise<Object>} Settings object
     */
    async fetchSettings() {
        try {
            console.log('📋 Fetching system settings from SharePoint...');
            
            const items = await this.connector.getListItems(this.listName);
            
            if (!items || items.length === 0) {
                console.log('⚠️ No settings found in SharePoint, using defaults');
                return this.defaults;
            }

            // Read settings from direct columns
            const item = items[0]; // Assume single configuration row
            const settings = {};

            // Map direct columns to setting names
            if (item.OverallPassingScore !== undefined && item.OverallPassingScore !== null) {
                settings.OverallPassingScore = parseInt(item.OverallPassingScore) || this.defaults.OverallPassingScore;
                console.log(`   ✅ OverallPassingScore: ${settings.OverallPassingScore}`);
            }

            if (item.SectionPassingScore !== undefined && item.SectionPassingScore !== null) {
                settings.SectionPassingScore = parseInt(item.SectionPassingScore) || this.defaults.SectionPassingScore;
                console.log(`   ✅ SectionPassingScore: ${settings.SectionPassingScore}`);
            }

            if (item.CategoryPassingScore !== undefined && item.CategoryPassingScore !== null) {
                settings.CategoryPassingScore = parseInt(item.CategoryPassingScore) || this.defaults.CategoryPassingScore;
                console.log(`   ✅ CategoryPassingScore: ${settings.CategoryPassingScore}`);
            }

            // Use SettingValue as fallback for OverallPassingScore if direct column not found
            if (!settings.OverallPassingScore && item.SettingValue !== undefined && item.SettingValue !== null) {
                settings.OverallPassingScore = parseInt(item.SettingValue) || this.defaults.OverallPassingScore;
                console.log(`   ✅ OverallPassingScore (from SettingValue): ${settings.OverallPassingScore}`);
            }

            // Fill in any missing values with defaults
            Object.keys(this.defaults).forEach(key => {
                if (settings[key] === undefined) {
                    settings[key] = this.defaults[key];
                    console.log(`   ⚠️ ${key}: ${settings[key]} (using default)`);
                }
            });

            console.log(`✅ Loaded settings from SharePoint`);
            return settings;

        } catch (error) {
            console.error('❌ Error fetching settings from SharePoint:', error.message);
            console.log('⚠️ Using default settings');
            return this.defaults;
        }
    }

    /**
     * Get all settings (with caching)
     * @param {boolean} forceRefresh - Force refresh from SharePoint
     * @returns {Promise<Object>} All settings
     */
    async getAll(forceRefresh = false) {
        const now = Date.now();
        
        // Return cached if valid
        if (!forceRefresh && this.cache && this.cacheExpiry && now < this.cacheExpiry) {
            return this.cache;
        }

        // Fetch fresh settings
        this.cache = await this.fetchSettings();
        this.cacheExpiry = now + this.cacheDurationMs;
        
        return this.cache;
    }

    /**
     * Get a specific setting value
     * @param {string} settingName - The setting name (Title)
     * @param {number|string} defaultValue - Default if not found
     * @returns {Promise<number|string>} The setting value
     */
    async get(settingName, defaultValue = null) {
        const settings = await this.getAll();
        
        if (settings.hasOwnProperty(settingName)) {
            return settings[settingName];
        }
        
        // Check defaults
        if (this.defaults.hasOwnProperty(settingName)) {
            return this.defaults[settingName];
        }
        
        return defaultValue;
    }

    /**
     * Get overall passing score threshold
     * @returns {Promise<number>} Passing score (default 83)
     */
    async getOverallPassingScore() {
        const value = await this.get('OverallPassingScore', 83);
        return parseFloat(value) || 83;
    }

    /**
     * Get section passing score threshold
     * @returns {Promise<number>} Section passing score (default 89)
     */
    async getSectionPassingScore() {
        const value = await this.get('SectionPassingScore', 89);
        return parseFloat(value) || 89;
    }

    /**
     * Get category passing score threshold
     * @returns {Promise<number>} Category passing score (default 83)
     */
    async getCategoryPassingScore() {
        const value = await this.get('CategoryPassingScore', 83);
        return parseFloat(value) || 83;
    }

    /**
     * Get all scoring thresholds at once
     * @returns {Promise<Object>} Object with all score thresholds
     */
    async getScoringThresholds() {
        await this.getAll(); // Ensure cache is populated
        
        return {
            overall: await this.getOverallPassingScore(),
            section: await this.getSectionPassingScore(),
            category: await this.getCategoryPassingScore()
        };
    }

    /**
     * Clear the cache (force next request to fetch from SharePoint)
     */
    clearCache() {
        this.cache = null;
        this.cacheExpiry = null;
        console.log('🔄 Config cache cleared');
    }

    /**
     * Check if a score passes based on the threshold type
     * @param {number} score - The score to check
     * @param {string} type - 'overall', 'section', or 'category'
     * @returns {Promise<boolean>} True if passing
     */
    async isPassing(score, type = 'overall') {
        const thresholds = await this.getScoringThresholds();
        const threshold = thresholds[type] || thresholds.overall;
        return score >= threshold;
    }

    /**
     * Get pass/fail status text
     * @param {number} score - The score
     * @param {string} type - 'overall', 'section', or 'category'
     * @returns {Promise<string>} "Pass ✅" or "Fail ❌"
     */
    async getPassFailText(score, type = 'overall') {
        const passing = await this.isPassing(score, type);
        return passing ? "Pass ✅" : "Fail ❌";
    }

    /**
     * Get pass/fail CSS class
     * @param {number} score - The score
     * @param {string} type - 'overall', 'section', or 'category'
     * @returns {Promise<string>} 'pass' or 'fail'
     */
    async getPassFailClass(score, type = 'overall') {
        const passing = await this.isPassing(score, type);
        return passing ? 'pass' : 'fail';
    }
}

module.exports = ConfigService;
