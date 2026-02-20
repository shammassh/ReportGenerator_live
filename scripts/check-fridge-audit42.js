const sql = require('mssql');
const config = require('../config/default').database;

(async () => {
    try {
        const pool = await sql.connect(config);
        
        // Check if FridgeReadings table exists and get data for audit 42
        const result = await pool.request()
            .input('AuditID', sql.Int, 42)
            .query(`
                SELECT 
                    ReadingID,
                    AuditID,
                    ResponseID,
                    ReadingType,
                    Section,
                    Unit,
                    DisplayTemp,
                    ProbeTemp,
                    Issue,
                    PicturePath
                FROM FridgeReadings
                WHERE AuditID = @AuditID
                ORDER BY ReadingID
            `);
        
        console.log('=== Fridge Readings for Audit 42 ===');
        console.log('Total:', result.recordset.length);
        
        if (result.recordset.length > 0) {
            // Group by type
            const good = result.recordset.filter(r => r.ReadingType === 'Good');
            const bad = result.recordset.filter(r => r.ReadingType === 'Bad');
            
            console.log('\n--- Good Readings:', good.length, '---');
            good.forEach(r => {
                console.log(`  [${r.ReadingID}] ${r.Section} - ${r.Unit}: Display=${r.DisplayTemp}°C, Air=${r.ProbeTemp}°C`);
                if (r.PicturePath) console.log(`       Picture: ${r.PicturePath}`);
            });
            
            console.log('\n--- Bad Readings (Findings):', bad.length, '---');
            bad.forEach(r => {
                console.log(`  [${r.ReadingID}] ${r.Section} - ${r.Unit}: Display=${r.DisplayTemp}°C, Air=${r.ProbeTemp}°C`);
                console.log(`       Issue: ${r.Issue}`);
                if (r.PicturePath) console.log(`       Picture: ${r.PicturePath}`);
            });
        } else {
            console.log('No fridge readings found for this audit.');
        }
        
        await pool.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
