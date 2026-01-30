# 📧 Email Notification Permission Issue - SOLUTION

## Problem
Notifications are failing with error:
```
❌ [EMAIL] Failed to send to spnotification@spinneys-lebanon.com: 
Graph API error: 403 - {"error":{"code":"ErrorAccessDenied","message":"Access is denied. Check credentials and try again."}}
```

## Root Cause
The Azure AD App Registration does **NOT** have the required **Mail.Send** permission to send emails on behalf of users.

## Solution: Grant Microsoft Graph Mail.Send Permission

### 📋 Step-by-Step Instructions

#### 1. Open Azure Portal
- Go to: **https://portal.azure.com**
- Sign in with your **admin account**

#### 2. Navigate to Your App Registration
1. Click **"Azure Active Directory"** in the left sidebar
2. Click **"App registrations"** in the left menu
3. Find your app:
   - **Client ID**: `9c916e84-9ff1-4e15-9d76-0a87cb974c30`
   - **Name**: (Look for your ReportGenerator or Spinneys app)

#### 3. Add Mail.Send Permission
1. Click on your app registration to open it
2. In the left menu, click **"API permissions"**
3. Click **"+ Add a permission"**
4. Select **"Microsoft Graph"**
5. Select **"Application permissions"** ⚠️ (NOT "Delegated permissions")
6. In the search box, type: **"Mail.Send"**
7. Check the checkbox for **"Mail.Send"**
8. Click **"Add permissions"**

#### 4. Grant Admin Consent (CRITICAL!)
⚠️ **This step is REQUIRED for the permission to work!**

1. After adding the permission, you'll see it in the permissions list
2. Click the button: **"Grant admin consent for [Your Organization Name]"**
3. Click **"Yes"** in the confirmation dialog
4. Wait for the status to change to: ✅ **"Granted for [Your Organization]"**

#### 5. Verify Sender Email Exists
The app sends emails from: **`noreply@spinneys-lebanon.com`**

**Option A: Check if it exists**
```powershell
# In Exchange Online PowerShell
Get-Mailbox -Identity noreply@spinneys-lebanon.com
# OR for shared mailbox
Get-Mailbox -Identity noreply@spinneys-lebanon.com -RecipientTypeDetails SharedMailbox
```

**Option B: Create Shared Mailbox (if it doesn't exist)**
1. Go to **Microsoft 365 Admin Center**: https://admin.microsoft.com
2. Navigate to **Teams & groups** → **Shared mailboxes**
3. Click **"+ Add a shared mailbox"**
4. Name: `No Reply`
5. Email: `noreply@spinneys-lebanon.com`
6. Click **"Add"**

**Option C: Use Existing Service Account**
- If you already have a service account, update the `.env` file:
  ```
  NOTIFICATION_SENDER_EMAIL=your-service-account@spinneys-lebanon.com
  ```

### 📊 Expected Permissions After Setup

In **Azure Portal → App registrations → Your App → API permissions**, you should see:

| Permission Name | Type | Admin Consent Required | Status |
|---|---|---|---|
| Sites.Read.All | Application | Yes | ✅ Granted |
| Mail.Send | Application | Yes | ✅ Granted |

### ⏱️ Wait Time
After granting admin consent, wait **5-10 minutes** for the changes to propagate across Microsoft's systems.

---

## 🧪 Testing After Setup

### Test 1: Check Azure Permissions
Run this script to verify permissions are granted:

```bash
node check-azure-permissions.js
```

### Test 2: Test Email Sending
1. Wait 5-10 minutes after granting consent
2. Go to: http://localhost:3001/dashboard
3. Click **"Generate"** on a Signature store document
4. Click **"📧 Send Notifications"**
5. Check the server logs

### Expected Success Output:
```
📧 [EMAIL] Starting notification process for: GMRL-FSACR-XXXX
👥 [EMAIL] Finding recipients for store: Signature
  ✓ Store Manager: spnotification@spinneys-lebanon.com
📧 [EMAIL] Sending to: spnotification@spinneys-lebanon.com (StoreManager)
✅ [EMAIL] Sent successfully to: spnotification@spinneys-lebanon.com
📝 [EMAIL] Notification logged for spnotification@spinneys-lebanon.com
✅ [EMAIL] Notifications complete: 1 sent, 0 failed (1 total)
```

---

## 🔍 Troubleshooting

### Still Getting 403 Error?

**Check 1: Is admin consent granted?**
- Go to Azure Portal → Your App → API permissions
- Look for **Mail.Send** permission
- Status should show: ✅ "Granted for [Your Organization]"

**Check 2: Does sender mailbox exist?**
```bash
node check-sender-mailbox.js
```

**Check 3: Wait longer**
- Permission changes can take up to 10 minutes
- Try again after waiting

**Check 4: Clear token cache**
- The app caches access tokens
- Restart the auth-app server:
  ```bash
  # Press Ctrl+C to stop
  node auth-app.js
  ```

### Getting 404 Error Instead?

This means the sender mailbox doesn't exist:
1. Create shared mailbox: `noreply@spinneys-lebanon.com`
2. OR update `.env` with an existing service account email

---

## 📝 Summary Checklist

- [ ] Logged into Azure Portal with admin account
- [ ] Found app registration (Client ID: 9c916e84...)
- [ ] Added **Mail.Send** (Application) permission
- [ ] Granted admin consent
- [ ] Verified permission shows "✅ Granted"
- [ ] Verified sender mailbox exists: noreply@spinneys-lebanon.com
- [ ] Waited 5-10 minutes for propagation
- [ ] Restarted auth-app server
- [ ] Tested email sending from dashboard
- [ ] Checked logs for success message

---

## 🎯 Current System Status

| Component | Status |
|---|---|
| Store Manager Found | ✅ Working |
| Email Notifications Enabled | ✅ Working |
| Store Name Matching | ✅ Working |
| Azure AD Permissions | ❌ **NEEDS SETUP** |
| Sender Mailbox | ❓ **NEEDS VERIFICATION** |

**Next Step**: Complete the Azure AD permission setup above, then test again!
