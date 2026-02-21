const sql = require('mssql');
const config = require('./config/default').database;
sql.connect(config).then(async pool => {
    const r = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Notifications'");
    console.log('Notifications columns:', r.recordset.map(x => x.COLUMN_NAME));
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
