#!/usr/bin/env node

/**
 * Enhanced Report Generator - CLI Entry Point
 * Usage: node index.js <DOCUMENT_NUMBER> [options]
 */

require('dotenv').config();
const ReportGenerator = require('./report-generator');

/**
 * Display usage information
 */
function showUsage() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     Enhanced Food Safety Audit Report Generator              ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  node index.js <DOCUMENT_NUMBER> [options]

Arguments:
  DOCUMENT_NUMBER    Required. The document number to generate report for
                     Example: GMRL-FSACR-0048

Options:
  --help, -h         Show this help message
  --debug, -d        Use debug mode (read from debug folder)
  --output, -o       Specify output directory (default: ./reports)

Examples:
  node index.js GMRL-FSACR-0048
  node index.js GMRL-FSACR-0048 --output ./my-reports
  node index.js GMRL-FSACR-0048 --debug

Environment Variables:
  AUTH_METHOD              Authentication method (auto, graph, interactive)
  SHAREPOINT_SITE_URL      SharePoint site URL
  AZURE_CLIENT_ID          Azure AD client ID
  AZURE_TENANT_ID          Azure AD tenant ID
  AZURE_CLIENT_SECRET      Azure AD client secret

Report Location:
  Generated reports will be saved to the output directory
  Default: ./reports/Food_Safety_Audit_Report_<DOC_NUM>_<DATE>.html
    `);
}

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    
    const options = {
        documentNumber: null,
        debug: false,
        outputDir: './reports',
        showHelp: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            options.showHelp = true;
        } else if (arg === '--debug' || arg === '-d') {
            options.debug = true;
        } else if (arg === '--output' || arg === '-o') {
            options.outputDir = args[++i];
        } else if (!arg.startsWith('-')) {
            options.documentNumber = arg;
        }
    }

    return options;
}

/**
 * Main execution function
 */
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     Enhanced Food Safety Audit Report Generator              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // Parse arguments
    const options = parseArguments();

    // Show help if requested
    if (options.showHelp) {
        showUsage();
        return;
    }

    // Validate document number
    if (!options.documentNumber) {
        console.error('❌ Error: Document number is required\n');
        showUsage();
        process.exit(1);
    }

    console.log(`📄 Document Number: ${options.documentNumber}`);
    console.log(`📁 Output Directory: ${options.outputDir}`);
    
    if (options.debug) {
        console.log('🐛 Debug Mode: Reading from debug folder');
    }

    console.log('');

    try {
        // Get appropriate connector
        const connector = ReportGenerator.getConnector({
            siteUrl: process.env.SHAREPOINT_SITE_URL
        });

        // Create report generator instance
        const generator = new ReportGenerator(connector, {
            outputDir: options.outputDir
        });

        // Generate the report
        const result = await generator.generateReport(options.documentNumber, {
            useDebugFolder: options.debug
        });

        if (result.success) {
            console.log('\n╔═══════════════════════════════════════════════════════════════╗');
            console.log('║                    ✅ SUCCESS!                                ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝\n');
            console.log(`📁 Report saved to: ${result.filePath}`);
            console.log(`📊 Overall Score: ${result.data.overallScore}%`);
            console.log(`🏪 Store: ${result.data.auditDetails.storeName}`);
            console.log(`📅 Date: ${result.data.auditDetails.dateOfAudit}\n`);
            console.log('💡 To view the report, open the HTML file in your browser');
            process.exit(0);
        } else {
            console.error('\n╔═══════════════════════════════════════════════════════════════╗');
            console.error('║                    ❌ FAILED!                                 ║');
            console.error('╚═══════════════════════════════════════════════════════════════╝\n');
            console.error(`Error: ${result.error}\n`);
            if (result.stack) {
                console.error('Stack trace:');
                console.error(result.stack);
            }
            process.exit(1);
        }

    } catch (error) {
        console.error('\n╔═══════════════════════════════════════════════════════════════╗');
        console.error('║                    ❌ ERROR!                                  ║');
        console.error('╚═══════════════════════════════════════════════════════════════╝\n');
        console.error('An unexpected error occurred:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main, parseArguments };
