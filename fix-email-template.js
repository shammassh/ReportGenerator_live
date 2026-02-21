// Fix email template placeholders
const sql = require('mssql');
const config = require('./config/default').database;

async function fixTemplate() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected to database');
        
        const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Action Plan Submitted</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Dear Food Safety Team,</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">The action plan related to the Food Safety Report has been completed and saved on the online dashboard.</p>
        <div style="background: #d1fae5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
            <strong>Store:</strong> {{store_name}}<br>
            <strong>Document:</strong> {{document_number}}<br>
            <strong>Audit Date:</strong> {{audit_date}}<br>
            <strong>Score:</strong> {{score}}<br>
            <strong>Submitted by:</strong> {{submitter_name}}
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Please review the action plan on the dashboard.</p>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">Thank you.</p>
    </div>
    <div style="text-align: center; padding: 15px; color: #6b7280; font-size: 12px;">
        Food Safety Audit System - GMRL Group
    </div>
</div>`;

        const result = await pool.request()
            .input('subject', sql.NVarChar, 'Action Plan Submitted - {{store_name}} ({{document_number}})')
            .input('body', sql.NVarChar(sql.MAX), htmlBody)
            .input('key', sql.NVarChar, 'action_plan_submitted')
            .query(`
                UPDATE EmailTemplates 
                SET subject_template = @subject,
                    html_body = @body,
                    updated_at = GETDATE()
                WHERE template_key = @key
            `);
        
        console.log('Rows updated:', result.rowsAffected[0]);
        
        // Verify
        const verify = await pool.request()
            .input('key', sql.NVarChar, 'action_plan_submitted')
            .query('SELECT subject_template FROM EmailTemplates WHERE template_key = @key');
        
        console.log('Updated subject:', verify.recordset[0]?.subject_template);
        
        await pool.close();
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixTemplate();
