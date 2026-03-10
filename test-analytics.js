const sql = require('mssql');
const dbConfig = require('./config/default').database;

async function testAnalytics() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('Connected to DB');
        
        // Test basic query - same as analytics API
        let whereClause = "WHERE ai.Status = 'Completed'";
        
        const summaryResult = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalAudits,
                AVG(CAST(ai.TotalScore as FLOAT)) as AvgScore
            FROM AuditInstances ai
            LEFT JOIN Stores s ON ai.StoreID = s.StoreID
            ${whereClause}
        `);
        console.log('Summary:', summaryResult.recordset[0]);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testAnalytics();
