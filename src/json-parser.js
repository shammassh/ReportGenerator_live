class JsonParser {
    constructor(config = {}) {
        this.config = {
            jsonColumns: config.jsonColumns || ['JsonData', 'Data', 'CustomData'], // Default column names to check
            primaryKeyField: config.primaryKeyField || 'PrimaryKey',
            ...config
        };
    }

    parseJsonColumns(item) {
        const parsedData = {
            originalItem: item,
            parsedJson: {},
            primaryKey: null,
            hasJsonData: false
        };

        // Look for primary key
        if (item[this.config.primaryKeyField]) {
            parsedData.primaryKey = item[this.config.primaryKeyField];
        }

        // Check each potential JSON column
        for (const columnName of this.config.jsonColumns) {
            if (item[columnName]) {
                try {
                    const jsonData = this.parseJsonString(item[columnName]);
                    if (jsonData) {
                        parsedData.parsedJson[columnName] = jsonData;
                        parsedData.hasJsonData = true;

                        // If no primary key found yet, try to extract from JSON
                        if (!parsedData.primaryKey && jsonData.id) {
                            parsedData.primaryKey = jsonData.id;
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to parse JSON in column ${columnName} for item ${item.ID}:`, error.message);
                }
            }
        }

        return parsedData.hasJsonData ? parsedData : null;
    }

    parseJsonString(jsonString) {
        if (!jsonString) return null;

        try {
            // Handle different JSON string formats
            let cleanJson = jsonString;

            // Remove potential HTML encoding
            cleanJson = cleanJson.replace(/&quot;/g, '"')
                                 .replace(/&amp;/g, '&')
                                 .replace(/&lt;/g, '<')
                                 .replace(/&gt;/g, '>');

            // Try to parse as JSON
            return JSON.parse(cleanJson);
        } catch (error) {
            // If direct parsing fails, try to clean up the string
            try {
                // Remove outer quotes if present
                if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
                    jsonString = jsonString.slice(1, -1);
                }

                // Escape unescaped quotes
                const escapedJson = jsonString.replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
                
                return JSON.parse(escapedJson);
            } catch (secondError) {
                throw new Error(`Cannot parse JSON: ${secondError.message}`);
            }
        }
    }

    extractRelationships(parsedItems) {
        const relationships = {
            byPrimaryKey: new Map(),
            orphaned: [],
            connected: []
        };

        // Group items by primary key
        for (const item of parsedItems) {
            if (item.primaryKey) {
                if (!relationships.byPrimaryKey.has(item.primaryKey)) {
                    relationships.byPrimaryKey.set(item.primaryKey, []);
                }
                relationships.byPrimaryKey.get(item.primaryKey).push(item);
                relationships.connected.push(item);
            } else {
                relationships.orphaned.push(item);
            }
        }

        return relationships;
    }

    findConnectedData(primaryKey, allParsedItems) {
        return allParsedItems.filter(item => item.primaryKey === primaryKey);
    }

    validateJsonStructure(jsonData, expectedSchema) {
        if (!expectedSchema) return true;

        try {
            for (const field of expectedSchema.required || []) {
                if (!(field in jsonData)) {
                    return false;
                }
            }

            for (const [field, type] of Object.entries(expectedSchema.types || {})) {
                if (jsonData[field] && typeof jsonData[field] !== type) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = JsonParser;