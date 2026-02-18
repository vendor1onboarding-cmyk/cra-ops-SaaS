# Quick Fix: "User not allowed" Error

## Problem
Getting error: **"Failed to create user: User not allowed"**

## Root Cause
Missing **Service Role Key** - the admin API requires elevated privileges.

## Solution (3 Steps)

### Step 1: Get Service Role Key
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Go to: **Settings** → **API**
3. Copy the **`service_role`** key (labeled "secret")

### Step 2: Add to .env.local
Open/create `.env.local` in your project root and add:

```env
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Your `.env.local` should look like:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  ← ADD THIS LINE
```

### Step 3: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

## Test It
1. Go to **Admin Operations** → **User Management**
2. Create a user (email or mobile)
3. Should now work! ✅

## ⚠️ Security Note
- Service role key has admin privileges
- Keep it secret (never commit to Git)
- `.env.local` is already in `.gitignore` ✅
- For production, consider moving to backend API

## Still Not Working?

Check these:
- ✅ Key has `VITE_` prefix
- ✅ Key is in `.env.local` (not `.env`)
- ✅ Dev server was restarted after adding key
- ✅ No extra spaces in the key value
- ✅ You copied the **service_role** key (not anon key)

## Error Messages

| Error | Fix |
|-------|-----|
| "User not allowed" | Add service role key |
| "Admin operations not configured" | Key not loaded, restart server |
| "Invalid API key" | Wrong key copied, use service_role |

---

**Full Documentation**: See [USER_MANAGEMENT_SERVICE_ROLE_SETUP.md](USER_MANAGEMENT_SERVICE_ROLE_SETUP.md)
