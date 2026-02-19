/**
 * Migration Script: Move Fridge Pictures from SQL (base64) to File System
 * 
 * This script:
 * 1. Adds PicturePath column to FridgeReadings table
 * 2. Reads all fridge readings with Picture data (base64 data URLs)
 * 3. Extracts and saves each picture to file system
 * 4. Updates PicturePath in database
 * 5. Optionally clears Picture column to reclaim space
 * 
 * Run with: node scripts/migrate-fridge-pictures.js
 * Options:
 *   --dry-run     : Preview changes without making them
 *   --clear-base64: Clear Picture column after migration
 *   --batch-size  : Number of readings per batch (default: 50)
 */

require('dotenv').config();
const sql = require('mssql');
const path = require('path');
const fs = require('fs').promises;

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAR_BASE64 = args.includes('--clear-base64');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');

const dbConfig = {
    server: 'localhost',
    database: 'FoodSafetyDB_Live',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        requestTimeout: 120000
    },
    authentication: {
        type: 'default',
        options: {
            userName: 'sa',
            password: 'Kokowawa123@@'
        }
    },
    connectionTimeout: 30000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Storage directory for fridge pictures
const STORAGE_BASE = path.join(__dirname, '..', 'storage', 'fridge-pictures');

async function ensureStorageDir() {
    await fs.mkdir(STORAGE_BASE, { recursive: true });
    console.log(`📁 Storage directory ready: ${STORAGE_BASE}`);
}

async function saveFridgePicture(readingId, auditId, base64DataUrl) {
    // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
    const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
        throw new Error('Invalid data URL format');
    }
    
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create directory structure: /audits/{auditId}/fridges/
    const dirPath = path.join(STORAGE_BASE, 'audits', String(auditId), 'fridges');
    await fs.mkdir(dirPath, { recursive: true });
    
    // Generate filename
    const fileName = `fridge_${readingId}.${extension}`;
    const fullPath = path.join(dirPath, fileName);
    const relativePath = path.relative(STORAGE_BASE, fullPath).replace(/\\/g, '/');
    
    // Save file
    await fs.writeFile(fullPath, buffer);
    
    return {
        relativePath,
        fullPath,
        size: buffer.length
    };
}

async function readFridgePicture(relativePath) {
    const fullPath = path.join(STORAGE_BASE, relativePath);
    const buffer = await fs.readFile(fullPath);
    const extension = path.extname(fullPath).toLowerCase().slice(1);
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    };
    return {
        buffer,
        contentType: mimeTypes[extension] || 'image/jpeg'
    };
}

async function getPool() {
    return await sql.connect(dbConfig);
}

async function ensurePicturePathColumn(pool) {
    console.log('📋 Ensuring PicturePath column exists...');
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FridgeReadings') AND name = 'PicturePath')
        ALTER TABLE FridgeReadings ADD PicturePath NVARCHAR(500) NULL;
    `);
    console.log('✅ PicturePath column ready');
}

async function migrateFridgePictures(pool) {
    console.log('\n🌡️ Starting fridge picture migration...');
    
    // Get count of readings to migrate
    const countResult = await pool.request().query(`
        SELECT COUNT(*) as Total FROM FridgeReadings 
        WHERE Picture IS NOT NULL AND Picture != '' AND Picture LIKE 'data:image%'
          AND (PicturePath IS NULL OR PicturePath = '')
    `);
    const totalToMigrate = countResult.recordset[0].Total;
    
    if (totalToMigrate === 0) {
        console.log('✅ No fridge pictures need migration - all already have PicturePath set');
        return { migrated: 0, errors: 0, skipped: 0 };
    }
    
    console.log(`📊 Found ${totalToMigrate} fridge pictures to migrate`);
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN - no changes will be made');
        return { migrated: 0, errors: 0, skipped: totalToMigrate };
    }
    
    let migrated = 0;
    let errors = 0;
    let batchNum = 0;
    
    while (true) {
        batchNum++;
        
        // Fetch batch of readings with pictures
        const batchResult = await pool.request()
            .input('BatchSize', sql.Int, BATCH_SIZE)
            .query(`
                SELECT TOP (@BatchSize) ReadingID, AuditID, Picture
                FROM FridgeReadings
                WHERE Picture IS NOT NULL AND Picture != '' AND Picture LIKE 'data:image%'
                  AND (PicturePath IS NULL OR PicturePath = '')
                ORDER BY ReadingID
            `);
        
        if (batchResult.recordset.length === 0) break;
        
        console.log(`\n📦 Processing batch ${batchNum} (${batchResult.recordset.length} pictures)...`);
        
        for (const reading of batchResult.recordset) {
            try {
                // Save picture to file
                const result = await saveFridgePicture(
                    reading.ReadingID,
                    reading.AuditID,
                    reading.Picture
                );
                
                // Update database with file path
                await pool.request()
                    .input('ReadingID', sql.Int, reading.ReadingID)
                    .input('PicturePath', sql.NVarChar(500), result.relativePath)
                    .query(`UPDATE FridgeReadings SET PicturePath = @PicturePath WHERE ReadingID = @ReadingID`);
                
                console.log(`📁 Saved fridge picture ${reading.ReadingID} to ${result.relativePath}`);
                migrated++;
            } catch (error) {
                console.error(`❌ Error migrating reading ${reading.ReadingID}:`, error.message);
                errors++;
            }
        }
        
        console.log(`   Migrated: ${migrated}/${totalToMigrate}`);
    }
    
    console.log(`✅ Migration complete: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors, skipped: 0 };
}

async function clearBase64Data(pool) {
    console.log('\n🧹 Clearing base64 Picture data from SQL...');
    
    // First verify all have file paths
    const checkResult = await pool.request().query(`
        SELECT COUNT(*) as Count, SUM(LEN(Picture)) / 1024 / 1024 as SizeMB 
        FROM FridgeReadings 
        WHERE PicturePath IS NOT NULL AND PicturePath != '' 
          AND Picture IS NOT NULL AND Picture != '' AND Picture LIKE 'data:image%'
    `);
    
    const { Count, SizeMB } = checkResult.recordset[0];
    console.log(`📊 Found ${Count} readings with both PicturePath and Picture data (${SizeMB || 0} MB)`);
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN - not clearing data');
        return;
    }
    
    // Only clear Picture where PicturePath exists (successfully migrated)
    const result = await pool.request().query(`
        UPDATE FridgeReadings 
        SET Picture = NULL 
        WHERE PicturePath IS NOT NULL AND PicturePath != '' 
          AND Picture IS NOT NULL AND Picture != ''
    `);
    
    console.log(`✅ Cleared Picture data from ${result.rowsAffected[0]} readings`);
    
    // Shrink database
    console.log('📉 Shrinking database to reclaim space...');
    await pool.request().query('DBCC SHRINKDATABASE (FoodSafetyDB_Live, 10)');
    console.log('✅ Database shrunk');
}

async function printStats(pool) {
    console.log('\n📊 Current Fridge Pictures Statistics:');
    
    const stats = await pool.request().query(`
        SELECT 
            COUNT(*) as TotalReadings,
            SUM(CASE WHEN Picture IS NOT NULL AND Picture != '' AND Picture LIKE 'data:image%' THEN 1 ELSE 0 END) as WithBase64,
            SUM(CASE WHEN PicturePath IS NOT NULL AND PicturePath != '' THEN 1 ELSE 0 END) as WithFilePath,
            SUM(LEN(Picture)) / 1024 / 1024 as Base64SizeMB
        FROM FridgeReadings
    `);
    
    const s = stats.recordset[0];
    console.log(`\n🌡️ FridgeReadings:`);
    console.log(`   Total: ${s.TotalReadings}`);
    console.log(`   With base64 data: ${s.WithBase64} (${s.Base64SizeMB || 0} MB)`);
    console.log(`   With FilePath: ${s.WithFilePath}`);
    
    // File storage stats
    try {
        const files = await countFiles(STORAGE_BASE);
        console.log(`\n📁 File Storage (${STORAGE_BASE}):`);
        console.log(`   Total files: ${files.count}`);
        console.log(`   Total size: ${(files.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
        console.log(`\n📁 File Storage: Not yet created`);
    }
}

async function countFiles(dir) {
    let count = 0;
    let size = 0;
    
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const sub = await countFiles(fullPath);
                count += sub.count;
                size += sub.size;
            } else {
                const stat = await fs.stat(fullPath);
                count++;
                size += stat.size;
            }
        }
    } catch (e) {
        // Directory doesn't exist
    }
    
    return { count, size };
}

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 Fridge Picture Migration Script');
    console.log('='.repeat(60));
    console.log(`Options: DRY_RUN=${DRY_RUN}, CLEAR_BASE64=${CLEAR_BASE64}, BATCH_SIZE=${BATCH_SIZE}`);
    
    try {
        const pool = await getPool();
        console.log('✅ Connected to database');
        
        // Ensure storage directory exists
        await ensureStorageDir();
        
        // Ensure PicturePath column exists
        await ensurePicturePathColumn(pool);
        
        // Print current stats
        await printStats(pool);
        
        // Migrate pictures
        await migrateFridgePictures(pool);
        
        // Clear base64 data if requested
        if (CLEAR_BASE64) {
            await clearBase64Data(pool);
        } else {
            console.log('\n⏭️  Skipping base64 cleanup (use --clear-base64 to clear)');
        }
        
        // Print final stats
        console.log('\n' + '='.repeat(60));
        console.log('📊 Final Statistics:');
        await printStats(pool);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Fridge picture migration script completed!');
        if (!CLEAR_BASE64) {
            console.log('💡 Run with --clear-base64 to clear SQL data after migration');
        }
        
        await pool.close();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

main();
