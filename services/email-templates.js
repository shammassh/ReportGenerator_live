/**
 * Email Templates Module
 * Generates HTML email templates for notifications
 * 
 * This is a modular, reusable template generator
 */

class EmailTemplates {
    /**
     * Get role description for email
     */
    static getRoleDescription(role) {
        const descriptions = {
            'Admin': 'Full access to all reports, user management, and system configuration',
            'Auditor': 'Can generate and view all audit reports',
            'StoreManager': 'Can view reports for your assigned store(s)',
            'CleaningHead': 'Can view cleaning department follow-up reports',
            'ProcurementHead': 'Can view procurement department follow-up reports',
            'MaintenanceHead': 'Can view maintenance department follow-up reports'
        };
        return descriptions[role] || 'View reports based on your assigned permissions';
    }

    /**
     * Generate report notification email HTML
     */
    static generateReportNotificationEmail(data) {
        const {
            documentNumber,
            storeName,
            auditDate,
            overallScore,
            auditor,
            recipientName,
            recipientRole,
            dashboardUrl,
            reportUrl
        } = data;

        const scoreColor = overallScore >= 83 ? '#10b981' : overallScore >= 70 ? '#f59e0b' : '#ef4444';
        const statusEmoji = overallScore >= 83 ? '✅' : overallScore >= 70 ? '⚠️' : '❌';
        const statusText = overallScore >= 83 ? 'Pass' : overallScore >= 70 ? 'Acceptable' : 'Fail';

        const formattedDate = new Date(auditDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 20px;
            color: #495057;
        }
        .greeting strong {
            color: #212529;
        }
        .message-box {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .info-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .info-row {
            display: flex;
            margin: 8px 0;
            align-items: center;
        }
        .info-label {
            min-width: 140px;
            font-weight: 600;
            color: #495057;
            font-size: 14px;
        }
        .info-value {
            color: #212529;
            font-size: 14px;
        }
        .score-section {
            text-align: center;
            margin: 25px 0;
            padding: 20px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 8px;
        }
        .score-label {
            font-size: 14px;
            color: #6c757d;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .score-badge {
            display: inline-block;
            padding: 15px 30px;
            background: ${scoreColor};
            color: white;
            border-radius: 30px;
            font-weight: bold;
            font-size: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .score-status {
            margin-top: 10px;
            font-size: 16px;
            color: #495057;
            font-weight: 600;
        }
        .cta-section {
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            padding: 15px 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
        }
        .secondary-button {
            display: inline-block;
            padding: 12px 30px;
            background: white;
            color: #667eea !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            border: 2px solid #667eea;
            margin-left: 10px;
        }
        .access-info {
            margin-top: 30px;
            padding: 20px;
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            border-radius: 5px;
        }
        .access-info h3 {
            margin: 0 0 10px;
            color: #1976D2;
            font-size: 16px;
        }
        .access-info p {
            margin: 5px 0;
            font-size: 14px;
            color: #495057;
        }
        .role-badge {
            display: inline-block;
            padding: 4px 12px;
            background: #667eea;
            border-radius: 15px;
            font-size: 12px;
            color: white;
            margin-left: 10px;
            font-weight: 600;
        }
        .footer {
            background: #f8f9fa;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #dee2e6;
        }
        .footer-title {
            font-weight: 600;
            color: #212529;
            margin: 0 0 10px;
            font-size: 16px;
        }
        .footer-text {
            margin: 5px 0;
            font-size: 12px;
            color: #6c757d;
        }
        .footer-links {
            margin-top: 15px;
        }
        .footer-link {
            color: #667eea;
            text-decoration: none;
            margin: 0 10px;
            font-size: 12px;
        }
        .icon {
            font-size: 18px;
            margin-right: 5px;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 5px;
            }
            .content {
                padding: 20px;
            }
            .score-badge {
                font-size: 20px;
                padding: 12px 25px;
            }
            .cta-button {
                display: block;
                margin-bottom: 10px;
            }
            .secondary-button {
                display: block;
                margin: 10px 0 0 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍽️ New Food Safety Audit Report</h1>
            <p>Food Safety Audit System - Spinneys</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hello <strong>${recipientName}</strong><span class="role-badge">${recipientRole}</span>,
            </div>
            
            <div class="message-box">
                <p style="margin: 0; font-size: 15px;">
                    A new food safety audit report has been completed and is now available for your review in the dashboard.
                </p>
            </div>
            
            <div class="info-box">
                <div class="info-row">
                    <span class="info-label"><span class="icon">📄</span>Document Number:</span>
                    <span class="info-value"><strong>${documentNumber}</strong></span>
                </div>
                <div class="info-row">
                    <span class="info-label"><span class="icon">🏪</span>Store:</span>
                    <span class="info-value">${storeName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><span class="icon">📅</span>Audit Date:</span>
                    <span class="info-value">${formattedDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><span class="icon">👨‍💼</span>Auditor:</span>
                    <span class="info-value">${auditor}</span>
                </div>
            </div>
            
            <div class="score-section">
                <div class="score-label">Overall Compliance Score</div>
                <div class="score-badge">${statusEmoji} ${overallScore.toFixed(1)}%</div>
                <div class="score-status">${statusText}</div>
            </div>
            
            <div class="cta-section">
                <a href="${dashboardUrl}" class="cta-button">
                    🔐 Access Your Dashboard
                </a>
                ${reportUrl ? `<a href="${reportUrl}" class="secondary-button">📊 View Report</a>` : ''}
            </div>
            
            <div class="access-info">
                <h3>🔑 Your Access Level</h3>
                <p><strong>Role:</strong> ${recipientRole}</p>
                <p>${this.getRoleDescription(recipientRole)}</p>
            </div>
            
            <p style="margin-top: 25px; font-size: 13px; color: #6c757d; font-style: italic;">
                💡 <strong>Tip:</strong> Log in to the dashboard to view detailed findings, section scores, and action items.
            </p>
        </div>
        
        <div class="footer">
            <p class="footer-title">Food Safety Audit System</p>
            <p class="footer-text">This is an automated notification from the Food Safety Audit System.</p>
            <p class="footer-text">Please do not reply to this email.</p>
            <div class="footer-links">
                <a href="${dashboardUrl}" class="footer-link">Dashboard</a>
                <span style="color: #dee2e6;">|</span>
                <a href="mailto:muhammad.shammas@gmrlgroup.com" class="footer-link">Support</a>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Generate plain text version for email clients that don't support HTML
     */
    static generatePlainTextVersion(data) {
        const {
            documentNumber,
            storeName,
            auditDate,
            overallScore,
            auditor,
            recipientName,
            recipientRole,
            dashboardUrl
        } = data;

        const formattedDate = new Date(auditDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });

        return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍽️ NEW FOOD SAFETY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hello ${recipientName} [${recipientRole}],

A new food safety audit report has been completed.

REPORT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Document Number: ${documentNumber}
🏪 Store: ${storeName}
📅 Audit Date: ${formattedDate}
👨‍💼 Auditor: ${auditor}
📊 Overall Score: ${overallScore.toFixed(1)}%

ACCESS YOUR DASHBOARD:
${dashboardUrl}

Your Access Level: ${recipientRole}
${this.getRoleDescription(recipientRole)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Food Safety Audit System
This is an automated notification.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
    }
}

module.exports = EmailTemplates;
