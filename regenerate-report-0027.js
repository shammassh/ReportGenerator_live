/**
 * Regenerate Report Script
 * Regenerates the report for audit ID 83 (GMRL-FSACSG-1221-0027)
 * after fixing the date.
 */

require('dotenv').config();
const sql = require('mssql');
const ReportGenerator = require('./audit-app/report-generator');

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'FoodSafetyDB_Live',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: { 
        encrypt: false, 
        trustServerCertificate: true 
    }
};

const AUDIT_ID = 83;

async function regenerateReport() {
    let pool;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        
        // Create report generator with the pool
        const reportGenerator = new ReportGenerator({
            pool: pool,
            outputDir: './reports'
        });
        
        console.log(`\n📝 Regenerating report for Audit ID: ${AUDIT_ID}`);
        
        // Generate the report
        const result = await reportGenerator.generateReport(AUDIT_ID);
        
        if (result.success) {
            console.log('\n✅ Report regenerated successfully!');
            console.log(`📄 File: ${result.filePath}`);
            console.log(`📊 Score: ${result.data.totalScore}%`);
            console.log(`🏪 Store: ${result.data.storeName}`);
            console.log(`📅 Date: ${new Date(result.data.auditDate).toLocaleDateString('en-GB')}`);
        } else {
            console.error('❌ Failed to regenerate report:', result.error);
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

regenerateReport();
