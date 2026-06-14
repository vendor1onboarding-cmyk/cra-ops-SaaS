# Mobile Number Support - Quick Reference

## What Changed?

✅ **User Creation Now Supports**:
- Email as username (original)
- Mobile number as username (new)

## For Admins

### Creating Email-Based User:
1. Go to Admin Operations → User Management
2. Select "Email" radio button
3. Enter: email, full name, role
4. Click "Create User"
5. Share credentials (email + temp password)

### Creating Mobile-Based User:
1. Go to Admin Operations → User Management
2. Select "Mobile Number" radio button
3. Enter: 10-digit mobile, full name, role
4. Click "Create User"
5. Share credentials (mobile + temp password)

## Key Features

| Feature | Email | Mobile |
|---------|-------|--------|
| Identifier Format | name@domain.com | 10 digits (9876543210) |
| Input Validation | Email regex | 10-digit numeric |
| Duplicate Check | By email | By mobile number |
| First Login Reset | ✅ Enforced | ✅ Enforced |
| Temporary Password | ✅ Generated | ✅ Generated |
| Security | ✅ Same | ✅ Same |

## Database Changes

Run in Supabase SQL Editor:
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobile_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_mobile_number_unique 
ON public.profiles(mobile_number) 
WHERE mobile_number IS NOT NULL;
```

## Validation Rules

**Email**:
- Must be valid email format
- Must be unique (no duplicates)
- Required if email type selected

**Mobile Number**:
- Must be exactly 10 digits
- Non-numeric characters auto-stripped
- Must be unique (no duplicates)
- Required if mobile type selected

## Form Flow

```
Select Identifier Type
        ↓
    [Email or Mobile]
        ↓
    [Conditional Input]
        ↓
    [Full Name] [Role]
        ↓
    [Create User]
        ↓
    [Show Credentials]
```

## Testing Notes

✅ Test both identifier types
✅ Test validation error messages
✅ Test duplicate prevention
✅ Test form reset
✅ Test credentials copy
✅ Test database column created
✅ Test first login reset works

## No Breaking Changes ✅

- Existing email users unaffected
- Mobile number is optional (NULL allowed)
- Business logic preserved
- All security features maintained
- Backward compatible

## Best Practices

**Email Users**:
- Use official company email addresses
- For corporate staff, supervisors, admins

**Mobile Users**:
- Use 10-digit Indian mobile numbers
- For field custodians, site workers
- Better accessibility for mobile-first users

## Credentials Display

After successful user creation, both identifier types show:
- **Identifier** (Email or Mobile Number) - with copy button
- **Temporary Password** (12-char) - with copy button
- Security reminders and best practices

## Next Steps

1. Deploy database migration
2. Deploy frontend code
3. Test both user creation paths
4. Update user onboarding documentation
5. Train admins on new feature

## FAQs

**Q: Can I create user with both email and mobile?**
A: Select one identifier type. Mobile number is stored in profiles for future use.

**Q: What if user forgets which identifier type was used?**
A: Admin can check profiles table or check user's email/mobile_number field directly.

**Q: How do users log in with mobile number?**
A: They enter mobile number as username (1st login reset required, then permanent password set).

**Q: Are both identifier types equally secure?**
A: Yes, both use same temporary password generation and first-login reset enforcement.

**Q: Can I mix email and mobile for different users?**
A: Yes, each user gets one identifier type chosen at creation time.
