# Sruthi CRA Ops - Quick Reference Guide

## 🚀 Quick Start

### Development
```bash
npm install              # Install dependencies
npm run dev             # Start dev server (http://localhost:5173)
npm run build           # Build for production
npm run preview         # Preview production build
```

### Environment Setup
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 🔗 Route Map

### Public Routes
- `/login` - Login page

### Custodian Routes (Protected)
| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Dashboard | Daily operations summary |
| `/denomination-plan` | DenominationPlan | Plan ATM cash distribution |
| `/cash-pickup` | CashPickup | Record bank pickup |
| `/atm-replenishment` | ATMReplenishment | Load cash into ATMs |
| `/atm-excess-cash` | ATMExcessCash | Handle excess cash |
| `/atm-adjustment` | ATMCashAdjustment | Manual adjustments |
| `/technical-issues` | TechnicalIssues | Report issues |
| `/travel-log` | TravelTracking | Track routes & KM |
| `/soa` | StatementOfAccounts | View SOA records |
| `/eod-summary` | EODSummary | Submit EOD & sign |

### Admin Routes (Protected)
| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin` | AdminDashboard | KPIs & statistics |
| `/admin/approvals` | AdminApprovals | List pending EODs |
| `/admin/approvals/:assignmentId` | AdminEODDetail | Review & approve EOD |
| `/admin/route-assignment` | AdminRouteAssignment | Assign routes |
| `/admin/soa-adjustments` | AdminSOAAdjustments | SOA adjustments |

---

## 🎯 Key Features at a Glance

### For Custodians
✅ Daily cash operations tracking  
✅ ATM denomination planning  
✅ Cash pickup recording  
✅ ATM replenishment  
✅ Excess cash handling  
✅ Technical issue reporting  
✅ Travel tracking with KM  
✅ Digital signature signing  
✅ EOD submission  

### For Admins
✅ Dashboard KPIs  
✅ EOD review & approval  
✅ Route assignment  
✅ SOA management  
✅ Rejection with feedback  

---

## 💾 Database Tables Quick Reference

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `profiles` | User data | id, full_name, role |
| `assignments` | Daily assignments | id, custodian_id, status, eod_signed |
| `route_sites` | ATM sites in route | assignment_id, site_id, sequence_no |
| `sites` | ATM locations | id, bank_name, address, atm_id |
| `denomination_plans` | Cash plans | assignment_id, site_id, denom_* |
| `cash_pickups` | Bank cash pickups | assignment_id, bank_name, denom_* |
| `atm_replenishments` | Cash loaded to ATMs | assignment_id, site_id, denom_* |
| `atm_cash_adjustments` | Manual adjustments | assignment_id, site_id, reason |
| `technical_issues` | Problem reports | assignment_id, issue_type, status |
| `travel_logs` | Route tracking | custodian_id, km_covered, status |

---

## 🎨 Color Palette

```
Primary Blue:     #1565C0
Light Blue:       #42A5F5
Accent Yellow:    #FFC107
Dark Slate:       #0f172a
Light Gray:       #f1f5f9
```

---

## 🔐 Authentication Flow

```
Login Form
    ↓
Supabase Auth (email/password)
    ↓
Fetch User Profile (role)
    ↓
Role-Based Redirect
├─ admin/supervisor → /admin
└─ custodian → /
```

---

## 📊 Key Calculations

### Cash Summary
```
Total Picked = Sum of all cash pickups
Total Loaded = Sum of all ATM replenishments
Total Adjusted = Sum of all adjustments
In Hand = Picked - Loaded + Adjusted
```

### Denomination-wise
```
For each denomination (₹100, ₹200, ₹500, ₹2000):
In Hand = Picked Count - Loaded Count + Adjusted Count
```

### Variance
```
For each ATM:
Variance = Loaded Amount - Planned Amount
```

---

## 🔧 Common Code Patterns

### Fetch Data from Supabase
```typescript
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("column", value)
  .single();
```

### Update Data
```typescript
const { error } = await supabase
  .from("table_name")
  .update({ column: newValue })
  .eq("id", recordId);
```

### Get Current User
```typescript
const { profile, loading } = useAuth();
if (!profile) return <div>Loading...</div>;
```

### Format Site Name
```typescript
function formatSite(site: any) {
  if (!site) return "Unknown Site";
  return `${site.bank_name} – ${site.address || site.site_code}`;
}
```

---

## ⚠️ Important Notes

1. **Assignment Status Workflow**: 
   - `open` → `submitted` → `approved` or `rejected`
   - Once signed (eod_signed=true), cannot be edited

2. **Denominations**: ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000
   - Store as separate columns: `denom_10`, `denom_20`, etc.

3. **Today's Date Only**: 
   - Custodians work only with today's assignment
   - New assignment created daily

4. **Offline Support**: 
   - PWA enabled, works offline
   - Data syncs when online
   - Clear browser cache if issues occur

5. **Signature**:
   - Digital signature stored as PNG in Supabase Storage
   - Public URL generated for viewing
   - Required for EOD submission

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Admin page loading forever | Check profile.role in database |
| Signature not saving | Verify storage bucket exists |
| No assignment for today | Create assignment in DB for today |
| Offline mode not working | Clear cache & reinstall PWA |
| Supabase auth failing | Check .env.local variables |

---

## 📱 Mobile Considerations

- Responsive design (Tailwind CSS)
- Mobile-first UI
- Sticky footer for actions
- Collapse/expand sections
- Drawer menu for navigation
- Touch-friendly buttons

---

## 📈 Performance Tips

1. Use count flags in Supabase queries (`{ count: "exact", head: true }`)
2. Parallel queries with `Promise.all()`
3. Lazy load data where possible
4. Cache assignment data in state
5. Use `maybeSingle()` for optional records

---

## 🔔 Recent Fixes

### Admin Dashboard Loading (v1.1)
✅ Fixed role-based redirect in Login  
✅ Added Dashboard access check  
✅ Optimized AdminDashboard queries  

### EOD Signature (v1.1)
✅ Fixed JSX structure errors  
✅ Implemented read-only view  
✅ Added signature timestamp  
✅ Callback for state refresh  

---

## 📞 Quick Help

**Error Logs**: Check browser DevTools Console (F12)  
**Supabase Logs**: Check Supabase Dashboard > Logs  
**Code Issues**: Search for `console.error()` or `TODO` comments  

---

**Version**: 1.1.0  
**Last Updated**: January 25, 2026  
**Status**: ✅ Production Ready
