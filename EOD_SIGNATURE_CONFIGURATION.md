# EOD Signature Storage - Configuration & Troubleshooting Guide

## Overview
EOD signatures are stored in Supabase Storage in the `eod-signatures` bucket as PNG images and are referenced in the `assignments` table via the `eod_signature_url` column.

## Bucket Configuration

### 1. Create the Bucket (if not exists)

In **Supabase Dashboard → Storage**:

```
Bucket Name: eod-signatures
Access Level: Public
```

**CRITICAL**: The bucket MUST be set to **Public** for the signature images to be accessible via public URLs.

### 2. Enable CORS (Cross-Origin Resource Sharing)

In **Supabase Dashboard → Project Settings → CORS**:

Add the following CORS configuration:

```json
{
  "allowed_headers": ["*"],
  "allowed_methods": ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
  "allowed_origins": [
    "http://localhost:5175",
    "http://localhost:3000",
    "https://yourdomain.com",
    "*"
  ],
  "exposed_headers": ["*"],
  "max_age": 3600
}
```

### 3. Row Level Security (RLS) Policy

In **Supabase Dashboard → Authentication → Policies → eod-signatures**:

#### Enable RLS on the bucket:
```sql
-- Storage bucket RLS setup (in SQL editor)
-- Public read access (anyone can view)
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'eod-signatures' );

-- Authenticated upload/update (only authenticated users)
CREATE POLICY "Authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'eod-signatures' 
    AND auth.role() = 'authenticated'
  );
```

## Signature URL Format

### Storage Path
```
eod_signature_assignment_{assignment_id}_{timestamp}.png
Example: eod_signature_assignment_106_1770496429301.png
```

### Public URL Format
```
https://{supabase-project}.supabase.co/storage/v1/object/public/eod-signatures/{filename}
Example: https://ejszqwmmpspvhtuhodsa.supabase.co/storage/v1/object/public/eod-signatures/eod_signature_assignment_106_1770496429301.png
```

## Implementation Details

### Upload Flow (in EODSummary.tsx)

```typescript
// 1. Convert signature canvas to Blob
const dataUrl = sigPadRef.current.toDataURL("image/png");
const blob = await (await fetch(dataUrl)).blob();

// 2. Generate unique path
const path = `eod_signature_assignment_${assignment.id}_${Date.now()}.png`;

// 3. Upload to bucket
const { error: uploadError } = await supabase.storage
  .from("eod-signatures")
  .upload(path, blob, { contentType: "image/png" });

// 4. Get public URL
const { data } = supabase.storage
  .from("eod-signatures")
  .getPublicUrl(path);

// 5. Store URL in database
await supabase
  .from("assignments")
  .update({
    eod_signed: true,
    eod_signed_at: new Date().toISOString(),
    eod_signature_url: data.publicUrl,  // <- Store the public URL
  })
  .eq("id", assignment.id);
```

### Retrieval & Display Flow

1. **Fetch from Database**: Signature URL is retrieved from `assignments.eod_signature_url`
2. **Validate URL**: Check if URL is not null/empty before rendering
3. **Load Image**: Use `SignatureImage` component with error handling
4. **Error Handling**: If image fails to load, show fallback UI with diagnostic info

## Common Issues & Troubleshooting

### Issue 1: Signature URL Stored but Image Returns 404

**Cause**: Bucket is not public or URL path is incorrect

**Solution**:
1. Verify bucket is set to **Public** in Supabase Storage settings
2. Check URL format: Should contain `/public/` path segment
3. Verify file exists in bucket: `supabase.storage.from('eod-signatures').list()`

### Issue 2: CORS Error When Loading Image in Browser

**Error**: `Access to XMLHttpRequest at '...' from origin '...' has been blocked by CORS policy`

**Solution**:
1. Configure CORS in Supabase Project Settings (see section above)
2. Ensure allowed origins include your app's domain
3. Browser console will show exact origin, add it to CORS config

### Issue 3: Image Loads but Appears Broken

**Cause**: File might be corrupted or not actually a PNG

**Solution**:
1. Check browser Network tab → request to signature URL
2. Response status should be 200
3. Response content-type should be `image/png`
4. Try downloading the file to verify it opens in image viewer
5. Enable debug logging: Check browser console for `[SignatureImage]` logs

### Issue 4: Signature Doesn't Persist After Page Refresh

**Solution**:
1. Verify `eod_signature_url` is being stored in `assignments` table
2. Check that `eod_signed` flag is also set to `true`
3. Query database: `SELECT eod_signed, eod_signature_url FROM assignments WHERE id = {assignment_id};`

### Issue 5: PDF Generation Doesn't Include Signature

**Cause**: Image not loaded before PDF render (race condition)

**Solution** (Already implemented):
```typescript
// Preload image before print
await preloadSignatureImage(assignment.eod_signature_url);
setTimeout(() => window.print(), 300);
```

The delay ensures image is cached before browser renders PDF.

## Database Schema

### assignments Table
```sql
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS (
  eod_signed BOOLEAN NOT NULL DEFAULT FALSE,
  eod_signed_at TIMESTAMPTZ,
  eod_signature_url TEXT,
  eod_signature_path TEXT
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_assignments_eod_signed 
  ON assignments(eod_signed);
```

### Storage Bucket Structure
```
eod-signatures/
├── eod_signature_assignment_1_1702000000000.png
├── eod_signature_assignment_1_1702100000000.png
├── eod_signature_assignment_2_1702200000000.png
└── ...
```

## Testing Checklist

- [ ] Bucket created and set to Public
- [ ] CORS configured for your domain
- [ ] RLS policies enabled for bucket
- [ ] Signature uploads successfully
- [ ] eod_signature_url stored in DB
- [ ] Image displays in preview after signing
- [ ] Image displays in Admin approval view
- [ ] Image embeds in PDF print
- [ ] Page refresh still shows signature
- [ ] Historical EODs show signatures
- [ ] Mobile rendering works correctly

## Debug Commands

### Check if bucket exists and is public:
```sql
SELECT * FROM storage.buckets WHERE name = 'eod-signatures';
-- Should show: public = true
```

### Check stored signature URLs:
```sql
SELECT id, eod_signed, eod_signature_url, eod_signed_at 
FROM assignments 
WHERE eod_signed = true 
ORDER BY eod_signed_at DESC 
LIMIT 10;
```

### List all signature files in bucket:
```javascript
// In browser console or Node.js:
const { data, error } = await supabase.storage
  .from('eod-signatures')
  .list();
console.log(data);
```

### Test image access directly:
```bash
# Test if URL is accessible
curl -I "https://[project].supabase.co/storage/v1/object/public/eod-signatures/[filename]"
# Should return 200 OK
```

## Performance Optimization

### Image Preloading
Images are preloaded before PDF generation to prevent race conditions:
```typescript
const preloadSignatureImage = (url: string | null | undefined): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};
```

### Caching
- Browser caches signature images (max-age in HTTP headers)
- Don't reload images unnecessarily
- Use unique filenames to invalidate cache when needed

## Security Considerations

1. **Public Bucket**: Signatures are publicly readable (acceptable for audit trail)
2. **Authenticated Upload**: Only authenticated users can upload signatures
3. **Immutable**: Once uploaded, signatures shouldn't be deleted (audit trail)
4. **No Duplication**: Same assignment cannot have multiple signatures (UNIQUE constraint on assignment_id)

## References

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [CORS Configuration Guide](https://supabase.com/docs/guides/storage#cors-configuration)
- [RLS Policies Documentation](https://supabase.com/docs/guides/auth/row-level-security)
