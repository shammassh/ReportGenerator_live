const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'FoodSafetyDB_Live',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: { 
        encrypt: false, 
        trustServerCertificate: true 
    }
};

async function checkAuditDate() {
    try {
        const pool = await sql.connect(config);
        
        const result = await pool.request().query(`
            SELECT AuditID, DocumentNumber, AuditDate, StoreName, Status 
            FROM AuditInstances 
            WHERE DocumentNumber = 'GMRL-FSACSG-1221-0027'
        `);
        
        console.log('Current audit data:');
        console.log(JSON.stringify(result.recordset, null, 2));
        
        await pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkAuditDate();
