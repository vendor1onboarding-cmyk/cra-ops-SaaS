# Supabase CLI Installation for Windows - Quick Guide

## ❌ Don't Use npm
```bash
npm install -g supabase  # ❌ NOT SUPPORTED ANYMORE
```

## ✅ Use These Methods Instead

### Method 1: Scoop (Recommended) ⭐

**Step 1: Install Scoop** (if you don't have it)
```powershell
# Open PowerShell and run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

**Step 2: Install Supabase CLI**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Verify Installation**
```powershell
supabase --version
```

---

### Method 2: Direct Download

**Step 1: Download**
- Go to: https://github.com/supabase/cli/releases/latest
- Download: `supabase_windows_amd64.zip`

**Step 2: Extract**
- Extract to: `C:\Program Files\Supabase`

**Step 3: Add to PATH**
1. Open System Properties (Win + Pause)
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "System variables", find "Path"
5. Click "Edit"
6. Click "New"
7. Add: `C:\Program Files\Supabase`
8. Click "OK" on all dialogs
9. **Restart PowerShell**

**Verify Installation**
```powershell
supabase --version
```

---

### Method 3: Use npx (No Installation) 🚀

**No installation needed!** Just prefix every command with `npx supabase@latest`:

```bash
# Instead of: supabase login
npx supabase@latest login

# Instead of: supabase link --project-ref abc123
npx supabase@latest link --project-ref abc123

# Instead of: supabase functions deploy create-user
npx supabase@latest functions deploy create-user
```

**Pros**: No installation, always latest version
**Cons**: Slower (downloads each time)

---

## Complete Deployment with Scoop

```powershell
# 1. Install Scoop (if needed)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# 2. Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 3. Verify
supabase --version

# 4. Login
supabase login

# 5. Link project (get YOUR_REF from Supabase dashboard)
supabase link --project-ref YOUR_PROJECT_REF

# 6. Deploy function
supabase functions deploy create-user

# 7. Done! ✅
```

---

## Complete Deployment with npx

```bash
# No installation needed! Just use npx:

# 1. Login
npx supabase@latest login

# 2. Link project
npx supabase@latest link --project-ref YOUR_PROJECT_REF

# 3. Deploy function
npx supabase@latest functions deploy create-user

# 4. Done! ✅
```

---

## Troubleshooting

### "Scoop not recognized"
**Solution**: Restart PowerShell after installing Scoop

### "supabase not recognized" (after Scoop install)
**Solution**:
```powershell
# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Or just restart PowerShell
```

### "Execution policy error"
**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### npx is slow
**Solution**: Use Scoop method for permanent installation

---

## Which Method Should I Use?

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| **Scoop** | Most users | Fast, easy updates with `scoop update` | Requires Scoop |
| **Direct Download** | No package manager | Full control | Manual PATH setup |
| **npx** | Quick testing | No install, always latest | Slower, downloads each time |

**Recommendation**: Use Scoop ⭐

---

## Updating Supabase CLI

### With Scoop
```powershell
scoop update supabase
```

### With Direct Download
Re-download and replace the binary

### With npx
Always uses latest automatically

---

## Quick Reference

```powershell
# Check version
supabase --version

# Get help
supabase help

# Login
supabase login

# List projects
supabase projects list

# Link project
supabase link --project-ref YOUR_REF

# Deploy function
supabase functions deploy create-user

# View functions
supabase functions list

# View function logs
supabase functions logs create-user
```

---

## Official Documentation

- Supabase CLI Install Guide: https://github.com/supabase/cli#install-the-cli
- Scoop Homepage: https://scoop.sh
- CLI Release Page: https://github.com/supabase/cli/releases

---

**Ready to install?** Choose a method above and follow the steps! 🚀
