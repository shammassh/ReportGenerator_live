const fs = require('fs').promises;
const path = require('path');

class ReportGenerator {
    constructor(config = {}) {
        this.config = {
            outputDir: config.outputDir || './reports',
            format: config.format || 'json', // json, csv, html
            timestamp: config.timestamp !== false,
            ...config
        };
    }

    generateReport(reportData, options = {}) {
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalItems: reportData.length,
                listsProcessed: [...new Set(reportData.map(item => item.listName))],
                summary: this.generateSummary(reportData)
            },
            data: reportData,
            relationships: this.analyzeRelationships(reportData),
            insights: this.generateInsights(reportData)
        };

        return report;
    }

    generateSummary(reportData) {
        const summary = {
            totalJsonItems: reportData.length,
            itemsByList: {},
            primaryKeysFound: 0,
            orphanedItems: 0,
            jsonColumnsUsed: new Set()
        };

        for (const item of reportData) {
            // Count items by list
            if (!summary.itemsByList[item.listName]) {
                summary.itemsByList[item.listName] = 0;
            }
            summary.itemsByList[item.listName]++;

            // Count primary keys
            if (item.primaryKey) {
                summary.primaryKeysFound++;
            } else {
                summary.orphanedItems++;
            }

            // Track JSON columns used
            if (item.parsedJson) {
                Object.keys(item.parsedJson).forEach(col => summary.jsonColumnsUsed.add(col));
            }
        }

        summary.jsonColumnsUsed = Array.from(summary.jsonColumnsUsed);
        return summary;
    }

    analyzeRelationships(reportData) {
        const relationships = {
            primaryKeyGroups: new Map(),
            crossListConnections: [],
            potentialDuplicates: []
        };

        // Group by primary key
        for (const item of reportData) {
            if (item.primaryKey) {
                const key = item.primaryKey;
                if (!relationships.primaryKeyGroups.has(key)) {
                    relationships.primaryKeyGroups.set(key, []);
                }
                relationships.primaryKeyGroups.get(key).push(item);
            }
        }

        // Find cross-list connections
        for (const [primaryKey, items] of relationships.primaryKeyGroups) {
            const uniqueLists = [...new Set(items.map(item => item.listName))];
            if (uniqueLists.length > 1) {
                relationships.crossListConnections.push({
                    primaryKey,
                    lists: uniqueLists,
                    itemCount: items.length,
                    items: items
                });
            }
        }

        // Convert Map to Object for JSON serialization
        relationships.primaryKeyGroups = Object.fromEntries(
            Array.from(relationships.primaryKeyGroups).map(([key, value]) => [key, value])
        );

        return relationships;
    }

    generateInsights(reportData) {
        const insights = [];

        // Insight 1: Most common JSON structures
        const jsonStructures = new Map();
        for (const item of reportData) {
            if (item.parsedJson) {
                for (const [column, jsonData] of Object.entries(item.parsedJson)) {
                    const structure = Object.keys(jsonData).sort().join(',');
                    if (!jsonStructures.has(structure)) {
                        jsonStructures.set(structure, { count: 0, example: jsonData, column });
                    }
                    jsonStructures.get(structure).count++;
                }
            }
        }

        insights.push({
            type: 'json_structures',
            description: 'Most common JSON structures found',
            data: Array.from(jsonStructures.entries()).map(([structure, info]) => ({
                structure,
                count: info.count,
                fields: structure.split(','),
                exampleData: info.example,
                column: info.column
            })).sort((a, b) => b.count - a.count)
        });

        // Insight 2: Data completeness
        const completeness = {
            withPrimaryKey: reportData.filter(item => item.primaryKey).length,
            withoutPrimaryKey: reportData.filter(item => !item.primaryKey).length,
            totalItems: reportData.length
        };

        insights.push({
            type: 'data_completeness',
            description: 'Data completeness analysis',
            data: {
                ...completeness,
                primaryKeyCompleteness: (completeness.withPrimaryKey / completeness.totalItems * 100).toFixed(2) + '%'
            }
        });

        // Insight 3: List distribution
        const listDistribution = {};
        for (const item of reportData) {
            if (!listDistribution[item.listName]) {
                listDistribution[item.listName] = 0;
            }
            listDistribution[item.listName]++;
        }

        insights.push({
            type: 'list_distribution',
            description: 'Distribution of JSON items across SharePoint lists',
            data: Object.entries(listDistribution).map(([list, count]) => ({
                listName: list,
                itemCount: count,
                percentage: (count / reportData.length * 100).toFixed(2) + '%'
            })).sort((a, b) => b.itemCount - a.itemCount)
        });

        return insights;
    }

    async saveReport(report, filename = null) {
        try {
            // Ensure output directory exists
            await fs.mkdir(this.config.outputDir, { recursive: true });

            // Generate filename if not provided
            if (!filename) {
                const timestamp = this.config.timestamp ? 
                    `_${new Date().toISOString().replace(/[:.]/g, '-')}` : '';
                filename = `sharepoint_report${timestamp}.${this.config.format}`;
            }

            const filePath = path.join(this.config.outputDir, filename);

            // Save based on format
            let content;
            switch (this.config.format.toLowerCase()) {
                case 'json':
                    content = JSON.stringify(report, null, 2);
                    break;
                case 'csv':
                    content = this.convertToCSV(report.data);
                    break;
                case 'html':
                    content = this.convertToHTML(report);
                    break;
                default:
                    throw new Error(`Unsupported format: ${this.config.format}`);
            }

            await fs.writeFile(filePath, content, 'utf8');
            console.log(`Report saved to: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('Error saving report:', error.message);
            throw error;
        }
    }

    convertToCSV(data) {
        if (!data || data.length === 0) return '';

        // Get all unique columns
        const columns = new Set(['listName', 'itemId', 'primaryKey']);
        data.forEach(item => {
            if (item.parsedJson) {
                Object.keys(item.parsedJson).forEach(col => columns.add(col));
            }
        });

        const columnArray = Array.from(columns);
        
        // Create CSV header
        let csv = columnArray.join(',') + '\n';

        // Add data rows
        data.forEach(item => {
            const row = columnArray.map(col => {
                let value = item[col];
                if (col.startsWith('parsedJson.') && item.parsedJson) {
                    const jsonCol = col.replace('parsedJson.', '');
                    value = JSON.stringify(item.parsedJson[jsonCol] || '');
                }
                return `"${String(value || '').replace(/"/g, '""')}"`;
            });
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    convertToHTML(report) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>SharePoint Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metadata { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .json { font-family: monospace; background: #f9f9f9; padding: 5px; }
    </style>
</head>
<body>
    <h1>SharePoint Report</h1>
    
    <div class="metadata">
        <h2>Report Metadata</h2>
        <p><strong>Generated:</strong> ${report.metadata.generatedAt}</p>
        <p><strong>Total Items:</strong> ${report.metadata.totalItems}</p>
        <p><strong>Lists Processed:</strong> ${report.metadata.listsProcessed.join(', ')}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <pre class="json">${JSON.stringify(report.metadata.summary, null, 2)}</pre>
    </div>

    <div class="section">
        <h2>Insights</h2>
        ${report.insights.map(insight => `
            <h3>${insight.description}</h3>
            <pre class="json">${JSON.stringify(insight.data, null, 2)}</pre>
        `).join('')}
    </div>
</body>
</html>`;
    }
}

module.exports = ReportGenerator;