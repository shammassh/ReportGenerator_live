# 📧 Email Notifications - User Guide

## 🎯 Where to Find Email Notifications

### **Step-by-Step Guide:**

---

## 1️⃣ **Access the Dashboard**

Go to: **http://localhost:3001/dashboard**

Log in with your credentials (Admin or Auditor role required).

---

## 2️⃣ **Find a Report to Generate**

In the dashboard, you'll see a list of audit reports with their details:
- Document Number
- Store Name
- Score
- Date
- Status

Each report has action buttons on the right side.

---

## 3️⃣ **Click "Generate" Button**

When you click the **"📊 Generate"** button on any report, a **modal popup** will appear:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Email Notifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Would you like to send email notifications to 
relevant stakeholders?

Who will receive notifications:
  📍 Store Managers assigned to this store
  🧹 Cleaning Department Head
  🛒 Procurement Department Head  
  🔧 Maintenance Department Head

Note: Only active users with notifications 
enabled will receive emails.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Skip Notifications]  [📧 Send Notifications]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4️⃣ **Choose Your Option**

### **Option A: Send Notifications** ✅
Click **"📧 Send Notifications"** button:
- Report will be generated
- Emails will be sent to all relevant recipients
- You'll see a success message: 
  ```
  ✅ Report generated successfully! 
  📧 Notifications sent to 5 recipient(s).
  ```

### **Option B: Skip Notifications** ⏭️
Click **"Skip Notifications"** button:
- Report will be generated
- No emails will be sent
- You'll see: 
  ```
  ✅ Report generated successfully!
  ```

---

## 📨 **What the Email Looks Like**

Recipients will receive a professional email with:

**Subject:** `🍽️ New Audit Report: [Store Name] - [Document Number]`

**Content:**
- Greeting with recipient name and role
- Report details (document number, store, date, auditor)
- Overall compliance score with color-coded badge
- Direct link to access the dashboard
- Description of their access level
- Direct link to view the full report

**Example:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍽️ New Food Safety Audit Report Available
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hello John Smith [Store Manager],

A new food safety audit report has been 
completed and is now available for your review.

📄 Document Number: GMRL-FSACR-0001
🏪 Store: Signature
📅 Audit Date: November 21, 2025
👨‍💼 Auditor: Muhammad Shammas
📊 Overall Score: ⚠️ 73.0% (Fail)

[🔐 Access Your Dashboard]
[📊 View Report]

Your Access Level: Store Manager
Can view reports for your assigned store(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Food Safety Audit System
This is an automated notification.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 👥 **Who Receives Notifications?**

### **Automatic Recipients:**

1. **Store Managers** 👔
   - Only those assigned to the specific store in the report
   - Must have the store code in their `assigned_stores` field

2. **Department Heads** (All reports) 🎯
   - **Cleaning Head** - Receives all cleaning-related findings
   - **Procurement Head** - Receives all procurement-related findings
   - **Maintenance Head** - Receives all maintenance-related findings

### **Requirements:**
✅ User must be active (`is_active = 1`)  
✅ User must have notifications enabled (`email_notifications_enabled = 1`)  
✅ User must have valid email address

---

## 🔧 **Managing Notification Preferences**

### **Enable/Disable Notifications for a User**

**Via Database:**
```sql
-- Enable notifications for a user
UPDATE Users 
SET email_notifications_enabled = 1 
WHERE email = 'user@example.com';

-- Disable notifications for a user
UPDATE Users 
SET email_notifications_enabled = 0 
WHERE email = 'user@example.com';
```

**Default:** All new users have notifications **enabled** by default.

---

## 📊 **Viewing Notification History**

**Check sent notifications in database:**
```sql
-- View all notifications for a specific report
SELECT 
    recipient_email,
    recipient_name,
    recipient_role,
    status,
    sent_at,
    error_message
FROM Notifications
WHERE document_number = 'GMRL-FSACR-0001'
ORDER BY sent_at DESC;

-- View notification summary
SELECT 
    status,
    COUNT(*) as total,
    COUNT(DISTINCT document_number) as reports
FROM Notifications
GROUP BY status;
```

---

## 🐛 **Troubleshooting**

### **Issue: No recipients found**
**Cause:** No users are configured for this store or have notifications disabled.

**Solution:**
1. Check if store managers are assigned to the store:
   ```sql
   SELECT email, assigned_stores 
   FROM Users 
   WHERE role = 'StoreManager' 
   AND is_active = 1;
   ```
2. Check if users have notifications enabled:
   ```sql
   SELECT email, email_notifications_enabled 
   FROM Users 
   WHERE role IN ('StoreManager', 'CleaningHead', 'ProcurementHead', 'MaintenanceHead');
   ```

### **Issue: Email not sending**
**Cause:** Microsoft Graph API permission missing or token expired.

**Solution:**
1. Check server logs for error messages
2. Verify Azure AD app has `Mail.Send` permission
3. Check if Graph API token is valid

### **Issue: Modal not appearing**
**Cause:** JavaScript error or browser cache.

**Solution:**
1. Clear browser cache and refresh
2. Check browser console for errors (F12)
3. Verify server is running

---

## 📁 **Implementation Files**

### **Backend:**
- `services/email-notification-service.js` - Email sending logic
- `services/email-templates.js` - HTML email templates
- `auth-app.js` - API endpoint integration
- `database/notifications-schema.sql` - Database schema

### **Frontend:**
- `dashboard.html` - Modal UI and notification logic

### **Database:**
- `Notifications` table - Tracks all sent emails
- `Users.email_notifications_enabled` - User preference
- `Users.notification_preferences` - Future: Custom preferences (JSON)

---

## 🎨 **Customization**

### **Modify Email Template:**
Edit: `services/email-templates.js`
- Change colors, styling, layout
- Add company logo
- Modify text content

### **Change Recipients:**
Edit: `services/email-notification-service.js`
- Function: `getReportRecipients()`
- Add/remove user roles
- Modify filtering logic

### **Add Notification Types:**
1. Add to `Notifications.notification_type` enum
2. Create new template in `email-templates.js`
3. Add logic in `email-notification-service.js`

---

## 📝 **Testing Checklist**

- [ ] Create test users with different roles
- [ ] Assign stores to store managers
- [ ] Enable notifications for test users
- [ ] Generate report and select "Send Notifications"
- [ ] Check inbox for emails
- [ ] Verify email content and formatting
- [ ] Check Notifications table for logs
- [ ] Test "Skip Notifications" option
- [ ] Test with disabled notification users
- [ ] Test with no recipients configured

---

## 🚀 **Next Steps**

1. **Azure AD Permission:**
   - Add `Mail.Send` permission to your Azure AD app
   - Admin consent required

2. **Email Configuration:**
   - Set up SPF/DKIM records for better deliverability
   - Configure reply-to address

3. **Future Enhancements:**
   - Weekly digest emails
   - Action plan notifications
   - Reminder notifications for pending actions
   - Email templates for different languages

---

## 💡 **Tips**

✅ **Always test with your own email first**  
✅ **Start with "Skip Notifications" until you're ready**  
✅ **Monitor the Notifications table for delivery status**  
✅ **Check spam folders if emails don't arrive**  
✅ **Use notification history to track what was sent**

---

## 📞 **Support**

If you encounter issues:
1. Check server console logs for detailed error messages
2. Review notification history in database
3. Verify Azure AD permissions
4. Contact: muhammad.shammas@gmrlgroup.com

---

**Last Updated:** November 21, 2025  
**Version:** 1.0.0
