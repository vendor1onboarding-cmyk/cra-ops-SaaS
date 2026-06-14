# EOD Signature Rendering - Complete Test Guide

## Pre-Test Checklist

- [ ] EOD_SIGNATURE_CONFIGURATION.md has been reviewed
- [ ] Supabase bucket `eod-signatures` is set to Public
- [ ] CORS is configured in Supabase Project Settings
- [ ] `.env.local` has correct VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- [ ] Application runs without errors: `npm run dev`
- [ ] Browser console is open (F12 → Console tab)

---

## Test 1: Signature Capture & Upload

### Steps:
1. Login as a **custodian** user
2. Navigate to **EOD Summary** page
3. Select an EOD assignment or create a test one
4. Click **Sign EOD** button
5. In the signature modal, draw a signature
6. Click **✓ Next: Review**
7. Click **✓ Confirm & Lock**

### Expected Results:
- [ ] Modal closes after confirmation
- [ ] Success message appears: "✓ EOD signed and locked successfully"
- [ ] Console shows: `[SignatureImage] Successfully loaded signature`
- [ ] Status changes to "signed"
- [ ] Green "EOD Signed & Locked" section appears

### Troubleshooting If Failed:
- Check browser console for errors starting with `[SignatureImage]`
- Check Network tab → Should see POST to `/storage/v1/object` with 200 status
- Verify `eod_signature_url` was saved in database

---

## Test 2: Signature Display in Custodian Preview (On Same Page)

### Steps:
1. After Test 1 is complete, stay on the same EOD page
2. Scroll up to see the signature preview section

### Expected Results:
- [ ] Green card appears with title "✓ EOD Signed & Locked"
- [ ] "Signed on: [timestamp]" displays correctly
- [ ] Signature image loads with checkmark "✓ Signature verified"
- [ ] Image displays the handwritten signature clearly
- [ ] Text appears below: "This EOD is finalized and embedded in the PDF..."

### Troubleshooting If Failed:
- Check browser console for `[SignatureImage]` error messages
- If error shows "Image load failed": Check Network tab → signature image request status
- If 404 error: Verify bucket name is `eod-signatures` and is public
- If CORS error: Verify CORS config in Supabase Project Settings

---

## Test 3: Signature Persists After Page Refresh

### Steps:
1. Complete Test 1 (signature captured and saved)
2. **Refresh the page** (F5 or Cmd+R)
3. Wait for page to reload
4. The same EOD should still be displayed

### Expected Results:
- [ ] Signature section reappears automatically
- [ ] Same signature is visible (should be identical)
- [ ] No "loading" spinner appears
- [ ] No error messages appear
- [ ] No need to click any buttons to reload signature

### Troubleshooting If Failed:
- Check database: `SELECT eod_signature_url FROM assignments WHERE id = {assignment_id};`
- If URL is NULL: Signature wasn't saved (go back to Test 1)
- If URL has value but image doesn't show: Bucket access issue (see EOD_SIGNATURE_CONFIGURATION.md)
- Check browser console for `[SignatureImage]` logs

---

## Test 4: Admin View - Signature Display

### Steps:
1. Login as **admin** or **supervisor** user
2. Navigate to **Admin → Approvals** (or Admin Dashboard)
3. Find the EOD from Test 1 (should have status "submitted")
4. Click to view EOD details
5. Look for **"Custodian Signature"** section
6. Click **View Signature** button

### Expected Results:
- [ ] Modal popup appears with the signature image
- [ ] Image displays clearly with checkmark "✓ Signature verified"
- [ ] Timestamp displays: "Signed on: [date and time]"
- [ ] Modal has close button (✕)
- [ ] Clicking outside modal closes it

### Troubleshooting If Failed:
- Check if `eod_signed` and `eod_signature_url` are both present in DB
- Verify image loads (same as Test 2 troubleshooting)
- Check Network tab headers for CORS errors
- Verify bucket is public: Dashboard → Storage → eod-signatures → bucket settings

---

## Test 5: PDF Generation with Signature

### Steps:
1. Complete Test 1 (signature captured)
2. On EOD page, find the **Print/PDF button** (sticky at bottom)
3. Button should show: "🖨️ Print / Download PDF"
4. Click the button
5. Browser print dialog appears
6. Click **Save as PDF** or **Print**

### Expected Results:
- [ ] Print dialog opens without errors
- [ ] PDF preview shows signature in the footer section (bottom of page)
- [ ] Signature is clearly visible, not broken/blank
- [ ] All transaction data is visible above signature section
- [ ] PDF downloads/prints successfully
- [ ] Browser console shows preloading logs

### Key Signature Locations in PDF:
- **Page Footer Left**: "Custodian Signature" section
- **Page Footer Right**: "Supervisor/Admin Signature" section

### Troubleshooting If Failed:
- If signature blank in PDF: Preloading might have failed
  - Check console for `[preloadSignatureImage]` logs
  - The preloading adds a 300ms delay before printing
- If print dialog doesn't appear: Check browser console for JavaScript errors
- If PDF saves but signature missing:
  - Try printing again (sometimes timing issue)
  - Check that image URL is valid by opening it directly in new tab

---

## Test 6: Admin Print with Signature

### Steps:
1. Login as admin
2. Go to Admin → Approvals → Select an EOD with signature
3. Click **🖨️ Print / PDF** button
4. Browser print dialog appears
5. Save as PDF

### Expected Results:
- [ ] Same as Test 5 but from admin view
- [ ] Signature embedded in print footer
- [ ] All admin-level data displays correctly
- [ ] PDF saves without errors

---

## Test 7: Mobile Rendering

### Steps:
1. Open application on **mobile device** or use Chrome DevTools (F12 → Toggle device toolbar)
2. Complete signature capture (Test 1)
3. View signature in preview
4. Test PDF generation

### Expected Results:
- [ ] Signature canvas is responsive (fills screen width)
- [ ] Touch input works smoothly (no lag)
- [ ] Signature dialog appears full-screen
- [ ] Buttons are touch-friendly (min 44px height)
- [ ] Signature preview displays at correct size
- [ ] Print renders correctly in mobile (landscape recommended)

### Mobile-Specific Checks:
- [ ] No horizontal scroll needed for signature
- [ ] Modal doesn't crop signature
- [ ] Buttons are easily tappable
- [ ] Text is legible without zooming

---

## Test 8: Error Handling

### Simulate Bucket Access Error:

#### Step 8a: Test Broken URL
1. Manually update DB: Set `eod_signature_url` to `https://example.com/nonexistent.png`
2. Refresh page
3. Signature section should appear with error state

**Expected Results**:
- [ ] Red error card appears
- [ ] Error message: "⚠️ Unable to load signature"
- [ ] Detailed error explanation shows
- [ ] Fallback signature line displays below
- [ ] Page doesn't crash

#### Step 8b: Test Missing CORS
1. Disable CORS in Supabase temporarily
2. Refresh page with signature
3. Browser console shows CORS error

**Expected Results**:
- [ ] Browser console shows CORS policy error
- [ ] `[SignatureImage]` log shows load failure
- [ ] Error state UI appears with red styling
- [ ] User can click "View Signature" → still shows error gracefully

---

## Test 9: Historical EOD Records

### Steps:
1. In Admin view, look at **old/completed EOD records**
2. Select one that was signed weeks/months ago
3. Check signature display

### Expected Results:
- [ ] Signature still loads and displays
- [ ] Image is not lost or expired
- [ ] No "file not found" errors
- [ ] Audit trail is intact

### If Failed:
- Signature might have been deleted from storage
- Check S3/Supabase storage logs
- Ensure bucket lifecycle policies don't delete old files

---

## Test 10: Database Integrity

### SQL Queries to Run:

```sql
-- Check signature records
SELECT 
  id,
  assignment_date,
  custodian_id,
  eod_signed,
  eod_signed_at,
  eod_signature_url,
  status
FROM assignments
WHERE eod_signed = true
ORDER BY eod_signed_at DESC
LIMIT 10;

-- Check for integrity issues
SELECT id, eod_signed, eod_signature_url
FROM assignments
WHERE eod_signed = true AND eod_signature_url IS NULL;
-- Result should be empty (can't have flag without URL)

SELECT id, eod_signed, eod_signature_url, eod_signed_at
FROM assignments
WHERE eod_signature_url IS NOT NULL AND eod_signed = false;
-- Result should be empty (can't have URL without flag)
```

### Expected Results:
- [ ] All signed EODs have both `eod_signed = true` AND `eod_signature_url` populated
- [ ] No orphaned records (URL without flag or vice versa)
- [ ] `eod_signed_at` timestamp is reasonable and recent

---

## Test 11: Concurrent User Access

### Steps:
1. Open EOD page in **2 different browser windows** (same user)
2. In Window A: Sign the EOD
3. Check Window B: Refresh page

**Expected Results**:
- [ ] Window B immediately shows signature once refreshed
- [ ] No data conflicts or duplication
- [ ] Signature URL matches between windows

### Steps:
1. Open as **Custodian** → Complete signature
2. Open as **Admin** in another window
3. Both should see same signature

**Expected Results**:
- [ ] Both views show identical signature
- [ ] No race conditions or timing issues
- [ ] Print from both views embeds same signature

---

## Test 12: Validation & Error Recovery

### Test expired session:
1. Sign EOD while logged in
2. Wait for session to expire (or clear cookies)
3. Refresh page
4. Should prompt re-login

**Expected Results**:
- [ ] Session handled gracefully
- [ ] After re-login, signature still visible
- [ ] No data loss

### Test network interruption:
1. Start signature signing
2. During upload, disable network (F12 → Network → Offline)
3. Try to confirm signature

**Expected Results**:
- [ ] Error appears: "Failed to save signature"
- [ ] User can retry when network is back
- [ ] No partial uploads to DB

---

## Console Logging Reference

### Success Logs (should appear):
```
[SignatureImage] Attempting to load signature: {bucket: 'eod-signatures', path: '...', timestamp: '...'}
[SignatureImage] Successfully loaded signature
[EODSummary] Preloading signature before print...
[preloadSignatureImage] Successfully preloaded signature
```

### Error Logs (troubleshooting):
```
[SignatureImage] Image load failed: {src: '...', error: '...', timestamp: '...'}
[SignatureImage] Failed to load signature image. Image URL may be invalid or bucket access denied.
[preloadSignatureImage] Failed to preload signature
```

---

## Final Validation Checklist

- [ ] Test 1: Signature captures and uploads ✓
- [ ] Test 2: Signature displays in custodian preview ✓
- [ ] Test 3: Signature persists after refresh ✓
- [ ] Test 4: Admin can view signature ✓
- [ ] Test 5: Signature embeds in PDF (custodian) ✓
- [ ] Test 6: Signature embeds in PDF (admin) ✓
- [ ] Test 7: Mobile rendering works ✓
- [ ] Test 8: Error handling shows gracefully ✓
- [ ] Test 9: Historical records have signatures ✓
- [ ] Test 10: Database integrity is clean ✓
- [ ] Test 11: Concurrent access works ✓
- [ ] Test 12: Error recovery is smooth ✓

---

## Known Limitations & Workarounds

1. **Image Takes Time to Load**: Normal behavior, 300ms preload delay helps with PDF
2. **Mobile Signature Quality**: Dependent on device DPI, works best on tablets
3. **PDF Print Quality**: Matches browser rendering, use Chrome for best results
4. **Signature Immutability**: Once signed, cannot be changed (by design)

---

## Rollback Plan If Issues Found

If critical signature rendering issue is discovered:

1. Revert to previous version of EODSummary.tsx
2. Temporarily disable SignatureImage component
3. Use basic `<img>` tag as fallback
4. Notify users of known issue
5. Fix and redeploy

---

## Performance Metrics

Track these to ensure no regression:

- Signature upload time: < 2 seconds
- Signature display load time: < 1 second  
- PDF generation with signature: < 2 seconds total
- Page load with signature data: < 1.5 seconds

---

## Support & Debugging

If signature not rendering:

1. **Check Console**: Look for `[SignatureImage]` error logs
2. **Check Network**: Verify signature URL request returns 200 with image/png
3. **Check Database**: Query assignments table for eod_signature_url value
4. **Check Bucket**: Verify eod_signatures bucket exists and is public
5. **Check CORS**: Confirm CORS config includes your app domain
6. **Contact Support**: Include console logs, Network request/response, DB query results
