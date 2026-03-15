require('dotenv').config({ path: '.env.live' });
const sql = require('mssql');

(async () => {
    const pool = await sql.connect({
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: { encrypt: false, trustServerCertificate: true }
    });
    
    // Check table structure
    const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Sessions'`);
    console.log('Sessions columns:', cols.recordset.map(c => c.COLUMN_NAME));
    
    // Check all sessions
    const result = await pool.request().query(`SELECT * FROM Sessions`);
    console.log('\nAll sessions:', result.recordset);
    
    // Check system sender email from env
    console.log('\nSYSTEM_SENDER_EMAIL:', process.env.SYSTEM_SENDER_EMAIL);
    
    await pool.close();
})();
