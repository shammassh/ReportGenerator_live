# 🔍 Azure AD Permission Verification Checklist

## Your App Details
- **App Name**: `papp-report`
- **Client ID**: `9c916e84-9ff1-4e15-9d76-0a87cb974c30`
- **Tenant ID**: `b99fc2f6-d65e-4b48-935b-118659097da7`

## ❌ Current Status
The access token shows **NO permissions (roles)** at all.

---

## 📋 Step-by-Step Verification

### 1. Open Azure Portal
🔗 https://portal.azure.com

Log in with your **admin account** (must have Global Admin or Application Admin role).

---

### 2. Navigate to Your App Registration

1. Click **"Azure Active Directory"** (left sidebar)
2. Click **"App registrations"** (left menu)
3. Search for **"papp-report"** OR search by Client ID: `9c916e84-9ff1-4e15-9d76-0a87cb974c30`
4. Click on the app to open it

---

### 3. Check API Permissions Page

1. In the left menu, click **"API permissions"**
2. Look at the list of permissions

#### ✅ What You Should See:

```
┌─────────────────────┬──────────────────┬──────────┬─────────────────────────┐
│ API / Permission    │ Type             │ Admin    │ Status                  │
│ Name                │                  │ Required │                         │
├─────────────────────┼──────────────────┼──────────┼─────────────────────────┤
│ Microsoft Graph     │                  │          │                         │
│   Mail.Send         │ Application      │ Yes      │ ✅ Granted for [Org]    │
└─────────────────────┴──────────────────┴──────────┴─────────────────────────┘
```

#### ❌ Common Mistakes to Check:

**Mistake 1: Permission Type is "Delegated"**
```
│   Mail.Send         │ Delegated        │ Yes      │ ✅ Granted              │
```
❌ **WRONG!** - Must be **"Application"** not "Delegated"

**Solution**: 
- Remove the Delegated permission
- Add it again as Application permission

**Mistake 2: Status Shows "Not granted"**
```
│   Mail.Send         │ Application      │ Yes      │ ⚠️ Not granted          │
```
❌ **WRONG!** - Admin consent not granted

**Solution**:
- Click the button "Grant admin consent for [Your Organization]"
- Click "Yes" to confirm
- Wait for status to change to "✅ Granted"

**Mistake 3: Permission is not in the list at all**
```
No permissions configured
```
❌ **WRONG!** - Permission was never added

**Solution**:
- Click "+ Add a permission"
- Select "Microsoft Graph"
- Select "Application permissions"
- Search for "Mail.Send"
- Check the box
- Click "Add permissions"
- Then grant admin consent (see above)

---

### 4. Verify the Correct Permission Type

#### To Add Mail.Send as Application Permission:

1. Click **"+ Add a permission"**
2. Click **"Microsoft Graph"**
3. Click **"Application permissions"** ⚠️ (NOT "Delegated permissions"!)
4. In the search box, type: **"Mail"**
5. Expand **"Mail"** section
6. Find and check: **"Mail.Send"** - Send mail as any user
7. Click **"Add permissions"** at the bottom

---

### 5. Grant Admin Consent

After adding the permission:

1. You'll see it in the list with status "Not granted"
2. Click the button: **"Grant admin consent for [Your Organization Name]"**
3. A popup will appear asking: "Grant consent for the requested permissions for all accounts in [Your Organization]?"
4. Click **"Yes"**
5. Wait 5-10 seconds for the status to update
6. Status should change to: **"✅ Granted for [Your Organization]"**

---

### 6. Wait for Propagation

After granting consent:
- Wait **5-10 minutes** for the changes to propagate through Microsoft's systems
- Token cache needs to refresh

---

### 7. Verify the Fix

After waiting, run this command:

```bash
node verify-graph-token.js
```

#### ✅ Expected Success Output:

```
======================================================================
📊 FINAL VERDICT
======================================================================
✅ Mail.Send permission: PRESENT in token
✅ Azure AD configuration: CORRECT
```

If you still see "NOT PRESENT", wait another 5 minutes and try again.

---

## 🔍 Still Not Working?

### Double Check These:

1. **Correct App?**
   - Make sure you're looking at app: `papp-report`
   - Client ID: `9c916e84-9ff1-4e15-9d76-0a87cb974c30`

2. **Correct Tenant?**
   - Make sure you're in the right Azure AD tenant
   - Tenant ID should be: `b99fc2f6-d65e-4b48-935b-118659097da7`

3. **Admin Rights?**
   - You need to be a Global Administrator or Application Administrator
   - Check your role in Azure AD → Users → Your User → Assigned roles

4. **Conditional Access?**
   - Check if there are any Conditional Access policies blocking the app
   - Azure AD → Security → Conditional Access

---

## 📸 Screenshots to Verify

Take screenshots of:

1. **API Permissions page** showing Mail.Send with "Granted" status
2. **Overview page** showing the correct Client ID
3. **Token verification output** showing Mail.Send in roles

---

## 🆘 Need Help?

If you've completed all steps and it's still not working:

1. Share screenshot of the "API permissions" page
2. Run `node verify-graph-token.js` and share the output
3. Verify you're using the correct Azure AD tenant

---

## 📚 Microsoft Documentation

- [Application permissions vs Delegated permissions](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Grant admin consent](https://learn.microsoft.com/en-us/azure/active-directory/manage-apps/grant-admin-consent)
- [Microsoft Graph Mail permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#mail-permissions)
