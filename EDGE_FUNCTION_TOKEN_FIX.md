# Edge Function Token Error - Fixed

## What Was Wrong
The Edge Function was trying to verify JWT tokens using the **anon key**, which can't verify tokens. It needs to use the **service role key** to properly verify JWT tokens.

## What I Fixed
Updated the Edge Function to:
1. Use `SUPABASE_SERVICE_ROLE_KEY` to verify the JWT token
2. Added better error logging for debugging
3. Properly extract and verify the user from the token

## Redeployed
✅ Edge Function redeployed with the fix

## Now Test It

### Step 1: Make Sure You're Logged In
- Go to your app
- Admin Operations page should load
- You should see your logged-in status (usually top right)

### Step 2: Try Creating a User Again
1. Admin Operations → User Management
2. Select "Email" or "Mobile Number"
3. Fill in the details
4. Click "Create User"

### Step 3: If Still Getting Error
Check the error in browser console (F12):
- If it says "Unauthorized: Admin role required" - your user doesn't have admin role
- If it says "Invalid token" - your session might be expired, try logging out and back in
- Any other error - see "Troubleshooting" below

---

## Why This Happened

The original code tried to verify tokens like this:

```typescript
// WRONG ❌ - Can't verify tokens with anon key
const supabaseClient = createClient(url, ANON_KEY);
const { data: { user } } = await supabaseClient.auth.getUser();
```

It should be:

```typescript
// CORRECT ✅ - Use service role key to verify tokens
const supabaseClient = createClient(url, SERVICE_ROLE_KEY, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await supabaseClient.auth.getUser();
```

The anon key can't verify JWT tokens - only the service role key can.

---

## Common Issues

### "Unauthorized: Admin role required"
**Cause**: Your user account doesn't have `role = 'admin'`

**Solution**:
1. Go to Supabase Dashboard → SQL Editor
2. Run:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'YOUR_USER_ID';
```
Get your user ID from the Auth section in Supabase dashboard.

### "Invalid or expired token"
**Cause**: Your session expired

**Solution**:
1. Log out of the app
2. Log back in
3. Try creating a user again

### Still getting 400 error
**Solution**: Check Edge Function logs:
```bash
npx supabase@latest functions logs create-user --project-ref ejszqwmmpspvhtuhodsa
```

Or check Supabase Dashboard → Edge Functions → create-user → Logs

---

## Test Case

To test if the function works, you can also test it directly:

### In Browser Console (F12)
```javascript
// Get your JWT token
const { data: { session } } = await supabase.auth.getSession();
console.log('Token:', session?.access_token);

// Call the function
fetch('https://ejszqwmmpspvhtuhodsa.supabase.co/functions/v1/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
    'apikey': 'YOUR_ANON_KEY',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'custodian',
    tempPassword: 'TempPass123!',
    identifierType: 'email'
  })
})
.then(r => r.json())
.then(data => console.log('Response:', data));
```

---

## What to Do Now

1. ✅ Edge Function redeployed with fix
2. ➡️ Log out and log back in (refresh session)
3. ➡️ Try creating a user again
4. If error persists, check your user has admin role (see above)
5. If still failing, check function logs

**Try it now!** 🚀
