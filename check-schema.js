const sql = require('mssql');
const config = require('./config/default').database;
sql.connect(config).then(async pool => {
    const r = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Stores'");
    console.log('Stores columns:', r.recordset.map(x => x.COLUMN_NAME));
    
    const r2 = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UserAreaAssignments'");
    console.log('UserAreaAssignments columns:', r2.recordset.map(x => x.COLUMN_NAME));
    
    const r3 = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UserBrandAssignments'");
    console.log('UserBrandAssignments columns:', r3.recordset.map(x => x.COLUMN_NAME));
    
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
