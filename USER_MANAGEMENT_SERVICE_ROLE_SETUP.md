# Service Role Key Setup for User Management

## Issue Resolved
**Error**: "Failed to create user: User not allowed"

**Cause**: The `auth.admin.createUser()` method requires a **service role key** with elevated privileges, not the regular anon key.

## Solution Implemented

### 1. Updated Supabase Client Configuration
**File**: `src/api/supabaseClient.ts`

Added a separate admin client that uses the service role key:
```typescript
// Regular client for standard operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for user management (requires service role key)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
```

### 2. Updated UserOnboarding Component
**File**: `src/pages/admin/UserOnboarding.tsx`

Changed from:
```typescript
await supabase.auth.admin.createUser({ ... })
```

To:
```typescript
await supabaseAdmin.auth.admin.createUser({ ... })
```

With proper error handling if service role key is not configured.

## Setup Instructions

### Step 1: Get Your Service Role Key from Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Settings** (gear icon in sidebar)
3. Click **API** section
4. Find **Project API keys** section
5. Copy the **service_role** key (labeled as "secret")
   - ⚠️ **WARNING**: This key has admin privileges - handle carefully!

### Step 2: Add to Environment Variables

Add this to your `.env.local` file:

```env
# Existing variables (keep these)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# New variable for admin operations
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 3: Restart Development Server

```bash
npm run dev
```

The service role key will now be available for admin operations.

## Security Considerations

### ⚠️ IMPORTANT SECURITY WARNINGS

1. **Never Commit Service Role Key to Git**
   - The `.env.local` file is already in `.gitignore`
   - Never add service role key to public repositories
   - Never expose it in client-side code logs

2. **Service Role Key Permissions**
   - Bypasses Row Level Security (RLS)
   - Has full database access
   - Can create/delete users
   - Should ONLY be used in admin-protected components

3. **Frontend Exposure Risk**
   - Service role key in environment variables IS accessible in the frontend bundle
   - Mitigated by admin role checks in the UI
   - For production, consider moving to backend API

### Production Security Recommendation

**For Production Environments**, use one of these safer approaches:

#### Option A: Backend API (Most Secure)
Create a backend API endpoint that:
1. Verifies admin role from session token
2. Uses service role key on the server
3. Creates users via Supabase admin API
4. Returns result to frontend

#### Option B: Supabase Edge Function (Recommended)
Create a Supabase Edge Function:
```typescript
// supabase/functions/create-user/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // Verify user is admin via JWT token
  const authHeader = req.headers.get('Authorization')
  // ... verify admin role
  
  // Create user
  const { email, password, userData } = await req.json()
  const result = await supabaseAdmin.auth.admin.createUser({...})
  
  return new Response(JSON.stringify(result))
})
```

#### Option C: Row Level Security Policies
If your Supabase plan supports it, configure policies that allow admins to manage users.

## Current Implementation Trade-offs

### ✅ Pros (Current Approach)
- Simple setup
- Works immediately for development
- No backend required
- Good for small teams/internal tools
- Admin role check provides UI-level protection

### ⚠️ Cons (Current Approach)
- Service role key exposed in frontend bundle
- Anyone with browser dev tools could extract it
- Not ideal for public-facing production
- Relies on UI-level access control

### When Current Approach is Acceptable
- Internal admin panels (not public-facing)
- Small teams with trusted users
- Development/staging environments
- Rapid prototyping
- When combined with network-level security (IP whitelist, VPN)

## Testing the Fix

### 1. Verify Service Role Key is Set
Check that the key is loaded:
```typescript
// In browser console (after app loads)
console.log('Service role configured:', !!window.supabaseAdmin);
```

### 2. Test User Creation
1. Navigate to Admin Operations → User Management
2. Fill in user details (email or mobile)
3. Click "Create User"
4. Should see success message with credentials
5. Verify user appears in Supabase auth dashboard

### 3. Verify Error Handling
If service role key is NOT set:
- Should see error: "Admin operations not configured..."
- User creation should fail gracefully
- No crashes or undefined errors

## Troubleshooting

### Error: "Admin operations not configured"
**Solution**: Add `VITE_SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and restart server

### Error: "Invalid API key" or "401 Unauthorized"
**Solution**: 
- Verify you copied the **service_role** key (not anon key)
- Check for extra spaces in the key
- Ensure key matches your Supabase project

### Error: Still getting "User not allowed"
**Solution**:
- Clear browser cache and reload
- Check Network tab to see which key is being used
- Verify `.env.local` is in the same directory as `package.json`
- Restart the dev server

### Service Role Key Not Loading
**Solution**:
- Vite requires `VITE_` prefix for environment variables
- Variable must be in `.env.local` (not `.env`)
- Restart dev server after adding variable
- Check `import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY` is defined

## Example .env.local File

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Other environment variables...
```

## Alternative: Move to Backend (Future Enhancement)

If you want to implement the backend API approach later:

### 1. Create Express/FastAPI Endpoint
```javascript
// backend/routes/admin.js
router.post('/create-user', verifyAdmin, async (req, res) => {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const result = await supabaseAdmin.auth.admin.createUser({
    email: req.body.email,
    password: req.body.password,
    // ... other fields
  });
  
  res.json(result);
});
```

### 2. Update Frontend to Call Backend
```typescript
// Instead of supabaseAdmin.auth.admin.createUser()
const response = await fetch('/api/admin/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    email: formData.email,
    password: tempPassword,
    // ... other fields
  })
});
```

## Summary

✅ **Fixed**: Added service role key support for admin user creation
✅ **Required**: Add `VITE_SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
✅ **Security**: Documented risks and mitigation strategies
✅ **Future**: Recommendations for production hardening

**Next Steps**:
1. Add service role key to `.env.local`
2. Restart development server
3. Test user creation functionality
4. Consider backend API for production deployment
