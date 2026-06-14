# EOD Signature Flow - Visual Guide

## Complete Signature Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTODIAN EOD FLOW                           │
└─────────────────────────────────────────────────────────────────┘

1. LOGIN & NAVIGATE
   ┌───────────────────────────┐
   │ Custodian User            │
   │ Login → EOD Summary Page   │
   └───────────────┬───────────┘
                   │
                   ▼
   ┌─────────────────────────────────┐
   │ Select Assignment & View Tasks   │
   │ - Denomination Plans             │
   │ - Cash Pickups                   │
   │ - ATM Loads                      │
   │ - Issues                          │
   └───────────────┬─────────────────┘
                   │
                   ▼

2. SIGN EOD (✍️ SIGNATURE CAPTURE)
   ┌──────────────────────────────────────┐
   │ Click "Sign EOD" Button              │
   │ ↓                                    │
   │ Modal Opens                          │
   │ ├─ Title: "✍️ Sign Here"             │
   │ ├─ Canvas: User draws signature      │
   │ ├─ Button: "Clear"                   │
   │ └─ Button: "✓ Next: Review"          │
   └──────────────┬───────────────────────┘
                  │ [User draws signature]
                  ▼
   ┌──────────────────────────────────────┐
   │ Preview Modal Shows                  │
   │ ├─ Title: "✍️ Confirm Signature"     │
   │ ├─ Preview Image: [signature image]  │
   │ ├─ Note: Can't be changed later      │
   │ ├─ Button: "↶ Retake"                │
   │ └─ Button: "✓ Confirm & Lock"        │
   └──────────────┬───────────────────────┘
                  │ [User clicks Confirm]
                  ▼

3. UPLOAD TO STORAGE (🔼 UPLOAD)
   ┌─────────────────────────────────────────────┐
   │ Browser                                     │
   │ 1. Convert canvas to PNG DataURL            │
   │ 2. Convert DataURL to Blob                  │
   │ 3. Generate path:                           │
   │    eod_signature_assignment_{id}_{time}.png│
   └────────┬────────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────────────────┐
   │ Supabase Storage                            │
   │ POST /storage/v1/object                     │
   │ Bucket: eod-signatures                      │
   │ File: eod_signature_assignment_106_1770...  │
   │ Content-Type: image/png                     │
   └────────┬────────────────────────────────────┘
            │ [Upload success]
            ▼
   ┌─────────────────────────────────────────────┐
   │ Get Public URL                              │
   │ https://[project].supabase.co/              │
   │   storage/v1/object/public/                 │
   │   eod-signatures/eod_signature_...          │
   └────────┬────────────────────────────────────┘
            │
            ▼

4. SAVE TO DATABASE (💾 PERSIST)
   ┌─────────────────────────────────────────────┐
   │ Update assignments table                    │
   │ SET                                         │
   │   eod_signed = true                         │
   │   eod_signed_at = NOW()                     │
   │   eod_signature_url = {public_url}          │
   │ WHERE id = {assignment_id}                  │
   └────────┬────────────────────────────────────┘
            │ [DB update success]
            ▼

5. DISPLAY IN PREVIEW (👁️ RENDER - **FIXED**)
   ┌──────────────────────────────────────────────────┐
   │ Green Success Card Appears                       │
   │ ┌────────────────────────────────────────────┐   │
   │ │ ✓ EOD Signed & Locked                      │   │
   │ │ Signed on: {timestamp}                     │   │
   │ │ ┌──────────────────────────────────────┐   │   │
   │ │ │ SignatureImage Component (NEW)        │   │   │
   │ │ │ ├─ Check: Is URL valid?              │   │   │
   │ │ │ ├─ Display: Loading spinner          │   │   │
   │ │ │ ├─ Fetch: Image from bucket          │   │   │
   │ │ │ ├─ Success: Show image + checkmark   │   │   │
   │ │ │ └─ Error: Show error message + line   │   │   │
   │ │ │                                       │   │   │
   │ │ │ [Signature Image Displayed]           │   │   │
   │ │ │         ~~~~~~                        │   │   │
   │ │ │        /     \\                        │   │   │
   │ │ │       | John  |                       │   │   │
   │ │ │        \\     /                         │   │   │
   │ │ │         ~~~~ ✓                        │   │   │
   │ │ └──────────────────────────────────────┘   │   │
   │ │ 📋 This EOD is finalized ...               │   │
   │ └────────────────────────────────────────────┘   │
   └──────────────────────────────────────────────────┘
            │ [Custodian confirms signature visible]
            ▼

6. PRINT/PDF (🖨️ GENERATE)
   ┌─────────────────────────────────────────────┐
   │ Click "🖨️ Print / Download PDF"             │
   │ ↓                                           │
   │ **CRITICAL**: Preload signature before print│
   │ await preloadSignatureImage(url) [NEW]      │
   │ setTimeout(() => window.print(), 300)       │
   │ ↓                                           │
   │ Browser Print Dialog Opens                  │
   │ ├─ [Print Preview]                          │
   │ ├─ Signature in Footer: [visible ✓]        │
   │ └─ Save as PDF or Print                     │
   └──────────────┬───────────────────────────────┘
                  │ [User saves/prints]
                  ▼
   ┌──────────────────────────────────────────────┐
   │ PDF Generated with Embedded Signature        │
   │ ┌────────────────────────────────────────┐   │
   │ │ [EOD Report Content]                   │   │
   │ │                                        │   │
   │ │ [Transaction Data]                     │   │
   │ │                                        │   │
   │ │ ────────────────────────────────────   │   │
   │ │ Custodian Signature  │  Admin Sig      │   │
   │ │       ~~~~ ✓         │                 │   │
   │ │      /     \\        │  ___________    │   │
   │ │ John        │       │                 │   │
   │ │      \\     /        │                 │   │
   │ │       ~~~~         │  ___________    │   │
   │ │ John Doe 2/22/2026│  Name/Date/Seal │   │
   │ └────────────────────────────────────┘   │
   └──────────────┬───────────────────────────┘
                  │
                  ▼
   ┌──────────────────────────┐
   │  PDF File Saved/Downloaded│
   │  ✓ Signature Embedded     │
   │  ✓ Report Complete        │
   │  ✓ Audit Trail Intact     │
   └──────────────────────────┘
```

---

## Admin Approval Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN APPROVAL FLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. ADMIN LOGIN & VIEW EOD LIST
   ┌───────────────────────────┐
   │ Admin User                │
   │ Login → Admin Dashboard   │
   │ → EOD Lists               │
   └───────────────┬───────────┘
                   │
                   ▼
   ┌────────────────────────────────────┐
   │ View Submitted EOD Records         │
   │ ├─ Assignment #106                 │
   │ │  ├─ Status: submitted ✓          │
   │ │  ├─ Custodian: John Doe          │
   │ │  ├─ Date: 2026-02-22             │
   │ │  └─ Click to view details        │
   │                                    │
   │ ├─ Assignment #107                 │
   │ └─ ...                             │
   └───────────────┬────────────────────┘
                   │ [Click to view]
                   ▼

2. VIEW CUSTODIAN SIGNATURE (✍️ DISPLAY - **FIXED**)
   ┌────────────────────────────────────────────┐
   │ EOD Detail Page                            │
   │ ┌──────────────────────────────────────┐   │
   │ │ Custodian Signature Section          │   │
   │ │ ├─ Button: "View Signature"          │   │
   │ │ └─ [Click button]                    │   │
   │ └─────────────────┬────────────────────┘   │
   │                   │                        │
   │                   ▼                        │
   │ ┌──────────────────────────────────────┐   │
   │ │ SignatureModal Opens (NEW Component) │   │
   │ │ ┌──────────────────────────────────┐ │   │
   │ │ │ Signature                        │ │   │
   │ │ │ ┌──────────────────────────────┐ │ │   │
   │ │ │ │ [Signature Image - Loaded]   │ │ │   │
   │ │ │ │        ~~~~ ✓                │ │ │   │
   │ │ │ │       /     \\                │ │ │   │
   │ │ │ │  John        │                │ │ │   │
   │ │ │ │       \\     /                 │ │ │   │
   │ │ │ │        ~~~~                  │ │ │   │
   │ │ │ │ ✓ Signature verified         │ │ │   │
   │ │ │ │ Signed on: 2/22/2026 10:30am│ │ │   │
   │ │ │ └──────────────────────────────┘ │ │   │
   │ │ │ Close: ✕                        │ │   │
   │ │ └──────────────────────────────────┘ │   │
   │ └──────────────────────────────────────┘   │
   └────────────────────────────────────────────┘
            │ [Admin confirms signature]
            ▼

3. APPROVE OR REJECT
   ┌────────────────────────────────────────┐
   │ Approval Actions                       │
   │                                        │
   │ ✅ APPROVE EOD                         │
   │    └─ Updates status to "approved"     │
   │    └─ Records approver name & date     │
   │                                        │
   │ ❌ REJECT EOD                          │
   │    ├─ Prompts for rejection reason     │
   │    └─ Updates status to "rejected"     │
   │                                        │
   │ ← BACK                                 │
   └────────────────┬───────────────────────┘
                    │
                    ▼
   ┌────────────────────────────┐
   │ Confirmation Modal         │
   │ ✓ EOD Approved Successfully│
   └────────────────────────────┘

4. PRINT WITH SIGNATURE (🖨️ - **FIXED**)
   ┌────────────────────────────────────────┐
   │ Print Button: "🖨️ Print / PDF"         │
   │ ↓                                      │
   │ Preload signature (NEW)                │
   │ ↓                                      │
   │ Browser print dialog                  │
   │ ↓                                      │
   │ PDF includes:                          │
   │ ├─ Transaction data                    │
   │ ├─ Custodian signature ✓              │
   │ ├─ Admin signature line                │
   │ └─ Approval timestamp                  │
   └────────────────────────────────────────┘
```

---

## Error Handling Flow (NEW)

```
┌──────────────────────────────────────────────┐
│  WHAT HAPPENS IF SIGNATURE IMAGE FAILS TO   │
│              LOAD (FIXED)                    │
└──────────────────────────────────────────────┘

Scenario 1: Image Not Found (404)
┌─ SignatureImage Component receives URL
├─ Validates URL format ✓
├─ Attempts to fetch image
├─ Server returns 404 ❌
├─ onError handler triggered
└─ Display Error State:
   ┌──────────────────────────────┐
   │ ⚠️ Unable to load signature   │
   │ Failed to load signature      │
   │ image. Image URL may be       │
   │ invalid or bucket access      │
   │ denied.                        │
   │                              │
   │ URL: https://...blob/sig... │
   │                              │
   │ [Fallback signature line]    │
   │ ─────────────────────        │
   └──────────────────────────────┘

Scenario 2: CORS Error
┌─ Browser blocks image due to CORS
├─ Image load fails
├─ onError handler triggered
└─ Display Same Error UI with details
   └─ Console shows: CORS policy blocked

Scenario 3: Missing URL
┌─ eod_signature_url is NULL
├─ SignatureImage receives null
├─ Skips fetch attempt
└─ Display Placeholder:
   ┌──────────────────────────────┐
   │ No signature available        │
   │ [empty bordered box]          │
   └──────────────────────────────┘

Scenario 4: Network Timeout
┌─ Image fetch takes too long
├─ Browser timeout (usually 30s)
├─ onError handler triggered
└─ Display Error with retry option
   └─ User can refresh page
```

---

## Component Architecture

```
EODSummary.tsx
├─ Imports:
│  ├─ SignatureImage (NEW)
│  ├─ SignatureModal (NEW)
│  └─ preloadSignatureImage (NEW)
│
├─ Custodian View:
│  ├─ Signature Capture (existing canvas code)
│  ├─ Signature Upload (existing upload code)
│  ├─ On Success:
│  │  ├─ Store in DB (existing)
│  │  └─ Display with SignatureImage (FIXED)
│  │
│  └─ Print Button:
│     ├─ Preload: await preloadSignatureImage(url) (NEW)
│     ├─ Wait: setTimeout(..., 300ms) (NEW)
│     └─ Print: window.print() (existing)
│
└─ Admin Dashboard (unchanged)

AdminEODDetail.tsx
├─ Imports:
│  ├─ SignatureImage (NEW)
│  ├─ SignatureModal (NEW)
│  └─ preloadSignatureImage (NEW)
│
├─ Signature Review Section:
│  ├─ Check: eod_signed && eod_signature_url
│  ├─ Show: "View Signature" button
│  └─ Modal: <SignatureModal /> (NEW)
│      └─ Content: SignatureImage (NEW)
│
└─ Print Button:
   ├─ Preload: await preloadSignatureImage(url) (NEW)
   ├─ Wait: setTimeout(..., 300ms) (NEW)
   └─ Print: window.print() (existing)

SignatureImage.tsx (NEW COMPONENT)
├─ Props:
│  ├─ src: string (image URL)
│  ├─ size: 'small' | 'medium' | 'large'
│  ├─ showLabel: boolean
│  ├─ isPrint: boolean
│  ├─ onLoadSuccess: function
│  └─ onLoadError: function
│
├─ States:
│  ├─ loading: boolean
│  ├─ error: string | null
│  └─ imageUrl: string
│
├─ Effects:
│  └─ Validate URL & update state on src change
│
├─ Handlers:
│  ├─ handleImageLoad() - Success case
│  ├─ handleImageError() - Error case
│  └─ useEffect with logging
│
└─ Render:
   ├─ Loading state: Spinner
   ├─ Error state: Error message + line
   ├─ Success state: Image + checkmark
   └─ Fallback: Signature line
```

---

## Data Flow Diagram

```
USER INPUT (Signature)
        │
        ▼
┌──────────────────┐
│  HTML5 Canvas    │  (react-signature-canvas)
│  User draws sig  │
└────────┬─────────┘
         │ toDataURL("image/png")
         ▼
    ┌────────────┐
    │ Data URL   │  (data:image/png;base64,...)
    └─────┬──────┘
          │ fetch() → Blob
          ▼
    ┌────────────────────────┐
    │ PNG Blob               │
    │ (Binary image data)    │
    └─────┬──────────────────┘
          │ supabase.storage.upload()
          ▼
    ┌──────────────────────────┐
    │ Supabase Storage Bucket  │
    │ /eod-signatures/         │
    │ eod_signature_..._X.png  │
    └─────┬────────────────────┘
          │ getPublicUrl()
          ▼
    ┌──────────────────────────────────────┐
    │ Public URL (HTTPS)                   │
    │ https://project.supabase.co/storage/ │
    │   v1/object/public/eod-signatures/.. │
    └─────┬───────────────────────────────┘
          │ supabase.update(eod_signature_url)
          ▼
    ┌──────────────────────────┐
    │ Database: assignments    │
    │ {                        │
    │   eod_signed: true       │
    │   eod_signature_url: URL │
    │   eod_signed_at: now()   │
    │ }                        │
    └─────┬────────────────────┘
          │ fetch from DB on page load
          ▼
    ┌──────────────────────────────────────┐
    │ SignatureImage Component             │
    │ ├─ Validates URL ✓                  │
    │ ├─ Shows loading spinner             │
    │ ├─ Fetches from storage bucket       │
    │ ├─ On success:                       │
    │ │  ├─ Display image                  │
    │ │  ├─ Show checkmark                 │
    │ │  └─ Log success                    │
    │ └─ On error:                         │
    │    ├─ Show error message             │
    │    ├─ Show fallback line             │
    │    └─ Log failure details            │
    └─────┬────────────────────────────────┘
          │ (Rendering)
          ▼
    User sees signature ✓
    or helpful error message ✓
```

---

## Timeline of Fixes

```
BEFORE (Broken):
├─ Signature uploads ✓
├─ URL stored in DB ✓
├─ URL retrieval ✓
├─ Image display ✗ (broken with no fallback)
├─ PDF generation ✗ (race condition)
└─ Error handling ✗ (silent failures)

AFTER (Fixed):
├─ Signature uploads ✓
├─ URL stored in DB ✓
├─ URL retrieval ✓
├─ Image display ✓ (with SignatureImage component)
│  ├─ Loading indicator
│  ├─ Error handling
│  └─ Fallback UI
├─ PDF generation ✓ (with preloading)
│  ├─ await preloadSignatureImage()
│  └─ 300ms delay before print
└─ Error handling ✓ (comprehensive logging & UI)
   ├─ User-friendly messages
   ├─ Debug logging
   └─ Graceful degradation
```

---

This diagram shows the complete flow and how the fixes integrate into the existing system without breaking changes.
