const sql = require('mssql');
const config = require('./config/default').database;

async function check() {
    const pool = await sql.connect(config);
    
    // Get audit 22 (Spinneys Tilal) responses for reference 1.11
    const r = await pool.request()
        .query("SELECT ResponseID, ReferenceValue, Title, SelectedChoice, Value FROM AuditResponses WHERE AuditID = 22 AND ReferenceValue LIKE '1.11%'");
    
    console.log('Item 1.11 data:');
    console.log(r.recordset);
    
    await pool.close();
}
check();
