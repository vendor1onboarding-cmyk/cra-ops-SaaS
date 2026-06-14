# Fix Session Corruption - Complete Guide

## Problem
Your browser has a corrupted Supabase session where the refresh token is missing or invalid. This causes the error:
```
AuthApiError: Invalid Refresh Token: Refresh Token Not Found
```

## ✅ What I Fixed in the Code

### 1. **Frontend (`supabaseClient.ts`)**
- Added automatic session validation before API calls
- Added automatic token refresh when expired
- Added automatic sign-out when session is corrupted
- Better error messages telling you exactly what to do

### 2. **Edge Function (`create-user/index.ts`)**
- Improved token verification using admin client
- Better error logging for debugging
- More reliable JWT validation

### 3. **Automatic Recovery**
- App will now automatically sign you out if session is corrupted
- You'll see clear error messages instead of generic failures

---

## 🛠️ Manual Session Reset (Do This Now)

### Step 1: Clear Browser Storage (in app)

1. Open your app in the browser
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Copy and paste this code:

```javascript
// Force complete session cleanup
await supabase.auth.signOut({ scope: 'global' });
localStorage.clear();
sessionStorage.clear();
console.log('✅ Session cleared completely');
```

5. Press Enter
6. You should see: `✅ Session cleared completely`

### Step 2: Clear All Browser Data

**Option A - Chrome/Edge/Brave:**
1. Press `Ctrl+Shift+Delete`
2. Select "All time" 
3. Check:
   - ✅ Cookies and other site data
   - ✅ Cached images and files
   - ✅ Site settings
4. Click "Clear data"

**Option B - Manual (all browsers):**
1. Press `F12` → Go to **Application** tab
2. Under **Storage**:
   - Click **Local Storage** → Delete all
   - Click **Session Storage** → Delete all
   - Click **Cookies** → Delete all for `localhost` and `supabase.co`
   - Click **Cache Storage** → Delete all
3. Close DevTools

### Step 3: Restart Everything

1. **Close ALL browser windows** completely (don't just close the tab)
2. Open Task Manager (`Ctrl+Shift+Esc`)
3. End any remaining browser processes
4. **Restart the dev server:**
   ```bash
   # Kill the current server (Ctrl+C)
   npm run dev
   ```
5. Open a **new browser window** (preferably Incognito/Private mode first)
6. Navigate to `http://localhost:5175`

### Step 4: Fresh Login

1. You should see the login page
2. Enter your admin credentials
3. If you get any errors, check:
   - Username/password are correct
   - Profile has `role = 'admin'` in database

### Step 5: Test User Creation

1. Go to **Admin Operations** → **User Management**
2. Select "Email" identifier
3. Enter test details:
   - Email: `test@example.com`
   - Full Name: `Test User`
   - Role: `custodian`
4. Click "Create User"
5. Should see success message with credentials! ✅

---

## 🔍 If Still Not Working

### Check 1: Verify Your Admin Role

Run this in Supabase SQL Editor:

```sql
-- Check your user's role
SELECT id, email, role 
FROM profiles 
WHERE email = 'your-email@example.com';
```

**Expected:** `role` should be `'admin'`

**If not admin:**
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

### Check 2: Check Edge Function Logs

```bash
npx supabase@latest functions logs create-user --project-ref ejszqwmmpspvhtuhodsa
```

Look for:
- `Token verified successfully for user: ...` ← Good!
- `Token verification failed: ...` ← Check the reason

### Check 3: Test Session in Console

After logging in, run in browser console:

```javascript
// Check if session is valid
const { data: { session }, error } = await supabase.auth.getSession();

if (error) {
  console.error('❌ Session error:', error);
} else if (!session) {
  console.warn('⚠️ No session found');
} else {
  console.log('✅ Session valid');
  console.log('User ID:', session.user.id);
  console.log('Token expires:', new Date(session.expires_at * 1000));
}
```

**Expected output:**
```
✅ Session valid
User ID: abc123...
Token expires: [future date]
```

---

## 🎯 Why This Happened

1. **Browser storage corruption** - Something cleared only part of your session data
2. **Token expiry** - Token expired but refresh token was missing
3. **Multiple tabs** - Having multiple tabs open can sometimes cause session conflicts
4. **Browser extensions** - Some privacy/security extensions clear storage

---

## 🛡️ Prevent Future Issues

### Best Practices:
1. **Always use one tab** for the app during development
2. **Log out properly** using the UI logout button (don't just close the tab)
3. **Don't clear browser storage manually** while logged in
4. **If app acts weird**, log out and log back in immediately

### The app now has auto-recovery:
- Detects corrupted sessions automatically
- Signs you out with clear message
- Prevents sending bad tokens to server

---

## ✅ Success Checklist

After following steps above, you should have:

- [ ] Cleared all browser storage
- [ ] Restarted dev server
- [ ] Logged in successfully in fresh browser window
- [ ] Profile role is 'admin'
- [ ] Can see Admin Operations menu
- [ ] Can access User Management page
- [ ] Successfully created a test user
- [ ] See user credentials displayed

---

## 📞 Still Having Issues?

If you're still stuck after all these steps:

1. **Share the exact error message** from browser console
2. **Share Edge Function logs** (run the command above)
3. **Confirm your role** with the SQL query above
4. **Try a different browser** (Firefox/Chrome/Edge) to rule out browser-specific issues

The code improvements I made should prevent this from happening again! 🚀
