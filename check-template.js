const sql = require('mssql');

async function checkTemplate() {
    const pool = await sql.connect({
        server: 'localhost',
        database: 'FoodSafetyDB_Live',
        user: 'sa',
        password: 'Kokowawa123@@',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    });
    
    const result = await pool.request().query("SELECT html_body FROM EmailTemplates WHERE template_key = 'report_notification'");
    
    if (result.recordset.length > 0) {
        console.log('TEMPLATE HTML (first 3000 chars):\n');
        console.log(result.recordset[0].html_body?.substring(0, 3000));
    } else {
        console.log('No template found');
    }
    
    await pool.close();
}

checkTemplate().catch(console.error);
