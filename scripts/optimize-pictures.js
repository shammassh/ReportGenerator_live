/**
 * Picture Optimization Migration Script
 * 
 * Optimizes all existing pictures in storage to reduce size while
 * keeping originals backed up.
 * 
 * Run: node scripts/optimize-pictures.js
 * Options:
 *   --dry-run     : Preview changes without making them
 *   --no-backup   : Don't keep original files
 *   --batch-size  : Number of files per batch (default: 50)
 *   --audit       : Only process pictures from specific audit ID
 */

const path = require('path');
const fs = require('fs').promises;
const ImageOptimizer = require('../services/image-optimizer');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_BACKUP = args.includes('--no-backup');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');
const AUDIT_FILTER = args.find(a => a.startsWith('--audit='))?.split('=')[1];

// Directories
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'pictures');
const BACKUP_DIR = path.join(__dirname, '..', 'storage', 'pictures-original');
const FRIDGE_STORAGE_DIR = path.join(__dirname, '..', 'storage', 'fridge-pictures');
const FRIDGE_BACKUP_DIR = path.join(__dirname, '..', 'storage', 'fridge-pictures-original');

/**
 * Collect all image files from a directory
 */
async function collectImageFiles(dir, filter = null) {
    const files = [];
    
    async function scan(currentDir) {
        try {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    await scan(fullPath);
                } else {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
                        // Apply audit filter if specified
                        if (filter) {
                            if (!fullPath.includes(`audits/${filter}/`) && !fullPath.includes(`audits\\${filter}\\`)) {
                                continue;
                            }
                        }
                        const stat = await fs.stat(fullPath);
                        files.push({
                            path: fullPath,
                            size: stat.size,
                            ext: ext
                        });
                    }
                }
            }
        } catch (e) {
            // Directory doesn't exist
        }
    }
    
    await scan(dir);
    return files;
}

/**
 * Process a batch of images
 */
async function processBatch(files, backupDir, stats) {
    for (const file of files) {
        try {
            if (DRY_RUN) {
                // Just analyze without processing
                const buffer = await fs.readFile(file.path);
                const result = await ImageOptimizer.optimizeBuffer(buffer, path.basename(file.path));
                
                if (result.optimized) {
                    stats.wouldOptimize++;
                    stats.potentialSavings += result.savings;
                    console.log(`  📊 Would save ${(result.savings / 1024).toFixed(0)} KB: ${path.basename(file.path)}`);
                } else {
                    stats.skipped++;
                }
            } else {
                // Actually process
                const result = await ImageOptimizer.optimizeFile(
                    file.path,
                    NO_BACKUP ? null : backupDir
                );
                
                if (result.optimized) {
                    stats.optimized++;
                    stats.totalSavings += result.savings;
                    const pct = result.savingsPercent;
                    const savedKB = (result.savings / 1024).toFixed(0);
                    console.log(`  ✅ Saved ${savedKB} KB (${pct}%): ${path.basename(file.path)}`);
                } else {
                    stats.skipped++;
                }
            }
            stats.processed++;
        } catch (error) {
            stats.errors++;
            console.error(`  ❌ Error processing ${path.basename(file.path)}:`, error.message);
        }
    }
}

/**
 * Main migration function
 */
async function runMigration() {
    console.log('='.repeat(60));
    console.log('🖼️  Picture Optimization Migration');
    console.log('='.repeat(60));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE MIGRATION'}`);
    console.log(`Backup: ${NO_BACKUP ? 'DISABLED' : 'ENABLED'}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    if (AUDIT_FILTER) console.log(`Audit filter: ${AUDIT_FILTER}`);
    console.log('');

    // Collect files
    console.log('📁 Collecting image files...');
    const auditPictures = await collectImageFiles(STORAGE_DIR, AUDIT_FILTER);
    const fridgePictures = await collectImageFiles(FRIDGE_STORAGE_DIR, AUDIT_FILTER);
    
    const totalFiles = auditPictures.length + fridgePictures.length;
    const totalSize = [...auditPictures, ...fridgePictures].reduce((sum, f) => sum + f.size, 0);
    
    console.log(`   Found ${auditPictures.length} audit pictures (${(auditPictures.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`   Found ${fridgePictures.length} fridge pictures (${(fridgePictures.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`   Total: ${totalFiles} files (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
    console.log('');

    if (totalFiles === 0) {
        console.log('✅ No files to process.');
        return;
    }

    // Create backup directories if needed
    if (!DRY_RUN && !NO_BACKUP) {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        await fs.mkdir(FRIDGE_BACKUP_DIR, { recursive: true });
        console.log('📦 Backup directories ready');
    }

    // Process audit pictures
    const stats = {
        processed: 0,
        optimized: 0,
        skipped: 0,
        errors: 0,
        totalSavings: 0,
        wouldOptimize: 0,
        potentialSavings: 0
    };

    console.log('\n🖼️  Processing audit pictures...');
    const auditBatches = Math.ceil(auditPictures.length / BATCH_SIZE);
    for (let i = 0; i < auditBatches; i++) {
        const batch = auditPictures.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        console.log(`\n📦 Batch ${i + 1}/${auditBatches} (${batch.length} files)`);
        await processBatch(batch, BACKUP_DIR, stats);
    }

    console.log('\n🌡️  Processing fridge pictures...');
    const fridgeBatches = Math.ceil(fridgePictures.length / BATCH_SIZE);
    for (let i = 0; i < fridgeBatches; i++) {
        const batch = fridgePictures.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        console.log(`\n📦 Batch ${i + 1}/${fridgeBatches} (${batch.length} files)`);
        await processBatch(batch, FRIDGE_BACKUP_DIR, stats);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total processed: ${stats.processed}`);
    
    if (DRY_RUN) {
        console.log(`Would optimize: ${stats.wouldOptimize}`);
        console.log(`Would skip: ${stats.skipped}`);
        console.log(`Potential savings: ${(stats.potentialSavings / 1024 / 1024).toFixed(1)} MB`);
        console.log('');
        console.log('💡 Run without --dry-run to apply optimizations');
    } else {
        console.log(`Optimized: ${stats.optimized}`);
        console.log(`Skipped: ${stats.skipped}`);
        console.log(`Errors: ${stats.errors}`);
        console.log(`Total savings: ${(stats.totalSavings / 1024 / 1024).toFixed(1)} MB`);
        
        if (!NO_BACKUP) {
            console.log('');
            console.log(`📦 Originals backed up to:`);
            console.log(`   ${BACKUP_DIR}`);
            console.log(`   ${FRIDGE_BACKUP_DIR}`);
        }
    }
    
    console.log('\n✅ Migration complete!');
}

// Run
runMigration().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
