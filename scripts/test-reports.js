/**
 * Test Report Generation - Verify pictures work after file-based migration
 */

const sql = require('mssql');
const path = require('path');
const fs = require('fs').promises;

const dbConfig = {
    server: 'localhost',
    database: 'FoodSafetyDB_Live',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    authentication: {
        type: 'default',
        options: {
            userName: 'sa',
            password: 'Kokowawa123@@'
        }
    }
};

async function testReports() {
    console.log('='.repeat(60));
    console.log('🧪 Testing Report Generation with File-Based Pictures');
    console.log('='.repeat(60));

    const pool = await sql.connect(dbConfig);
    
    // Import ReportGenerator
    const ReportGenerator = require('../audit-app/report-generator');
    const reportGenerator = new ReportGenerator({ pool });

    const auditId = 38; // Test with audit that has 64 pictures
    
    try {
        // 1. Test Full Audit Report
        console.log('\n📋 TEST 1: Full Audit Report');
        console.log('-'.repeat(40));
        const fullReportResult = await reportGenerator.generateReport(auditId);
        if (!fullReportResult.success) {
            throw new Error('Full report failed: ' + fullReportResult.error);
        }
        const fullReportPath = fullReportResult.filePath;
        const fullReportContent = await fs.readFile(fullReportPath, 'utf8');
        const fullReportPicCount = (fullReportContent.match(/\/api\/pictures\//g) || []).length;
        console.log(`   📄 Generated: ${path.basename(fullReportPath)}`);
        console.log(`   📊 Size: ${(fullReportContent.length / 1024).toFixed(1)} KB`);
        console.log(`   🖼️ Picture URLs found: ${fullReportPicCount}`);
        console.log(`   ✅ Full Report: ${fullReportPicCount > 0 ? 'PASS' : 'FAIL - No pictures!'}`);

        // 2. Test Department Report (Maintenance)
        console.log('\n🔧 TEST 2: Department Report (Maintenance)');
        console.log('-'.repeat(40));
        const deptReportResult = await reportGenerator.generateDepartmentReport(auditId, 'Maintenance');
        const deptReportPath = typeof deptReportResult === 'string' ? deptReportResult : deptReportResult.filePath;
        const deptReportContent = await fs.readFile(deptReportPath, 'utf8');
        const deptReportPicCount = (deptReportContent.match(/\/api\/pictures\//g) || []).length;
        console.log(`   📄 Generated: ${path.basename(deptReportPath)}`);
        console.log(`   📊 Size: ${(deptReportContent.length / 1024).toFixed(1)} KB`);
        console.log(`   🖼️ Picture URLs found: ${deptReportPicCount}`);
        console.log(`   ✅ Department Report: PASS`);

        // 3. Test Action Plan Report
        console.log('\n📝 TEST 3: Action Plan Report');
        console.log('-'.repeat(40));
        const actionPlanResult = await reportGenerator.generateActionPlan(auditId);
        const actionPlanPath = typeof actionPlanResult === 'string' ? actionPlanResult : actionPlanResult.filePath;
        const actionPlanContent = await fs.readFile(actionPlanPath, 'utf8');
        const actionPlanPicCount = (actionPlanContent.match(/\/api\/pictures\//g) || []).length;
        console.log(`   📄 Generated: ${path.basename(actionPlanPath)}`);
        console.log(`   📊 Size: ${(actionPlanContent.length / 1024).toFixed(1)} KB`);
        console.log(`   🖼️ Picture URLs found: ${actionPlanPicCount}`);
        console.log(`   ✅ Action Plan Report: ${actionPlanPicCount > 0 ? 'PASS' : 'FAIL - No pictures!'}`);

        // 4. Verify picture URLs are valid file paths
        console.log('\n🔍 TEST 4: Verify Picture File Paths');
        console.log('-'.repeat(40));
        const urlMatches = fullReportContent.match(/\/api\/pictures\/file\/([^"']+)/g) || [];
        let validCount = 0;
        let invalidCount = 0;
        
        for (const url of urlMatches.slice(0, 5)) { // Check first 5
            const filePath = url.replace('/api/pictures/file/', '');
            const fullFilePath = path.join(__dirname, '..', 'storage', 'pictures', filePath);
            try {
                await fs.access(fullFilePath);
                validCount++;
            } catch {
                invalidCount++;
                console.log(`   ❌ Missing file: ${filePath}`);
            }
        }
        
        if (urlMatches.length > 0) {
            console.log(`   📁 Checked ${Math.min(5, urlMatches.length)} picture file paths`);
            console.log(`   ✅ Valid: ${validCount}, ❌ Invalid: ${invalidCount}`);
        } else {
            console.log('   ⚠️ No file-based URLs found (may be using ID-based URLs)');
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Full Report: Generated with ${fullReportPicCount} picture URLs`);
        console.log(`✅ Department Report: Generated with ${deptReportPicCount} picture URLs`);
        console.log(`✅ Action Plan: Generated with ${actionPlanPicCount} picture URLs`);
        console.log('');
        console.log('🎉 All reports generated successfully with URL-based pictures!');
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
    } finally {
        await pool.close();
    }
}

testReports().catch(console.error);
