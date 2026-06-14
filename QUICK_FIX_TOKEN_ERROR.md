# Quick Checklist: Fix "Unauthorized: Invalid token" Error

## ✅ What I Did
1. Fixed the Edge Function to properly verify JWT tokens
2. Redeployed the function successfully

## ➡️ What You Need to Do (4 Steps)

### Step 1: Verify Your User is Admin
In Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Find your user account
3. Check the **Custom Claims** or **Metadata**
4. Or run this SQL in SQL Editor:
```sql
SELECT id, email, role FROM profiles WHERE id = 'YOUR_USER_ID';
```

Your user MUST have `role = 'admin'` to create other users.

### Step 2: If Not Admin, Make Yourself Admin
In Supabase SQL Editor:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'YOUR_EMAIL_HERE';
```

Example:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'yourname@example.com';
```

### Step 3: Refresh Your Session
1. Log out of the app (clear session)
2. Close the browser tab
3. Come back and log in again
4. This gets a fresh JWT token

### Step 4: Try Creating a User
1. Admin Operations → User Management
2. Create a user (email or mobile)
3. Should work now! ✅

---

## If Still Getting Error

### Check Edge Function Logs
```bash
npx supabase@latest functions logs create-user --project-ref ejszqwmmpspvhtuhodsa
```

Or in Supabase Dashboard:
- Edge Functions → create-user → Logs tab

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Unauthorized: Admin role required" | User not admin | Run SQL: `UPDATE profiles SET role = 'admin' WHERE email = '...'` |
| "Invalid or expired token" | Session expired | Log out and back in |
| "User profile not found" | Profile record missing | Check profiles table |
| Any other error | See logs | Check function logs |

---

## Verify Deployment

✅ **Function deployed successfully!**

Check in Supabase Dashboard:
- Navigate to **Edge Functions**
- Should see `create-user` listed
- No errors shown

---

## Quick Test

### Test via Browser Console (F12)
```javascript
// This tests if your token works
const { data: { session } } = await supabase.auth.getSession();
console.log('Session exists:', !!session);
console.log('Token:', session?.access_token?.substring(0, 20) + '...');
```

Should show your token (not null/undefined).

---

## Summary

1. ✅ Edge Function fixed and deployed
2. ➡️ Make sure your user is admin (UPDATE query above)
3. ➡️ Refresh session (log out/in)
4. ➡️ Try creating user again

**Do these steps and it should work!** 🎉
