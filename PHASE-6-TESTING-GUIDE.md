# Phase 6 Testing Guide

## 🎯 Quick Start

**Server Status:** ✅ Running on http://localhost:3001  
**Checklist Management URL:** http://localhost:3001/admin/checklist-management  
**Test Admin User:** muhammad.shammas@gmrlgroup.com

---

## 📝 Testing Checklist

### 1. Access & Authentication (2 min)

- [ ] Navigate to http://localhost:3001/auth/login
- [ ] Log in with admin credentials
- [ ] Navigate to http://localhost:3001/admin/checklist-management
- [ ] Verify page loads with statistics dashboard
- [ ] Check that all 13 sections appear in dropdown

**Expected:** Professional UI loads with purple gradient header, stats cards showing totals

---

### 2. View Questions (3 min)

- [ ] Check statistics cards at top (Total/Active/Inactive/Sections)
- [ ] Select "Food Storage & Dry Storage" from section filter
- [ ] Verify questions table populates with data
- [ ] Check table columns: #, Section, Question, Coeff, Answers, Status, Actions
- [ ] Test pagination if more than 20 questions

**Expected:** Table shows all questions from selected section, properly formatted

---

### 3. Search & Filter (3 min)

- [ ] Clear section filter (select "All Sections")
- [ ] Enter "temperature" in search box, click Search
- [ ] Verify results show questions containing "temperature"
- [ ] Select "Active" from status filter
- [ ] Verify only active questions shown
- [ ] Select "Inactive" from status filter
- [ ] Verify only inactive questions shown

**Expected:** Search and filters work correctly, results update immediately

---

### 4. Add New Question (5 min)

- [ ] Click **"➕ Add Question"** button
- [ ] Modal dialog opens
- [ ] Select "Fridges and Freezers" from section dropdown
- [ ] Note the suggested reference value (e.g., "2.27")
- [ ] Enter reference value: "99.1"
- [ ] Enter question title: "Test Question - Delete Me"
- [ ] Enter criterion: "This is a test question for Phase 6 validation"
- [ ] Select coefficient: "2 (Standard)"
- [ ] Select answer options: "Yes,Partially,No,NA"
- [ ] Enter reason: "Testing Phase 6 add functionality"
- [ ] Click **"Save Question"**
- [ ] Verify success message appears
- [ ] Verify question appears in table

**Expected:** Question successfully created, appears in Fridges and Freezers section

---

### 5. Edit Question (5 min)

- [ ] Find the question you just created (filter by Fridges section)
- [ ] Click **✏️ Edit** icon in actions column
- [ ] Modal opens with question data pre-filled
- [ ] Change question title to: "Test Question - EDITED"
- [ ] Change coefficient to: "4 (Critical)"
- [ ] Enter reason: "Testing Phase 6 edit functionality"
- [ ] Click **"Save Question"**
- [ ] Verify success message appears
- [ ] Verify question shows updated text and Coeff=4

**Expected:** Question successfully updated, changes reflected in table

---

### 6. Toggle Question Status (3 min)

- [ ] Find the test question in table
- [ ] Note current status (should be "Active" with green badge)
- [ ] Click **🔴 Deactivate** button
- [ ] Confirm in dialog
- [ ] Verify status changes to "Inactive" (red badge)
- [ ] Verify button changes to **🟢 Activate**
- [ ] Click **🟢 Activate** button
- [ ] Confirm in dialog
- [ ] Verify status changes back to "Active"

**Expected:** Status toggles correctly, badge colors update

---

### 7. View Question History (5 min)

- [ ] Find the test question
- [ ] Click **📜 History** icon in actions column
- [ ] History modal opens
- [ ] Verify you see at least 3 entries:
  - CHECKLIST_ADD (initial creation)
  - CHECKLIST_UPDATE (your edit)
  - CHECKLIST_TOGGLE (status changes)
- [ ] Click **"View Changes"** on the UPDATE entry
- [ ] Verify before/after states show correctly
- [ ] Check that Title changed from original to "EDITED"
- [ ] Check that Coeff changed from 2 to 4

**Expected:** Complete change history visible with expandable details

---

### 8. View Recent Changes (3 min)

- [ ] Close question history modal
- [ ] Click **"📜 View History"** button at top
- [ ] History modal opens showing recent changes across all sections
- [ ] Verify your test question changes appear at top (most recent)
- [ ] Check that user email is correct
- [ ] Check that timestamps are accurate
- [ ] Check that reasons you entered are displayed

**Expected:** Recent changes from all sections visible, sorted by date

---

### 9. Statistics (2 min)

- [ ] Refresh the page
- [ ] Check statistics cards at top
- [ ] Verify total questions count increased by 1
- [ ] Verify "Fridges and Freezers" section shows +1 question

**Expected:** Statistics accurately reflect the added question

---

### 10. Permissions Check (2 min)

**If you have a non-admin user account:**
- [ ] Log out (http://localhost:3001/auth/logout)
- [ ] Log in as auditor or department head
- [ ] Try to navigate to http://localhost:3001/admin/checklist-management
- [ ] Verify you get 403 Forbidden error

**OR use browser console:**
- [ ] Open DevTools (F12)
- [ ] Go to Console tab
- [ ] Run: `fetch('/api/checklist/sections').then(r => r.json()).then(console.log)`
- [ ] As admin: Should return sections list
- [ ] As non-admin: Should return 403 error

**Expected:** Only admins can access checklist management

---

## 🐛 Common Issues & Solutions

### Issue: Modal doesn't open
**Solution:** Check browser console (F12) for JavaScript errors

### Issue: "Failed to load questions"
**Solution:** 
1. Check SharePoint connectivity
2. Verify list names match exactly
3. Check simple-graph-connector.js is working

### Issue: "AuditLog table not found"
**Solution:** System falls back to console logging - check terminal output

### Issue: Changes not saving
**Solution:**
1. Check validation errors in modal
2. Verify database connection in config/default.js
3. Check terminal for error logs

### Issue: Search returns no results
**Solution:**
1. Clear all filters first
2. Try shorter search terms
3. Check that questions exist in SharePoint

---

## 📊 Expected Test Results

After completing all tests, you should have:

- ✅ 1 new question in "Fridges and Freezers" section
- ✅ Question edited (title contains "EDITED", Coeff=4)
- ✅ At least 3 entries in question history (ADD, UPDATE, TOGGLE)
- ✅ All entries logged in AuditLog table with your user email
- ✅ Statistics cards showing updated counts

---

## 🧹 Cleanup (Optional)

To remove test question:
1. Find "Test Question - EDITED" in table
2. Click 🔴 Deactivate button
3. Confirm deactivation
4. Question remains in table but shows as "Inactive"

**Note:** There is no hard delete - questions are soft-deleted only.

---

## 📸 Screenshots to Capture

For documentation, capture screenshots of:
1. Main page with statistics dashboard
2. Questions table with multiple sections
3. Add question modal (filled out)
4. Edit question modal
5. Version history modal with expanded changes
6. Mobile responsive view (resize browser)

---

## ✅ Test Success Criteria

**Phase 6 passes testing if:**
- [ ] All CRUD operations work correctly
- [ ] Version history captures all changes accurately
- [ ] UI is responsive and professional
- [ ] Only admins can access the system
- [ ] Search and filters work as expected
- [ ] No console errors in browser
- [ ] No server errors in terminal
- [ ] Statistics update correctly

---

## 🎉 Next Steps

Once testing is complete:
1. Document any bugs found in new GitHub issue
2. Capture screenshots for documentation
3. Update PHASE-6-COMPLETE.md with test results
4. Proceed to Phase 7 (if defined) or close Phase 6

---

**Ready to test!** Start with step 1 and work through the checklist. 🚀
