const sql = require('mssql');

async function updateTemplate() {
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
    
    // Get current template
    const result = await pool.request().query("SELECT html_body FROM EmailTemplates WHERE template_key = 'report_notification'");
    
    if (result.recordset.length > 0) {
        let htmlBody = result.recordset[0].html_body;
        
        // Check if urgentHrNotes placeholder already exists
        if (htmlBody.includes('{{urgentHrNotes}}')) {
            console.log('urgentHrNotes placeholder already exists in template');
        } else {
            // Add {{urgentHrNotes}} after {{customMessage}}
            htmlBody = htmlBody.replace(
                '{{customMessage}}',
                '{{customMessage}}\n{{urgentHrNotes}}'
            );
            
            // Update the template
            await pool.request()
                .input('htmlBody', sql.NVarChar(sql.MAX), htmlBody)
                .query("UPDATE EmailTemplates SET html_body = @htmlBody WHERE template_key = 'report_notification'");
            
            console.log('Template updated successfully!');
            console.log('\nUpdated template now includes {{urgentHrNotes}} placeholder after {{customMessage}}');
        }
    } else {
        console.log('No template found');
    }
    
    await pool.close();
}

updateTemplate().catch(console.error);
