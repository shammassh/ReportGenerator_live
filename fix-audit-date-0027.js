/**
 * Fix Audit Date Script
 * Updates the AuditDate for document GMRL-FSACSG-1221-0027 to March 27, 2026
 * and regenerates the report.
 * 
 * Run this script on the production server:
 *   node fix-audit-date-0027.js
 */

const sql = require('mssql');
require('dotenv').config();

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

const DOCUMENT_NUMBER = 'GMRL-FSACSG-1221-0027';
const CORRECT_DATE = '2026-03-27'; // March 27, 2026

async function fixAuditDate() {
    let pool;
    try {
        console.log('🔗 Connecting to database...');
        pool = await sql.connect(config);
        
        // Check current date
        console.log('\n📋 Current audit data:');
        const checkResult = await pool.request().query(`
            SELECT AuditID, DocumentNumber, AuditDate, StoreName, Status 
            FROM AuditInstances 
            WHERE DocumentNumber = '${DOCUMENT_NUMBER}'
        `);
        
        if (checkResult.recordset.length === 0) {
            console.error(`❌ Audit not found: ${DOCUMENT_NUMBER}`);
            return;
        }
        
        const audit = checkResult.recordset[0];
        console.log(`   AuditID: ${audit.AuditID}`);
        console.log(`   Document: ${audit.DocumentNumber}`);
        console.log(`   Current Date: ${audit.AuditDate}`);
        console.log(`   Store: ${audit.StoreName}`);
        
        // Update the date
        console.log(`\n🔧 Updating AuditDate to ${CORRECT_DATE}...`);
        await pool.request().query(`
            UPDATE AuditInstances 
            SET AuditDate = '${CORRECT_DATE}'
            WHERE DocumentNumber = '${DOCUMENT_NUMBER}'
        `);
        
        // Verify update
        const verifyResult = await pool.request().query(`
            SELECT AuditID, DocumentNumber, AuditDate, StoreName 
            FROM AuditInstances 
            WHERE DocumentNumber = '${DOCUMENT_NUMBER}'
        `);
        
        console.log('\n✅ Date updated successfully!');
        console.log(`   New Date: ${verifyResult.recordset[0].AuditDate}`);
        
        console.log('\n📝 Note: You need to regenerate the report for the date to appear in the HTML.');
        console.log(`   Visit: https://fsaudit.gmrlapps.com/dashboard and regenerate the report for ${DOCUMENT_NUMBER}`);
        console.log(`   Or call the API: POST /api/audits/${audit.AuditID}/report`);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

fixAuditDate();
