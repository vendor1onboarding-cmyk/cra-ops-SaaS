# 🚀 SOA V2 - IMPLEMENTATION ROADMAP
## Step-by-Step Execution Plan

**Project**: SOA Restructuring with Exchanges & Adjustments  
**Version**: 2.0  
**Duration**: 4 weeks  
**Start Date**: February 5, 2026  

---

## 📅 WEEK 1: DATABASE FOUNDATION

### Day 1-2: Schema Design & Migration Script

**Tasks**:
- ✅ Finalize migration script
- ✅ Test on local development database
- ✅ Create rollback script
- ✅ Document schema changes

**Deliverables**:
```sql
-- File: migrations/SOA_V2_MIGRATION.sql
-- Status: Ready for staging deployment
```

**Testing Checklist**:
- [ ] Migration runs without errors
- [ ] Existing data unchanged
- [ ] New columns created
- [ ] Constraints updated
- [ ] Indexes created
- [ ] View created successfully

---

### Day 3: Staging Deployment

**Tasks**:
1. Backup staging database
2. Run migration script
3. Verify v_soa_effective still works
4. Test existing SOA page
5. Monitor for any issues

**Verification Queries**:
```sql
-- Check new columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'soa_adjustments'
AND column_name IN ('exchange_metadata', 'transfer_metadata');

-- Check constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'soa_adjustments_adjustment_type_check';

-- Check view
SELECT COUNT(*) FROM v_soa_detailed;
```

---

### Day 4-5: Backend Testing

**Tasks**:
- Test EXCHANGE insert
- Test INTER_SITE_TRANSFER insert
- Test v_soa_detailed queries
- Test backward compatibility
- Performance testing

**Test Scripts**:
```sql
-- Test 1: Insert EXCHANGE adjustment
INSERT INTO soa_adjustments (
  assignment_id, custodian_id, adjustment_type, 
  adjustment_amount, reason, exchange_metadata, created_by
) VALUES (
  '...', '...', 'EXCHANGE', 0,
  'Test exchange: Bank A → Bank B',
  '{"from_denominations": {"denom_2000": 5}, "to_denominations": {"denom_500": 20}}'::jsonb,
  '...'
);

-- Test 2: Query detailed view
SELECT 
  assignment_date,
  opening_balance,
  total_withdrawals,
  total_loads,
  exchange_count,
  transfer_count,
  closing_balance
FROM v_soa_detailed
WHERE custodian_id = '...'
ORDER BY assignment_date DESC
LIMIT 10;

-- Test 3: Verify backward compatibility
SELECT * FROM v_soa_effective
WHERE assignment_date >= CURRENT_DATE - INTERVAL '7 days';
```

---

## 📅 WEEK 2: EXCHANGE & TRANSFER FEATURES

### Day 1-3: Denomination Exchange Component

**File**: `src/pages/DenominationExchange.tsx`

**Implementation Steps**:

1. **Create component skeleton**
```typescript
export default function DenominationExchange() {
  const { profile } = useAuth();
  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [exchangeType, setExchangeType] = useState<'bank-to-bank' | 'atm-to-bank'>('bank-to-bank');
  
  // From details
  const [fromLocation, setFromLocation] = useState('');
  const [fromDenoms, setFromDenoms] = useState({ denom_2000: 0, denom_500: 0, ... });
  
  // To details
  const [toLocation, setToLocation] = useState('');
  const [toDenoms, setToDenoms] = useState({ denom_2000: 0, denom_500: 0, ... });
  
  // Validation
  const [errors, setErrors] = useState<string[]>([]);
  
  // GPS & Photo
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'verified'>('unknown');
  const [photo, setPhoto] = useState<File | null>(null);
  
  return (
    <AppLayout>
      {/* Form implementation */}
    </AppLayout>
  );
}
```

2. **Implement amount validation**
```typescript
const fromTotal = Object.entries(fromDenoms).reduce((sum, [key, count]) => {
  const denomValue = parseInt(key.replace('denom_', ''));
  return sum + (count * denomValue);
}, 0);

const toTotal = Object.entries(toDenoms).reduce((sum, [key, count]) => {
  const denomValue = parseInt(key.replace('denom_', ''));
  return sum + (count * denomValue);
}, 0);

const isValid = fromTotal === toTotal && fromTotal > 0;
```

3. **Implement save function**
```typescript
async function saveExchange() {
  if (!isValid) {
    setError('From and To amounts must match');
    return;
  }
  
  const { error } = await supabase.from('soa_adjustments').insert({
    assignment_id: assignmentId,
    custodian_id: profile.id,
    adjustment_type: 'EXCHANGE',
    adjustment_amount: 0, // Neutral
    reason: `Exchange: ${fromLocation} → ${toLocation}`,
    reference: '',
    exchange_metadata: {
      from_location: fromLocation,
      to_location: toLocation,
      from_denominations: fromDenoms,
      to_denominations: toDenoms,
      total_amount: fromTotal,
      exchange_time: new Date().toISOString()
    },
    created_by: profile.id
  });
  
  if (error) {
    setError('Failed to save exchange');
    return;
  }
  
  alert('Exchange recorded successfully');
  resetForm();
}
```

**Testing Checklist**:
- [ ] Form renders correctly
- [ ] Amount validation works
- [ ] Prevents submission if amounts don't match
- [ ] Saves to database successfully
- [ ] Metadata structure correct
- [ ] Mobile responsive

---

### Day 4-5: Inter-Site Transfer Component

**File**: `src/pages/InterSiteTransfer.tsx`

**Implementation Steps**:

1. **Create component with site selection**
```typescript
export default function InterSiteTransfer() {
  const [sites, setSites] = useState<any[]>([]);
  const [fromSiteId, setFromSiteId] = useState<number | null>(null);
  const [toSiteId, setToSiteId] = useState<number | null>(null);
  const [denoms, setDenoms] = useState({ denom_2000: 0, denom_500: 0, ... });
  const [reason, setReason] = useState('');
  
  // Load sites from today's assignment
  useEffect(() => {
    loadAssignmentSites();
  }, []);
  
  return (
    <AppLayout>
      <h2>Inter-Site Cash Transfer</h2>
      {/* Site selection */}
      {/* Denomination inputs */}
      {/* Reason field */}
      {/* Submit button */}
    </AppLayout>
  );
}
```

2. **Implement save function**
```typescript
async function saveTransfer() {
  const totalAmount = Object.entries(denoms).reduce((sum, [key, count]) => {
    const denomValue = parseInt(key.replace('denom_', ''));
    return sum + (count * denomValue);
  }, 0);
  
  if (totalAmount === 0) {
    setError('Enter at least one denomination');
    return;
  }
  
  const fromSite = sites.find(s => s.id === fromSiteId);
  const toSite = sites.find(s => s.id === toSiteId);
  
  const { error } = await supabase.from('soa_adjustments').insert({
    assignment_id: assignmentId,
    custodian_id: profile.id,
    adjustment_type: 'INTER_SITE_TRANSFER',
    adjustment_amount: 0, // Neutral
    reason: reason,
    reference: `${fromSite.bank_name} → ${toSite.bank_name}`,
    transfer_metadata: {
      from_site_id: fromSiteId,
      to_site_id: toSiteId,
      from_site_name: fromSite.bank_name,
      to_site_name: toSite.bank_name,
      amount: totalAmount,
      denominations: denoms,
      transfer_time: new Date().toISOString()
    },
    created_by: profile.id
  });
  
  if (error) {
    setError('Failed to save transfer');
    return;
  }
  
  alert('Transfer recorded successfully');
  resetForm();
}
```

**Testing Checklist**:
- [ ] Site selection works
- [ ] Prevents same site transfer
- [ ] Denomination inputs work
- [ ] Reason field required
- [ ] Saves to database successfully
- [ ] Metadata structure correct

---

## 📅 WEEK 3: ENHANCED SOA DISPLAY

### Day 1-3: Enhanced SOA Component

**File**: `src/pages/StatementOfAccounts.tsx` (ENHANCE)

**Implementation Steps**:

1. **Add view toggle state**
```typescript
const [view, setView] = useState<'summary' | 'detailed'>('summary');
```

2. **Query v_soa_detailed for detailed view**
```typescript
useEffect(() => {
  if (view === 'detailed') {
    loadDetailedSOA();
  } else {
    loadSOA(); // Existing function
  }
}, [view, fromDate, toDate]);

async function loadDetailedSOA() {
  let query = supabase
    .from('v_soa_detailed')
    .select('*')
    .gte('assignment_date', fromDate)
    .lte('assignment_date', toDate)
    .order('assignment_date', { ascending: false });
    
  if (profile.role === 'custodian') {
    query = query.eq('custodian_id', profile.id);
  }
  
  const { data, error } = await query;
  
  if (error) {
    setError('Failed to load detailed SOA');
    return;
  }
  
  setDetailedRows(data || []);
}
```

3. **Create detailed view component**
```typescript
function DetailedSOACard({ row }: { row: any }) {
  const [showExchanges, setShowExchanges] = useState(false);
  const [exchanges, setExchanges] = useState<any[]>([]);
  
  // Calculate closing balance
  const closing = 
    row.opening_balance + 
    row.total_withdrawals - 
    row.total_loads + 
    row.net_adjustments + 
    row.travel_allowance;
  
  const isBalanced = Math.abs(closing) < 0.01;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
      {/* Header */}
      <div className="border-b pb-4 mb-4">
        <h3 className="text-lg font-bold">{formatISTDate(row.assignment_date)}</h3>
      </div>
      
      {/* Opening Balance */}
      <div className="bg-blue-50 rounded p-4 mb-4">
        <div className="flex justify-between">
          <span className="font-semibold">Opening Balance</span>
          <span className="font-mono">₹{row.opening_balance.toLocaleString('en-IN')}</span>
        </div>
      </div>
      
      {/* Inflows */}
      <div className="space-y-2 mb-4">
        <h4 className="font-semibold text-green-700">Cash Inflows (+)</h4>
        <div className="pl-4">
          <div className="flex justify-between">
            <span>Bank Withdrawals</span>
            <span className="font-mono text-green-600">
              +₹{row.total_withdrawals.toLocaleString('en-IN')}
            </span>
          </div>
          {row.travel_allowance > 0 && (
            <div className="flex justify-between">
              <span>Travel Allowance</span>
              <span className="font-mono text-green-600">
                +₹{row.travel_allowance.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Operations */}
      {(row.exchange_count > 0 || row.transfer_count > 0) && (
        <div className="bg-yellow-50 rounded p-4 mb-4">
          <h4 className="font-semibold text-yellow-800">Operations (Neutral)</h4>
          {row.exchange_count > 0 && (
            <button onClick={() => setShowExchanges(!showExchanges)}>
              Exchanges ({row.exchange_count})
            </button>
          )}
        </div>
      )}
      
      {/* Outflows */}
      <div className="space-y-2 mb-4">
        <h4 className="font-semibold text-red-700">Cash Outflows (-)</h4>
        <div className="pl-4">
          <div className="flex justify-between">
            <span>ATM Loads</span>
            <span className="font-mono text-red-600">
              -₹{row.total_loads.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
      
      {/* Closing */}
      <div className={`rounded p-4 ${
        isBalanced ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'
      }`}>
        <div className="flex justify-between">
          <span className="font-bold">Closing Balance</span>
          <span className={`font-mono font-bold ${
            isBalanced ? 'text-green-700' : 'text-red-700'
          }`}>
            ₹{closing.toLocaleString('en-IN')}
          </span>
        </div>
        {isBalanced ? (
          <p className="text-xs text-green-600 mt-1">✓ Balanced</p>
        ) : (
          <p className="text-xs text-red-600 mt-1">⚠️ Unreconciled</p>
        )}
      </div>
    </div>
  );
}
```

**Testing Checklist**:
- [ ] View toggle works
- [ ] Summary view unchanged
- [ ] Detailed view renders correctly
- [ ] Calculations accurate
- [ ] Exchange details expandable
- [ ] Transfer details expandable
- [ ] Mobile responsive

---

### Day 4-5: Admin Adjustment History

**File**: `src/pages/AdminSOAAdjustments.tsx` (ENHANCE)

**Add adjustment history section**:
```typescript
const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);
const [typeFilter, setTypeFilter] = useState<string>('ALL');

useEffect(() => {
  loadAdjustmentHistory();
}, []);

async function loadAdjustmentHistory() {
  const { data, error } = await supabase
    .from('soa_adjustments')
    .select(`
      *,
      created_by_profile:profiles!created_by(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) {
    console.error('Failed to load adjustment history:', error);
    return;
  }
  
  setAdjustmentHistory(data || []);
}

const filteredAdjustments = typeFilter === 'ALL' 
  ? adjustmentHistory 
  : adjustmentHistory.filter(a => a.adjustment_type === typeFilter);
```

**Testing Checklist**:
- [ ] History loads correctly
- [ ] Type filter works
- [ ] Metadata displays properly
- [ ] Credits/Debits show correctly
- [ ] Exchanges show denominations
- [ ] Transfers show sites

---

## 📅 WEEK 4: FINALIZATION & DEPLOYMENT

### Day 1-2: Navigation & Routes

**Tasks**:
1. Update `src/components/Layout.tsx`
2. Add routes in `src/App.tsx`
3. Test navigation flow

**Layout.tsx Changes**:
```typescript
{/* Custodian Menu */}
<NavLink to="/cash-pickup">Cash Pickup</NavLink>
<NavLink to="/atm-replenishment">ATM Load</NavLink>

{/* NEW */}
<NavLink to="/denomination-exchange">Denomination Exchange</NavLink>
<NavLink to="/inter-site-transfer">Inter-Site Transfer</NavLink>

<NavLink to="/statement-of-accounts">SOA</NavLink>
```

**App.tsx Changes**:
```typescript
<Route path="/denomination-exchange" element={
  <PrivateRoute><DenominationExchange /></PrivateRoute>
} />
<Route path="/inter-site-transfer" element={
  <PrivateRoute><InterSiteTransfer /></PrivateRoute>
} />
```

---

### Day 3: Documentation

**Create user guides**:
- [ ] SOA_V2_USER_GUIDE.md
- [ ] EXCHANGE_QUICK_START.md
- [ ] TRANSFER_QUICK_START.md
- [ ] SOA_READING_GUIDE.md

**Update existing docs**:
- [ ] START_HERE.md (mention new features)
- [ ] DOCUMENTATION_INDEX.md (add new docs)
- [ ] PROJECT_DOCUMENTATION.md (update feature list)

---

### Day 4: UAT (User Acceptance Testing)

**Test Scenarios**:

**Scenario 1: Full Day with Exchange**
```
1. Login as custodian
2. Record cash pickup (₹50,000)
3. Record exchange (₹2000×5 → ₹500×20)
4. Record ATM load #1 (₹15,000)
5. Record ATM load #2 (₹20,000)
6. Record ATM load #3 (₹15,000)
7. View SOA (detailed view)
8. Verify closing balance = ₹0
9. Verify exchange shows in operations
```

**Scenario 2: Inter-Site Transfer**
```
1. Login as custodian
2. Record cash pickup (₹30,000)
3. Record ATM load Site 1 (₹10,000)
4. Record transfer Site 1 → Site 2 (₹5,000)
5. Record ATM load Site 2 (₹15,000)
6. View SOA
7. Verify closing balance = ₹0
8. Verify transfer shows in operations
```

**Scenario 3: Admin Review**
```
1. Login as admin
2. View all custodians' SOA
3. Filter adjustment history by EXCHANGE
4. View exchange details
5. Identify any unreconciled balances
6. Export detailed report
```

---

### Day 5: Production Deployment

**Pre-Deployment Checklist**:
- [ ] All tests passing
- [ ] UAT completed
- [ ] Documentation complete
- [ ] Backup production database
- [ ] Rollback plan ready
- [ ] Team trained

**Deployment Steps**:
```bash
# 1. Backup production database
pg_dump -h prod-host -U user -d database > backup_$(date +%Y%m%d).sql

# 2. Run migration on production
psql -h prod-host -U user -d database -f migrations/SOA_V2_MIGRATION.sql

# 3. Verify migration
psql -h prod-host -U user -d database -c "SELECT COUNT(*) FROM v_soa_detailed;"

# 4. Deploy application code
# (via Vercel or deployment platform)
git push production main

# 5. Monitor for 24 hours
# - Check error logs
# - Monitor user feedback
# - Watch database performance
```

**Post-Deployment**:
- [ ] Monitor error logs (24 hours)
- [ ] Collect user feedback
- [ ] Address any issues
- [ ] Document lessons learned

---

## 🎯 SUCCESS METRICS

### Week 1
- ✅ Database migration successful
- ✅ Backward compatibility verified
- ✅ No performance degradation

### Week 2
- ✅ Exchange feature functional
- ✅ Transfer feature functional
- ✅ All tests passing

### Week 3
- ✅ Enhanced SOA display working
- ✅ Admin history working
- ✅ Mobile responsive

### Week 4
- ✅ Navigation updated
- ✅ Documentation complete
- ✅ UAT passed
- ✅ Production deployed

---

## 📋 DAILY STANDUP TEMPLATE

**What did I accomplish yesterday?**
- 

**What will I work on today?**
- 

**Any blockers or concerns?**
- 

**Testing status?**
- 

---

## 🚨 RISK MITIGATION

### Risk 1: Migration Fails
**Mitigation**: Test extensively on staging, have rollback script ready

### Risk 2: Performance Degradation
**Mitigation**: Index new columns, monitor query performance

### Risk 3: User Confusion
**Mitigation**: Comprehensive documentation, training sessions

### Risk 4: Data Inconsistency
**Mitigation**: Validation rules, audit trails, admin review

---

**Ready to Begin**: ✅  
**Team Aligned**: ✅  
**Resources Available**: ✅  

**LET'S BUILD! 🚀**
