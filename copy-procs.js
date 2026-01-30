const sql = require('mssql');

async function copyProcedures() {
    const uatConfig = {
        server: 'localhost',
        database: 'FoodSafetyDB',
        user: 'sa',
        password: 'Kokowawa123@@',
        options: { encrypt: false, trustServerCertificate: true }
    };
    
    const liveConfig = {
        server: 'localhost',
        database: 'FoodSafetyDB_Live',
        user: 'sa',
        password: 'Kokowawa123@@',
        options: { encrypt: false, trustServerCertificate: true }
    };
    
    const uatPool = await sql.connect(uatConfig);
    
    // Get missing procedures
    const missingResult = await uatPool.request().query(`
        SELECT name FROM sys.procedures WHERE name LIKE 'sp_%'
        EXCEPT
        SELECT name FROM FoodSafetyDB_Live.sys.procedures WHERE name LIKE 'sp_%'
    `);
    
    console.log(`Found ${missingResult.recordset.length} missing procedures`);
    
    for (const row of missingResult.recordset) {
        const procName = row.name;
        try {
            // Get procedure definition
            const defResult = await uatPool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('${procName}')) AS def`);
            const def = defResult.recordset[0].def;
            
            if (def) {
                // Create in Live
                const livePool = await new sql.ConnectionPool(liveConfig).connect();
                
                // Drop if exists
                await livePool.request().query(`IF EXISTS (SELECT * FROM sys.procedures WHERE name = '${procName}') DROP PROCEDURE ${procName}`);
                
                // Create procedure
                await livePool.request().query(def);
                console.log(`✅ Created: ${procName}`);
                await livePool.close();
            }
        } catch (err) {
            console.log(`❌ Failed: ${procName} - ${err.message.substring(0, 50)}`);
        }
    }
    
    await uatPool.close();
    console.log('Done!');
}

copyProcedures().catch(console.error);
