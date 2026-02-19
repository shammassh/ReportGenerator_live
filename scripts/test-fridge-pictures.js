/**
 * Test script to verify fridge pictures are accessible from file storage
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfig = {
    server: 'localhost',
    database: 'FoodSafetyDB_Live',
    options: { encrypt: false, trustServerCertificate: true },
    authentication: { type: 'default', options: { userName: 'sa', password: 'Kokowawa123@@' } }
};

const FRIDGE_STORAGE_BASE = path.join(__dirname, '..', 'storage', 'fridge-pictures');

async function test() {
    console.log('🧪 Testing fridge picture file storage...\n');
    
    const pool = await sql.connect(dbConfig);
    
    // Get sample readings with pictures
    const result = await pool.request().query(`
        SELECT TOP 5 ReadingID, AuditID, PicturePath, ReadingType, Section, Unit
        FROM FridgeReadings 
        WHERE PicturePath IS NOT NULL
    `);
    
    console.log('📋 Sample readings with PicturePath:');
    let allExist = true;
    
    for (const row of result.recordset) {
        const fullPath = path.join(FRIDGE_STORAGE_BASE, row.PicturePath);
        const exists = fs.existsSync(fullPath);
        if (!exists) allExist = false;
        
        const size = exists ? (fs.statSync(fullPath).size / 1024).toFixed(1) + ' KB' : 'MISSING';
        console.log(`  ReadingID: ${row.ReadingID}, Audit: ${row.AuditID}, Type: ${row.ReadingType}`);
        console.log(`    Section: ${row.Section}`);
        console.log(`    Unit: ${row.Unit}`);
        console.log(`    Path: ${row.PicturePath}`);
        console.log(`    File: ${exists ? '✅ EXISTS' : '❌ MISSING'} (${size})\n`);
    }
    
    // Count totals
    const counts = await pool.request().query(`
        SELECT 
            COUNT(*) as Total,
            SUM(CASE WHEN PicturePath IS NOT NULL AND PicturePath != '' THEN 1 ELSE 0 END) as WithFilePath,
            SUM(CASE WHEN Picture IS NOT NULL AND Picture LIKE 'data:image%' THEN 1 ELSE 0 END) as WithBase64,
            SUM(LEN(Picture)) / 1024 / 1024 as Base64SizeMB
        FROM FridgeReadings
    `);
    
    const c = counts.recordset[0];
    console.log('📊 Summary:');
    console.log(`  Total readings: ${c.Total}`);
    console.log(`  With FilePath: ${c.WithFilePath}`);
    console.log(`  With base64 data: ${c.WithBase64} (${c.Base64SizeMB || 0} MB)`);
    
    // Count actual files
    let fileCount = 0;
    let totalSize = 0;
    
    function countFiles(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    countFiles(fullPath);
                } else {
                    fileCount++;
                    totalSize += fs.statSync(fullPath).size;
                }
            }
        } catch (e) {}
    }
    
    countFiles(FRIDGE_STORAGE_BASE);
    
    console.log(`\n📁 File Storage (${FRIDGE_STORAGE_BASE}):`);
    console.log(`  Total files: ${fileCount}`);
    console.log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n' + '='.repeat(50));
    if (allExist && c.WithFilePath === c.WithBase64) {
        console.log('✅ All files verified! Safe to clear base64 data.');
    } else if (!allExist) {
        console.log('⚠️ Some files are missing! Do not clear base64 data yet.');
    }
    
    await pool.close();
}

test().catch(console.error);
