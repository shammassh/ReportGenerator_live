const sql = require('mssql');
const config = require('./config/default').database;

async function check() {
    const pool = await sql.connect(config);
    
    // Fix Cold Stone stores - set Brand
    console.log('=== Fixing Cold Stone Stores ===');
    const result = await pool.request()
        .query(`UPDATE Stores SET Brand = 'Cold Stone' WHERE StoreName LIKE '%Cold Stone%' AND Brand IS NULL`);
    console.log('Updated rows:', result.rowsAffected);
    
    // Verify
    console.log('\n=== Verifying Cold Stone Stores ===');
    const stores = await pool.request()
        .query(`SELECT StoreID, StoreName, Brand FROM Stores WHERE StoreName LIKE '%Cold Stone%'`);
    stores.recordset.forEach(s => console.log(' -', s.StoreID, s.StoreName, '| Brand:', s.Brand));
    
    await pool.close();
}

check().catch(console.error);
