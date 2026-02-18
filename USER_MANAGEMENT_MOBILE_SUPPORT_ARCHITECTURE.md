# Mobile Number Support - Architecture Diagram

## User Creation Flow Comparison

### Email User Creation (Original)
```
┌─────────────────────────────────────────────────────┐
│           Admin Operations Panel                    │
├─────────────────────────────────────────────────────┤
│  User Onboarding Component                          │
│                                                     │
│  1. Admin selects: Email identifier               │
│  2. Enters: john@company.com                       │
│  3. Enters: John Doe, Role                         │
│  4. Click: Create User                             │
│                                                     │
│     ✅ Validation:                                 │
│        - Email format check                        │
│        - Duplicate email check                     │
│        - Name length check                         │
│                                                     │
│  5. Generate: Temporary 12-char password           │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Supabase Auth (Admin API)   │
        ├──────────────────────────────┤
        │ Create User:                 │
        │ - email: john@company.com    │
        │ - password: Temp****         │
        │ - email_confirm: true        │
        │ - metadata:                  │
        │   - full_name: John Doe      │
        │   - role: custodian          │
        │   - login_identifier: email  │
        └──────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │  Supabase Database           │
        ├──────────────────────────────┤
        │ 1. auth.users table:         │
        │    - id: uuid                │
        │    - email: john@company.com │
        │    - password_hash: ****     │
        │                              │
        │ 2. profiles table:           │
        │    - id: uuid (match above)  │
        │    - email: john@company.com │
        │    - mobile_number: NULL     │
        │    - full_name: John Doe     │
        │    - role: custodian         │
        │    - first_login: true       │
        └──────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Admin UI: Show Credentials │
        ├──────────────────────────────┤
        │ Username (Email):            │
        │ john@company.com [Copy]      │
        │                              │
        │ Temp Password:               │
        │ X@9k#2mL$pQ [Copy]           │
        │                              │
        │ ⚠️ Security Reminders...     │
        └──────────────────────────────┘
```

### Mobile User Creation (New)
```
┌─────────────────────────────────────────────────────┐
│           Admin Operations Panel                    │
├─────────────────────────────────────────────────────┤
│  User Onboarding Component                          │
│                                                     │
│  1. Admin selects: Mobile Number identifier       │
│  2. Enters: 9876543210                            │
│  3. Enters: Raj Kumar, Role                       │
│  4. Click: Create User                             │
│                                                     │
│     ✅ Validation:                                 │
│        - 10-digit check                            │
│        - Numeric-only check                        │
│        - Duplicate mobile check                    │
│        - Name length check                         │
│                                                     │
│  5. Generate: Temporary 12-char password           │
│  6. Create Synthetic Internal Email:               │
│     mobile_9876543210@system.internal              │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │     Supabase Auth (Admin API)         │
        ├──────────────────────────────────────┤
        │ Create User:                         │
        │ - email: mobile_9876543210@system... │
        │   (synthetic for compatibility)     │
        │ - password: Temp****                 │
        │ - email_confirm: true                │
        │ - metadata:                          │
        │   - full_name: Raj Kumar             │
        │   - role: custodian                  │
        │   - login_identifier: mobile         │
        └──────────────────────────────────────┘
                           │
                           ▼
        ┌─────────────────────────────────────┐
        │   Supabase Database                 │
        ├─────────────────────────────────────┤
        │ 1. auth.users table:                │
        │    - id: uuid                       │
        │    - email: mobile_9876543210@...   │
        │    - password_hash: ****            │
        │                                     │
        │ 2. profiles table:                  │
        │    - id: uuid (match above)         │
        │    - email: mobile_9876543210@... │
        │    - mobile_number: 9876543210      │
        │    - full_name: Raj Kumar           │
        │    - role: custodian                │
        │    - first_login: true              │
        │                                     │
        │ 3. Index on mobile_number (UNIQUE) │
        └─────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │   Admin UI: Show Credentials     │
        ├──────────────────────────────────┤
        │ Username (Mobile Number):        │
        │ 9876543210 [Copy]                │
        │                                  │
        │ Temp Password:                   │
        │ K#8pL$2j@x9 [Copy]               │
        │                                  │
        │ ⚠️ Security Reminders...         │
        └──────────────────────────────────┘
```

## Database Schema Change

```
┌─────────────────────────────────────────────────────┐
│              profiles TABLE (PostgreSQL)             │
├─────────────────────────────────────────────────────┤
│ Column Name      │ Type    │ Constraints             │
├──────────────────┼─────────┼────────────────────────┤
│ id               │ UUID    │ PRIMARY KEY             │
│ full_name        │ VARCHAR │ NOT NULL                │
│ email            │ TEXT    │ NOT NULL                │
│ mobile_number    │ TEXT    │ NULL (NEW ✨)          │
│ role             │ VARCHAR │ NOT NULL                │
│ first_login      │ BOOLEAN │ DEFAULT true            │
│ created_at       │ TIMESTAMP│ DEFAULT now()          │
│ updated_at       │ TIMESTAMP│ DEFAULT now()          │
└─────────────────────────────────────────────────────┘

Indexes:
- idx_profiles_email (ON email)
- idx_profiles_first_login (ON first_login WHERE first_login=true)
- idx_profiles_mobile_number (ON mobile_number WHERE mobile_number IS NOT NULL) ✨ NEW
- idx_profiles_mobile_number_unique (UNIQUE ON mobile_number WHERE mobile_number IS NOT NULL) ✨ NEW
```

## Component State Structure

```
UserOnboarding Component State:

┌─────────────────────────────────────────────────────┐
│          Identifier Type Selector                   │
│  [○ Email] [● Mobile Number]                       │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴───────────┐
        │                        │
        ▼                        ▼
   ┌─────────┐            ┌──────────────┐
   │ Email   │            │ Mobile Input │
   │ Input   │            │ Input        │
   └─────────┘            └──────────────┘
        │                        │
        └────────────┬───────────┘
                     │
                     ▼
     ┌──────────────────────────┐
     │ Full Name & Role         │
     │ (Always Visible)         │
     └──────────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
        [Create]          [Reset]
```

## Validation Flow

```
        Form Input
            │
    ┌───────┴───────┐
    ▼               ▼
 Email          Mobile
    │               │
    ├─ Format?      ├─ 10 digits?
    ├─ Not empty?   ├─ Numeric?
    └─ Unique?      └─ Unique?
         │               │
         └───────┬───────┘
                 ▼
         All Valid? ──NO──► Show Errors
                 │
                YES
                 │
                 ▼
    Check Duplicate in DB
         │
    ┌────┴────┐
   YES       NO
    │        │
    ▼        ▼
Reject   Continue
  │        │
  │        ▼
  │   Generate Password
  │        │
  │        ▼
  │   Create Auth User
  │        │
  │   ┌────┴────┐
  │  YES       NO
  │   │        │
  │   ▼        ▼
  │   Create  Rollback
  │  Profile   │
  │   │       │
  │   ├───┬───┤
  │   │   │   ▼
  │  YES  NO  Error
  │   │   │
  │   ▼   ▼
  │ Show  Delete
  │ Creds Auth
  │         User
  │
  └─► Error
```

## Login Identifier Decision Tree

```
User Roles Created:

┌────────────────────────────────────────────────────┐
│             USER CREATION DECISION TREE            │
├────────────────────────────────────────────────────┤
│                                                    │
│ Email Identifier Selected?                        │
│           │                    │                  │
│         YES                     NO                 │
│           │                    │                  │
│           ├─ Admin Staff        ├─ Field Worker  │
│           ├─ Supervisors        ├─ Mobile Users  │
│           ├─ Corporate Users    ├─ Remote Sites  │
│           │                    │                  │
│           ▼                    ▼                  │
│     john@company.com      9876543210             │
│     jane@company.com      9123456789             │
│           │                    │                  │
│           └────────┬───────────┘                 │
│                    ▼                              │
│           Both stored in profiles                │
│           Queries/Lookups Fast                   │
│           Login Works Both Ways                  │
│           First Login Reset Enforced             │
│                                                  │
└────────────────────────────────────────────────────┘
```

## Security Flow

```
┌─────────────────────────────────────────────────────┐
│           Security & Access Control               │
├─────────────────────────────────────────────────────┤
│                                                    │
│  1. Admin Only Access                             │
│     └─ Role Check in AuthContext                 │
│                                                    │
│  2. Client-Side Validation                        │
│     ├─ Email format (if email)                   │
│     ├─ 10-digit (if mobile)                      │
│     ├─ Name length                                │
│     └─ Role selection                             │
│                                                    │
│  3. Server-Side Duplicate Check                   │
│     ├─ Query email column                        │
│     └─ Query mobile_number column                │
│                                                    │
│  4. Auth User Creation                            │
│     ├─ Supabase admin API                        │
│     ├─ Email (real or synthetic)                │
│     ├─ Temporary pwd: 12 char                   │
│     └─ Auto-confirmed (admin trust)              │
│                                                    │
│  5. Profile Record                                │
│     ├─ ID matches auth.users                     │
│     ├─ Email field populated                     │
│     ├─ Mobile field (if applicable)              │
│     └─ first_login = true (ENFORCED)             │
│                                                    │
│  6. First Login Requirement                       │
│     ├─ User logs in with temp password           │
│     ├─ System detects first_login = true         │
│     ├─ Forces password reset                      │
│     └─ User sets permanent password              │
│                                                    │
│  7. Ongoing Security                              │
│     ├─ User can change password anytime          │
│     ├─ Identifier stored securely                │
│     └─ Profile role enforces access              │
│                                                   │
└─────────────────────────────────────────────────────┘
```

## Before & After Comparison

```
BEFORE (Email Only):
┌──────────────────────┐
│ Select Admin Action  │
│ - ATM Onboarding     │
│ - ATM Update         │
│ - User Management    │ ◄── Clicked
└──────────────────────┘
        │
        ▼
    Create User:
    [Email Input]
    [Full Name]
    [Role]
    [Create]

AFTER (Email + Mobile):
┌──────────────────────┐
│ Select Admin Action  │
│ - ATM Onboarding     │
│ - ATM Update         │
│ - User Management    │ ◄── Clicked
└──────────────────────┘
        │
        ▼
    Create User:
    [Email ●] [Mobile ○]  ◄── NEW: Selector
    [Email Input] or [Mobile Input] ◄── Conditional
    [Full Name]
    [Role]
    [Create]
```

## Data Flow Resolution

```
┌─────────────────────────────────────────────────┐
│        Data Storage & Retrieval                │
├─────────────────────────────────────────────────┤
│                                                │
│ Email User Path:                              │
│ ┌─────────────┐                               │
│ │ Input:      │                               │
│ │ john@...com │                               │
│ └──────┬──────┘                               │
│        │                                       │
│ ┌──────▼──────────────────────────────────┐  │
│ │ auth.users:                              │  │
│ │ - email: john@company.com                │  │
│ │ - password: hash(temp)                   │  │
│ └──────┬──────────────────────────────────┘  │
│        │                                       │
│ ┌──────▼──────────────────────────────────┐  │
│ │ profiles:                                │  │
│ │ - email: john@company.com                │  │
│ │ - mobile_number: NULL                    │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ Mobile User Path:                             │
│ ┌──────────────┐                              │
│ │ Input:       │                              │
│ │ 9876543210   │                              │
│ └──────┬───────┘                              │
│        │                                       │
│ ┌──────▼──────────────────────────────────┐  │
│ │ Generate: mobile_9876543210@system...   │  │
│ └──────┬──────────────────────────────────┘  │
│        │                                       │
│ ┌──────▼──────────────────────────────────┐  │
│ │ auth.users:                              │  │
│ │ - email: mobile_9876543210@system...    │  │
│ │ - password: hash(temp)                   │  │
│ └──────┬──────────────────────────────────┘  │
│        │                                       │
│ ┌──────▼──────────────────────────────────┐  │
│ │ profiles:                                │  │
│ │ - email: mobile_9876543210@system...    │  │
│ │ - mobile_number: 9876543210              │  │
│ └──────────────────────────────────────────┘  │
│                                                │
└─────────────────────────────────────────────────┘
```

## Performance Impact

```
Query Performance Analysis:

Email Lookups (Existing):
  SELECT * FROM profiles WHERE email = 'john@company.com'
  └─ Uses: idx_profiles_email  ✅ Unchanged

Mobile Lookups (New):
  SELECT * FROM profiles WHERE mobile_number = '9876543210'
  └─ Uses: idx_profiles_mobile_number ✅ Fast

Duplicate Checks:
  Email: WHERE email = '...' ✅ Existing index
  Mobile: WHERE mobile_number = '...' ✅ New Index

First Login Checks (Existing):
  SELECT * FROM profiles WHERE first_login = true
  └─ Uses: idx_profiles_first_login ✅ Unaffected

Null Handling:
  Mobile queries: WHERE mobile_number IS NOT NULL
  └─ Email users have NULL in mobile_number ✅ Efficient
```

This architecture ensures:
✅ No performance degradation
✅ Efficient lookups for both identifier types
✅ Full backward compatibility
✅ Scalable design for future enhancements
