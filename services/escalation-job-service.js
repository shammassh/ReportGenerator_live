/**
 * Escalation Job Service
 * Background job that checks action plan deadlines and sends reminder/escalation emails
 */

const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

class EscalationJobService {
    constructor() {
        this.isRunning = false;
        this.lastRunTime = null;
        this.nextRunTime = null;
        this.intervalId = null;
        this.runIntervalMinutes = 60; // Run every hour
        this.jobStats = {
            totalRuns: 0,
            remindersSent: 0,
            escalationsSent: 0,
            errors: 0
        };
        // System sender email for automated notifications - must have an active session
        this.systemSenderEmail = process.env.SYSTEM_SENDER_EMAIL || 'spnotification@spinneys-lebanon.com';
    }

    /**
     * Get the access token for the system sender from their session
     * Uses token refresh if needed (delegated permissions)
     */
    async getSystemSenderToken() {
        const pool = await this.getDbPool();
        
        // Find active session for system sender
        const result = await pool.request()
            .input('email', sql.NVarChar, this.systemSenderEmail)
            .query(`
                SELECT TOP 1 s.session_token, s.azure_access_token, s.azure_refresh_token, s.expires_at, u.email
                FROM Sessions s
                INNER JOIN Users u ON s.user_id = u.id
                WHERE u.email = @email
                AND s.expires_at > GETDATE()
                ORDER BY s.created_at DESC
            `);
        
        if (result.recordset.length === 0) {
            throw new Error(`No active session found for system sender: ${this.systemSenderEmail}. Please login with this account.`);
        }
        
        const session = result.recordset[0];
        const tokenExpiry = new Date(session.expires_at);
        const now = new Date();
        
        // Check if access token is still valid (with 5 min buffer)
        if (tokenExpiry > new Date(now.getTime() + 5 * 60 * 1000) && session.azure_access_token) {
            console.log(`[EscalationJob] Using existing access token for ${this.systemSenderEmail}`);
            return session.azure_access_token;
        }
        
        // Token expired or about to expire, need to refresh
        if (!session.azure_refresh_token) {
            throw new Error(`No refresh token available for ${this.systemSenderEmail}. Please login again with offline_access scope.`);
        }
        
        console.log(`[EscalationJob] Refreshing access token for ${this.systemSenderEmail}...`);
        
        // Refresh the token
        const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
        
        const params = new URLSearchParams({
            client_id: process.env.AZURE_CLIENT_ID,
            client_secret: process.env.AZURE_CLIENT_SECRET,
            refresh_token: session.azure_refresh_token,
            grant_type: 'refresh_token',
            scope: 'User.Read User.ReadBasic.All Mail.Send offline_access'
        });

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
        }

        const tokenData = await response.json();
        
        // Update the session with new tokens
        // IMPORTANT: Extend session expiry by 24 hours (not just access token expiry)
        // This keeps the session alive as long as the refresh token is valid (90 days)
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await pool.request()
            .input('sessionToken', sql.NVarChar, session.session_token)
            .input('accessToken', sql.NVarChar, tokenData.access_token)
            .input('refreshToken', sql.NVarChar, tokenData.refresh_token || session.azure_refresh_token)
            .input('expiresAt', sql.DateTime, newExpiry)
            .query(`
                UPDATE Sessions 
                SET azure_access_token = @accessToken,
                    azure_refresh_token = @refreshToken,
                    expires_at = @expiresAt,
                    last_activity = GETDATE()
                WHERE session_token = @sessionToken
            `);
        
        console.log(`[EscalationJob] Token refreshed successfully for ${this.systemSenderEmail}`);
        return tokenData.access_token;
    }

    /**
     * Get database connection
     */
    async getDbPool() {
        return await sql.connect({
            server: process.env.SQL_SERVER || 'localhost',
            database: process.env.SQL_DATABASE || 'FoodSafetyDB_Live',
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            options: { encrypt: false, trustServerCertificate: true }
        });
    }

    /**
     * Get escalation settings from database
     */
    async getSettings() {
        const pool = await this.getDbPool();
        const result = await pool.request().query(`
            SELECT TOP 1 
                DeadlineDays, ReminderDaysBefore, AutoEscalationEnabled,
                EmailNotificationsEnabled, EscalationRecipients, GracePeriodHours, MaxReminders
            FROM ActionPlanEscalationSettings
        `);
        
        if (result.recordset.length > 0) {
            return result.recordset[0];
        }
        
        // Return defaults
        return {
            DeadlineDays: 7,
            ReminderDaysBefore: '3,1',
            AutoEscalationEnabled: true,
            EmailNotificationsEnabled: true,
            EscalationRecipients: 'AreaManager',
            GracePeriodHours: 24,
            MaxReminders: 3
        };
    }

    /**
     * Get email template from database
     */
    async getEmailTemplate(templateKey) {
        const pool = await this.getDbPool();
        const result = await pool.request()
            .input('key', sql.NVarChar, templateKey)
            .query('SELECT subject_template, html_body FROM EmailTemplates WHERE template_key = @key AND is_active = 1');
        
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    /**
     * Log job activity
     */
    async logActivity(jobRunId, eventType, details = {}) {
        try {
            const pool = await this.getDbPool();
            await pool.request()
                .input('jobRunId', sql.UniqueIdentifier, jobRunId)
                .input('eventType', sql.NVarChar, eventType)
                .input('documentNumber', sql.NVarChar, details.documentNumber || null)
                .input('storeName', sql.NVarChar, details.storeName || null)
                .input('recipientEmail', sql.NVarChar, details.recipientEmail || null)
                .input('recipientRole', sql.NVarChar, details.recipientRole || null)
                .input('emailTemplate', sql.NVarChar, details.emailTemplate || null)
                .input('status', sql.NVarChar, details.status || 'Success')
                .input('errorMessage', sql.NVarChar, details.errorMessage || null)
                .query(`
                    INSERT INTO EscalationJobLog 
                    (JobRunID, EventType, DocumentNumber, StoreName, RecipientEmail, RecipientRole, EmailTemplate, Status, ErrorMessage)
                    VALUES (@jobRunId, @eventType, @documentNumber, @storeName, @recipientEmail, @recipientRole, @emailTemplate, @status, @errorMessage)
                `);
        } catch (error) {
            console.error('[EscalationJob] Error logging activity:', error);
        }
    }

    /**
     * Get action plans needing reminders
     */
    async getActionPlansNeedingReminders(reminderDays) {
        const pool = await this.getDbPool();
        
        // Get audits that have action plans with approaching deadlines
        // Use DISTINCT and take earliest notification to avoid duplicates
        const result = await pool.request()
            .input('reminderDays', sql.Int, reminderDays)
            .query(`
                WITH AuditDeadlines AS (
                    SELECT 
                        ai.AuditID,
                        ai.DocumentNumber,
                        ai.StoreName,
                        ai.StoreCode,
                        ai.AuditDate,
                        DATEADD(DAY, es.DeadlineDays, MIN(n.sent_at)) as Deadline,
                        DATEDIFF(DAY, GETDATE(), DATEADD(DAY, es.DeadlineDays, MIN(n.sent_at))) as DaysRemaining
                    FROM AuditInstances ai
                    INNER JOIN Notifications n ON n.document_number = ai.DocumentNumber 
                        AND n.notification_type IN ('ReportPublished', 'FullReportGenerated', 'AuditReport')
                        AND n.status = 'Sent'
                    CROSS JOIN ActionPlanEscalationSettings es
                    WHERE ai.Status = 'Completed'
                    AND NOT EXISTS (
                        SELECT 1 FROM Notifications n2 
                        WHERE n2.document_number = ai.DocumentNumber 
                        AND n2.notification_type = 'ActionPlanSubmitted'
                        AND n2.status = 'Sent'
                    )
                    GROUP BY ai.AuditID, ai.DocumentNumber, ai.StoreName, ai.StoreCode, ai.AuditDate, es.DeadlineDays
                )
                SELECT * FROM AuditDeadlines
                WHERE DaysRemaining = @reminderDays
                AND NOT EXISTS (
                    SELECT 1 FROM EscalationJobLog ejl 
                    WHERE ejl.DocumentNumber = AuditDeadlines.DocumentNumber 
                    AND ejl.EventType = 'Reminder'
                    AND ejl.Status = 'Success'
                    AND CAST(ejl.CreatedAt AS DATE) = CAST(GETDATE() AS DATE)
                )
            `);
        
        return result.recordset;
    }

    /**
     * Get overdue action plans for escalation
     */
    async getOverdueActionPlans(gracePeriodHours) {
        const pool = await this.getDbPool();
        
        // Use GROUP BY with MIN(sent_at) to avoid duplicates from multiple notification records
        const result = await pool.request()
            .input('gracePeriodHours', sql.Int, gracePeriodHours)
            .query(`
                WITH AuditDeadlines AS (
                    SELECT 
                        ai.AuditID,
                        ai.DocumentNumber,
                        ai.StoreName,
                        ai.StoreCode,
                        ai.AuditDate,
                        DATEADD(DAY, es.DeadlineDays, MIN(n.sent_at)) as Deadline,
                        DATEDIFF(DAY, DATEADD(DAY, es.DeadlineDays, MIN(n.sent_at)), GETDATE()) as DaysOverdue
                    FROM AuditInstances ai
                    INNER JOIN Notifications n ON n.document_number = ai.DocumentNumber 
                        AND n.notification_type IN ('ReportPublished', 'FullReportGenerated', 'AuditReport')
                        AND n.status = 'Sent'
                    CROSS JOIN ActionPlanEscalationSettings es
                    WHERE ai.Status = 'Completed'
                    AND NOT EXISTS (
                        SELECT 1 FROM Notifications n2 
                        WHERE n2.document_number = ai.DocumentNumber 
                        AND n2.notification_type = 'ActionPlanSubmitted'
                        AND n2.status = 'Sent'
                    )
                    GROUP BY ai.AuditID, ai.DocumentNumber, ai.StoreName, ai.StoreCode, ai.AuditDate, es.DeadlineDays
                )
                SELECT * FROM AuditDeadlines
                WHERE DATEADD(HOUR, @gracePeriodHours, Deadline) < GETDATE()
                AND DaysOverdue > 0
                AND NOT EXISTS (
                    SELECT 1 FROM EscalationJobLog ejl 
                    WHERE ejl.DocumentNumber = AuditDeadlines.DocumentNumber 
                    AND ejl.EventType = 'Escalation'
                    AND ejl.Status = 'Success'
                )
            `);
        
        return result.recordset;
    }

    /**
     * Get Store Manager for a store
     */
    async getStoreManager(storeCode) {
        const pool = await this.getDbPool();
        const result = await pool.request()
            .input('storeCode', sql.NVarChar, storeCode)
            .query(`
                SELECT u.id, u.email, u.display_name
                FROM Users u
                INNER JOIN StoreManagerAssignments sma ON u.id = sma.UserId
                INNER JOIN Stores s ON sma.StoreId = s.StoreID
                WHERE s.StoreCode = @storeCode
                AND u.is_active = 1
            `);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    /**
     * Get Area Manager for a store
     */
    async getAreaManager(storeCode) {
        const pool = await this.getDbPool();
        const result = await pool.request()
            .input('storeCode', sql.NVarChar, storeCode)
            .query(`
                SELECT u.id, u.email, u.display_name
                FROM Users u
                INNER JOIN UserAreaAssignments uaa ON u.id = uaa.UserID
                INNER JOIN Stores s ON uaa.StoreID = s.StoreID
                WHERE s.StoreCode = @storeCode
                AND u.is_active = 1
            `);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    /**
     * Get all active SuperAuditors
     */
    async getSuperAuditors() {
        const pool = await this.getDbPool();
        const result = await pool.request().query(`
            SELECT id, email, display_name
            FROM Users
            WHERE role = 'SuperAuditor' AND is_active = 1
        `);
        return result.recordset;
    }

    /**
     * Get the auditor who created the audit (by email from CreatedBy field)
     */
    async getAuditCreator(documentNumber) {
        const pool = await this.getDbPool();
        const result = await pool.request()
            .input('docNum', sql.NVarChar, documentNumber)
            .query(`
                SELECT u.id, u.email, u.display_name
                FROM Users u
                INNER JOIN AuditInstances ai ON u.email = ai.CreatedBy
                WHERE ai.DocumentNumber = @docNum
                AND u.is_active = 1
            `);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    /**
     * Replace placeholders in template
     */
    replacePlaceholders(template, data) {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || '');
        }
        return result;
    }

    /**
     * Send email using Microsoft Graph API with delegated permissions
     * Uses the system sender's access token from their session
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} htmlBody - HTML email body
     * @param {Array} ccRecipients - Optional array of CC email addresses
     */
    async sendEmail(to, subject, htmlBody, ccRecipients = []) {
        try {
            const token = await this.getSystemSenderToken();
            
            // Use /me/sendMail endpoint with delegated permissions
            const endpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';
            
            const emailPayload = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: htmlBody
                    },
                    toRecipients: [{
                        emailAddress: { address: to }
                    }]
                },
                saveToSentItems: true
            };

            // Add CC recipients if provided
            if (ccRecipients && ccRecipients.length > 0) {
                emailPayload.message.ccRecipients = ccRecipients.map(email => ({
                    emailAddress: { address: email }
                }));
                console.log(`[EscalationJob] CC recipients: ${ccRecipients.join(', ')}`);
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailPayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[EscalationJob] Email failed: ${response.status} - ${errorText}`);
                return { success: false, error: `${response.status}: ${errorText}` };
            }

            console.log(`[EscalationJob] ✅ Email sent to: ${to}${ccRecipients.length ? ` (CC: ${ccRecipients.length})` : ''} (from ${this.systemSenderEmail})`);
            return { success: true };
            
        } catch (error) {
            console.error(`[EscalationJob] Email error:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process reminders for a specific day count
     */
    async processReminders(jobRunId, reminderDays, settings) {
        if (!settings.EmailNotificationsEnabled) {
            await this.logActivity(jobRunId, 'ReminderSkipped', { 
                status: 'Skipped', 
                errorMessage: 'Email notifications disabled' 
            });
            return 0;
        }

        const actionPlans = await this.getActionPlansNeedingReminders(reminderDays);
        console.log(`[EscalationJob] Found ${actionPlans.length} action plans needing ${reminderDays}-day reminder`);

        const template = await this.getEmailTemplate('action_plan_reminder');
        if (!template) {
            await this.logActivity(jobRunId, 'ReminderError', { 
                status: 'Error', 
                errorMessage: 'Reminder template not found' 
            });
            return 0;
        }

        let sentCount = 0;
        for (const ap of actionPlans) {
            try {
                const storeManager = await this.getStoreManager(ap.StoreCode);
                if (!storeManager) {
                    await this.logActivity(jobRunId, 'Reminder', {
                        documentNumber: ap.DocumentNumber,
                        storeName: ap.StoreName,
                        status: 'Skipped',
                        errorMessage: 'No Store Manager assigned'
                    });
                    continue;
                }

                const templateData = {
                    recipientName: storeManager.display_name || storeManager.email,
                    storeName: ap.StoreName,
                    documentNumber: ap.DocumentNumber,
                    auditDate: ap.AuditDate ? new Date(ap.AuditDate).toLocaleDateString('en-GB') : '',
                    deadline: ap.Deadline ? new Date(ap.Deadline).toLocaleDateString('en-GB') : '',
                    daysRemaining: reminderDays,
                    actionPlanUrl: `https://fsaudit.gmrlapps.com/auditor/action-plan?doc=${ap.DocumentNumber}`,
                    dashboardUrl: 'https://fsaudit.gmrlapps.com/dashboard'
                };

                const subject = this.replacePlaceholders(template.subject_template, templateData);
                const body = this.replacePlaceholders(template.html_body, templateData);

                const result = await this.sendEmail(storeManager.email, subject, body);

                await this.logActivity(jobRunId, 'Reminder', {
                    documentNumber: ap.DocumentNumber,
                    storeName: ap.StoreName,
                    recipientEmail: storeManager.email,
                    recipientRole: 'StoreManager',
                    emailTemplate: 'action_plan_reminder',
                    status: result.success ? 'Success' : 'Error',
                    errorMessage: result.error || null
                });

                if (result.success) sentCount++;
            } catch (error) {
                await this.logActivity(jobRunId, 'Reminder', {
                    documentNumber: ap.DocumentNumber,
                    storeName: ap.StoreName,
                    status: 'Error',
                    errorMessage: error.message
                });
            }
        }

        return sentCount;
    }

    /**
     * Process escalations for overdue action plans
     */
    async processEscalations(jobRunId, settings) {
        if (!settings.AutoEscalationEnabled) {
            await this.logActivity(jobRunId, 'EscalationSkipped', { 
                status: 'Skipped', 
                errorMessage: 'Auto-escalation disabled' 
            });
            return 0;
        }

        const overdueAPs = await this.getOverdueActionPlans(settings.GracePeriodHours);
        console.log(`[EscalationJob] Found ${overdueAPs.length} overdue action plans for escalation`);

        const escalationTemplate = await this.getEmailTemplate('action_plan_escalation');
        const overdueTemplate = await this.getEmailTemplate('action_plan_overdue');

        let sentCount = 0;
        for (const ap of overdueAPs) {
            try {
                const storeManager = await this.getStoreManager(ap.StoreCode);
                const areaManager = await this.getAreaManager(ap.StoreCode);

                const templateData = {
                    storeName: ap.StoreName,
                    documentNumber: ap.DocumentNumber,
                    auditDate: ap.AuditDate ? new Date(ap.AuditDate).toLocaleDateString('en-GB') : '',
                    deadline: ap.Deadline ? new Date(ap.Deadline).toLocaleDateString('en-GB') : '',
                    daysOverdue: ap.DaysOverdue,
                    storeManagerName: storeManager?.display_name || 'N/A',
                    storeManagerEmail: storeManager?.email || 'N/A',
                    actionPlanUrl: `https://fsaudit.gmrlapps.com/auditor/action-plan?doc=${ap.DocumentNumber}`,
                    dashboardUrl: 'https://fsaudit.gmrlapps.com/dashboard'
                };

                // Build CC list for escalation: SuperAuditors + Audit Creator
                const escalationCcRecipients = [];
                const superAuditors = await this.getSuperAuditors();
                for (const sa of superAuditors) {
                    if (sa.email) {
                        escalationCcRecipients.push(sa.email);
                    }
                }
                const auditCreator = await this.getAuditCreator(ap.DocumentNumber);
                if (auditCreator && auditCreator.email && !escalationCcRecipients.includes(auditCreator.email)) {
                    escalationCcRecipients.push(auditCreator.email);
                }

                // Send escalation to Area Manager with CC
                if (areaManager && escalationTemplate) {
                    templateData.recipientName = areaManager.display_name || areaManager.email;
                    const subject = this.replacePlaceholders(escalationTemplate.subject_template, templateData);
                    const body = this.replacePlaceholders(escalationTemplate.html_body, templateData);

                    const result = await this.sendEmail(areaManager.email, subject, body, escalationCcRecipients);

                    await this.logActivity(jobRunId, 'Escalation', {
                        documentNumber: ap.DocumentNumber,
                        storeName: ap.StoreName,
                        recipientEmail: areaManager.email,
                        recipientRole: 'AreaManager',
                        emailTemplate: 'action_plan_escalation',
                        ccRecipients: escalationCcRecipients.join(', '),
                        status: result.success ? 'Success' : 'Error',
                        errorMessage: result.error || null
                    });

                    if (result.success) sentCount++;
                }

                // Send overdue notice to Store Manager with CC to SuperAuditors and Audit Creator
                if (storeManager && overdueTemplate) {
                    templateData.recipientName = storeManager.display_name || storeManager.email;
                    const subject = this.replacePlaceholders(overdueTemplate.subject_template, templateData);
                    const body = this.replacePlaceholders(overdueTemplate.html_body, templateData);

                    // Build CC list: SuperAuditors + Audit Creator
                    const ccRecipients = [];
                    
                    // Add all SuperAuditors
                    const superAuditors = await this.getSuperAuditors();
                    for (const sa of superAuditors) {
                        if (sa.email && !ccRecipients.includes(sa.email)) {
                            ccRecipients.push(sa.email);
                        }
                    }
                    
                    // Add the auditor who created the audit
                    const auditCreator = await this.getAuditCreator(ap.DocumentNumber);
                    if (auditCreator && auditCreator.email && !ccRecipients.includes(auditCreator.email)) {
                        ccRecipients.push(auditCreator.email);
                    }

                    const result = await this.sendEmail(storeManager.email, subject, body, ccRecipients);

                    await this.logActivity(jobRunId, 'OverdueNotice', {
                        documentNumber: ap.DocumentNumber,
                        storeName: ap.StoreName,
                        recipientEmail: storeManager.email,
                        recipientRole: 'StoreManager',
                        emailTemplate: 'action_plan_overdue',
                        status: result.success ? 'Success' : 'Error',
                        errorMessage: result.success ? `CC: ${ccRecipients.join(', ')}` : result.error
                    });

                    if (result.success) sentCount++;
                }
            } catch (error) {
                await this.logActivity(jobRunId, 'Escalation', {
                    documentNumber: ap.DocumentNumber,
                    storeName: ap.StoreName,
                    status: 'Error',
                    errorMessage: error.message
                });
                this.jobStats.errors++;
            }
        }

        return sentCount;
    }

    /**
     * Preview what the job would do without sending any emails
     * Returns a list of all actions that would be taken
     */
    async preview() {
        console.log('[EscalationJob] Running preview (dry run)...');
        const results = {
            settings: null,
            reminders: [],
            escalations: [],
            overdueNotices: [],
            summary: {
                totalReminders: 0,
                totalEscalations: 0,
                totalOverdueNotices: 0
            }
        };

        try {
            const settings = await this.getSettings();
            results.settings = settings;

            // Parse reminder days
            const reminderDaysArray = (settings.ReminderDaysBefore || '3,1')
                .split(',')
                .map(d => parseInt(d.trim()))
                .filter(d => !isNaN(d));

            // Get email templates
            const reminderTemplate = await this.getEmailTemplate('action_plan_reminder');
            const escalationTemplate = await this.getEmailTemplate('action_plan_escalation');
            const overdueTemplate = await this.getEmailTemplate('action_plan_overdue');

            // Preview reminders
            for (const reminderDays of reminderDaysArray) {
                if (!settings.EmailNotificationsEnabled) continue;

                const actionPlans = await this.getActionPlansNeedingReminders(reminderDays);
                
                for (const ap of actionPlans) {
                    const storeManager = await this.getStoreManager(ap.StoreCode);
                    
                    // Build template data
                    const templateData = {
                        storeName: ap.StoreName,
                        documentNumber: ap.DocumentNumber,
                        auditDate: ap.AuditDate ? new Date(ap.AuditDate).toLocaleDateString('en-GB') : '',
                        deadline: ap.Deadline ? new Date(ap.Deadline).toLocaleDateString('en-GB') : '',
                        daysRemaining: reminderDays,
                        recipientName: storeManager?.display_name || storeManager?.email || 'Store Manager',
                        actionPlanUrl: `https://fsaudit.gmrlapps.com/auditor/action-plan?doc=${ap.DocumentNumber}`,
                        dashboardUrl: 'https://fsaudit.gmrlapps.com/dashboard'
                    };

                    // Render email content
                    let emailPreview = null;
                    if (reminderTemplate && storeManager) {
                        emailPreview = {
                            subject: this.replacePlaceholders(reminderTemplate.subject_template, templateData),
                            body: this.replacePlaceholders(reminderTemplate.html_body, templateData)
                        };
                    }

                    results.reminders.push({
                        daysRemaining: reminderDays,
                        documentNumber: ap.DocumentNumber,
                        storeName: ap.StoreName,
                        storeCode: ap.StoreCode,
                        deadline: ap.Deadline,
                        recipient: storeManager ? {
                            email: storeManager.email,
                            name: storeManager.display_name,
                            role: 'StoreManager'
                        } : null,
                        emailPreview: emailPreview,
                        status: storeManager ? 'Would Send' : 'No Store Manager'
                    });
                    
                    if (storeManager) results.summary.totalReminders++;
                }
            }

            // Preview escalations
            if (settings.AutoEscalationEnabled) {
                const overdueAPs = await this.getOverdueActionPlans(settings.GracePeriodHours);
                const superAuditors = await this.getSuperAuditors();

                for (const ap of overdueAPs) {
                    const storeManager = await this.getStoreManager(ap.StoreCode);
                    const areaManager = await this.getAreaManager(ap.StoreCode);
                    const auditCreator = await this.getAuditCreator(ap.DocumentNumber);

                    // Build template data
                    const templateData = {
                        storeName: ap.StoreName,
                        documentNumber: ap.DocumentNumber,
                        auditDate: ap.AuditDate ? new Date(ap.AuditDate).toLocaleDateString('en-GB') : '',
                        deadline: ap.Deadline ? new Date(ap.Deadline).toLocaleDateString('en-GB') : '',
                        daysOverdue: ap.DaysOverdue,
                        storeManagerName: storeManager?.display_name || 'N/A',
                        storeManagerEmail: storeManager?.email || 'N/A',
                        actionPlanUrl: `https://fsaudit.gmrlapps.com/auditor/action-plan?doc=${ap.DocumentNumber}`,
                        dashboardUrl: 'https://fsaudit.gmrlapps.com/dashboard'
                    };

                    // Build CC list for escalation preview
                    const escalationCcRecipients = [];
                    for (const sa of superAuditors) {
                        if (sa.email) escalationCcRecipients.push({ email: sa.email, name: sa.display_name, role: 'SuperAuditor' });
                    }
                    if (auditCreator && auditCreator.email) {
                        escalationCcRecipients.push({ email: auditCreator.email, name: auditCreator.display_name, role: 'AuditCreator' });
                    }

                    // Render escalation email
                    let escalationEmailPreview = null;
                    if (escalationTemplate && areaManager) {
                        const escData = { ...templateData, recipientName: areaManager.display_name || areaManager.email };
                        escalationEmailPreview = {
                            subject: this.replacePlaceholders(escalationTemplate.subject_template, escData),
                            body: this.replacePlaceholders(escalationTemplate.html_body, escData)
                        };
                    }

                    // Escalation to Area Manager
                    results.escalations.push({
                        documentNumber: ap.DocumentNumber,
                        storeName: ap.StoreName,
                        storeCode: ap.StoreCode,
                        deadline: ap.Deadline,
                        daysOverdue: ap.DaysOverdue,
                        recipient: areaManager ? {
                            email: areaManager.email,
                            name: areaManager.display_name,
                            role: 'AreaManager'
                        } : null,
                        ccRecipients: escalationCcRecipients,
                        emailPreview: escalationEmailPreview,
                        status: areaManager ? 'Would Send' : 'No Area Manager'
                    });
                    
                    if (areaManager) results.summary.totalEscalations++;

                    // Build CC list for overdue notice
                    const ccRecipients = [];
                    for (const sa of superAuditors) {
                        if (sa.email) ccRecipients.push({ email: sa.email, name: sa.display_name, role: 'SuperAuditor' });
                    }
                    if (auditCreator && auditCreator.email) {
                        ccRecipients.push({ email: auditCreator.email, name: auditCreator.display_name, role: 'AuditCreator' });
                    }

                    // Render overdue email
                    let overdueEmailPreview = null;
                    if (overdueTemplate && storeManager) {
                        const odData = { ...templateData, recipientName: storeManager.display_name || storeManager.email };
                        overdueEmailPreview = {
                            subject: this.replacePlaceholders(overdueTemplate.subject_template, odData),
                            body: this.replacePlaceholders(overdueTemplate.html_body, odData)
                        };
                    }

                    // Overdue notice to Store Manager
                    results.overdueNotices.push({
                        documentNumber: ap.DocumentNumber,
                        storeName: ap.StoreName,
                        storeCode: ap.StoreCode,
                        deadline: ap.Deadline,
                        daysOverdue: ap.DaysOverdue,
                        recipient: storeManager ? {
                            email: storeManager.email,
                            name: storeManager.display_name,
                            role: 'StoreManager'
                        } : null,
                        ccRecipients: ccRecipients,
                        emailPreview: overdueEmailPreview,
                        status: storeManager ? 'Would Send' : 'No Store Manager'
                    });
                    
                    if (storeManager) results.summary.totalOverdueNotices++;
                }
            }

            console.log(`[EscalationJob] Preview complete: ${results.summary.totalReminders} reminders, ${results.summary.totalEscalations} escalations, ${results.summary.totalOverdueNotices} overdue notices`);
            return { success: true, preview: results };

        } catch (error) {
            console.error('[EscalationJob] Preview error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Run the escalation job
     */
    async run(isManualTrigger = false) {
        if (this.isRunning) {
            console.log('[EscalationJob] Job already running, skipping...');
            return { success: false, message: 'Job already running' };
        }

        this.isRunning = true;
        const jobRunId = uuidv4();
        const startTime = new Date();
        console.log(`[EscalationJob] Starting job run ${jobRunId}${isManualTrigger ? ' (manual trigger)' : ''}`);

        try {
            const settings = await this.getSettings();
            
            await this.logActivity(jobRunId, 'JobStart', {
                status: 'Success',
                errorMessage: isManualTrigger ? 'Manual trigger' : 'Scheduled run'
            });

            // Parse reminder days
            const reminderDaysArray = (settings.ReminderDaysBefore || '3,1')
                .split(',')
                .map(d => parseInt(d.trim()))
                .filter(d => !isNaN(d));

            // Process reminders for each configured day
            let totalReminders = 0;
            for (const days of reminderDaysArray) {
                const sent = await this.processReminders(jobRunId, days, settings);
                totalReminders += sent;
            }

            // Process escalations
            const escalationsSent = await this.processEscalations(jobRunId, settings);

            this.jobStats.totalRuns++;
            this.jobStats.remindersSent += totalReminders;
            this.jobStats.escalationsSent += escalationsSent;
            this.lastRunTime = new Date();

            await this.logActivity(jobRunId, 'JobComplete', {
                status: 'Success',
                errorMessage: `Reminders: ${totalReminders}, Escalations: ${escalationsSent}`
            });

            console.log(`[EscalationJob] Job completed. Reminders: ${totalReminders}, Escalations: ${escalationsSent}`);

            return {
                success: true,
                jobRunId,
                duration: (new Date() - startTime) / 1000,
                remindersSent: totalReminders,
                escalationsSent
            };

        } catch (error) {
            console.error('[EscalationJob] Job failed:', error);
            this.jobStats.errors++;

            await this.logActivity(jobRunId, 'JobError', {
                status: 'Error',
                errorMessage: error.message
            });

            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.intervalId) {
            console.log('[EscalationJob] Scheduler already running');
            return;
        }

        console.log(`[EscalationJob] Starting scheduler (interval: ${this.runIntervalMinutes} minutes)`);
        
        // Calculate next run time
        this.nextRunTime = new Date(Date.now() + this.runIntervalMinutes * 60 * 1000);

        // Run immediately on start, then on interval
        this.run();

        this.intervalId = setInterval(() => {
            this.nextRunTime = new Date(Date.now() + this.runIntervalMinutes * 60 * 1000);
            this.run();
        }, this.runIntervalMinutes * 60 * 1000);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[EscalationJob] Scheduler stopped');
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            schedulerActive: !!this.intervalId,
            lastRunTime: this.lastRunTime,
            nextRunTime: this.nextRunTime,
            runIntervalMinutes: this.runIntervalMinutes,
            systemSenderEmail: this.systemSenderEmail,
            stats: this.jobStats
        };
    }

    /**
     * Get recent logs
     */
    async getRecentLogs(limit = 50) {
        const pool = await this.getDbPool();
        const result = await pool.request()
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit) 
                    LogID, JobRunID, EventType, DocumentNumber, StoreName,
                    RecipientEmail, RecipientRole, EmailTemplate, Status, ErrorMessage, CreatedAt
                FROM EscalationJobLog
                ORDER BY CreatedAt DESC
            `);
        return result.recordset;
    }
}

// Singleton instance
const escalationJobService = new EscalationJobService();

module.exports = escalationJobService;
