# Deploy Edge Function NOW (Windows) - 5 Minutes

## 🚀 Option 1: Using npx (Fastest - No Install)

Just run these commands in PowerShell:

```bash
# 1. Login
npx supabase@latest login

# 2. Link your project (replace YOUR_REF with your project reference ID)
npx supabase@latest link --project-ref YOUR_REF

# 3. Deploy the function
npx supabase@latest functions deploy create-user
```

**Get YOUR_REF**: 
- Go to https://app.supabase.com
- Open your project → Settings → General → Reference ID
- Copy it (looks like: abcdefghijklmnop)

**Done!** ✅ Function deployed!

---

## 🚀 Option 2: Install Scoop First (Better for Multiple Deployments)

### If you have Scoop already:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase login
supabase link --project-ref YOUR_REF
supabase functions deploy create-user
```

### If you DON'T have Scoop:
```powershell
# Install Scoop first
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Then install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Deploy
supabase login
supabase link --project-ref YOUR_REF
supabase functions deploy create-user
```

---

## ✅ Verify It Worked

1. Go to https://app.supabase.com
2. Your project → Edge Functions (in sidebar)
3. Should see "create-user" listed ✅

Then test user creation in your app:
- Admin Operations → User Management
- Create a user (email or mobile)
- Should work! 🎉

---

## 🆘 Troubleshooting

**"npx not recognized"**
- Make sure Node.js is installed
- Restart PowerShell

**"Scoop not recognized"**
- Restart PowerShell after installing Scoop

**Function deploy fails**
- Make sure you're in the project root directory
- Check `supabase/functions/create-user/index.ts` exists

---

## My Recommendation

**Use Option 1 (npx)** if you:
- Want to deploy right now
- Don't want to install anything
- Are okay with it being a bit slower

**Use Option 2 (Scoop)** if you:
- Will deploy multiple times
- Want faster commands
- Don't mind installing Scoop

---

**Choose an option above and copy-paste the commands!** 🚀
