# Edge Function Deployment - Command Cheat Sheet

## 🚀 Copy-Paste Deployment Commands

### Step 1: Install Supabase CLI

**Option A: Using Scoop (Recommended for Windows)**
```powershell
# Install Scoop if you don't have it (https://scoop.sh)
iwr -useb get.scoop.sh | iex

# Add Supabase bucket
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git

# Install Supabase CLI
scoop install supabase
```

**Option B: Direct Download**
1. Download from: https://github.com/supabase/cli/releases/latest
2. Download `supabase_windows_amd64.zip`
3. Extract and add to PATH

**Option C: Using npx (No Installation)**
```bash
# Use npx for each command (no global install needed)
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_REF
npx supabase@latest functions deploy create-user
```

### Step 2: Login to Supabase
```bash
supabase login
```
*(Opens browser - login with your Supabase account)*

### Step 3: Link Your Project
First, get your project reference ID:
- Go to: https://app.supabase.com
- Open your project
- Settings → General → Project Settings
- Copy "Reference ID" (e.g., `abcdefghijklmnop`)

Then run:
```bash
supabase link --project-ref YOUR_PROJECT_REF_HERE
```

Example:
```bash
supabase link --project-ref abcdefghijklmnop
```

### Step 4: Deploy Edge Function
```bash
supabase functions deploy create-user
```

### Step 5: Verify Deployment
Check in Supabase Dashboard:
- Go to: https://app.supabase.com
- Your Project → Edge Functions (in sidebar)
- Should see "create-user" listed ✅

---

## 📋 Database Migration Commands

### Option A: Via Supabase Dashboard
1. Go to: https://app.supabase.com
2. Your Project → SQL Editor
3. Copy content from: `USER_MANAGEMENT_MOBILE_SUPPORT_MIGRATION.sql`
4. Paste and click "Run"

### Option B: Via Supabase CLI
```bash
# Create migration file
supabase migration new add_mobile_number_support

# Edit the file and add SQL from USER_MANAGEMENT_MOBILE_SUPPORT_MIGRATION.sql

# Apply migration
supabase db push
```

---

## 🧪 Testing Commands

### View Edge Function Logs
```bash
supabase functions logs create-user
```

### Test Edge Function Locally (Optional)
```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve create-user
```

---

## 🔍 Verification Commands

### Check Supabase CLI Version
```bash
supabase --version
```

### Check Login Status
```bash
supabase projects list
```

### Check Function Status
```bash
supabase functions list
```

### View Function Details
```bash
supabase functions show create-user
```

---

## 🛠️ Troubleshooting Commands

### If "command not found: supabase"
```powershell
# Option 1: Install via Scoop
scoop install supabase

# Option 2: Use npx instead
npx supabase@latest --version

# Verify installation
supabase --version
```

### If "Not logged in"
```bash
# Login again
supabase login

# Verify
supabase projects list
```

### If "Project not linked"
```bash
# Unlink (if needed)
supabase unlink

# Link again
supabase link --project-ref YOUR_PROJECT_REF
```

### If Deploy Fails
```bash
# Check current directory (should be project root)
pwd

# List files (should see supabase/ folder)
ls -la

# Try deploy again with verbose output
supabase functions deploy create-user --debug
```

### View All Functions
```bash
supabase functions list
```

### Delete Function (if needed)
```bash
supabase functions delete create-user
```

---

## 📝 Quick Reference

### Get Project Reference ID
```
Dashboard → Settings → General → Reference ID
```

### Edge Function URL Format
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-user
```

### Check Function Logs (Dashboard)
```
Dashboard → Edge Functions → create-user → Logs
```

---

## 🔐 Environment Cleanup

### After deploying Edge Function, remove from .env.local:
```bash
# Open .env.local and DELETE this line:
# VITE_SUPABASE_SERVICE_ROLE_KEY=...

# Keep only these:
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

---

## ✅ Success Indicators

After running all commands, you should see:

1. **CLI Installed**:
   ```bash
   $ supabase --version
   supabase version 1.x.x
   ```

2. **Logged In**:
   ```bash
   $ supabase projects list
   ┌────────────────────────┬─────────────────┐
   │ NAME                   │ PROJECT ID      │
   ├────────────────────────┼─────────────────┤
   │ Your Project Name      │ abcdefghijklmnop│
   └────────────────────────┴─────────────────┘
   ```

3. **Project Linked**:
   ```bash
   $ supabase link --project-ref abcdefghijklmnop
   ✓ Linked to project ref: abcdefghijklmnop
   ```

4. **Function Deployed**:
   ```bash
   $ supabase functions deploy create-user
   ✓ Deploying function create-user...
   ✓ Function create-user deployed successfully!
   ```

5. **Function Listed**:
   ```bash
   $ supabase functions list
   ┌─────────────┬─────────┬────────────┐
   │ NAME        │ CREATED │ STATUS     │
   ├─────────────┼─────────┼────────────┤
   │ create-user │ 1m ago  │ ACTIVE ✅  │
   └─────────────┴─────────┴────────────┘
   ```

---

## 🎯 Complete Flow (All Commands)

### Using npx (No Installation Needed) - RECOMMENDED

Copy and execute in PowerShell:

```bash
# 1. Login (opens browser)
npx supabase@latest login

# 2. Link project (replace with your ref ID)
npx supabase@latest link --project-ref YOUR_PROJECT_REF

# 3. Deploy function
npx supabase@latest functions deploy create-user

# 4. Verify
npx supabase@latest functions list

# 5. Check logs (optional)
npx supabase@latest functions logs create-user

echo "✅ Deployment complete!"
```

### Using Scoop (After Installation)

Copy and execute in PowerShell:

```powershell
# 0. Install Supabase CLI (one-time)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 1. Login
supabase login

# 2. Link project (replace with your ref ID)
supabase link --project-ref YOUR_PROJECT_REF

# 3. Deploy function
supabase functions deploy create-user

# 4. Verify
supabase functions list

# 5. Check logs (optional)
supabase functions logs create-user

echo "✅ Deployment complete!"
```

---

## 💡 Pro Tips

### Faster Deployments
```bash
# Deploy all functions at once
supabase functions deploy

# Deploy with verbose output
supabase functions deploy create-user -v
```

### Local Development
```bash
# Start local stack (includes functions)
supabase start

# Watch function changes
supabase functions serve create-user --watch
```

### View Real-time Logs
```bash
# Follow logs in real-time
supabase functions logs create-user --follow
```

---

## 🆘 Emergency Recovery

### If Everything Breaks
```bash
# 1. Unlink project
supabase unlink

# 2. Clear local config
rm -rf .supabase/

# 3. Start fresh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-user
```

### Reset Edge Function
```bash
# Delete and redeploy
supabase functions delete create-user
supabase functions deploy create-user
```

---

## 📞 Get Help

### CLI Help
```bash
supabase help
supabase functions help
supabase functions deploy --help
```

### Version Info
```bash
supabase --version
deno --version  # Deno used by Edge Functions
```

---

**Ready to deploy?** Start with Step 1 above! 🚀
