/**
 * Email Notification Service Module
 * Handles sending email notifications via Microsoft Graph API
 * 
 * This is a modular, reusable service for email notifications
 */

const sql = require('mssql');
const EmailTemplates = require('./email-templates');

class EmailNotificationService {
    constructor(connector) {
        this.connector = connector; // SimpleGraphConnector instance
    }

    /**
     * Send email via Microsoft Graph API
     * Can use either user's token (delegated) or app token (application)
     * @param {Array} to - Array of recipient emails
     * @param {String} subject - Email subject
     * @param {String} htmlBody - HTML email body
     * @param {String} plainTextBody - Plain text version (optional)
     * @param {String} userAccessToken - User's access token from session (optional)
     */
    async sendEmail(to, subject, htmlBody, plainTextBody = null, userAccessToken = null) {
        try {
            // Use user's token if provided, otherwise use application token
            const token = userAccessToken || await this.connector.getGraphToken();
            
            // Determine endpoint based on token type
            let endpoint;
            if (userAccessToken) {
                // Use /me endpoint for user's own mailbox (delegated permission)
                endpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';
                console.log('📧 [EMAIL] Using logged-in user\'s mailbox (delegated)');
            } else {
                // Use /users/{email} endpoint for application permission
                const senderEmail = process.env.NOTIFICATION_SENDER_EMAIL || 'muhammad.shammas@gmrlgroup.com';
                endpoint = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
                console.log(`📧 [EMAIL] Using service account: ${senderEmail}`);
            }
            
            const emailPayload = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: htmlBody
                    },
                    toRecipients: to.map(email => ({
                        emailAddress: { address: email }
                    }))
                },
                saveToSentItems: true // Save to sent items
            };

            // Send email using the determined endpoint
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
                throw new Error(`Graph API error: ${response.status} - ${errorText}`);
            }

            console.log(`✅ [EMAIL] Sent successfully to: ${to.join(', ')}`);
            return { success: true };
            
        } catch (error) {
            console.error(`❌ [EMAIL] Failed to send to ${to.join(', ')}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get recipients for a report notification based on store and user roles
     */
    async getReportRecipients(storeName, pool) {
        const recipients = [];

        try {
            console.log(`👥 [EMAIL] Finding recipients for store: ${storeName}`);

            // Get store managers assigned to this store
            const storeManagerQuery = `
                SELECT id, email, display_name, role, assigned_stores
                FROM Users
                WHERE role = 'StoreManager'
                AND is_active = 1
                AND email_notifications_enabled = 1
            `;
            
            const storeManagers = await pool.request().query(storeManagerQuery);

            // Filter store managers who have this store in their assigned_stores JSON array
            storeManagers.recordset.forEach(user => {
                if (user.assigned_stores) {
                    try {
                        const stores = JSON.parse(user.assigned_stores);
                        // Check if store code matches (e.g., "GMRL-ABD" or store name contains)
                        const hasStore = stores.some(store => 
                            store === storeName || 
                            storeName.includes(store) ||
                            store.includes(storeName)
                        );
                        
                        if (hasStore) {
                            recipients.push({
                                userId: user.id,
                                email: user.email,
                                name: user.display_name || user.email,
                                role: user.role
                            });
                            console.log(`  ✓ Store Manager: ${user.email}`);
                        }
                    } catch (e) {
                        console.warn(`  ⚠️  Could not parse assigned_stores for ${user.email}`);
                    }
                }
            });

            // Get all department heads (they see all reports)
            const departmentHeadsQuery = `
                SELECT id, email, display_name, role, assigned_department
                FROM Users
                WHERE role IN ('CleaningHead', 'ProcurementHead', 'MaintenanceHead')
                AND is_active = 1
                AND email_notifications_enabled = 1
            `;

            const departmentHeads = await pool.request().query(departmentHeadsQuery);

            departmentHeads.recordset.forEach(user => {
                recipients.push({
                    userId: user.id,
                    email: user.email,
                    name: user.display_name || user.email,
                    role: user.role,
                    department: user.assigned_department
                });
                console.log(`  ✓ Department Head (${user.role}): ${user.email}`);
            });

            console.log(`👥 [EMAIL] Found ${recipients.length} recipients`);
            return recipients;

        } catch (error) {
            console.error('❌ [EMAIL] Error getting recipients:', error);
            return [];
        }
    }

    /**
     * Log notification to database
     */
    async logNotification(data, pool) {
        try {
            await pool.request()
                .input('documentNumber', sql.NVarChar(50), data.documentNumber)
                .input('recipientUserId', sql.Int, data.recipientUserId || null)
                .input('recipientEmail', sql.NVarChar(255), data.recipientEmail)
                .input('recipientName', sql.NVarChar(255), data.recipientName)
                .input('recipientRole', sql.NVarChar(50), data.recipientRole)
                .input('notificationType', sql.NVarChar(50), data.notificationType)
                .input('sentByUserId', sql.Int, data.sentByUserId || null)
                .input('sentByEmail', sql.NVarChar(255), data.sentByEmail)
                .input('sentByName', sql.NVarChar(255), data.sentByName)
                .input('status', sql.NVarChar(50), data.status)
                .input('errorMessage', sql.NVarChar(sql.MAX), data.errorMessage || null)
                .input('emailSubject', sql.NVarChar(500), data.emailSubject)
                .input('emailBody', sql.NVarChar(sql.MAX), data.emailBody)
                .query(`
                    INSERT INTO Notifications (
                        document_number, recipient_user_id, recipient_email, recipient_name, recipient_role,
                        notification_type, sent_by_user_id, sent_by_email, sent_by_name,
                        status, error_message, email_subject, email_body, sent_at
                    )
                    VALUES (
                        @documentNumber, @recipientUserId, @recipientEmail, @recipientName, @recipientRole,
                        @notificationType, @sentByUserId, @sentByEmail, @sentByName,
                        @status, @errorMessage, @emailSubject, @emailBody, GETDATE()
                    )
                `);
            
            console.log(`📝 [EMAIL] Notification logged for ${data.recipientEmail}`);
            
        } catch (error) {
            console.error('❌ [EMAIL] Error logging notification:', error.message);
        }
    }

    /**
     * Get user ID from Users table by Azure user ID
     */
    async getUserIdByAzureId(azureUserId, pool) {
        try {
            const result = await pool.request()
                .input('azureUserId', sql.NVarChar(255), azureUserId)
                .query('SELECT id FROM Users WHERE azure_user_id = @azureUserId');
            
            return result.recordset.length > 0 ? result.recordset[0].id : null;
        } catch (error) {
            console.error('❌ [EMAIL] Error getting user ID:', error);
            return null;
        }
    }

    /**
     * Send report generation notifications to selected recipients
     * @param {Object} reportData - Report metadata
     * @param {Object} sentBy - User who sent the notification
     * @param {Array} selectedRecipientEmails - Array of email addresses to send to (optional, if not provided, sends to all)
     * @param {Object} pool - Database connection pool
     */
    async notifyReportGeneration(reportData, sentBy, pool, selectedRecipientEmails = null) {
        const {
            documentNumber,
            storeName,
            auditDate,
            overallScore,
            auditor,
            reportUrl
        } = reportData;

        const dashboardUrl = process.env.DASHBOARD_URL || 'https://pappreports.gmrlapps.com:3001/auth/login';

        console.log(`📧 [EMAIL] Starting notification process for: ${documentNumber}`);
        console.log(`   Store: ${storeName}`);
        console.log(`   Score: ${overallScore}%`);

        // Get all available recipients based on store and roles
        let recipients = await this.getReportRecipients(storeName, pool);

        // Filter to selected recipients if provided
        if (selectedRecipientEmails && selectedRecipientEmails.length > 0) {
            recipients = recipients.filter(r => selectedRecipientEmails.includes(r.email));
            console.log(`📧 [EMAIL] Filtered to ${recipients.length} selected recipient(s)`);
        }

        if (recipients.length === 0) {
            console.log('⚠️  [EMAIL] No recipients found - skipping notifications');
            return { 
                success: true, 
                sent: 0, 
                failed: 0,
                total: 0,
                message: 'No recipients configured or selected' 
            };
        }

        let successCount = 0;
        let failCount = 0;
        const results = [];

        // Get sender user ID
        const sentByUserId = sentBy.azureUserId ? 
            await this.getUserIdByAzureId(sentBy.azureUserId, pool) : null;

        // Send email to each recipient
        for (const recipient of recipients) {
            try {
                console.log(`📧 [EMAIL] Sending to: ${recipient.email} (${recipient.role})`);

                // Generate personalized email
                const emailHtml = EmailTemplates.generateReportNotificationEmail({
                    documentNumber,
                    storeName,
                    auditDate,
                    overallScore,
                    auditor,
                    recipientName: recipient.name,
                    recipientRole: recipient.role,
                    dashboardUrl,
                    reportUrl
                });

                const plainText = EmailTemplates.generatePlainTextVersion({
                    documentNumber,
                    storeName,
                    auditDate,
                    overallScore,
                    auditor,
                    recipientName: recipient.name,
                    recipientRole: recipient.role,
                    dashboardUrl
                });

                const subject = `🍽️ New Audit Report: ${storeName} - ${documentNumber}`;

                // Send email using sender's access token from session
                const result = await this.sendEmail(
                    [recipient.email],
                    subject,
                    emailHtml,
                    plainText,
                    sentBy.accessToken // Pass user's token from session
                );

                // Log notification
                await this.logNotification({
                    documentNumber,
                    recipientUserId: recipient.userId,
                    recipientEmail: recipient.email,
                    recipientName: recipient.name,
                    recipientRole: recipient.role,
                    notificationType: 'ReportGenerated',
                    sentByUserId,
                    sentByEmail: sentBy.email,
                    sentByName: sentBy.name,
                    status: result.success ? 'Sent' : 'Failed',
                    errorMessage: result.error || null,
                    emailSubject: subject,
                    emailBody: emailHtml
                }, pool);

                if (result.success) {
                    successCount++;
                    results.push({ email: recipient.email, status: 'sent' });
                } else {
                    failCount++;
                    results.push({ email: recipient.email, status: 'failed', error: result.error });
                }

            } catch (error) {
                console.error(`❌ [EMAIL] Error processing ${recipient.email}:`, error.message);
                failCount++;
                results.push({ email: recipient.email, status: 'error', error: error.message });
            }
        }

        const summary = `✅ [EMAIL] Notifications complete: ${successCount} sent, ${failCount} failed (${recipients.length} total)`;
        console.log(summary);

        return {
            success: true,
            sent: successCount,
            failed: failCount,
            total: recipients.length,
            results,
            message: summary
        };
    }

    /**
     * Get notification history for a document
     */
    async getNotificationHistory(documentNumber, pool) {
        try {
            const result = await pool.request()
                .input('documentNumber', sql.NVarChar(50), documentNumber)
                .query(`
                    SELECT 
                        id, recipient_email, recipient_name, recipient_role,
                        notification_type, status, sent_by_email, sent_at,
                        error_message
                    FROM Notifications
                    WHERE document_number = @documentNumber
                    ORDER BY sent_at DESC
                `);

            return result.recordset;
        } catch (error) {
            console.error('❌ [EMAIL] Error getting notification history:', error);
            return [];
        }
    }
}

module.exports = EmailNotificationService;
