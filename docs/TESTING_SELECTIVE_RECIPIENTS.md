# 🧪 Testing Guide: Selective Recipient Feature

## Quick Test Steps

### Prerequisites
1. ✅ Server running: `node auth-app.js`
2. ✅ Logged in as Admin or Auditor
3. ✅ Test users configured in database

---

## Test 1: Basic Flow

### Steps:
1. **Navigate to Dashboard**
   - URL: http://localhost:3001/dashboard
   - Login with Admin credentials

2. **Click "Generate" on any document**
   - Example: GMRL-FSACR-0001 (Signature store)

3. **Verify Modal Appears**
   - Should show "📧 Email Notifications" header
   - Should display two sections: "Store Managers" and "Department Heads"
   - All checkboxes should be pre-checked

4. **Review Recipients List**
   - Store Managers section shows managers assigned to that specific store
   - Department Heads section shows all department heads
   - Each recipient shows: Name, Role, Email

5. **Test Selection Controls**
   - Click "Deselect All" under Store Managers → all unchecked
   - Click "Select All" under Store Managers → all checked again
   - Manually uncheck one recipient
   - Manually check it back

6. **Send to Selected Recipients**
   - Click "📧 Send to Selected"
   - Modal closes
   - Report generates
   - Success message shows: "✅ Report generated successfully! 📧 Notifications sent to X recipient(s)."

7. **Verify in Database**
   ```sql
   SELECT recipient_name, recipient_email, status, sent_at
   FROM Notifications
   WHERE document_number = 'GMRL-FSACR-0001'
   ORDER BY sent_at DESC;
   ```

### Expected Results:
- ✅ Modal displays correctly with recipients
- ✅ Checkboxes work as expected
- ✅ Only selected recipients receive emails
- ✅ Database logs all sent notifications

---

## Test 2: Skip Notifications

### Steps:
1. Click "Generate" on any document
2. Modal appears with recipients
3. Click "Skip Notifications" button
4. Report should generate WITHOUT sending emails

### Expected Results:
- ✅ Report generates successfully
- ✅ Success message shows: "✅ Report generated successfully!" (no notification count)
- ✅ No new entries in Notifications table

---

## Test 3: Select Subset of Recipients

### Steps:
1. Click "Generate" on a document
2. Modal shows (e.g., 2 Store Managers + 3 Department Heads = 5 total)
3. Uncheck 1 Store Manager
4. Uncheck 2 Department Heads
5. Click "📧 Send to Selected"

### Expected Results:
- ✅ Only 2 recipients receive emails (1 Store Manager + 1 Department Head)
- ✅ Success message: "📧 Notifications sent to 2 recipient(s)"
- ✅ Database shows exactly 2 notification records

---

## Test 4: No Recipients Scenario

### Setup:
```sql
-- Temporarily disable all users' notifications
UPDATE Users SET email_notifications_enabled = 0;
```

### Steps:
1. Click "Generate" on any document
2. Wait for modal to load

### Expected Results:
- ✅ Modal shows "No recipients found" message
- ✅ "📧 Send to Selected" button is disabled
- ✅ "Skip Notifications" still works

### Cleanup:
```sql
-- Re-enable notifications
UPDATE Users SET email_notifications_enabled = 1;
```

---

## Test 5: Store-Specific Filtering

### Setup:
Ensure you have:
- Store Manager A assigned to "Signature" store
- Store Manager B assigned to "Naccache" store

### Steps:
1. Generate report for document from "Signature" store
2. Check modal recipients

### Expected Results:
- ✅ Only Store Manager A appears (assigned to Signature)
- ✅ Store Manager B does NOT appear
- ✅ All Department Heads appear (they see all stores)

---

## Test 6: API Direct Test

### Test Get Recipients Endpoint:

```powershell
# Get session token first (login via browser, copy from DevTools)
$sessionId = "YOUR_SESSION_ID"

# Call API
Invoke-RestMethod -Uri "http://localhost:3001/api/notifications/get-recipients" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body '{"storeName":"Signature"}' `
  -WebSession $sessionId
```

### Expected Response:
```json
{
  "success": true,
  "recipients": {
    "storeManagers": [
      {
        "userId": 3,
        "email": "manager@example.com",
        "name": "John Doe",
        "role": "StoreManager"
      }
    ],
    "departmentHeads": [
      {
        "userId": 5,
        "email": "cleaning@example.com",
        "name": "Jane Smith",
        "role": "CleaningHead"
      }
    ]
  },
  "total": 2
}
```

---

## Test 7: Browser DevTools Verification

### Steps:
1. Open Dashboard → F12 (DevTools)
2. Go to Network tab
3. Click "Generate" on a document

### Check Network Calls:
1. **POST /api/notifications/get-recipients**
   - Status: 200
   - Response: Contains recipients object
   - Timing: Should be fast (~100-500ms)

2. **POST /api/generate-report**
   - Status: 200
   - Request Body contains:
     ```json
     {
       "documentNumber": "GMRL-FSACR-0001",
       "sendNotifications": true,
       "selectedRecipients": ["email1@example.com", "email2@example.com"]
     }
     ```
   - Response contains:
     ```json
     {
       "success": true,
       "reportUrl": "...",
       "notifications": {
         "sent": 2,
         "failed": 0,
         "total": 2
       }
     }
     ```

### Check Console Tab:
- Should see: `📧 Found X recipient(s) for [StoreName]`
- Should see: `📧 Selected Y recipient(s) [array of emails]`

---

## Test 8: UI Responsiveness

### Test on Different Screen Sizes:
1. Desktop (1920x1080) - Full modal width
2. Tablet (768x1024) - Modal should still fit
3. Mobile (375x667) - Modal should scroll if needed

### Check:
- ✅ Modal centered on screen
- ✅ Checkboxes and labels aligned
- ✅ Buttons visible and clickable
- ✅ Scrollable recipient list if many recipients

---

## Test 9: Error Handling

### Scenario A: Network Error Fetching Recipients

**Simulate:**
1. Stop server temporarily
2. Click "Generate"
3. Network call fails

**Expected:**
- Modal shows with empty recipients (fallback)
- Warning message: "⚠️ No recipients found"
- Can still skip notifications

### Scenario B: Email Send Failure

**Simulate:**
- Invalid Microsoft Graph API credentials
- Recipient email invalid

**Expected:**
- Report still generates successfully
- Some notifications marked as "failed" in database
- Error logged in server console
- User sees partial success message

---

## Test 10: Role-Based Access

### Test as Different Roles:

**Admin:**
- ✅ Can generate reports
- ✅ Can see notification modal
- ✅ Can select recipients
- ✅ Can send notifications

**Auditor:**
- ✅ Can generate reports
- ✅ Can see notification modal
- ✅ Can select recipients
- ✅ Can send notifications

**Store Manager:**
- ❌ Cannot access report generation
- ❌ Cannot see notification modal

---

## Database Verification Queries

### Check Recipients Configuration:
```sql
-- All active Store Managers
SELECT id, full_name, email, assigned_stores, email_notifications_enabled
FROM Users
WHERE role = 'StoreManager' AND active = 1;

-- All active Department Heads
SELECT id, full_name, email, role, email_notifications_enabled
FROM Users
WHERE role IN ('CleaningHead', 'ProcurementHead', 'MaintenanceHead')
  AND active = 1;
```

### Check Notification Logs:
```sql
-- Recent notifications (last 24 hours)
SELECT 
  document_number,
  recipient_name,
  recipient_email,
  recipient_role,
  status,
  sent_at,
  sent_by_name
FROM Notifications
WHERE sent_at >= DATEADD(hour, -24, GETDATE())
ORDER BY sent_at DESC;

-- Notifications for specific document
SELECT * FROM Notifications
WHERE document_number = 'GMRL-FSACR-0001'
ORDER BY sent_at DESC;

-- Failed notifications
SELECT * FROM Notifications
WHERE status = 'failed'
ORDER BY sent_at DESC;
```

### Check User Notification Settings:
```sql
-- Users with notifications disabled
SELECT full_name, email, role, email_notifications_enabled
FROM Users
WHERE email_notifications_enabled = 0;
```

---

## Common Issues & Solutions

### Issue: Modal shows but no recipients
**Cause:** No users meet the criteria
**Fix:**
```sql
-- Create test users
INSERT INTO Users (azure_user_id, email, full_name, role, active, email_notifications_enabled, assigned_stores)
VALUES 
  (NEWID(), 'testmanager@example.com', 'Test Manager', 'StoreManager', 1, 1, '["Signature"]'),
  (NEWID(), 'testcleaning@example.com', 'Test Cleaning Head', 'CleaningHead', 1, 1, NULL);
```

### Issue: Checkboxes not working
**Cause:** JavaScript error or CSS not loaded
**Fix:**
- Check browser console for errors
- Verify `selectAllRecipients()` function exists
- Clear browser cache and reload

### Issue: Emails not sending
**Cause:** Microsoft Graph API not configured
**Fix:**
1. Check Azure AD app permissions
2. Verify Mail.Send permission granted
3. Test with a simple email send:
```javascript
await emailService.sendEmail(
  'your-email@example.com',
  'Test Email',
  '<h1>Test</h1>'
);
```

### Issue: Wrong recipients appearing
**Cause:** `assigned_stores` JSON not matching
**Fix:**
```sql
-- Check Store Manager assignments
SELECT 
  full_name, 
  email, 
  assigned_stores,
  JSON_QUERY(assigned_stores, '$') as parsed_json
FROM Users
WHERE role = 'StoreManager';

-- Update assignment (example)
UPDATE Users
SET assigned_stores = '["Signature", "Naccache"]'
WHERE email = 'manager@example.com';
```

---

## Performance Benchmarks

### Expected Response Times:
- **Fetch recipients:** < 500ms
- **Modal render:** < 100ms
- **Generate report:** 30-60 seconds (includes SharePoint data fetch)
- **Send 5 emails:** < 5 seconds (1 second per email avg)

### Load Testing:
Test with:
- 10 recipients → Should complete in < 10 seconds
- 50 recipients → Should complete in < 30 seconds
- 100 recipients → May need optimization (pagination recommended)

---

## Automated Test Script (Optional)

```javascript
// test-selective-recipients.js
async function testRecipientSelection() {
  console.log('🧪 Testing Selective Recipient Feature...');
  
  // Test 1: Fetch recipients
  const recipientsResponse = await fetch('/api/notifications/get-recipients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeName: 'Signature' })
  });
  const recipients = await recipientsResponse.json();
  console.log(`✅ Fetched ${recipients.total} recipient(s)`);
  
  // Test 2: Generate with selected recipients
  const selectedEmails = recipients.recipients.storeManagers
    .slice(0, 1)
    .map(r => r.email);
  
  const reportResponse = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentNumber: 'GMRL-FSACR-0001',
      sendNotifications: true,
      selectedRecipients: selectedEmails
    })
  });
  const result = await reportResponse.json();
  console.log(`✅ Sent ${result.notifications.sent} notification(s)`);
  
  console.log('🎉 All tests passed!');
}
```

---

## Sign-Off Checklist

Before declaring feature complete:

- [ ] All 10 manual tests pass
- [ ] Database queries return expected results
- [ ] No JavaScript errors in console
- [ ] Network calls complete successfully
- [ ] Modal UI displays correctly
- [ ] Recipient selection works
- [ ] Emails send to selected recipients only
- [ ] Notifications logged to database
- [ ] Error handling works
- [ ] Performance is acceptable
- [ ] Documentation is accurate
- [ ] Feature works for Admin role
- [ ] Feature works for Auditor role
- [ ] Feature blocked for Store Manager role

---

## Next Steps After Testing

1. ✅ Verify all tests pass
2. ✅ Fix any issues found
3. ✅ Document any edge cases
4. ✅ Update user documentation if needed
5. ✅ Commit changes to git
6. ✅ Deploy to production
7. ✅ Monitor Notifications table for issues
8. ✅ Collect user feedback

---

*Testing Guide Created: 2025-01-21*
*Status: Ready for Testing*
