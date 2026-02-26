require('dotenv').config();
const sql = require('mssql');

const config = {
    server: 'localhost',
    database: 'FoodSafetyDB_Live',
    user: 'sa',
    password: process.env.SQL_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
    const pool = await sql.connect(config);
    
    // Check GNG Mar Mkhael specifically
    console.log('=== GNG Mar Mkhael Audit ===');
    const r = await pool.request().query(`
        SELECT AuditID, DocumentNumber, StoreName, TotalScore, Status 
        FROM AuditInstances 
        WHERE StoreName LIKE '%Mar Mkh%'
    `);
    console.table(r.recordset);
    
    // If the score is 86.8 and PassingGrade is 87, then 86.8 >= 87 is FALSE
    // So it would be in the failing list
    console.log('\n=== Score Analysis ===');
    console.log('Score: 86.8, PassingGrade: 87');
    console.log('86.8 >= 87 =', 86.8 >= 87);  // false
    console.log('86.8 < 87 =', 86.8 < 87);    // true (so it fails)
    
    // But maybe the TotalScore stored is actually higher? Let's check
    if (r.recordset.length > 0) {
        const audit = r.recordset[0];
        console.log(`\nActual stored TotalScore: ${audit.TotalScore}`);
        console.log(`${audit.TotalScore} >= 87 = ${audit.TotalScore >= 87}`);
    }
    
    pool.close();
})();
