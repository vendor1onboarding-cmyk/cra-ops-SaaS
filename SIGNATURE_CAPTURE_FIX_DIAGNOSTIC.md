# EOD Signature Capture Fix - Diagnostic Guide

## Problem: Empty Signature Captures (WHITE BLANK IMAGES)

### Root Cause
The signature drawing was happening on `modalSigPadRef` (expanded modal canvas), but the capture code was trying to save from `sigPadRef` (preview canvas which was never drawn on), resulting in blank white PNG files.

```
User Flow Timeline:
┌─────────────────────────────────────────────────────────┐
│ 1. User clicks "Sign & Lock EOD" button                 │
│    (shows clickable preview area with "Tap to sign")     │
├─────────────────────────────────────────────────────────┤
│ 2. Modal opens with FULL SCREEN canvas                  │
│    User draws signature here ✓ (modalSigPadRef)         │
├─────────────────────────────────────────────────────────┤
│ 3. User clicks "Next: Review"                           │
│    Code captures from modalSigPadRef ✓                  │
├─────────────────────────────────────────────────────────┤
│ 4. Preview modal shows signature ✓                      │
├─────────────────────────────────────────────────────────┤
│ ❌ OLD: Click "Confirm" → Saved blank from sigPadRef   │
│ ✓ NEW: Click "Confirm" → Saves from signaturePreviewUrl│
└─────────────────────────────────────────────────────────┘
```

---

## How to Detect Empty Signatures

### 1. Check Storage Directly
```sql
-- Query Supabase to find signatures for specific assignment
SELECT 
  eod_signature_url,
  eod_signed_at,
  custodian:custodian_id(full_name),
  id
FROM assignments
WHERE eod_signed = true
ORDER BY eod_signed_at DESC
LIMIT 10;
```

### 2. Visual Inspection in Browser
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by `eod-signatures`
4. Click on assignment to sign
5. Sign and submit
6. Look at uploaded PNG file
7. Click on it in Network tab → Preview tab
8. **Issue**: Image appears completely white/blank
9. **Fixed**: Image shows black signature lines

### 3. Console Logs (Correct Sequence)
```
✓ [SignatureImage] Attempting to load signature
✓ [preloadSignatureImage] Successfully preloaded signature
✓ [SignatureImage] Successfully loaded signature
```

**If seeing:**
```
⚠️ [SignatureImage] Image load failed
⚠️ Failed to load signature image. Image URL may be invalid
```
= Empty signature was saved (can't load anything)

---

## Test Scenarios - Verify the Fix Works

### Test 1: Sign and Save (Mobile)
**Steps:**
1. Login as custodian
2. Go to EOD Summary
3. Click "Sign & Lock EOD" button
4. **Modal opens fullscreen** ← Key: Modal appears, not preview
5. Draw signature on modal (should be visible)
6. Click "Next: Review"
7. **Preview shows your signature** ← Key: You see what you drew
8. Click "Confirm"
9. **Modal closes, signature locked** ← Key: No blank image

**Expected Result:**
- Signature appears in preview ✓
- Signature appears in admin modal ✓
- Signature embeds in PDF ✓
- Console shows: `Successfully loaded signature`

**Failure Signs:**
- Blank white image in preview ✗
- Console error: `Image load failed` ✗
- Empty white PNG in storage ✗

---

### Test 2: Verify Modal Canvas is Used
**Steps:**
1. Inspect element → Find `modalSigPadRef`
2. Open DevTools Console
3. Type: `document.querySelector('[data-test="modal-canvas"]')`
4. Sign again
5. Check Network showing uploaded PNG
6. Click PNG → Preview tab
7. Should see actual signature strokes

---

### Test 3: Check Canvas Dimensions
**Console Command:**
```javascript
// Get modal canvas dimensions
const canvas = document.querySelector('canvas');
console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

// Check if canvas has actual drawing data
const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
const hasData = imageData.data.some(pixel => pixel > 0);
console.log('Canvas has drawn content:', hasData);
```

**Expected:** 
- `Canvas has drawn content: true` ✓

**Wrong:**
- All pixels are 0 (white background) ✗

---

## Fixed Code Paths (After Update)

### OLD (Broken) Flow:
```typescript
// ❌ WRONG - Captures from preview canvas (always empty)
async function submitSignature() {
  const dataUrl = sigPadRef.current.toDataURL(); // Empty!
  const blob = await fetch(dataUrl).blob();
  // Saves blank white PNG
}
```

### NEW (Fixed) Flow:
```typescript
// ✓ CORRECT - Opens modal for drawing
function openSignatureModal() {
  setShowSignatureModal(true); // User draws on modalSigPadRef
}

// ✓ CORRECT - Captures from modal preview
if (signaturePreviewUrl) {
  const blob = await fetch(signaturePreviewUrl).blob();
  // Saves actual signature
}
```

---

## Debug Checklist

- [ ] **Canvas Visibility**
  - Modal opens when clicking "Sign & Lock EOD"?
  - Drawing appears on modal canvas in real-time?
  - Strokes visible as you draw?

- [ ] **Preview Generation**
  - Modal shows "Next: Review" button?
  - Click button → Shows preview of signature?
  - Preview shows actual strokes or blank?

- [ ] **Storage Verification**
  - Check Supabase Storage → eod-signatures bucket
  - Recent PNG files (check timestamp)
  - Download image and open: shows signature or blank?

- [ ] **Database**
  ```sql
  SELECT eod_signature_url, eod_signed FROM assignments 
  WHERE eod_signed = true LIMIT 5;
  ```
  - All URLs populated?
  - URLs follow pattern: `eod_signature_assignment_{id}_{timestamp}.png`?

- [ ] **Browser Console**
  - Filter: `[SignatureImage]`
  - Should see "Successfully loaded" messages
  - Any red errors = signature loading failed

- [ ] **PDF Print**
  - Sign and lock EOD
  - Click Print EOD
  - Check PDF preview
  - Signature visible in heading/footer?
  - Not blank/white?

---

## Common Issues After Fix

### Issue 1: Signature Still Shows As Blank
**Symptoms:**
- Store blank white PNG files
- Console shows "Successfully loaded" but image is white

**Causes:**
- User didn't actually draw on modal (just clicked without writing)
- Canvas size is 1x1 (needs resize on modal open)

**Fix:**
```typescript
// Ensure canvas resizes when modal opens
useEffect(() => {
  if (showSignatureModal) {
    setTimeout(() => {
      resizeSignatureCanvas(modalSigPadRef, modalCanvasWrapRef);
    }, 100);
  }
}, [showSignatureModal]);
```

### Issue 2: "No signature URL provided" Error
**Symptoms:**
- Error message: "No signature URL provided"
- Assignment shows unsigned even after clicking confirm

**Causes:**
- Database update failed silently
- Network request was blocked
- Supabase permission denied

**Fix:**
- Check browser Network tab for failed requests
- Verify Supabase bucket is PUBLIC
- Check RLS policies

### Issue 3: Loading Spinner Never Stops
**Symptoms:**
- Click sign, modal opens
- Try to draw but nothing happens
- Forever loading spinner

**Causes:**
- Canvas not resizing properly
- Modal wrapper height is 0
- SignatureCanvas library issue

**Fix:**
```typescript
// Check modal wrapper has dimensions
<div ref={modalCanvasWrapRef} className="flex-1 border rounded">
  {/* flex-1 ensures it takes available space */}
</div>
```

---

## Example: Testing with Browser Console

**Copy-paste this in browser console after opening signature modal:**

```javascript
// Check if modal canvas exists and is drawable
const modal = document.querySelector('[role="dialog"]');
const canvas = modal?.querySelector('canvas');

const checks = {
  'Modal visible': !!modal,
  'Canvas exists': !!canvas,
  'Canvas width': canvas?.width,
  'Canvas height': canvas?.height,
  'Canvas has context': !!canvas?.getContext('2d'),
  'Modal display': window.getComputedStyle(modal).display,
  'Modal z-index': window.getComputedStyle(modal).zIndex,
};

console.table(checks);
console.log('✓ If all checks pass, modal is ready for signing');
```

**Expected Output:**
```
Modal visible:      true
Canvas exists:      true
Canvas width:       1024
Canvas height:      768
Canvas has context: true
Modal display:      flex
Modal z-index:      60
```

---

## How to Disable Empty Signature Uploads (Optional Enhancement)

Add validation before saving:

```typescript
// Check if signature canvas actually has drawing
async function validateSignatureNotEmpty(dataUrl: string) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      
      // Check if any pixel is NOT white (R>250, G>250, B>250)
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const hasSignature = imageData?.data.some((value, i) => {
        const colorIndex = i % 4;
        return colorIndex < 3 && value < 250;
      });
      
      resolve(!!hasSignature);
    };
    img.src = dataUrl;
  });
}

// Use before upload:
if (!await validateSignatureNotEmpty(signaturePreviewUrl)) {
  setSigError("Please actually draw a signature before submitting");
  return;
}
```

---

## References

- **Canvas Library:** `react-signature-canvas`
- **Storage Bucket:** `eod-signatures` (PUBLIC)
- **Component:** `src/components/SignatureImage.tsx`
- **Pages:** `src/pages/EODSummary.tsx`, `src/pages/AdminEODDetail.tsx`
