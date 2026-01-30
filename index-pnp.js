const SimpleGraphConnector = require('./src/simple-graph-connector');
const JsonParser = require('./src/json-parser');
const ReportGenerator = require('./src/report-generator');
require('dotenv').config();

async function main() {
    try {
        console.log('🚀 Starting SharePoint Report Generator (Graph API)...\n');
        
        // Initialize Graph connector
        const graphConnector = new SimpleGraphConnector({
            siteUrl: process.env.SHAREPOINT_SITE_URL,
            outputDir: './sharepoint-data',
            pageSize: 200
        });

        // Connect to SharePoint using Graph API
        console.log('🔐 Connecting to SharePoint using Microsoft Graph API...');
        await graphConnector.connectToSharePoint();
        console.log('');

        // Get all SharePoint lists
        const lists = await graphConnector.getSharePointLists();
        console.log('');

        // Get all document libraries (for your images)
        const libraries = await graphConnector.getDocumentLibraries();
        console.log('');

        // Process each list to find JSON data
        const jsonParser = new JsonParser({
            jsonColumns: ['JsonData', 'Data', 'CustomData', 'Configuration', 'Metadata', 'Settings'],
            primaryKeyField: 'PrimaryKey'
        });

        const allReportData = [];
        
        console.log('🔍 Analyzing lists for JSON data...\n');
        
        for (const list of lists) {
            console.log(`📋 Processing list: ${list.Title}`);
            
            try {
                // Get items with JSON data from this list
                const itemsWithJson = await graphConnector.getListItemsWithJsonColumns(list.Title);
                
                if (itemsWithJson.length > 0) {
                    console.log(`✅ Found ${itemsWithJson.length} items with JSON data`);
                    
                    // Process each item with JSON
                    for (const item of itemsWithJson) {
                        // Use our existing JSON parser to extract relationships
                        const parsedData = jsonParser.parseJsonColumns(item.originalItem);
                        
                        allReportData.push({
                            listName: list.Title,
                            itemId: item.originalItem.ID || 'unknown',
                            jsonColumns: item.jsonColumns,
                            hasJsonData: true,
                            originalItem: item.originalItem,
                            ...parsedData
                        });
                    }
                } else {
                    console.log(`   ⚠️  No JSON data found`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error processing ${list.Title}: ${error.message}`);
            }
            
            console.log('');
        }

        // Process document libraries (download sample images)
        if (libraries.length > 0) {
            console.log('📸 Processing document libraries...\n');
            
            for (const library of libraries.slice(0, 2)) { // Process first 2 libraries
                console.log(`📁 Processing library: ${library.Title}`);
                
                try {
                    const imageFiles = await graphConnector.downloadImages(library.Title);
                    console.log(`✅ Downloaded ${imageFiles.length} images from ${library.Title}`);
                } catch (error) {
                    console.log(`❌ Error downloading from ${library.Title}: ${error.message}`);
                }
                console.log('');
            }
        }

        // Generate comprehensive report
        if (allReportData.length > 0) {
            console.log('📊 Generating comprehensive report...\n');
            
            const reportGenerator = new ReportGenerator({
                outputDir: './reports',
                format: 'json'
            });

            const report = reportGenerator.generateReport(allReportData);
            
            console.log('📈 SharePoint Report Summary:');
            console.log(`- Total JSON records found: ${allReportData.length}`);
            console.log(`- Lists processed: ${lists.length}`);
            console.log(`- Lists with JSON data: ${[...new Set(allReportData.map(r => r.listName))].length}`);
            console.log(`- Document libraries found: ${libraries.length}`);
            console.log(`- Primary keys found: ${allReportData.filter(r => r.primaryKey).length}`);
            console.log(`- Cross-list connections: ${report.relationships.crossListConnections.length}`);

            // Show JSON column analysis
            console.log('\n📋 JSON Columns Found:');
            const jsonFieldStats = {};
            allReportData.forEach(record => {
                Object.keys(record.jsonColumns || {}).forEach(field => {
                    jsonFieldStats[field] = (jsonFieldStats[field] || 0) + 1;
                });
            });

            Object.entries(jsonFieldStats).forEach(([field, count]) => {
                console.log(`   - ${field}: ${count} records`);
            });

            // Save reports
            const savedReportPath = await reportGenerator.saveReport(report, 'pnp-sharepoint-comprehensive-report.json');
            console.log(`\n💾 Comprehensive report saved to: ${savedReportPath}`);

            // Save raw SharePoint data
            const rawDataPath = await graphConnector.saveDataToFile({
                lists: lists,
                libraries: libraries,
                jsonData: allReportData,
                generatedAt: new Date().toISOString()
            }, 'sharepoint-raw-data.json');

            console.log('\n✅ PnP SharePoint report generation completed successfully!');
            console.log('\n📋 Files generated:');
            console.log(`   - ${savedReportPath}`);
            console.log(`   - ${rawDataPath}`);
            console.log(`   - Images downloaded to: ./sharepoint-data/images/`);

        } else {
            console.log('❌ No JSON data found in any SharePoint lists');
            console.log('\n💡 This could mean:');
            console.log('   - Your SharePoint lists don\'t contain JSON data');
            console.log('   - JSON data is in columns with different names');
            console.log('   - Lists are empty or inaccessible');
            
            // Still save basic list information
            await graphConnector.saveDataToFile({
                lists: lists,
                libraries: libraries,
                message: 'No JSON data found, but basic structure captured',
                generatedAt: new Date().toISOString()
            }, 'sharepoint-structure.json');
        }

        // Disconnect
        await graphConnector.disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Ensure PnP PowerShell module is installed');
        console.log('2. Check your SharePoint site URL in .env file');
        console.log('3. Verify you have access to the SharePoint site');
        console.log('4. Complete the browser authentication when prompted');
        console.log('5. Check if your lists contain the expected JSON columns');
    }
}

// Run the application
if (require.main === module) {
    main();
}