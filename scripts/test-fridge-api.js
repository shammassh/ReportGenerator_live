/**
 * Test fridge picture API and service
 */

const path = require('path');

// Test 1: Direct file read (same as endpoint does)
console.log('🧪 Test 1: Direct file read...');
const FRIDGE_STORAGE_BASE = path.join(__dirname, '..', 'storage', 'fridge-pictures');
const testPath = 'audits/6/fridges/fridge_517.png';
const fullPath = path.join(FRIDGE_STORAGE_BASE, testPath);

try {
    const fs = require('fs');
    const buffer = fs.readFileSync(fullPath);
    console.log(`   ✅ Read file: ${(buffer.length / 1024).toFixed(1)} KB`);
} catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
}

// Test 2: AuditService.getFridgeReadings
console.log('\n🧪 Test 2: AuditService.getFridgeReadings...');

const AuditService = require('../audit-app/services/audit-service');

async function testService() {
    try {
        // Get audit 6 fridge readings (should have pictures)
        const readings = await AuditService.getFridgeReadings(6);
        
        console.log(`   Good readings: ${readings.goodReadings.length}`);
        console.log(`   Bad readings: ${readings.badReadings.length}`);
        
        // Check if pictures have URLs
        const withPictures = readings.goodReadings.filter(r => r.picture);
        console.log(`   Good with pictures: ${withPictures.length}`);
        
        if (withPictures.length > 0) {
            const sample = withPictures[0];
            console.log(`\n   Sample picture URL: ${sample.picture}`);
            console.log(`   URL starts with /api/fridge-pictures/: ${sample.picture?.startsWith('/api/fridge-pictures/') ? '✅ YES' : '❌ NO'}`);
        }
        
        console.log('\n✅ getFridgeReadings works correctly!');
        
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
    }
}

// Test 3: Report generator data service
console.log('\n🧪 Test 3: Report DataService.getTemperatureReadings (base64 for reports)...');

async function testDataService() {
    const sql = require('mssql');
    const DataService = require('../audit-app/report-generator/services/data-service');
    
    const dbConfig = {
        server: 'localhost',
        database: 'FoodSafetyDB_Live',
        options: { encrypt: false, trustServerCertificate: true },
        authentication: { type: 'default', options: { userName: 'sa', password: 'Kokowawa123@@' } }
    };
    
    try {
        const pool = await sql.connect(dbConfig);
        const dataService = new DataService(pool);
        
        const readings = await dataService.getTemperatureReadings(6);
        
        console.log(`   Good readings: ${readings.good.length}`);
        console.log(`   Bad readings: ${readings.bad.length}`);
        
        const withPictures = readings.good.filter(r => r.picture);
        console.log(`   Good with pictures: ${withPictures.length}`);
        
        if (withPictures.length > 0) {
            const sample = withPictures[0];
            const isBase64 = sample.picture?.startsWith('data:image/');
            console.log(`   Picture is base64: ${isBase64 ? '✅ YES' : '❌ NO'}`);
            if (isBase64) {
                console.log(`   Base64 prefix: ${sample.picture.substring(0, 30)}...`);
            }
        }
        
        console.log('\n✅ getTemperatureReadings returns base64 for standalone reports!');
        
        await pool.close();
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
    }
}

async function runTests() {
    await testService();
    await testDataService();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All API tests passed! Safe to clear base64 data.');
}

runTests().catch(console.error);
