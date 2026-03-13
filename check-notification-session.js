const sql = require('mssql');
const config = require('./config/default').database;

async function check() {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
        SELECT TOP 5 
            s.id, 
            u.email, 
            s.created_at, 
            s.expires_at,
            CASE WHEN s.expires_at > GETDATE() THEN 'ACTIVE' ELSE 'EXPIRED' END as status,
            CASE WHEN s.azure_refresh_token IS NOT NULL THEN 'YES' ELSE 'NO' END as has_refresh_token
        FROM Sessions s 
        INNER JOIN Users u ON s.user_id = u.id 
        WHERE u.email LIKE '%notification%' 
        ORDER BY s.id DESC
    `);
    console.log('\n📧 Notification Account Sessions:\n');
    console.table(result.recordset);
    
    // Check if created_at is null and fix it
    const session = result.recordset[0];
    if (session && !session.created_at) {
        console.log('\n⚠️ created_at is NULL! Fixing...');
        await pool.request().query(`
            UPDATE Sessions SET created_at = GETDATE() WHERE id = ${session.id}
        `);
        console.log('✅ Fixed created_at for session ID:', session.id);
    }
    
    process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
