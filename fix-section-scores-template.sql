-- Fix email template to use correct sectionScores placeholder
UPDATE EmailTemplates 
SET html_body = '<div class="container">
<div class="header">
<h1>&#127869; Food Safety Audit Report</h1>
</div>
<div class="content">
<p>Dear {{recipientName}},</p>
<p>The Food Safety Report for your store has been successfully submitted and is now available on the online dashboard.</p>
<div class="highlight">
<strong>&#127978; Store:</strong> {{storeName}}<br>
<strong>&#128203; Document:</strong> {{documentNumber}}<br>
<strong>&#128197; Date:</strong> {{auditDate}}<br>
<strong>&#127919; Score:</strong> <span style="color: {{scoreColor}}; font-weight: bold;">{{score}}</span><br>
<strong>&#128200; Status:</strong> <span style="display: inline-block; background: {{statusBgColor}}; color: {{statusColor}}; padding: 4px 12px; border-radius: 4px; font-weight: bold;">{{statusEmoji}} {{statusText}}</span>
</div>
<div style="margin: 20px 0;">
<h3 style="text-align: center; color: #1e3a5f;">&#128202; Section Scores</h3>
{{sectionScores}}
</div>
{{customMessage}}
<p>You can access the report via the following link:</p>
<p style="text-align: center;"><a class="button" href="{{reportUrl}}">&#128196; View Report</a></p>
<p><strong>&#128221; Please review the report and ensure filling the action plan along with accompanying photos within one week.</strong></p>
<p>If you have any questions, do not hesitate to contact the food safety team.</p>
<p>Thank you.</p>
</div>
<div class="footer">
<p>Food Safety Audit System | GMRL Group</p>
</div>
</div>'
WHERE template_key = 'report_notification';

SELECT 'Template updated successfully' AS Result;
