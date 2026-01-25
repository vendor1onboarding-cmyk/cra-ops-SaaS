# Sruthi CRA Ops - Development & Enhancement Guide

## 📝 Code Style & Best Practices

### TypeScript Usage
```typescript
// ✅ Good: Type everything
interface User {
  id: string;
  full_name: string;
  role: 'admin' | 'custodian' | 'supervisor';
}

// ❌ Bad: Using 'any'
const user: any = fetchUser();

// ✅ Good: Optional chaining
const name = user?.profile?.full_name;

// ❌ Bad: Unsafe access
const name = user.profile.full_name; // Can throw if nested is null
```

### Component Structure
```typescript
import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function MyPage() {
  // 1. State declarations
  const { profile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 2. Effects
  useEffect(() => {
    // Load data
  }, [profile]);

  // 3. Handlers
  async function handleAction() {
    // Do something
  }

  // 4. Early returns (guards)
  if (loading) return <div>Loading...</div>;
  if (!profile) return <div>Not authenticated</div>;

  // 5. Render
  return (
    <AppLayout>
      {/* Component JSX */}
    </AppLayout>
  );
}
```

### Error Handling
```typescript
// ✅ Good: Comprehensive error handling
async function loadData() {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .from("table")
      .select("*");
    
    if (error) throw error;
    setData(data || []);
  } catch (err: any) {
    console.error("Failed to load data:", err.message);
    setError("Failed to load data. Please try again.");
  } finally {
    setLoading(false);
  }
}

// ❌ Bad: Ignoring errors
const { data } = await supabase.from("table").select("*");
// No error checking!
```

### Async/Await
```typescript
// ✅ Good: Parallel queries
const [users, items] = await Promise.all([
  supabase.from("profiles").select("*"),
  supabase.from("items").select("*")
]);

// ❌ Bad: Sequential (slower)
const users = await supabase.from("profiles").select("*");
const items = await supabase.from("items").select("*");
```

---

## 🎯 Adding New Features

### Feature Checklist
- [ ] Create new page component in `src/pages/`
- [ ] Add route in `App.tsx`
- [ ] Add navigation item in `Layout.tsx`
- [ ] Add Supabase table/queries
- [ ] Create utility functions if needed
- [ ] Add TypeScript types
- [ ] Handle loading/error states
- [ ] Test on mobile
- [ ] Document in this guide

### Example: Adding a New Custodian Feature

#### 1. Create Page Component
```typescript
// src/pages/MyFeature.tsx
import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function MyFeaturePage() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("my_table")
      .select("*")
      .eq("custodian_id", profile.id);
    setData(data || []);
    setLoading(false);
  }

  if (loading) return <AppLayout><div>Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">My Feature</h1>
        {/* Feature content */}
      </div>
    </AppLayout>
  );
}
```

#### 2. Add Route in App.tsx
```typescript
import MyFeaturePage from "./pages/MyFeature";

<Route
  path="/my-feature"
  element={
    <PrivateRoute>
      <MyFeaturePage />
    </PrivateRoute>
  }
/>
```

#### 3. Add Navigation Item in Layout.tsx
```typescript
const navItems = isAdmin ? [...] : [
  { to: "/", label: "Dashboard" },
  // ... existing items
  { to: "/my-feature", label: "My Feature" },
];

const ICONS: Record<string, string> = {
  // ... existing icons
  "My Feature": "📌",
};
```

---

## 🗄️ Working with Database

### Query Patterns

#### Count Records (Efficient)
```typescript
const { count } = await supabase
  .from("assignments")
  .select("*", { count: "exact", head: true })
  .eq("status", "submitted");
```

#### Get Single Record
```typescript
const { data } = await supabase
  .from("assignments")
  .select("*")
  .eq("id", assignmentId)
  .single(); // Throws if 0 or >1 records
```

#### Get Optional Record
```typescript
const { data } = await supabase
  .from("assignments")
  .select("*")
  .eq("id", assignmentId)
  .maybeSingle(); // Returns null if not found
```

#### Join Relations
```typescript
const { data } = await supabase
  .from("assignments")
  .select(`
    *,
    custodian:custodian_id(full_name, role),
    route_sites(id, site_id)
  `)
  .eq("id", assignmentId);
```

#### Upsert (Insert or Update)
```typescript
const { data, error } = await supabase
  .from("my_table")
  .upsert({
    id: existingId,
    column1: value1,
    column2: value2
  });
```

### File Upload to Storage
```typescript
async function uploadFile(bucket: string, path: string, file: Blob) {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}
```

---

## 🔐 Authentication & Authorization

### Check User Role
```typescript
const { profile } = useAuth();

if (profile?.role === "admin") {
  // Show admin features
}

if (profile?.role === "custodian") {
  // Show custodian features
}
```

### Create Protected Component
```typescript
function AdminOnly({ children }: { children: JSX.Element }) {
  const { profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (profile?.role !== "admin") {
    return <div>Access Denied</div>;
  }

  return children;
}
```

---

## 🧪 Testing Features

### Manual Testing Checklist
```
[ ] Feature loads without errors
[ ] Loading states work correctly
[ ] Data displays properly
[ ] Actions save to database
[ ] Error messages display
[ ] Mobile view looks good
[ ] Offline mode works (if applicable)
[ ] Can print/export (if applicable)
```

### Testing Different Roles
```
1. Login as custodian
   - Can access custodian pages
   - Cannot access admin pages

2. Login as admin
   - Can access admin pages
   - Dashboard shows proper data

3. Test logout
   - Session clears
   - Redirected to login

4. Test offline
   - Features still work
   - Data syncs when online
```

---

## 📊 Performance Optimization

### Code Splitting
```typescript
// Import page components lazily
const MyFeature = lazy(() => import("./pages/MyFeature"));

// Use in routes
<Suspense fallback={<div>Loading...</div>}>
  <MyFeature />
</Suspense>
```

### Query Optimization
```typescript
// ✅ Good: Only fetch what you need
.select("id, name, status")

// ❌ Bad: Fetch everything
.select("*")
```

### State Management
```typescript
// ✅ Good: Granular state
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// ❌ Bad: Monolithic state
const [state, setState] = useState({
  data: [], loading: false, error: null
});
```

---

## 🎨 UI Component Patterns

### Form Input with Validation
```typescript
function FormInput({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full border rounded px-3 py-2 ${
          error ? "border-red-500" : "border-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
```

### Loading Skeleton
```typescript
<div className="animate-pulse space-y-3">
  <div className="h-4 bg-slate-300 rounded w-3/4"></div>
  <div className="h-4 bg-slate-300 rounded w-1/2"></div>
  <div className="h-4 bg-slate-300 rounded w-2/3"></div>
</div>
```

### Empty State
```typescript
{data.length === 0 ? (
  <div className="text-center py-8 text-slate-500">
    <p className="text-lg font-medium">No data found</p>
    <p className="text-sm">Try creating a new record</p>
  </div>
) : (
  // Render data
)}
```

---

## 🔄 Common Workflows

### Implementing Approval Workflow
```typescript
// 1. Fetch pending items
const { data: pending } = await supabase
  .from("items")
  .select("*")
  .eq("status", "pending");

// 2. Update status
const { error } = await supabase
  .from("items")
  .update({ status: "approved", approved_by: adminId })
  .eq("id", itemId);

// 3. Refresh list
await loadPendingItems();
```

### Implementing Soft Delete
```typescript
// Mark as deleted instead of removing
const { error } = await supabase
  .from("items")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", itemId);

// Query excludes deleted items
.select("*")
.is("deleted_at", null)
```

---

## 📚 File Organization

### When to Split Code
- Component grows > 300 lines → extract sub-components
- Logic becomes complex → create utility functions
- Repeated code → create helpers in `utils/`
- Shared state → use Context

### Naming Conventions
```
Files:
- Pages: PascalCase (MyFeaturePage.tsx)
- Components: PascalCase (Button.tsx)
- Utils: camelCase (calculateTotal.ts)
- Hooks: camelCase with prefix (useAuth.ts)

Variables:
- Constants: UPPER_SNAKE_CASE
- Functions: camelCase
- Types/Interfaces: PascalCase
```

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
# Output in dist/ folder
# All TypeScript checked
# Assets optimized
# PWA manifest generated
```

### Environment Variables
```
.env.local (local development)
.env.production (production)

Required:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
```

### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Environment setup on Vercel dashboard
```

---

## 🐛 Debugging Tips

### Console Logging
```typescript
// Log with context
console.log("Feature: Loading data", { userId, date });

// Performance monitoring
console.time("dataFetch");
const data = await loadData();
console.timeEnd("dataFetch");
```

### React DevTools
- Check component state
- Track renders
- Profile performance
- Time component renders

### Supabase Logs
- Check for query errors
- Monitor authentication
- View storage access logs
- Track data changes

### Network Tab
- Check API requests
- View response times
- Identify failed requests
- Monitor payload sizes

---

## 📋 Pre-Commit Checklist

Before pushing code:
```
[ ] No console.log() statements left
[ ] No TypeScript errors (npm run build)
[ ] No ESLint warnings
[ ] All comments updated
[ ] Component tested on mobile
[ ] Error handling implemented
[ ] Loading states shown
[ ] No unused imports
[ ] Meaningful commit message
```

---

## 🔮 Future Enhancement Ideas

### Quick Wins
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts
- [ ] Copy-to-clipboard buttons
- [ ] Confirm dialogs for destructive actions
- [ ] Success toast notifications
- [ ] Data export to Excel
- [ ] Custom date range filtering

### Medium Effort
- [ ] Advanced search/filter
- [ ] Bulk operations
- [ ] Scheduled reports
- [ ] User preferences storage
- [ ] Activity history/audit log
- [ ] Comments/notes system
- [ ] Real-time updates via subscriptions

### Large Effort
- [ ] Mobile app (React Native)
- [ ] API documentation
- [ ] Advanced analytics
- [ ] Machine learning features
- [ ] GraphQL API
- [ ] Microservices architecture

---

**Version**: 1.1.0  
**Last Updated**: January 25, 2026  
**Maintained By**: Development Team
