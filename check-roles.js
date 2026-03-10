const sql = require('mssql');
const dbConfig = require('./config/default').database;

async function check() {
    const pool = await sql.connect(dbConfig);
    
    // Check roles
    const result = await pool.request().query(`
        SELECT id, display_name, role 
        FROM Users 
        WHERE role IN ('HeadOfOperations','AreaManager') AND is_active = 1
    `);
    console.log('HeadOfOps/AreaManager users:', result.recordset);
    
    // Check StoreManagerAssignments structure
    const sma = await pool.request().query(`
        SELECT TOP 5 * FROM StoreManagerAssignments
    `);
    console.log('\nStoreManagerAssignments sample:', sma.recordset);
    
    // Check UserAreaAssignments
    const uaa = await pool.request().query(`
        SELECT TOP 5 * FROM UserAreaAssignments
    `);
    console.log('\nUserAreaAssignments sample:', uaa.recordset);
    
    process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
