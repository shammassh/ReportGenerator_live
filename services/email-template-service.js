/**
 * Email Template Service
 * Manages dynamic email templates from database
 * Admin can edit templates without code changes
 */

const sql = require('mssql');

class EmailTemplateService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Get database config
     */
    getDbConfig() {
        return require('../config/default').database;
    }

    /**
     * Get template by key with caching
     */
    async getTemplate(templateKey) {
        // Check cache first
        const cached = this.cache.get(templateKey);
        if (cached && Date.now() < cached.expiry) {
            return cached.template;
        }

        try {
            const pool = await sql.connect(this.getDbConfig());
            const result = await pool.request()
                .input('key', sql.NVarChar(50), templateKey)
                .query(`
                    SELECT * FROM EmailTemplates 
                    WHERE template_key = @key AND is_active = 1
                `);

            if (result.recordset.length > 0) {
                const template = result.recordset[0];
                // Cache it
                this.cache.set(templateKey, {
                    template,
                    expiry: Date.now() + this.cacheExpiry
                });
                return template;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching template ${templateKey}:`, error.message);
            return null;
        }
    }

    /**
     * Get all templates (for admin UI)
     */
    async getAllTemplates() {
        try {
            const pool = await sql.connect(this.getDbConfig());
            const result = await pool.request().query(`
                SELECT * FROM EmailTemplates ORDER BY template_name
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching all templates:', error.message);
            return [];
        }
    }

    /**
     * Update template (admin only)
     */
    async updateTemplate(templateKey, updates, userId, userName) {
        try {
            const pool = await sql.connect(this.getDbConfig());
            await pool.request()
                .input('key', sql.NVarChar(50), templateKey)
                .input('name', sql.NVarChar(100), updates.template_name)
                .input('description', sql.NVarChar(500), updates.description)
                .input('subject', sql.NVarChar(500), updates.subject_template)
                .input('body', sql.NVarChar(sql.MAX), updates.html_body)
                .input('isActive', sql.Bit, updates.is_active !== false ? 1 : 0)
                .input('userId', sql.Int, userId)
                .input('userName', sql.NVarChar(100), userName)
                .query(`
                    UPDATE EmailTemplates SET
                        template_name = @name,
                        description = @description,
                        subject_template = @subject,
                        html_body = @body,
                        is_active = @isActive,
                        updated_at = GETDATE(),
                        updated_by = @userId,
                        updated_by_name = @userName
                    WHERE template_key = @key
                `);

            // Clear cache
            this.cache.delete(templateKey);
            return { success: true };
        } catch (error) {
            console.error('Error updating template:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Replace placeholders in template
     * @param {string} template - Template string with {{placeholder}} syntax
     * @param {object} data - Key-value pairs for replacement
     */
    replacePlaceholders(template, data) {
        if (!template) return '';
        
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'gi');
            result = result.replace(regex, value ?? '');
        }
        return result;
    }

    /**
     * Build email from template
     * @param {string} templateKey - Template identifier
     * @param {object} data - Data for placeholders
     * @returns {object} { subject, html } or null if template not found
     */
    async buildEmail(templateKey, data) {
        const template = await this.getTemplate(templateKey);
        
        if (!template) {
            console.warn(`Template '${templateKey}' not found, using fallback`);
            return null;
        }

        return {
            subject: this.replacePlaceholders(template.subject_template, data),
            html: this.replacePlaceholders(template.html_body, data)
        };
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Insert default templates (run once during setup)
     */
    async insertDefaultTemplates() {
        const defaults = this.getDefaultTemplates();
        
        try {
            const pool = await sql.connect(this.getDbConfig());
            
            for (const template of defaults) {
                // Check if exists
                const exists = await pool.request()
                    .input('key', sql.NVarChar(50), template.template_key)
                    .query('SELECT id FROM EmailTemplates WHERE template_key = @key');
                
                if (exists.recordset.length === 0) {
                    await pool.request()
                        .input('key', sql.NVarChar(50), template.template_key)
                        .input('name', sql.NVarChar(100), template.template_name)
                        .input('description', sql.NVarChar(500), template.description)
                        .input('subject', sql.NVarChar(500), template.subject_template)
                        .input('body', sql.NVarChar(sql.MAX), template.html_body)
                        .input('placeholders', sql.NVarChar(sql.MAX), JSON.stringify(template.placeholders))
                        .query(`
                            INSERT INTO EmailTemplates 
                            (template_key, template_name, description, subject_template, html_body, available_placeholders)
                            VALUES (@key, @name, @description, @subject, @body, @placeholders)
                        `);
                    console.log(`✅ Inserted template: ${template.template_key}`);
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error inserting default templates:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get default template definitions
     */
    getDefaultTemplates() {
        return [
            {
                template_key: 'action_plan_ready',
                template_name: 'Action Plan Ready',
                description: 'Sent to Store Managers when their action plan is ready for review',
                subject_template: '🎯 Action Plan Ready - {{store_name}} - {{document_number}}',
                placeholders: ['recipient_name', 'store_name', 'document_number', 'audit_date', 'score', 'score_color', 'report_url'],
                html_body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🎯 Action Plan Report</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Food Safety Audit System</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 22px;">Dear {{recipient_name}},</h2>
                            
                            <p style="font-size: 16px; line-height: 1.8; color: #34495e; margin: 0 0 30px 0;">
                                The Action Plan for your store audit is now ready for your review and action.
                            </p>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8f9fa; border-radius: 8px; margin: 0 0 30px 0; border: 1px solid #e9ecef;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <table width="100%" cellpadding="8" cellspacing="0" border="0">
                                            <tr>
                                                <td style="color: #7f8c8d; font-size: 14px; width: 40%; vertical-align: top;">📄 Document Number:</td>
                                                <td style="font-weight: bold; color: #2c3e50; font-size: 15px;">{{document_number}}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #7f8c8d; font-size: 14px; padding-top: 15px; vertical-align: top;">🏪 Store Name:</td>
                                                <td style="font-weight: bold; color: #2c3e50; font-size: 15px; padding-top: 15px;">{{store_name}}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #7f8c8d; font-size: 14px; padding-top: 15px; vertical-align: top;">📅 Audit Date:</td>
                                                <td style="font-weight: bold; color: #2c3e50; font-size: 15px; padding-top: 15px;">{{audit_date}}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #7f8c8d; font-size: 14px; padding-top: 15px; vertical-align: top;">📊 Audit Score:</td>
                                                <td style="font-weight: bold; color: {{score_color}}; font-size: 18px; padding-top: 15px;">{{score}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{{report_url}}" style="display: inline-block; background: #2c3e50; color: white; padding: 18px 50px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 17px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); border: 2px solid #2c3e50;">
                                            📋 View Action Plan
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px; margin: 30px 0 0 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            <strong>⚠️ Important:</strong> Please review the findings and take necessary corrective actions. Update the action plan with your progress.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="font-size: 14px; color: #7f8c8d; margin: 30px 0 0 0; line-height: 1.6;">
                                Best regards,<br>
                                <strong style="color: #2c3e50;">Food Safety Audit Team</strong>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align: center; padding: 25px 30px; background: #f8f9fa; border-radius: 0 0 10px 10px; border-top: 1px solid #e9ecef;">
                            <p style="margin: 0; color: #95a5a6; font-size: 12px; line-height: 1.5;">
                                This is an automated notification from the Food Safety Audit System.<br>
                                Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
            },
            {
                template_key: 'report_notification',
                template_name: 'Report Notification',
                description: 'Sent to Store Managers when a new audit report is published',
                subject_template: 'Food Safety Audit Report - {{storeName}} ({{documentNumber}})',
                placeholders: ['recipientName', 'storeName', 'documentNumber', 'auditDate', 'score', 'reportUrl', 'dashboardUrl'],
                html_body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 25px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .highlight { background: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍽️ Food Safety Audit Report</h1>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <p>The Food Safety Report for your store has been successfully submitted and is now available on the online dashboard.</p>
            
            <div class="highlight">
                <strong>📋 Store:</strong> {{storeName}}<br>
                <strong>📄 Document:</strong> {{documentNumber}}<br>
                <strong>📅 Date:</strong> {{auditDate}}<br>
                <strong>📊 Score:</strong> {{score}}
            </div>
            
            <p>You can access the report via the following link:</p>
            
            <p style="text-align: center;">
                <a href="{{reportUrl}}" class="button">📄 View Report</a>
            </p>
            
            <p><strong>⚠️ Please review the report and ensure filling the action plan along with accompanying photos within one week.</strong></p>
            
            <p>If you have any questions, don't hesitate to contact the food safety team.</p>
            
            <p>Thank you.</p>
        </div>
        <div class="footer">
            <p>Food Safety Audit System | GMRL Group</p>
        </div>
    </div>
</body>
</html>`
            },
            {
                template_key: 'broadcast_announcement',
                template_name: 'Broadcast Announcement',
                description: 'Used for admin announcements, reminders, and urgent notifications',
                subject_template: '{{type_emoji}} {{title}}',
                placeholders: ['type_emoji', 'broadcast_type', 'title', 'message', 'sender_name', 'sender_email', 'recipient_name'],
                html_body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">{{type_emoji}} {{broadcast_type}}</h1>
    </div>
    <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1f2937; margin-top: 0;">{{title}}</h2>
        <div style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">{{message}}</div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Sent by {{sender_name}} via Food Safety Audit System
        </p>
    </div>
</div>`
            },
            {
                template_key: 'action_plan_submitted',
                template_name: 'Action Plan Submitted',
                description: 'Sent to Auditors when Store Manager completes an action plan',
                subject_template: 'Action Plan Submitted - {{store_name}} ({{document_number}})',
                placeholders: ['store_name', 'document_number', 'audit_date', 'score', 'submitter_name', 'submitter_email', 'dashboard_url'],
                html_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">✅ Action Plan Submitted</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Dear Food Safety Team,
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            The action plan related to the Food Safety Report has been completed and saved on the online dashboard.
        </p>
        
        <div style="background: #dbeafe; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 4px;">
            <strong>📋 Store:</strong> {{store_name}}<br>
            <strong>📄 Document:</strong> {{document_number}}<br>
            <strong>📅 Audit Date:</strong> {{audit_date}}<br>
            <strong>📊 Score:</strong> {{score}}<br>
            <strong>👤 Submitted by:</strong> {{submitter_name}} ({{submitter_email}})
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Thank you.
        </p>
    </div>
    <div style="text-align: center; padding: 15px; color: #6b7280; font-size: 12px;">
        Food Safety Audit System | GMRL Group
    </div>
</div>`
            },
            {
                template_key: 'scheduled_audit_reminder',
                template_name: 'Scheduled Audit Reminder',
                description: 'Reminder sent to Auditors before their scheduled audits',
                subject_template: '⏰ Audit Reminder: {{storeName}} on {{auditDate}}',
                placeholders: ['auditorName', 'storeName', 'auditDate', 'auditTime', 'checklistName', 'notes', 'calendarUrl'],
                html_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">⏰ Upcoming Audit Reminder</h1>
    </div>
    <div style="padding: 30px; background: #fffbeb; border: 1px solid #fcd34d; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Hi {{auditorName}},
        </p>
        
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
            This is a reminder that you have a scheduled audit coming up:
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="margin: 10px 0;"><strong>🏪 Store:</strong> {{storeName}}</div>
            <div style="margin: 10px 0;"><strong>📅 Date:</strong> {{auditDate}}</div>
            <div style="margin: 10px 0;"><strong>🕐 Time:</strong> {{auditTime}}</div>
            <div style="margin: 10px 0;"><strong>📋 Checklist:</strong> {{checklistName}}</div>
            {{#notes}}<div style="margin: 10px 0;"><strong>📝 Notes:</strong> {{notes}}</div>{{/notes}}
        </div>
        
        <p style="text-align: center; margin: 25px 0;">
            <a href="{{calendarUrl}}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                📅 View Calendar
            </a>
        </p>
        
        <p style="font-size: 14px; color: #6b7280;">
            Please ensure you arrive on time and have all necessary equipment ready.
        </p>
    </div>
    <div style="text-align: center; padding: 15px; color: #6b7280; font-size: 12px;">
        Food Safety Audit System | GMRL Group
    </div>
</div>`
            }
        ];
    }
}

module.exports = new EmailTemplateService();
