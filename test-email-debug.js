const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Kokowawa123@@',
    server: 'localhost',
    database: 'FoodSafetyDB_Live',
    options: { encrypt: false, trustServerCertificate: true }
};

async function test() {
    const pool = await sql.connect(config);
    
    // Get store code for audit 14
    const auditResult = await pool.request()
        .input('auditId', sql.Int, 14)
        .query('SELECT StoreCode FROM AuditInstances WHERE AuditID = @auditId');
    
    const storeCode = auditResult.recordset[0]?.StoreCode;
    console.log('Store code for audit 14:', storeCode);
    
    // Get store managers
    const result = await pool.request().query(`
        SELECT id, email, display_name, assigned_stores
        FROM Users
        WHERE role = 'StoreManager'
        AND is_active = 1
        AND is_approved = 1
    `);
    
    console.log('Total store managers:', result.recordset.length);
    
    // Find matches
    let matchCount = 0;
    for (const mgr of result.recordset) {
        if (mgr.assigned_stores) {
            try {
                const stores = JSON.parse(mgr.assigned_stores);
                if (stores.includes(storeCode)) {
                    console.log('MATCH:', mgr.email, '-', mgr.assigned_stores);
                    matchCount++;
                }
            } catch(e) {
                console.log('JSON parse error for:', mgr.email);
            }
        }
    }
    
    console.log('Total matches:', matchCount);
    
    pool.close();
}
test().catch(console.error);
