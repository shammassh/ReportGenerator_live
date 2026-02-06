const sql = require('mssql');
const config = {
    server: 'localhost',
    database: 'FoodSafetyDB_Live',
    user: 'sa',
    password: 'Kokowawa123@@',
    options: { encrypt: false, trustServerCertificate: true }
};

async function test() {
    const pool = await sql.connect(config);
    
    // Test with audit ID 14
    const auditId = 14;
    
    // Get store code
    const auditResult = await pool.request()
        .input('auditId', sql.Int, auditId)
        .query('SELECT StoreCode FROM AuditInstances WHERE AuditID = @auditId');
    
    const storeCode = auditResult.recordset.length > 0 ? auditResult.recordset[0].StoreCode : null;
    console.log('Store code:', storeCode);
    
    if (storeCode) {
        // Find store managers
        const storeManagersWithStores = await pool.request()
            .query(`
                SELECT id, email, display_name, assigned_stores
                FROM Users
                WHERE role = 'StoreManager'
                AND is_active = 1
                AND is_approved = 1
            `);
        
        console.log('Total store managers:', storeManagersWithStores.recordset.length);
        
        const managers = [];
        for (const mgr of storeManagersWithStores.recordset) {
            if (mgr.assigned_stores) {
                try {
                    const stores = JSON.parse(mgr.assigned_stores);
                    if (stores.includes(storeCode)) {
                        managers.push(mgr);
                        console.log('Matched:', mgr.email, '- stores:', mgr.assigned_stores);
                    }
                } catch (e) {
                    // Skip
                }
            }
        }
        
        console.log('Matched managers:', managers.length);
    }
    
    await pool.close();
}

test().catch(console.error);
