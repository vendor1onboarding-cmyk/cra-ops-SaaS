# User Management - Quick Reference

## 🎯 Quick Access

**Admin**: Admin Operations → User Management (👤)  
**All Users**: Profile Menu → Change Password (🔐)

---

## 🚀 Create New User (Admin Only)

1. Go to **Admin Operations** → **User Management**
2. Fill form:
   - Email (becomes username)
   - Full Name
   - Role (custodian/supervisor/admin)
3. Click **Create User**
4. Copy credentials (email + temporary password)
5. Share securely with new user

**Temporary Password**: Auto-generated, 12 characters, complex

---

## 🔐 First Login (New Users)

1. Login with temporary credentials
2. System redirects to password reset (automatic)
3. Enter new password (must meet requirements)
4. Confirm password
5. Click **Set New Password**
6. Redirected to dashboard

**Requirements**: 8+ chars, uppercase, lowercase, number, special char

---

## 🔄 Change Password (All Users)

### Desktop
1. Click profile name (top-right)
2. Select **Change Password**

### Mobile
1. Open menu (☰)
2. Tap **Change Password**

### Process
1. Enter current password
2. Enter new password
3. Confirm new password
4. Click **Change Password**

---

## ✅ Password Requirements

- ✅ Minimum 8 characters
- ✅ At least one uppercase letter
- ✅ At least one lowercase letter
- ✅ At least one number
- ✅ At least one special character (!@#$%^&*)

**Strength Indicator**: Weak (red) → Medium (yellow) → Strong (green)

---

## 🛡️ Security Notes

- Temporary passwords: Share via encrypted email or in-person only
- First login: Mandatory password reset (cannot skip)
- Password change: Requires current password verification
- All operations: Logged by Supabase Auth system

---

## 🐛 Troubleshooting

**"User creation failed"**  
→ Email already exists. Use different email.

**"Current password incorrect"**  
→ Check password, try again. Contact admin if forgotten.

**"Password doesn't meet requirements"**  
→ Review requirements list, ensure all criteria met.

**"Stuck on password reset page"**  
→ Password must meet complexity rules. Check strength indicator.

---

## 📊 Database Migration (Deploy Once)

```sql
-- Run in Supabase SQL Editor before first use
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles
SET email = (SELECT email FROM auth.users WHERE auth.users.id = profiles.id)
WHERE email IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN email SET NOT NULL;
```

---

## 📁 Files Reference

**New Components**
- `src/pages/admin/UserOnboarding.tsx` - Admin user creation
- `src/pages/PasswordChange.tsx` - Password change for all users
- `src/pages/FirstLoginPasswordReset.tsx` - Forced first-login reset

**Modified Files**
- `src/context/AuthContext.tsx` - Added email, first_login to Profile
- `src/pages/AdminOperations.tsx` - Added user management action
- `src/App.tsx` - Added password routes
- `src/components/Layout.tsx` - Added user menu with password change

---

## 🎓 Admin Best Practices

1. **Email**: Use official company emails only
2. **Credentials**: Share via secure channel (encrypted email, in-person)
3. **Roles**: Assign lowest necessary privilege
4. **Verification**: Check email spelling before creating user
5. **Follow-up**: Confirm user successfully logged in

---

## 🔐 Supabase Auth API Compliance

✅ Uses `admin.createUser()` for user creation  
✅ Uses `auth.updateUser()` for password changes  
✅ Uses `signInWithPassword()` for verification  
❌ Never touches `auth.users.encrypted_password` directly  
❌ Never bypasses Supabase Auth APIs  
❌ Never stores passwords in plaintext  

---

## 📈 Feature Status

✅ Admin user creation via UI  
✅ Temporary password generation  
✅ First login password reset (enforced)  
✅ Password change anytime  
✅ User menu integration (desktop + mobile)  
✅ Mobile-responsive design  
✅ Rollback on failures  
✅ Zero breaking changes  

**Status**: ✅ Production-ready
