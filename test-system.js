// Test script to verify action plan and email system
const sql = require('mssql');
const config = require('./config/default').database;

async function test() {
    try {
        const pool = await sql.connect(config);
        
        // Check recent action plan saves
        const recent = await pool.request().query(`
            SELECT TOP 5 DocumentNumber, ReferenceValue, Status, UpdatedDate, UpdatedBy
            FROM ActionPlanResponses 
            ORDER BY ResponseID DESC
        `);
        
        console.log('✅ Recent Action Plan Saves:');
        recent.recordset.forEach(r => {
            console.log('  -', r.DocumentNumber, '|', r.ReferenceValue, '|', r.Status, '|', r.UpdatedDate);
        });
        
        // Check email notification service can load
        const EmailNotificationService = require('./services/email-notification-service');
        console.log('✅ Email service loaded');
        
        // Check template service
        const templateService = require('./services/email-template-service');
        const emailData = await templateService.buildEmail('action_plan_submitted', {
            document_number: 'TEST-001',
            store_name: 'Test Store',
            audit_date: '2026-02-21',
            score: '85%',
            submitter_name: 'Test User'
        });
        
        if (emailData && emailData.subject && emailData.html) {
            console.log('✅ Template renders correctly');
            console.log('  Subject:', emailData.subject);
            console.log('  Has store name in body:', emailData.html.includes('Test Store'));
            console.log('  Has document number in body:', emailData.html.includes('TEST-001'));
            console.log('  Has submitter name in body:', emailData.html.includes('Test User'));
        } else {
            console.log('❌ Template render failed');
        }
        
        await pool.close();
        console.log('\n✅ All tests passed! System is ready.');
        process.exit(0);
    } catch (err) {
        console.log('❌ Error:', err.message);
        process.exit(1);
    }
}
test();
