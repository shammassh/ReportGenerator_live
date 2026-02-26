/**
 * Diagnostic script to check failing branches logic
 */
require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'FoodSafetyDB_Live',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

async function checkFailingBranches() {
    let pool;
    try {
        console.log('Connecting to database...');
        pool = await sql.connect(config);
        console.log('Connected!\n');

        // 1. Check SystemSettings table for PassingGrade values
        console.log('=== SystemSettings (PassingGrade values) ===');
        const settingsResult = await pool.request().query(`
            SELECT ss.SettingID, ss.SchemaID, s.SchemaName, ss.SettingType, ss.PassingGrade
            FROM SystemSettings ss
            LEFT JOIN AuditSchemas s ON s.SchemaID = ss.SchemaID
            ORDER BY ss.SchemaID, ss.SettingType
        `);
        console.table(settingsResult.recordset);
        
        // 2. Get audits list with PassingGrade joined
        console.log('\n=== Completed Audits with PassingGrade ===');
        const auditsResult = await pool.request().query(`
            SELECT TOP 20
                a.AuditID,
                a.DocumentNumber,
                a.StoreName,
                a.SchemaID,
                s.SchemaName,
                a.Cycle AS AuditCycle,
                a.Year AS AuditYear,
                a.Status,
                a.TotalScore,
                ISNULL(ss.PassingGrade, 83) AS PassingGrade,
                CASE WHEN a.TotalScore < ISNULL(ss.PassingGrade, 83) THEN 'FAIL' ELSE 'PASS' END AS Result
            FROM AuditInstances a
            INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
            LEFT JOIN SystemSettings ss ON ss.SchemaID = a.SchemaID AND ss.SettingType = 'Overall'
            WHERE a.Status = 'Completed'
            ORDER BY a.AuditDate DESC
        `);
        console.table(auditsResult.recordset);
        
        // 3. Check specifically for stores that might be incorrectly showing as failing
        console.log('\n=== Looking for "gng" or "mkhail" store ===');
        const searchResult = await pool.request().query(`
            SELECT 
                a.AuditID,
                a.DocumentNumber,
                a.StoreName,
                a.SchemaID,
                s.SchemaName,
                a.Cycle AS AuditCycle,
                a.Year AS AuditYear,
                a.Status,
                a.TotalScore,
                ISNULL(ss.PassingGrade, 83) AS PassingGrade,
                CASE WHEN a.TotalScore < ISNULL(ss.PassingGrade, 83) THEN 'FAIL' ELSE 'PASS' END AS Result
            FROM AuditInstances a
            INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
            LEFT JOIN SystemSettings ss ON ss.SchemaID = a.SchemaID AND ss.SettingType = 'Overall'
            WHERE a.Status = 'Completed'
              AND (a.StoreName LIKE '%gng%' OR a.StoreName LIKE '%mkhail%' OR a.StoreName LIKE '%mikhail%' OR a.StoreName LIKE '%mar%')
            ORDER BY a.AuditDate DESC
        `);
        console.table(searchResult.recordset);
        
        // 4. Check for audits that are showing as failing but might have score >= PassingGrade
        console.log('\n=== Potential False Failing (Score >= PassingGrade but showing as fail) ===');
        const falseFailResult = await pool.request().query(`
            SELECT 
                a.AuditID,
                a.DocumentNumber,
                a.StoreName,
                a.SchemaID,
                s.SchemaName,
                a.Cycle AS AuditCycle,
                a.Year AS AuditYear,
                a.TotalScore,
                ISNULL(ss.PassingGrade, 83) AS PassingGrade,
                CASE 
                    WHEN a.TotalScore >= ISNULL(ss.PassingGrade, 83) THEN 'Should NOT be in failing list'
                    ELSE 'Correctly in failing list'
                END AS Note
            FROM AuditInstances a
            INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
            LEFT JOIN SystemSettings ss ON ss.SchemaID = a.SchemaID AND ss.SettingType = 'Overall'
            WHERE a.Status = 'Completed'
              AND a.TotalScore IS NOT NULL
            ORDER BY a.TotalScore DESC
        `);
        console.table(falseFailResult.recordset);
        
        // 5. Check if there are multiple audits for the same store/cycle
        console.log('\n=== Multiple audits per Store/Cycle (duplicates issue?) ===');
        const duplicatesResult = await pool.request().query(`
            SELECT 
                a.StoreName,
                a.SchemaID,
                s.SchemaName,
                a.Cycle,
                a.Year,
                COUNT(*) AS AuditCount,
                STRING_AGG(CAST(a.TotalScore AS NVARCHAR), ', ') AS Scores,
                STRING_AGG(a.DocumentNumber, ', ') AS DocumentNumbers
            FROM AuditInstances a
            INNER JOIN AuditSchemas s ON a.SchemaID = s.SchemaID
            WHERE a.Status = 'Completed'
            GROUP BY a.StoreName, a.SchemaID, s.SchemaName, a.Cycle, a.Year
            HAVING COUNT(*) > 1
            ORDER BY a.Year DESC, a.Cycle DESC
        `);
        console.table(duplicatesResult.recordset);

        console.log('\n✅ Diagnostic complete!');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (pool) await pool.close();
    }
}

checkFailingBranches();
