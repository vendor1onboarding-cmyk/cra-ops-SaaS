# 👨‍💻 DEVELOPMENT GUIDE - Setup & Architecture

## 🚀 Quick Start

### For Experienced Developers (5 minutes)
```bash
# Clone
git clone https://github.com/org/sruthi-cra.git
cd sruthi-cra

# Setup
npm install

# Run
npm run dev

# Open http://localhost:5175
```

### For New Developers (30 minutes)
Follow the [Complete Setup](#-complete-setup-guide) section below.

---

## 📋 Prerequisites

### Required
- **Node.js**: 16.0.0 or higher
  - Check: `node -v`
  - Install: https://nodejs.org
  
- **npm**: 8.0.0 or higher
  - Check: `npm -v`
  - Install: With Node.js
  
- **Git**: Any recent version
  - Check: `git --version`
  - Install: https://git-scm.com

- **Code Editor**: VS Code recommended
  - Download: https://code.visualstudio.com
  - Extensions: TypeScript, ESLint, Prettier (optional)

- **Supabase Account**: For database access
  - Visit: https://supabase.io
  - Create project
  - Get connection string

### Optional
- **GitHub Account**: For repository access
- **Vercel Account**: For deployment
- **Postman**: For API testing
- **Docker**: For containerization

---

## 📦 COMPLETE SETUP GUIDE

### Step 1: Clone Repository
```bash
# Clone via HTTPS (most common)
git clone https://github.com/org/sruthi-cra.git

# OR clone via SSH (if configured)
git clone git@github.com:org/sruthi-cra.git

# Navigate to project
cd sruthi-cra
```

### Step 2: Install Dependencies
```bash
# Install all npm packages
npm install

# Verify installation
npm -v
node -v
```

**Expected Output**:
```
npm: 8.0.0 or higher
node: 16.0.0 or higher
```

### Step 3: Environment Setup

#### Create .env.local file
```bash
# In project root, create file
cp .env.example .env.local
```

#### Add Supabase credentials
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_KEY=your_supabase_anon_key
```

**Where to find**:
1. Go to Supabase dashboard
2. Project settings → API
3. Copy URL and Anon key
4. Paste into .env.local

### Step 4: Start Development Server
```bash
# Start the dev server
npm run dev

# Expected output
# VITE v7.3.0 ready in 590 ms
# ➜ Local: http://localhost:5175/
# ➜ Network: use --host to expose
```

### Step 5: Open in Browser
```
http://localhost:5175
```

**You should see**:
- Sruthi CRA logo
- Login page
- No errors in console

---

## 🏗️ PROJECT STRUCTURE

### src/ - Source Code
```
src/
├── pages/                 # Page components (15+)
│   ├── StatementOfAccounts.tsx    # Main SOA view page
│   ├── AdminSOAAdjustments.tsx    # Admin edit page
│   ├── AdminDashboard.tsx
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── ... (10+ more pages)
│
├── components/            # Reusable components
│   ├── Layout.tsx         # Navigation & shell
│   ├── RequireAdmin.tsx   # Access control
│   ├── FileUpload.tsx
│   ├── DenominationFields.tsx
│   └── ... (more components)
│
├── context/              # Global state
│   └── AuthContext.tsx   # Authentication & user profile
│
├── api/                  # Backend integration
│   └── supabaseClient.ts # Database client setup
│
├── utils/                # Helper functions
│   ├── time.ts          # Date/time utilities
│   ├── getActiveAssignment.ts
│   ├── getActiveAssignmentWithSites.ts
│   ├── leafletFix.ts
│   └── ... (more utilities)
│
├── styles/              # CSS & styling
│   └── global.css       # Global styles
│
├── App.tsx              # Main app component & routing
├── main.tsx             # Entry point
└── vite-env.d.ts        # Vite types
```

### Root - Configuration
```
tsconfig.json           # TypeScript configuration
tsconfig.node.json      # Node.js TypeScript config
vite.config.ts          # Vite build configuration
tailwind.config.js      # Tailwind CSS configuration
postcss.config.js       # PostCSS configuration
package.json            # Dependencies & scripts
vercel.json             # Vercel deployment config
.env.example            # Environment template
.gitignore              # Git ignore rules
```

### Documentation
```
START_HERE.md           # Entry point guide
QUICK_REFERENCE.md      # Feature overview
DOCUMENTATION_INDEX.md  # Master guide
SOA_PAGES_QUICK_GUIDE.md
SOA_TECHNICAL_GUIDE.md
SOA_PAGES_REFACTOR_SUMMARY.md
SOA_VISUAL_GUIDE.md
PROJECT_DOCUMENTATION.md
DEVELOPMENT_GUIDE.md    # This file
... (5+ more documentation files)
```

---

## 📚 TECHNOLOGY STACK

### Frontend Framework
```
React 18.3.1
├─ Components: Functional with hooks
├─ State: useState, useContext, useMemo, useEffect
├─ Patterns: Custom hooks, HOCs, Context API
└─ Performance: Lazy loading, memoization
```

### Type Safety
```
TypeScript 5.6.3
├─ Strict mode enabled
├─ Full coverage: 100%
├─ Interface definitions: Comprehensive
└─ Type checking: Pre-deploy
```

### Build Tool
```
Vite 7.2.7
├─ Dev server: Hot reload (HMR)
├─ Build: Lightning fast
├─ Optimization: Tree-shaking
└─ Testing: Rollup-based
```

### Styling
```
Tailwind CSS 3.4.1
├─ Utility classes: Comprehensive
├─ Responsive: Mobile-first
├─ Colors: Custom palette
└─ Dark mode: Configured
```

### Routing
```
React Router 6.28.0
├─ Protected routes: PrivateRoute
├─ Admin routes: RequireAdmin
├─ Dynamic routing: Implemented
└─ Nested routes: Supported
```

### Database & Auth
```
Supabase (PostgreSQL)
├─ Auth: JWT-based
├─ Database: Relational
├─ Row-Level Security: Enabled
└─ Realtime: Configured
```

---

## 🔨 DEVELOPMENT WORKFLOW

### Starting Development
```bash
# 1. Start dev server
npm run dev

# 2. Open in browser
http://localhost:5175

# 3. Watch for changes
# File changes auto-refresh browser (HMR)

# 4. Check console for errors
# Open DevTools: F12 or right-click → Inspect
```

### File Structure Best Practices

#### Creating New Pages
```bash
# Create new file in src/pages/
# src/pages/NewPage.tsx

import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../api/supabaseClient';

export default function NewPage() {
  const { profile } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load data
  // Handle errors
  // Render UI
}

// Add to App.tsx routing
```

#### Creating New Components
```bash
# Create in src/components/
# src/components/NewComponent.tsx

interface Props {
  title: string;
  onAction: () => void;
}

export default function NewComponent({ title, onAction }: Props) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

#### Creating New Utilities
```bash
# Create in src/utils/
# src/utils/newHelper.ts

export function myHelper(input: string): string {
  return input.toUpperCase();
}

// Use in components
import { myHelper } from '../utils/newHelper';
```

---

## 📝 CODING STANDARDS

### TypeScript Usage
```typescript
// ✅ Good: Full type coverage
interface User {
  id: string;
  name: string;
  role: 'admin' | 'custodian' | 'supervisor';
}

function getUserRole(user: User): string {
  return user.role;
}

// ❌ Avoid: Using any
function getUserRole(user: any): any {
  return user.role;
}
```

### React Patterns
```typescript
// ✅ Good: Functional component with hooks
function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    // Effect logic
  }, [count]);
  
  return <div>{count}</div>;
}

// ❌ Avoid: Class components (legacy)
class MyComponent extends Component {
  // Old pattern
}
```

### Error Handling
```typescript
// ✅ Good: Comprehensive error handling
try {
  const { data, error } = await supabase
    .from('table')
    .select();
  
  if (error) {
    setError('User-friendly message');
    console.error('Technical error:', error);
    return;
  }
  
  setData(data);
} catch (err) {
  setError('Unexpected error occurred');
  console.error(err);
}

// ❌ Avoid: Ignoring errors
const data = await supabase.from('table').select();
setData(data);
```

### State Management
```typescript
// ✅ Good: Proper state organization
const [rows, setRows] = useState<SOARow[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [filters, setFilters] = useState({ date: '', status: '' });

// ❌ Avoid: Mixing related state
const [r, setR] = useState([]);
const [l, setL] = useState(false);
const [e, setE] = useState('');
```

---

## 🧪 TESTING

### Type Checking
```bash
# Check for TypeScript errors
npm run build

# Or manually check
npx tsc --noEmit
```

### Manual Testing

#### Test Authentication
1. Open http://localhost:5175
2. Go to login page
3. Enter test credentials
4. Verify login works
5. Check console for errors

#### Test Role-Based Access
1. **Login as Custodian**:
   - See only /dashboard, /soa routes
   - Cannot access /admin pages
   
2. **Login as Admin**:
   - See admin menu
   - Access /admin/soa-adjustments
   - Can edit records

#### Test Data Loading
1. Open SOA page
2. Wait for data to load
3. Verify table shows records
4. Check no console errors
5. Try filters

---

## 📦 BUILDING FOR PRODUCTION

### Local Build
```bash
# Build production bundle
npm run build

# This generates: dist/
# - Optimized code
# - Tree-shaken
# - Minified
```

### Preview Production Build
```bash
# Preview what production will look like
npm run preview

# Open http://localhost:4173
# Test production build locally
```

### Production Checklist
- ✅ No console errors
- ✅ All features working
- ✅ TypeScript passes
- ✅ Performance good
- ✅ Mobile responsive
- ✅ Accessibility OK
- ✅ No sensitive data in code

### Build Optimization
```typescript
// Lazy load pages for better performance
const AdminDashboard = lazy(() => 
  import('./pages/AdminDashboard')
);

// Use Suspense
<Suspense fallback={<Spinner />}>
  <AdminDashboard />
</Suspense>
```

---

## 🌐 DEPLOYMENT

### Vercel Deployment

#### One-Time Setup
1. Connect repository to Vercel
2. Set environment variables
3. Configure build settings

#### Environment Variables
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=...
```

#### Automatic Deployment
```bash
# Push to main branch
git push origin main

# Vercel automatically builds & deploys
# Check progress: https://vercel.com/dashboard
```

#### Manual Deployment
```bash
# Deploy specific build
npm run build
npm run preview
# Then push to Vercel
```

---

## 🔍 DEBUGGING

### Browser DevTools
```
F12 or Right-click → Inspect

Tabs:
├─ Elements: DOM structure
├─ Console: Errors & logs
├─ Network: API calls
├─ Sources: Breakpoints
├─ Application: Storage
└─ Performance: Speed analysis
```

### Common Issues

#### 1. Login Not Working
**Issue**: Can't log in  
**Debug**:
```typescript
// Check Supabase connection
console.log(supabase);

// Check credentials
console.log(email, password);

// Check network tab
// Should see POST to supabase.co
```

**Solution**:
- Verify .env.local has correct keys
- Check Supabase project is active
- Verify user exists in database

#### 2. Data Not Loading
**Issue**: Table shows no data  
**Debug**:
```typescript
// Check query
console.log('Query:', query);

// Check data
console.log('Data:', data);

// Check error
console.log('Error:', error);
```

**Solution**:
- Check date filters aren't too restrictive
- Verify user has correct role
- Check database has records
- Review error message

#### 3. Styling Not Applied
**Issue**: Tailwind classes not working  
**Debug**:
```html
<!-- Inspect element -->
<button class="bg-blue-500">Click</button>

<!-- Should have blue background -->
<!-- If not, check tailwind.config.js -->
```

**Solution**:
- Rebuild: `npm run dev`
- Clear cache: Ctrl+F5
- Check class name spelling
- Verify purge includes files

#### 4. Permission Denied
**Issue**: Can't access admin pages  
**Debug**:
```typescript
// Check profile role
console.log('Role:', profile?.role);

// Should be 'admin' or 'supervisor'
// Not 'custodian'
```

**Solution**:
- Check user role in profiles table
- Update role if needed
- Re-login after change

---

## 🚀 PERFORMANCE OPTIMIZATION

### Code Splitting
```typescript
// Split large page bundles
const AdminDashboard = lazy(() => 
  import('./pages/AdminDashboard')
);
```

### Memoization
```typescript
// Prevent re-renders
const totals = useMemo(() => {
  return calculateTotals(rows);
}, [rows]);
```

### Query Optimization
```typescript
// Only fetch needed columns
const { data } = await supabase
  .from('table')
  .select('id, name, amount'); // Not *

// Add filters early
.eq('status', 'active')
.order('created_at', { ascending: false });
```

### Image Optimization
```typescript
// Use modern formats
<img src="image.webp" alt="Description" />

// Lazy load images
<img loading="lazy" src="..." alt="..." />
```

---

## 📚 LEARNING RESOURCES

### Official Documentation
- **React**: https://react.dev
- **TypeScript**: https://typescriptlang.org
- **Vite**: https://vitejs.dev
- **Tailwind**: https://tailwindcss.com
- **Supabase**: https://supabase.io/docs
- **React Router**: https://reactrouter.com

### Video Tutorials
- React Hooks: https://www.youtube.com/results?search_query=react+hooks
- TypeScript: https://www.youtube.com/results?search_query=typescript+tutorial
- Tailwind: https://tailwindcss.com/docs/guides

### Books
- React: "Learning React" by Alex Banks & Eve Porcello
- TypeScript: "Learning TypeScript" by Josh Goldberg
- Web Development: "Eloquent JavaScript" by Marijn Haverbeke

---

## 💡 BEST PRACTICES

### 1. Always Use Types
```typescript
// ✅ Good
function process(data: string[]): void {
  // ...
}

// ❌ Bad
function process(data) {
  // ...
}
```

### 2. Handle Errors Gracefully
```typescript
// ✅ Good
try {
  // ... code
} catch (err) {
  setError('User-friendly message');
  console.error(err);
}

// ❌ Bad
const data = await query;
setData(data); // What if error?
```

### 3. Use Constants for Magic Strings
```typescript
// ✅ Good
const ROLE_ADMIN = 'admin';
const ROLE_CUSTODIAN = 'custodian';

if (role === ROLE_ADMIN) { }

// ❌ Bad
if (role === 'admin') { }
if (role === 'Admin') { } // Different!
```

### 4. Keep Components Small
```typescript
// ✅ Good: Focused component
function SOARow({ row }: { row: SOARecord }) {
  return <tr>...</tr>;
}

// ❌ Bad: Too much logic
function SOATable() {
  // 500 lines of logic
}
```

### 5. Reuse Components
```typescript
// ✅ Good: Create once, use everywhere
function LoadingSpinner() { }
function ErrorMessage() { }

// ❌ Bad: Duplicate code
function Page1() { return <div>Loading...</div>; }
function Page2() { return <div>Loading...</div>; }
```

---

## 🔐 SECURITY CONSIDERATIONS

### Environment Variables
```bash
# ✅ Store in .env.local (never commit)
VITE_SUPABASE_URL=...

# ❌ Don't hardcode
const url = "https://project.supabase.co";

# ❌ Don't log secrets
console.log(apiKey);
```

### Authentication
```typescript
// ✅ Verify JWT token
const user = await supabase.auth.getUser();

// ❌ Trust client-side only
if (localStorage.getItem('role') === 'admin') { }
```

### Data Access
```typescript
// ✅ Filter by user ID
.eq('custodian_id', profile.id)

// ❌ Trust user for row access
// Supabase RLS will handle it
```

---

## 🎓 LEARNING PATH

### Week 1: Fundamentals
- [ ] Set up development environment
- [ ] Understand project structure
- [ ] Learn React basics
- [ ] Read existing code
- [ ] Make small changes

### Week 2: Core Components
- [ ] Understand StatementOfAccounts.tsx
- [ ] Understand AdminSOAAdjustments.tsx
- [ ] Learn Supabase queries
- [ ] Review error handling
- [ ] Test features

### Week 3: Advanced
- [ ] Optimize performance
- [ ] Add new features
- [ ] Write tests
- [ ] Review security
- [ ] Deploy changes

### Week 4: Mastery
- [ ] Lead code reviews
- [ ] Mentor junior developers
- [ ] Improve documentation
- [ ] Refactor technical debt
- [ ] Plan new features

---

## 📞 GETTING HELP

### Internal Resources
- [START_HERE.md](START_HERE.md) - Quick overview
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Feature guide
- [SOA_TECHNICAL_GUIDE.md](SOA_TECHNICAL_GUIDE.md) - Code details
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Full index

### External Resources
- GitHub Issues: Report bugs
- Stack Overflow: Ask questions
- Official docs: Check documentation
- Team Slack: Ask teammates

---

## ✅ BEFORE COMMITTING CODE

- [ ] Code compiles (npm run build)
- [ ] No TypeScript errors (npx tsc --noEmit)
- [ ] Tested locally (npm run dev)
- [ ] No console errors
- [ ] Follows code standards
- [ ] Comments added where needed
- [ ] Commit message is clear

---

## 🎯 COMMON TASKS

### Add New Page
1. Create file: `src/pages/NewPage.tsx`
2. Import in `App.tsx`
3. Add route
4. Add to navigation menu
5. Test locally

### Add New Component
1. Create file: `src/components/NewComponent.tsx`
2. Define props interface
3. Implement component
4. Import where needed
5. Test in page

### Add New API Call
1. Create function in component
2. Use `supabase` client
3. Add error handling
4. Add loading state
5. Display results

### Deploy to Production
1. Verify code locally
2. Commit & push to main
3. Vercel auto-deploys
4. Test in production
5. Monitor for errors

---

**Last Updated**: January 26, 2026  
**Version**: 1.0  
**Status**: Production Ready

For questions, see [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

