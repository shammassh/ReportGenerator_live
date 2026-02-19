/**
 * Migration Script: Move Pictures from SQL to File System
 * 
 * This script:
 * 1. Reads all pictures from AuditPictures table with FileData (BLOB)
 * 2. Saves each picture to file system
 * 3. Updates FilePath in database
 * 4. Optionally clears FileData from SQL to reclaim space
 * 5. Clears old bloated DepartmentReports cache
 * 
 * Run with: node scripts/migrate-pictures-to-files.js
 * Options:
 *   --dry-run    : Preview changes without making them
 *   --clear-blobs: Clear FileData from SQL after migration
 *   --clear-cache: Clear old DepartmentReports cache
 *   --batch-size : Number of pictures per batch (default: 50)
 */

require('dotenv').config();
const sql = require('mssql');
const path = require('path');
const FileStorageService = require('../services/file-storage-service');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEAR_BLOBS = args.includes('--clear-blobs');
const CLEAR_CACHE = args.includes('--clear-cache');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');

const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'FoodSafetyDB_Live',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
        requestTimeout: 120000
    },
    connectionTimeout: 30000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function getPool() {
    return await sql.connect(dbConfig);
}

async function ensureFilePathColumn(pool) {
    console.log('📋 Ensuring FilePath column exists...');
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditPictures') AND name = 'FilePath')
        ALTER TABLE AuditPictures ADD FilePath NVARCHAR(500) NULL;
    `);
    console.log('✅ FilePath column ready');
}

async function migratePictures(pool) {
    console.log('\n📸 Starting picture migration...');
    
    // Get count of pictures to migrate
    const countResult = await pool.request().query(`
        SELECT COUNT(*) as Total FROM AuditPictures 
        WHERE FileData IS NOT NULL AND (FilePath IS NULL OR FilePath = '')
    `);
    const totalToMigrate = countResult.recordset[0].Total;
    
    if (totalToMigrate === 0) {
        console.log('✅ No pictures need migration - all already have FilePath set');
        return { migrated: 0, errors: 0, skipped: 0 };
    }
    
    console.log(`📊 Found ${totalToMigrate} pictures to migrate`);
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN - no changes will be made');
        return { migrated: 0, errors: 0, skipped: totalToMigrate };
    }
    
    let migrated = 0;
    let errors = 0;
    let offset = 0;
    
    while (offset < totalToMigrate) {
        // Fetch batch of pictures
        const batchResult = await pool.request()
            .input('Offset', sql.Int, offset)
            .input('BatchSize', sql.Int, BATCH_SIZE)
            .query(`
                SELECT PictureID, ResponseID, AuditID, FileName, FileData, ContentType, PictureType
                FROM AuditPictures
                WHERE FileData IS NOT NULL AND (FilePath IS NULL OR FilePath = '')
                ORDER BY PictureID
                OFFSET @Offset ROWS FETCH NEXT @BatchSize ROWS ONLY
            `);
        
        const pictures = batchResult.recordset;
        if (pictures.length === 0) break;
        
        console.log(`\n📦 Processing batch ${offset / BATCH_SIZE + 1} (${pictures.length} pictures)...`);
        
        for (const pic of pictures) {
            try {
                // Save to file system
                const fileResult = await FileStorageService.savePicture({
                    pictureId: pic.PictureID,
                    auditId: pic.AuditID,
                    responseId: pic.ResponseID,
                    fileName: pic.FileName,
                    fileData: pic.FileData, // Buffer from SQL
                    contentType: pic.ContentType,
                    pictureType: pic.PictureType
                });
                
                // Update database with file path
                await pool.request()
                    .input('PictureID', sql.Int, pic.PictureID)
                    .input('FilePath', sql.NVarChar(500), fileResult.relativePath)
                    .query(`UPDATE AuditPictures SET FilePath = @FilePath WHERE PictureID = @PictureID`);
                
                migrated++;
                
                if (migrated % 10 === 0) {
                    process.stdout.write(`\r   Migrated: ${migrated}/${totalToMigrate}`);
                }
            } catch (error) {
                console.error(`\n❌ Error migrating picture ${pic.PictureID}:`, error.message);
                errors++;
            }
        }
        
        offset += BATCH_SIZE;
    }
    
    console.log(`\n✅ Migration complete: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors, skipped: 0 };
}

async function clearBlobData(pool) {
    if (!CLEAR_BLOBS) {
        console.log('\n⏭️  Skipping BLOB cleanup (use --clear-blobs to clear)');
        return;
    }
    
    console.log('\n🧹 Clearing FileData blobs from SQL...');
    
    if (DRY_RUN) {
        const countResult = await pool.request().query(`
            SELECT COUNT(*) as Count, SUM(DATALENGTH(FileData)) as Size 
            FROM AuditPictures WHERE FilePath IS NOT NULL AND FilePath != '' AND FileData IS NOT NULL
        `);
        const { Count, Size } = countResult.recordset[0];
        console.log(`🔍 DRY RUN: Would clear ${Count} blobs, freeing ~${(Size / 1024 / 1024).toFixed(2)} MB`);
        return;
    }
    
    // Only clear FileData where FilePath exists (successfully migrated)
    const result = await pool.request().query(`
        UPDATE AuditPictures 
        SET FileData = NULL 
        WHERE FilePath IS NOT NULL AND FilePath != '' AND FileData IS NOT NULL
    `);
    
    console.log(`✅ Cleared FileData from ${result.rowsAffected[0]} pictures`);
    
    // Shrink database to reclaim space
    console.log('📉 Shrinking database to reclaim space...');
    try {
        await pool.request().query(`DBCC SHRINKDATABASE (FoodSafetyDB_Live, 10)`);
        console.log('✅ Database shrunk');
    } catch (error) {
        console.warn('⚠️  Could not shrink database:', error.message);
    }
}

async function clearCache(pool) {
    if (!CLEAR_CACHE) {
        console.log('\n⏭️  Skipping cache cleanup (use --clear-cache to clear)');
        return;
    }
    
    console.log('\n🧹 Clearing old DepartmentReports cache...');
    
    // Get current size
    const sizeResult = await pool.request().query(`
        SELECT COUNT(*) as Count, SUM(DATALENGTH(ReportData)) / 1024 / 1024 as SizeMB 
        FROM DepartmentReports WHERE ReportData IS NOT NULL
    `);
    const { Count, SizeMB } = sizeResult.recordset[0];
    console.log(`📊 Current cache: ${Count} reports, ${Number(SizeMB || 0).toFixed(2)} MB`);
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN: Would clear all cache data');
        return;
    }
    
    // Clear ReportData (keep metadata)
    await pool.request().query(`
        UPDATE DepartmentReports SET ReportData = NULL
    `);
    
    console.log(`✅ Cleared cache from ${Count} reports`);
}

async function printStats(pool) {
    console.log('\n📊 Current Storage Statistics:');
    
    // AuditPictures stats
    const picStats = await pool.request().query(`
        SELECT 
            COUNT(*) as TotalPictures,
            SUM(CASE WHEN FileData IS NOT NULL THEN 1 ELSE 0 END) as WithBlob,
            SUM(CASE WHEN FilePath IS NOT NULL AND FilePath != '' THEN 1 ELSE 0 END) as WithFilePath,
            SUM(DATALENGTH(FileData)) / 1024 / 1024 as BlobSizeMB
        FROM AuditPictures
    `);
    const pics = picStats.recordset[0];
    console.log(`\n📸 AuditPictures:`);
    console.log(`   Total: ${pics.TotalPictures}`);
    console.log(`   With BLOB data: ${pics.WithBlob} (${Number(pics.BlobSizeMB || 0).toFixed(2)} MB)`);
    console.log(`   With FilePath: ${pics.WithFilePath}`);
    
    // DepartmentReports stats
    const cacheStats = await pool.request().query(`
        SELECT 
            COUNT(*) as TotalReports,
            SUM(CASE WHEN ReportData IS NOT NULL THEN 1 ELSE 0 END) as WithData,
            SUM(DATALENGTH(ReportData)) / 1024 / 1024 as CacheSizeMB
        FROM DepartmentReports
    `);
    const cache = cacheStats.recordset[0];
    console.log(`\n📋 DepartmentReports Cache:`);
    console.log(`   Total: ${cache.TotalReports}`);
    console.log(`   With cached data: ${cache.WithData} (${Number(cache.CacheSizeMB || 0).toFixed(2)} MB)`);
    
    // File storage stats
    const fileStats = await FileStorageService.getStorageStats();
    console.log(`\n📁 File Storage:`);
    console.log(`   Directory: ${fileStats.baseDir}`);
    console.log(`   Total files: ${fileStats.totalFiles}`);
    console.log(`   Total size: ${fileStats.totalSizeMB} MB`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 Picture Migration Script');
    console.log('='.repeat(60));
    console.log(`Options: DRY_RUN=${DRY_RUN}, CLEAR_BLOBS=${CLEAR_BLOBS}, CLEAR_CACHE=${CLEAR_CACHE}, BATCH_SIZE=${BATCH_SIZE}`);
    
    let pool;
    try {
        pool = await getPool();
        console.log('✅ Connected to database');
        
        // Ensure schema is ready FIRST (before any queries using FilePath)
        await ensureFilePathColumn(pool);
        
        // Print current stats
        await printStats(pool);
        
        // Migrate pictures to files
        await migratePictures(pool);
        
        // Clear blobs if requested
        await clearBlobData(pool);
        
        // Clear cache if requested
        await clearCache(pool);
        
        // Print final stats
        if (!DRY_RUN) {
            console.log('\n' + '='.repeat(60));
            console.log('📊 Final Statistics:');
            await printStats(pool);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration script completed!');
        if (DRY_RUN) {
            console.log('💡 Run without --dry-run to apply changes');
        }
        if (!CLEAR_BLOBS) {
            console.log('💡 Run with --clear-blobs to clear SQL blobs after migration');
        }
        if (!CLEAR_CACHE) {
            console.log('💡 Run with --clear-cache to clear old bloated cache');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

main();
