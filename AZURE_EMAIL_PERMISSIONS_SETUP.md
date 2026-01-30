# Azure AD Email Permissions Setup Guide

## 🎯 Current Status
✅ **Endpoint Fixed:** Now using `/users/{email}/sendMail` (correct for application permissions)  
❌ **Permission Error:** `403 - Access Denied` means the Azure AD app lacks required permissions

---

## 📋 Required Azure AD Permissions

Your app needs **Application Permissions** (not Delegated) for sending emails:

### Required Permission:
- **Mail.Send** (Application) - Send mail as any user

---

## 🔧 Step-by-Step Setup in Azure Portal

### 1. Navigate to Azure Portal
- Go to: https://portal.azure.com
- Sign in with your admin account

### 2. Find Your App Registration
- Click **Azure Active Directory** (left sidebar)
- Click **App registrations**
- Search for your app or find it by Client ID: `9c916e84-9ff1-4e15-9d76-0a87cb974c30`

### 3. Add Mail.Send Permission
1. Click on your app registration
2. In the left menu, click **API permissions**
3. Click **+ Add a permission**
4. Select **Microsoft Graph**
5. Select **Application permissions** (NOT Delegated permissions)
6. Search for "Mail.Send"
7. Check the box for **Mail.Send**
8. Click **Add permissions**

### 4. Grant Admin Consent
⚠️ **CRITICAL STEP** - Without this, the permission won't work!

1. After adding the permission, you'll see it in the list
2. Click **Grant admin consent for [Your Organization]**
3. Click **Yes** to confirm
4. Wait for the status to show **✅ Granted for [Your Organization]**

### 5. Configure Sender Mailbox
The app will send emails from: `noreply@spinneys-lebanon.com`

**Option A: Use Shared Mailbox (Recommended)**
- Shared mailboxes don't require a license
- Create a shared mailbox in Exchange Admin Center
- Email: noreply@spinneys-lebanon.com

**Option B: Use Service Account**
- Create a user account: noreply@spinneys-lebanon.com
- Assign a Microsoft 365 license (if required)

---

## ✅ Verification Steps

### 1. Check Permissions in Azure Portal
After granting consent, you should see:
```
Permission Name          Type                 Status
Mail.Send               Application          ✅ Granted for [Org]
```

### 2. Wait for Propagation
- Permission changes can take 5-10 minutes to propagate
- Be patient!

### 3. Test Email Sending
1. Go to http://localhost:3001/dashboard
2. Click "Generate" on a Signature store document
3. Select recipient and click "Send to Selected"
4. Check the server logs for success message

### 4. Check Notifications Table
```sql
SELECT TOP 5 
    document_number,
    recipient_email,
    status,
    error_message,
    sent_at
FROM Notifications
ORDER BY sent_at DESC;
```

---

## 🔍 Troubleshooting

### Error 403: Access Denied
**Cause:** Missing Mail.Send permission or admin consent not granted
**Solution:** Follow steps above to add permission and grant consent

### Error 404: Resource Not Found
**Cause:** Sender email doesn't exist in your tenant
**Solution:** 
- Verify noreply@spinneys-lebanon.com exists
- Or update NOTIFICATION_SENDER_EMAIL in .env to an existing mailbox

### Error 400: Bad Request
**Cause:** Wrong endpoint (should be fixed now)
**Solution:** Already fixed - using `/users/{email}/sendMail`

### Emails Still Not Sending After 10+ Minutes
**Check:**
1. Verify permission shows "Granted" status (green checkmark)
2. Try revoking and re-granting admin consent
3. Check Azure AD audit logs for permission grant events
4. Restart your Node.js server after permission changes

---

## 📧 Alternative: Use Delegated Permissions (If Needed)

If you can't get application permissions approved, you can use delegated permissions:

### Required Changes:
1. **Azure AD:** Add Mail.Send **Delegated** permission
2. **Code:** Use interactive authentication flow
3. **Endpoint:** Use `/me/sendMail` endpoint

**Note:** This requires user login and won't work for automated/background jobs.

---

## 🎯 Current Configuration

- **Client ID:** 9c916e84-9ff1-4e15-9d76-0a87cb974c30
- **Tenant:** spinneysleb.onmicrosoft.com
- **Sender Email:** noreply@spinneys-lebanon.com
- **Auth Flow:** Client Credentials (Application)
- **Endpoint:** `/users/noreply@spinneys-lebanon.com/sendMail`

---

## 📞 Need Help?

If you continue to have issues after following this guide:
1. Check Azure AD audit logs for permission grant events
2. Verify the service account exists and is accessible
3. Contact your Azure AD administrator
4. Review Microsoft Graph API documentation: https://docs.microsoft.com/en-us/graph/api/user-sendmail

---

## ✅ Success Indicators

When everything is working correctly, you'll see:
```
📧 [EMAIL] Sending to: spnotification@spinneys-lebanon.com (StoreManager)
✅ Microsoft Graph access token obtained
✅ [EMAIL] Sent successfully to: spnotification@spinneys-lebanon.com
📝 [EMAIL] Notification logged for spnotification@spinneys-lebanon.com
✅ [EMAIL] Notifications complete: 1 sent, 0 failed (1 total)
```

And in the Notifications table:
- status = 'sent'
- error_message = NULL
- sent_at = [timestamp]
