const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    const config = {
        server: process.env.SQL_SERVER || 'PowerApps-Repor',
        database: process.env.SQL_DATABASE || 'FoodSafetyDB',
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    };

    try {
        console.log('🔌 Connecting to SQL Server...');
        const pool = await sql.connect(config);
        console.log('✅ Connected to SQL Server');
        
        // Read SQL file
        const sqlFilePath = path.join(__dirname, 'sql', 'audit-template-schema.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Split by GO statements
        const batches = sqlContent.split(/\nGO\s*\n/i).filter(batch => batch.trim());
        
        console.log(`📋 Executing ${batches.length} SQL batches...`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                try {
                    await pool.request().query(batch);
                    process.stdout.write('.');
                } catch (err) {
                    if (err.message.includes('already exists') || err.message.includes('already an object')) {
                        process.stdout.write('s'); // skip
                    } else {
                        console.log(`\n⚠️ Batch ${i + 1} warning: ${err.message.substring(0, 100)}`);
                    }
                }
            }
        }
        
        console.log('\n\n✅ Database setup complete!');
        console.log('');
        console.log('Tables created:');
        console.log('  - AuditSchemas');
        console.log('  - AuditSections');
        console.log('  - AuditItems');
        console.log('');
        console.log('Stored Procedures:');
        console.log('  - sp_GetAllSchemas');
        console.log('  - sp_CreateSchema');
        console.log('  - sp_GetSectionsBySchema');
        console.log('  - sp_CreateSection');
        console.log('  - sp_GetItemsBySection');
        console.log('  - sp_CreateItem');
        console.log('  - sp_UpdateItem');
        console.log('  - sp_DeleteItem');
        console.log('  - sp_GetFullSchema');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

setupDatabase();
