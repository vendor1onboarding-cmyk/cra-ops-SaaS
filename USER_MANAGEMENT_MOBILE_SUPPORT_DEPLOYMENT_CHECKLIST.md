# Mobile Number Support - Deployment Checklist

## Pre-Deployment

- [ ] Code review completed
- [ ] All tests passing locally
- [ ] No lint errors in UserOnboarding.tsx
- [ ] Database migration scripts reviewed
- [ ] Backup of current database created
- [ ] Team notified of upcoming changes

## Database Deployment

- [ ] Open Supabase SQL Editor
- [ ] Copy migration from `USER_MANAGEMENT_MOBILE_SUPPORT_MIGRATION.sql`
- [ ] Run verification queries:
  ```sql
  SELECT COUNT(*) as total_profiles FROM public.profiles;
  SELECT * FROM information_schema.columns 
  WHERE table_name='profiles' AND column_name='mobile_number';
  ```
- [ ] Confirm:
  - [ ] mobile_number column exists
  - [ ] idx_profiles_mobile_number_unique index created
  - [ ] idx_profiles_mobile_number index created
  - [ ] No errors in migration log

## Frontend Deployment

- [ ] Updated `src/pages/admin/UserOnboarding.tsx` deployed
- [ ] No build errors
- [ ] No TypeScript errors
- [ ] Component loads without issues

## Post-Deployment Testing

### Basic Functionality
- [ ] Admin panel loads correctly
- [ ] Admin Operations → User Management accessible
- [ ] Email option works (original flow)
- [ ] Mobile option works (new feature)
- [ ] Form validation works for both types
- [ ] Duplicate prevention works for both types

### Email User Creation
- [ ] Select "Email" identifier type
- [ ] Enter valid email (e.g., test@example.com)
- [ ] Enter full name
- [ ] Select role
- [ ] Click "Create User"
- [ ] Credentials displayed with email
- [ ] Copy buttons work
- [ ] Check profiles table: email column populated, mobile_number is NULL
- [ ] Check auth.users: new user exists
- [ ] Login with email + temp password works
- [ ] First login password reset triggered
- [ ] Can log in with new password

### Mobile User Creation
- [ ] Select "Mobile Number" identifier type
- [ ] Enter 10-digit mobile (e.g., 9876543210)
- [ ] Enter full name
- [ ] Select role
- [ ] Click "Create User"
- [ ] Credentials displayed with mobile number
- [ ] Copy buttons work
- [ ] Check profiles table: mobile_number populated, email is synthetic
- [ ] Check auth.users: new user exists with synthetic email
- [ ] Login with mobile + temp password works
- [ ] First login password reset triggered
- [ ] Can log in with new password

### Validation Tests
- [ ] Email validation: Empty email rejected
- [ ] Email validation: Invalid email format rejected (e.g., "test")
- [ ] Email validation: Valid email accepted
- [ ] Mobile validation: Empty mobile rejected
- [ ] Mobile validation: Non-numeric characters rejected
- [ ] Mobile validation: Less than 10 digits rejected
- [ ] Mobile validation: More than 10 digits rejected
- [ ] Mobile validation: Exactly 10 digits accepted
- [ ] Mobile validation: Auto-strips formatting (e.g., "98-7654-3210" → "9876543210")

### Duplicate Prevention
- [ ] Create email user with "test@example.com"
- [ ] Try to create another user with same email → Error message displayed
- [ ] Create mobile user with "9876543210"
- [ ] Try to create another user with same mobile → Error message displayed
- [ ] Can create user with different email
- [ ] Can create user with different mobile

### UI/UX
- [ ] Form resets properly after creation
- [ ] Error messages clear when user fixes issues
- [ ] Loading state works during submission
- [ ] Submit button disabled while loading
- [ ] All form fields clear on reset
- [ ] Identifier type reverts to "Email" on reset
- [ ] Mobile input accepts only numbers
- [ ] Mobile input truncates at 10 characters
- [ ] Radio buttons toggle correctly
- [ ] Conditional rendering works (email/mobile fields)

### Security
- [ ] Temporary password is 12 characters
- [ ] Temporary password has mixed case + numbers + special chars
- [ ] Temporary password different each time
- [ ] Credentials display only after successful creation
- [ ] Credentials hidden in copy operation (masked if possible)
- [ ] Form validation before server call
- [ ] Server-side duplicate check happens
- [ ] Rollback works if profile creation fails

### Data Integrity
- [ ] Email user has email populated, mobile_number NULL
- [ ] Mobile user has mobile_number populated
- [ ] Both have full_name, role, first_login=true
- [ ] Profile IDs match auth.users IDs
- [ ] No orphaned records in either table
- [ ] Indexes performing correctly (check query plans)

## Production Verification

- [ ] Deploy to production after all tests pass
- [ ] Monitor error logs for first 24 hours
- [ ] Check database query performance
- [ ] Verify indexes are being used (EXPLAIN ANALYZE)
- [ ] Monitor auth.users and profiles sync
- [ ] Check user login attempts (both email and mobile)
- [ ] Verify no issues with existing email-based users

## Rollback Plan (if needed)

If issues occur:

1. **Frontend Rollback**:
   - Revert UserOnboarding.tsx to previous version
   - Redeploy frontend
   - Users can still create email-only accounts

2. **Database Rollback**:
   ```sql
   DROP INDEX IF EXISTS idx_profiles_mobile_number_unique;
   DROP INDEX IF EXISTS idx_profiles_mobile_number;
   ALTER TABLE public.profiles DROP COLUMN IF EXISTS mobile_number;
   ```
   - This won't affect existing data
   - Mobile column will be removed
   - System reverts to email-only

## Documentation Updates

- [ ] Update user guide with mobile number option
- [ ] Update admin handbook with new feature
- [ ] Add FAQ about both identifier types
- [ ] Update system architecture docs
- [ ] Add to release notes
- [ ] Update database schema documentation

## Team Communication

- [ ] Send deployment notification
- [ ] Update admin training materials
- [ ] Schedule demo/training for admins
- [ ] Create support ticket template for mobile user issues
- [ ] Monitor support channel for issues

## Success Criteria

✅ All tests passing
✅ Both identifier types working
✅ No breaking changes to existing functionality
✅ Database migration runs cleanly
✅ No performance degradation
✅ Users can sign up with either identifier
✅ First login reset works for both
✅ Duplicate prevention works correctly
✅ No data inconsistencies

## Sign-off

- [ ] Developer: _________________________ Date: _________
- [ ] QA Lead: __________________________ Date: _________
- [ ] DevOps: ___________________________ Date: _________
- [ ] Project Manager: ___________________ Date: _________
