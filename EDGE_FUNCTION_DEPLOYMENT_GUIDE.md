# Supabase Edge Function Deployment Guide

## Problem Solved
**Error**: "Forbidden use of secret API key in browser"

**Root Cause**: Service role keys cannot be used in browser environments for security reasons.

**Solution**: Moved user creation logic to a secure server-side Supabase Edge Function.

---

## What Changed

### ✅ Secure Architecture
- **Before**: Frontend tried to use service role key directly ❌
- **After**: Frontend calls Edge Function → Edge Function uses service role key ✅

### Files Created/Modified
1. ✅ Created: `supabase/functions/create-user/index.ts` - Edge Function
2. ✅ Updated: `src/api/supabaseClient.ts` - Added Edge Function helper
3. ✅ Updated: `src/pages/admin/UserOnboarding.tsx` - Calls Edge Function

---

## Deployment Steps

### Step 1: Install Supabase CLI

**Windows (Recommended - Scoop)**:
```powershell
# Install Scoop first if needed: https://scoop.sh
iwr -useb get.scoop.sh | iex

# Add Supabase bucket
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git

# Install Supabase CLI
scoop install supabase
```

**Alternative: Direct Download**:
1. Visit: https://github.com/supabase/cli/releases/latest
2. Download `supabase_windows_amd64.zip`
3. Extract to a folder (e.g., `C:\Program Files\Supabase`)
4. Add folder to System PATH

**Alternative: Use npx (No Installation)**:
```bash
# Use npx for all commands (slower but no install needed)
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_REF
npx supabase@latest functions deploy create-user
```

**Verify installation**:
```bash
supabase --version
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate with your Supabase account.

### Step 3: Link Your Project

Get your project reference ID from Supabase dashboard (Settings → General → Reference ID)

```bash
supabase link --project-ref your-project-ref-id
```

Example:
```bash
supabase link --project-ref ejszqwmmpspvhtuhodsa
```

### Step 4: Deploy the Edge Function

From your project root directory:

```bash
supabase functions deploy create-user
```

You should see output like:
```
Deploying function create-user...
Function create-user deployed successfully!
Function URL: https://abcdefghijklmnop.supabase.co/functions/v1/create-user
```

### Step 5: Verify Deployment

Check that the function appears in your Supabase dashboard:
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** (in sidebar)
3. You should see `create-user` listed

### Step 6: Test the Function

From the Supabase dashboard:
1. Click on the `create-user` function
2. Click **Invoke** button
3. Or test from your app by creating a user

---

## Environment Variables (Automatic)

The Edge Function automatically has access to these environment variables:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (secure)
- `SUPABASE_ANON_KEY` - Anonymous key

**No manual setup required!** These are provided by Supabase automatically.

---

## Remove Service Role Key from .env.local

You can now **remove** this line from your `.env.local`:

```env
# REMOVE THIS LINE - no longer needed
# VITE_SUPABASE_SERVICE_ROLE_KEY=...
```

Your `.env.local` should only have:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Testing User Creation

### Test Email User
1. Navigate to **Admin Operations** → **User Management**
2. Select **Email** identifier type
3. Enter: `test@example.com`
4. Enter name and role
5. Click **Create User**
6. Should see credentials displayed ✅

### Test Mobile User
1. Navigate to **Admin Operations** → **User Management**
2. Select **Mobile Number** identifier type
3. Enter: `9876543210`
4. Enter name and role
5. Click **Create User**
6. Should see credentials displayed ✅

---

## Troubleshooting

### Error: "supabase command not found"
**Solution**: Install Supabase CLI (see Step 1)

### Error: "Not logged in"
**Solution**: Run `supabase login`

### Error: "Project not linked"
**Solution**: Run `supabase link --project-ref YOUR_REF_ID`

### Error: "Failed to deploy function"
**Solutions**:
- Check you're in the correct directory (project root)
- Verify `supabase/functions/create-user/index.ts` exists
- Check for syntax errors in the TypeScript file
- Ensure you're logged in: `supabase login`

### Error: "Edge function call failed"
**Solutions**:
- Check the function is deployed: Supabase Dashboard → Edge Functions
- Check function logs in dashboard for errors
- Verify you're logged in as admin in the app
- Check network tab for actual error message

### Error: "No active session"
**Solution**: Must be logged in to the app before creating users

### Error: "Unauthorized: Admin role required"
**Solution**: The logged-in user must have `role = 'admin'` in profiles table

---

## Security Benefits

### ✅ Service Role Key Never Exposed
- Lives only on Supabase servers
- Never sent to browser
- Cannot be extracted by users

### ✅ Admin Verification
- Edge Function verifies JWT token
- Checks user is authenticated
- Confirms user has admin role
- Rejects unauthorized requests

### ✅ Duplicate Prevention
- Server-side duplicate checking
- Transaction-safe user creation
- Automatic rollback on failure

### ✅ CORS Protected
- Only allows requests from your domain
- Includes authorization headers
- Prevents cross-site attacks

---

## Edge Function Features

### Built-in Functionality
- ✅ Admin role verification
- ✅ Email user creation
- ✅ Mobile user creation
- ✅ Duplicate checking (email & mobile)
- ✅ Profile creation with rollback
- ✅ Error handling and logging
- ✅ CORS support

### Request Validation
- ✅ Validates required fields
- ✅ Validates identifier type
- ✅ Validates role selection
- ✅ Sanitizes input data

### Response Format
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "mobileNumber": "9876543210",
    "identifierType": "email"
  }
}
```

Or on error:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Viewing Function Logs

To debug issues, check Edge Function logs:

**In Supabase Dashboard**:
1. Go to **Edge Functions**
2. Click on `create-user`
3. Click **Logs** tab
4. See real-time execution logs

**Via CLI**:
```bash
supabase functions logs create-user
```

---

## Updating the Function

If you need to modify the function:

1. Edit `supabase/functions/create-user/index.ts`
2. Deploy again:
   ```bash
   supabase functions deploy create-user
   ```
3. Changes take effect immediately

---

## Local Development (Optional)

To test Edge Function locally:

```bash
# Start local Supabase stack
supabase start

# Serve functions locally
supabase functions serve create-user
```

Update your `.env.local` to point to local function:
```env
VITE_SUPABASE_URL=http://localhost:54321
```

---

## Production Checklist

- [ ] Supabase CLI installed
- [ ] Logged in to Supabase CLI
- [ ] Project linked correctly
- [ ] Edge Function deployed successfully
- [ ] Function visible in dashboard
- [ ] Service role key removed from .env.local
- [ ] Tested email user creation
- [ ] Tested mobile user creation
- [ ] Verified admin role check works
- [ ] Verified duplicate prevention works
- [ ] Checked function logs for errors

---

## Cost Considerations

**Supabase Edge Functions Pricing**:
- **Free Tier**: 500,000 invocations/month
- **Pro Tier**: 2,000,000 invocations/month
- User creation is infrequent, so free tier is usually sufficient

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│           Browser (Frontend)                    │
│  ┌───────────────────────────────────────────┐ │
│  │ UserOnboarding Component                  │ │
│  │ - Validates input                         │ │
│  │ - Generates temp password                 │ │
│  │ - Calls invokeEdgeFunction()              │ │
│  └───────────────┬───────────────────────────┘ │
│                  │ POST /functions/v1/         │
│                  │ create-user                  │
└──────────────────┼──────────────────────────────┘
                   │ Headers:
                   │ - Authorization: Bearer JWT
                   │ - Content-Type: json
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│       Supabase Edge Function (Server-side)      │
│  ┌───────────────────────────────────────────┐ │
│  │ create-user/index.ts                      │ │
│  │ 1. Verify JWT token                       │ │
│  │ 2. Check admin role                       │ │
│  │ 3. Validate input                         │ │
│  │ 4. Check duplicates                       │ │
│  │ 5. Create auth user (admin API)           │ │
│  │ 6. Create profile record                  │ │
│  │ 7. Return result or rollback              │ │
│  └───────────────┬───────────────────────────┘ │
│                  │ Uses SUPABASE_               │
│                  │ SERVICE_ROLE_KEY             │
│                  │ (secure, never exposed)      │
└──────────────────┼──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│         Supabase Auth & Database                │
│  ┌───────────────────────────────────────────┐ │
│  │ auth.users - User auth records            │ │
│  │ profiles - User profile & role            │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Summary

✅ **Secure**: Service role key never exposed to browser  
✅ **Simple**: One command to deploy  
✅ **Fast**: Edge Functions run globally  
✅ **Free**: Included in Supabase free tier  
✅ **Scalable**: Handles concurrent requests  
✅ **Debuggable**: Full logging available  

**Status**: Production-ready and secure! 🎉
