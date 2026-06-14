# Quick Fix: Deploy Edge Function (5 Minutes)

## Why This Error?
**"Forbidden use of secret API key in browser"** - Supabase blocks service role keys in browsers for security.

## Solution: Deploy Edge Function (Server-Side)

### 3 Quick Steps

#### 1️⃣ Install Supabase CLI

**Windows (Scoop)**:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Or use npx (no install needed)**:
```bash
# Add 'npx supabase@latest' before each command
npx supabase@latest login
```

#### 2️⃣ Login & Link
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
*(Get YOUR_PROJECT_REF from Supabase → Settings → General → Reference ID)*

#### 3️⃣ Deploy Function
```bash
supabase functions deploy create-user
```

### ✅ Done!
Test by creating a user in Admin Operations → User Management

---

## Clean Up

Remove this from `.env.local` (no longer needed):
```env
# REMOVE THIS LINE
VITE_SUPABASE_SERVICE_ROLE_KEY=...
```

Keep only:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

---

## Verification

✅ **Check deployment**:
- Go to Supabase Dashboard → Edge Functions
- See `create-user` function listed

✅ **Test it**:
- Admin Operations → User Management
- Create email or mobile user
- Should work without errors!

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `supabase: command not found` | Install via Scoop: `scoop install supabase` or use `npx supabase@latest` |
| `Not logged in` | Run: `supabase login` |
| `Project not linked` | Run: `supabase link --project-ref YOUR_REF` |
| Function not working | Check logs in dashboard: Edge Functions → create-user → Logs |

---

## How It Works

**Before** (Insecure ❌):
```
Browser → Uses service role key → Blocked
```

**After** (Secure ✅):
```
Browser → Calls Edge Function → Edge Function uses service role key (safe!)
```

---

**Full Guide**: [EDGE_FUNCTION_DEPLOYMENT_GUIDE.md](EDGE_FUNCTION_DEPLOYMENT_GUIDE.md)
