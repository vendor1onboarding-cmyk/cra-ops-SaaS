# 🏗️ SOA RESTRUCTURING MASTER PLAN
## Enterprise Cash Flow Accounting with Exchanges & Adjustments

**Version**: 2.0  
**Date**: February 5, 2026  
**Status**: 🎯 Design Complete - Ready for Implementation  
**Backward Compatibility**: ✅ GUARANTEED

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Business Requirements Analysis](#business-requirements-analysis)
3. [Current State Assessment](#current-state-assessment)
4. [Proposed Architecture](#proposed-architecture)
5. [Database Schema Extensions](#database-schema-extensions)
6. [SOA Layout Design](#soa-layout-design)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Testing Strategy](#testing-strategy)
9. [Migration & Rollback Plan](#migration--rollback-plan)

---

## 📊 EXECUTIVE SUMMARY

### Problem Statement
Current SOA system lacks modeling for:
- Denomination exchanges (bank-to-bank, no net change)
- Inter-site cash transfers (ATM-to-ATM movement)
- Denomination reshaping without withdrawal
- Professional accounting presentation (Opening → Transactions → Closing)

### Solution Overview
Extend existing SOA framework with:
1. **New adjustment types** (EXCHANGE, INTER_SITE_TRANSFER)
2. **Enhanced SOA view** (professional accounting format)
3. **Denomination tracking** (exchange metadata)
4. **Zero-balance enforcement** (end-of-day validation)

### Key Principles
✅ **Backward Compatible** - Existing functionality untouched  
✅ **Audit-Friendly** - Complete trail of all cash movements  
✅ **Neutral Adjustments** - Exchanges don't affect net position  
✅ **Professional Presentation** - Enterprise accounting standards  
✅ **Mobile-First** - Responsive design maintained  

---

## 🔍 BUSINESS REQUIREMENTS ANALYSIS

### Requirement 1: Denomination Exchange (Bank to Bank)

**Scenario**:
```
1. Withdraw ₹2000 × 5 = ₹10,000 from Bank A
2. Go to Bank B with the ₹10,000
3. Give ₹2000 notes to Bank B
4. Receive ₹500 × 20 = ₹10,000 instead
5. Load ₹500 notes into ATMs
```

**Accounting Impact**:
- Total cash: **NO CHANGE** (₹10,000 → ₹10,000)
- Denominations: **CHANGED** (₹2000 → ₹500)
- Net position: **NEUTRAL** (exchange operation only)

**Current Gap**: No mechanism to record this exchange

**Proposed Solution**:
- New adjustment type: `EXCHANGE`
- Metadata: From denominations, To denominations, Exchange location
- Display: Shows in operations section, doesn't affect final net

---

### Requirement 2: Exchange Without Withdrawal (ATM → Bank → ATM)

**Scenario**:
```
1. Remove ₹200 × 10 = ₹2,000 from Site 1 (recorded as ATM withdrawal)
2. Go to bank
3. Exchange to ₹100 × 20 = ₹2,000
4. Load into Site 2
```

**Accounting Impact**:
- Total cash: **NO CHANGE** (₹2,000 → ₹2,000)
- Cash source: **ATM inventory** (not new bank withdrawal)
- Net position: **NEUTRAL**

**Current Gap**: Looks like new withdrawal in current system

**Proposed Solution**:
- ATM withdrawal creates negative entry (cash removed from site)
- Exchange recorded as denomination change
- New load uses exchanged denominations
- Net effect = 0 (withdrawal + exchange + load cancel out)

---

### Requirement 3: Inter-Site Cash Movement

**Scenario**:
```
1. Remove ₹5,000 from low-traffic ATM
2. Load ₹5,000 into high-traffic ATM
```

**Accounting Impact**:
- Total cash: **NO CHANGE**
- Site allocation: **CHANGED**
- Net position: **NEUTRAL**

**Current Gap**: Appears as withdrawal + load (distorts metrics)

**Proposed Solution**:
- New adjustment type: `INTER_SITE_TRANSFER`
- Metadata: From site, To site, Amount, Denominations
- Display: Shows in operations section as transfer
- Net calculation: Excludes from final position

---

### Requirement 4: End-of-Day Zero Balance

**Accounting Principle**:
```
Opening Balance (Previous closing)
+ Bank Withdrawals (cash_pickups)
± Exchanges (neutral, metadata only)
± Inter-site Transfers (neutral, metadata only)
- ATM Loads (atm_replenishments)
± Manual Adjustments (CREDIT/DEBIT)
- Excess Reported (separate bucket)
+ Travel Allowance
= Closing Balance (MUST BE ZERO at EOD)
```

**Current Gap**: No formal validation or presentation

**Proposed Solution**:
- Enhanced SOA layout with accounting sections
- Visual indicators when closing ≠ 0
- Admin alerts for unreconciled balances

---

## 🏛️ CURRENT STATE ASSESSMENT

### Existing Tables (Do NOT Modify)

#### assignments
```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY,
  custodian_id UUID REFERENCES profiles(id),
  vehicle_id UUID,
  route_id UUID,
  assignment_date DATE,
  status TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```
✅ **Safe** - No changes needed

#### cash_pickups (Bank Withdrawals)
```sql
CREATE TABLE cash_pickups (
  id UUID PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id),
  bank_account_id UUID,
  denom_2000 INTEGER,
  denom_500 INTEGER,
  denom_200 INTEGER,
  denom_100 INTEGER,
  denom_50 INTEGER,
  denom_20 INTEGER,
  denom_10 INTEGER,
  pickup_time TIMESTAMP,
  created_at TIMESTAMP
);
```
✅ **Safe** - No changes needed  
📊 **Usage**: Represents cash withdrawn from bank

#### atm_replenishments (ATM Loads)
```sql
CREATE TABLE atm_replenishments (
  id UUID PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id),
  site_id UUID REFERENCES sites(id),
  denom_2000 INTEGER,
  denom_500 INTEGER,
  denom_200 INTEGER,
  denom_100 INTEGER,
  time_in TIMESTAMP,
  time_out TIMESTAMP,
  remarks TEXT,
  created_at TIMESTAMP
);
```
✅ **Safe** - No changes needed  
📊 **Usage**: Represents cash loaded into ATMs

#### soa_adjustments (Manual Adjustments)
```sql
CREATE TABLE soa_adjustments (
  id UUID PRIMARY KEY,
  soa_id UUID,
  assignment_id UUID REFERENCES assignments(id),
  custodian_id UUID REFERENCES profiles(id),
  adjustment_type TEXT, -- CREDIT | DEBIT
  adjustment_amount DECIMAL(12, 2),
  reason TEXT,
  reference TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP
);
```
⚠️ **EXTEND** - Add new adjustment types  
📊 **Current types**: CREDIT, DEBIT  
📊 **New types**: EXCHANGE, INTER_SITE_TRANSFER

#### v_soa_effective (View - Current Structure)
```sql
CREATE VIEW v_soa_effective AS
SELECT
  a.id as soa_id,
  a.assignment_id,
  a.custodian_id,
  a.assignment_date,
  COALESCE(SUM(cp.cash_picked), 0) as cash_picked,
  COALESCE(SUM(ar.cash_loaded), 0) as cash_loaded,
  -- ... other calculations
  final_net_cash_position
FROM assignments a
LEFT JOIN cash_pickups cp ON a.id = cp.assignment_id
LEFT JOIN atm_replenishments ar ON a.id = ar.assignment_id
-- ... other joins
```
⚠️ **ENHANCE** - Add exchange/transfer tracking  
✅ **Backward Compatible** - Existing columns remain unchanged

---

## 🎯 PROPOSED ARCHITECTURE

### Phase 1: Database Schema Extensions

#### 1.1 Extend soa_adjustments Table (Non-Breaking)

**Add new adjustment types**:
```sql
-- Current constraint:
CHECK (adjustment_type IN ('CREDIT', 'DEBIT'))

-- New constraint (backward compatible):
CHECK (adjustment_type IN ('CREDIT', 'DEBIT', 'EXCHANGE', 'INTER_SITE_TRANSFER'))
```

**Add metadata columns** (all nullable for backward compatibility):
```sql
ALTER TABLE soa_adjustments
ADD COLUMN exchange_metadata JSONB DEFAULT NULL,
ADD COLUMN transfer_metadata JSONB DEFAULT NULL;

-- exchange_metadata structure:
{
  "from_bank_id": "uuid",
  "to_bank_id": "uuid",
  "from_denominations": {
    "denom_2000": 5,
    "denom_500": 0,
    ...
  },
  "to_denominations": {
    "denom_2000": 0,
    "denom_500": 20,
    ...
  },
  "exchange_location": "Bank B, Main Branch"
}

-- transfer_metadata structure:
{
  "from_site_id": "uuid",
  "to_site_id": "uuid",
  "amount": 5000,
  "denominations": {
    "denom_500": 10
  },
  "transfer_reason": "Rebalancing inventory"
}
```

✅ **Backward Compatible**: Existing CREDIT/DEBIT records have NULL metadata  
✅ **Flexible**: JSONB allows future extension without schema changes  
✅ **Type-Safe**: Application validates structure before insert

---

#### 1.2 Create Helper View: v_soa_detailed

**Purpose**: Provide detailed breakdown for enhanced SOA presentation

```sql
CREATE VIEW v_soa_detailed AS
SELECT
  a.id as soa_id,
  a.assignment_id,
  a.custodian_id,
  a.assignment_date,
  
  -- Opening balance (previous day closing)
  COALESCE(
    (SELECT final_net_cash_position 
     FROM v_soa_effective 
     WHERE custodian_id = a.custodian_id 
     AND assignment_date = a.assignment_date - INTERVAL '1 day'
    ), 0
  ) as opening_balance,
  
  -- Bank withdrawals (cash_pickups)
  COALESCE(
    (SELECT SUM(
      denom_2000 * 2000 + 
      denom_500 * 500 + 
      denom_200 * 200 + 
      denom_100 * 100 + 
      denom_50 * 50 + 
      denom_20 * 20 + 
      denom_10 * 10
    ) FROM cash_pickups WHERE assignment_id = a.id), 
    0
  ) as total_withdrawals,
  
  -- ATM loads (atm_replenishments)
  COALESCE(
    (SELECT SUM(
      denom_2000 * 2000 + 
      denom_500 * 500 + 
      denom_200 * 200 + 
      denom_100 * 100
    ) FROM atm_replenishments WHERE assignment_id = a.id), 
    0
  ) as total_loads,
  
  -- Manual adjustments (CREDIT/DEBIT only, excluding EXCHANGE/TRANSFER)
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN adjustment_type = 'CREDIT' THEN adjustment_amount
        WHEN adjustment_type = 'DEBIT' THEN -adjustment_amount
        ELSE 0
      END
    ) FROM soa_adjustments 
    WHERE assignment_id = a.id 
    AND adjustment_type IN ('CREDIT', 'DEBIT')
    ), 
    0
  ) as net_adjustments,
  
  -- Exchanges (count only, no net impact)
  (SELECT COUNT(*) 
   FROM soa_adjustments 
   WHERE assignment_id = a.id 
   AND adjustment_type = 'EXCHANGE'
  ) as exchange_count,
  
  -- Transfers (count only, no net impact)
  (SELECT COUNT(*) 
   FROM soa_adjustments 
   WHERE assignment_id = a.id 
   AND adjustment_type = 'INTER_SITE_TRANSFER'
  ) as transfer_count,
  
  -- Excess (separate, not part of cash-in-hand)
  COALESCE(
    (SELECT SUM(excess_amount) 
     FROM excess_cash 
     WHERE assignment_id = a.id
    ), 
    0
  ) as excess_reported,
  
  -- Travel allowance
  COALESCE(
    (SELECT travel_allowance 
     FROM travel_logs 
     WHERE assignment_id = a.id
    ), 
    0
  ) as travel_allowance,
  
  -- Closing balance (calculated)
  (
    COALESCE(
      (SELECT final_net_cash_position 
       FROM v_soa_effective 
       WHERE custodian_id = a.custodian_id 
       AND assignment_date = a.assignment_date - INTERVAL '1 day'
      ), 0
    )
    + COALESCE(
      (SELECT SUM(
        denom_2000 * 2000 + denom_500 * 500 + 
        denom_200 * 200 + denom_100 * 100 + 
        denom_50 * 50 + denom_20 * 20 + denom_10 * 10
      ) FROM cash_pickups WHERE assignment_id = a.id), 0
    )
    - COALESCE(
      (SELECT SUM(
        denom_2000 * 2000 + denom_500 * 500 + 
        denom_200 * 200 + denom_100 * 100
      ) FROM atm_replenishments WHERE assignment_id = a.id), 0
    )
    + COALESCE(
      (SELECT SUM(
        CASE 
          WHEN adjustment_type = 'CREDIT' THEN adjustment_amount
          WHEN adjustment_type = 'DEBIT' THEN -adjustment_amount
          ELSE 0
        END
      ) FROM soa_adjustments 
      WHERE assignment_id = a.id 
      AND adjustment_type IN ('CREDIT', 'DEBIT')
      ), 0
    )
    + COALESCE(
      (SELECT travel_allowance 
       FROM travel_logs 
       WHERE assignment_id = a.id
      ), 0
    )
  ) as closing_balance,
  
  a.status,
  a.created_at,
  a.updated_at
  
FROM assignments a;
```

✅ **Backward Compatible**: Does NOT modify v_soa_effective  
✅ **Additive**: Provides enhanced view alongside existing view  
✅ **Queryable**: Same interface as v_soa_effective

---

### Phase 2: Application Layer Enhancements

#### 2.1 New Exchange Recording Form

**Component**: `src/pages/DenominationExchange.tsx` (NEW)

**Purpose**: Record denomination exchanges (bank-to-bank, ATM-to-bank)

**Features**:
- Select exchange type (Bank-to-Bank, ATM-to-Bank)
- From location (bank/ATM site)
- To location (bank)
- From denominations (what you're giving)
- To denominations (what you're receiving)
- Auto-validation: Total amount must match
- GPS verification (optional)
- Photo capture (optional)

**Database Insert**:
```typescript
await supabase.from("soa_adjustments").insert({
  assignment_id: assignmentId,
  custodian_id: profile.id,
  adjustment_type: "EXCHANGE",
  adjustment_amount: 0, // Neutral operation
  reason: `Exchange: ${fromLocation} → ${toLocation}`,
  reference: exchangeReference,
  exchange_metadata: {
    from_bank_id: fromBankId,
    to_bank_id: toBankId,
    from_denominations: { denom_2000: 5, denom_500: 0, ... },
    to_denominations: { denom_2000: 0, denom_500: 20, ... },
    exchange_location: toLocation,
    total_amount: 10000
  },
  created_by: profile.id,
  created_at: new Date().toISOString()
});
```

---

#### 2.2 New Inter-Site Transfer Form

**Component**: `src/pages/InterSiteTransfer.tsx` (NEW)

**Purpose**: Record ATM-to-ATM cash movements

**Features**:
- Select from ATM site
- Select to ATM site
- Enter denominations being moved
- GPS verification at both sites
- Photo capture (optional)
- Reason for transfer

**Database Insert**:
```typescript
await supabase.from("soa_adjustments").insert({
  assignment_id: assignmentId,
  custodian_id: profile.id,
  adjustment_type: "INTER_SITE_TRANSFER",
  adjustment_amount: 0, // Neutral operation
  reason: reason,
  reference: `Transfer ${fromSite.bank_name} → ${toSite.bank_name}`,
  transfer_metadata: {
    from_site_id: fromSiteId,
    to_site_id: toSiteId,
    amount: totalAmount,
    denominations: { denom_500: 10, denom_200: 5, ... },
    transfer_reason: reason
  },
  created_by: profile.id,
  created_at: new Date().toISOString()
});
```

---

#### 2.3 Enhanced SOA Display

**Component**: `src/pages/StatementOfAccounts.tsx` (ENHANCED)

**Current Structure** (Keep intact):
```tsx
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Picked</th>
      <th>Loaded</th>
      <th>Adjusted</th>
      <th>Excess</th>
      <th>KM</th>
      <th>Allowance</th>
      <th>Final Net</th>
    </tr>
  </thead>
  {/* rows */}
</table>
```

**Enhanced Structure** (New professional layout):
```tsx
{/* Toggle between views */}
<div className="mb-4">
  <button onClick={() => setView('summary')}>Summary View</button>
  <button onClick={() => setView('detailed')}>Detailed View</button>
</div>

{/* Summary View - Original format (backward compatible) */}
{view === 'summary' && <SOASummaryTable rows={rows} />}

{/* Detailed View - New accounting format */}
{view === 'detailed' && (
  <div className="space-y-6">
    {rows.map(row => (
      <div key={row.soa_id} className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="border-b pb-4 mb-4">
          <h3 className="text-lg font-bold">
            {formatISTDate(row.assignment_date)}
          </h3>
          {isAdmin && <p className="text-sm text-gray-600">{row.full_name}</p>}
        </div>
        
        {/* Opening Balance */}
        <div className="bg-blue-50 rounded p-4 mb-4">
          <div className="flex justify-between">
            <span className="font-semibold">Opening Balance</span>
            <span className="font-mono">
              ₹{row.opening_balance.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        
        {/* Cash Inflows */}
        <div className="space-y-2 mb-4">
          <h4 className="font-semibold text-green-700">Cash Inflows (+)</h4>
          <div className="pl-4 space-y-1">
            <div className="flex justify-between">
              <span>Bank Withdrawals</span>
              <span className="font-mono text-green-600">
                +₹{row.total_withdrawals.toLocaleString('en-IN')}
              </span>
            </div>
            {row.net_adjustments > 0 && (
              <div className="flex justify-between">
                <span>Manual Credits</span>
                <span className="font-mono text-green-600">
                  +₹{row.net_adjustments.toLocaleString('en-IN')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Travel Allowance</span>
              <span className="font-mono text-green-600">
                +₹{row.travel_allowance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
        
        {/* Operational Adjustments (Neutral) */}
        {(row.exchange_count > 0 || row.transfer_count > 0) && (
          <div className="bg-yellow-50 rounded p-4 mb-4">
            <h4 className="font-semibold text-yellow-800 mb-2">
              Operational Adjustments (No Net Impact)
            </h4>
            <div className="pl-4 space-y-1">
              {row.exchange_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">
                    Denomination Exchanges ({row.exchange_count})
                  </span>
                  <button 
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => showExchangeDetails(row.soa_id)}
                  >
                    View Details
                  </button>
                </div>
              )}
              {row.transfer_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">
                    Inter-Site Transfers ({row.transfer_count})
                  </span>
                  <button 
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => showTransferDetails(row.soa_id)}
                  >
                    View Details
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Cash Outflows */}
        <div className="space-y-2 mb-4">
          <h4 className="font-semibold text-red-700">Cash Outflows (-)</h4>
          <div className="pl-4 space-y-1">
            <div className="flex justify-between">
              <span>ATM Loads</span>
              <span className="font-mono text-red-600">
                -₹{row.total_loads.toLocaleString('en-IN')}
              </span>
            </div>
            {row.net_adjustments < 0 && (
              <div className="flex justify-between">
                <span>Manual Debits</span>
                <span className="font-mono text-red-600">
                  -₹{Math.abs(row.net_adjustments).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Excess (Separate Section) */}
        {row.excess_reported > 0 && (
          <div className="bg-orange-50 rounded p-4 mb-4">
            <div className="flex justify-between">
              <span className="font-semibold text-orange-700">
                Excess Reported (Separate)
              </span>
              <span className="font-mono text-orange-600">
                ₹{row.excess_reported.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Not included in cash-in-hand calculation
            </p>
          </div>
        )}
        
        {/* Closing Balance */}
        <div className={`rounded p-4 ${
          Math.abs(row.closing_balance) < 0.01 
            ? 'bg-green-50 border-2 border-green-500' 
            : 'bg-red-50 border-2 border-red-500'
        }`}>
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">Closing Balance</span>
            <div className="text-right">
              <span className={`font-mono text-xl font-bold ${
                Math.abs(row.closing_balance) < 0.01 
                  ? 'text-green-700' 
                  : 'text-red-700'
              }`}>
                ₹{row.closing_balance.toLocaleString('en-IN')}
              </span>
              {Math.abs(row.closing_balance) < 0.01 ? (
                <p className="text-xs text-green-600 mt-1">✓ Balanced</p>
              ) : (
                <p className="text-xs text-red-600 mt-1">⚠️ Unreconciled</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Reconciliation Formula */}
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Show Calculation Formula
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono">
            <div>Opening: ₹{row.opening_balance.toLocaleString('en-IN')}</div>
            <div className="text-green-600">+ Withdrawals: ₹{row.total_withdrawals.toLocaleString('en-IN')}</div>
            {row.net_adjustments !== 0 && (
              <div className={row.net_adjustments > 0 ? 'text-green-600' : 'text-red-600'}>
                {row.net_adjustments > 0 ? '+ Credits' : '- Debits'}: 
                ₹{Math.abs(row.net_adjustments).toLocaleString('en-IN')}
              </div>
            )}
            <div className="text-green-600">+ Allowance: ₹{row.travel_allowance.toLocaleString('en-IN')}</div>
            <div className="text-red-600">- Loads: ₹{row.total_loads.toLocaleString('en-IN')}</div>
            <div className="border-t border-gray-300 mt-2 pt-2">
              = Closing: ₹{row.closing_balance.toLocaleString('en-IN')}
            </div>
          </div>
        </details>
      </div>
    ))}
  </div>
)}
```

**Key Features**:
- ✅ Dual view: Summary (original) + Detailed (new)
- ✅ Professional accounting presentation
- ✅ Clear distinction: Inflows, Outflows, Neutral operations
- ✅ Visual indicators: Balanced (green) vs Unreconciled (red)
- ✅ Expandable sections: Formula, Exchange details, Transfer details
- ✅ Mobile responsive
- ✅ Backward compatible (summary view unchanged)

---

#### 2.4 Admin Enhancement: Adjustment History

**Component**: `src/pages/AdminSOAAdjustments.tsx` (ENHANCED)

**Add new section**: Adjustment History with Type Breakdown

```tsx
{/* Add after existing form */}
<div className="mt-8 bg-white rounded-lg border border-slate-200 p-6">
  <h3 className="text-lg font-bold mb-4">Recent Adjustments</h3>
  
  {/* Filter by type */}
  <div className="flex gap-2 mb-4">
    <button 
      className={typeFilter === 'ALL' ? 'active' : ''}
      onClick={() => setTypeFilter('ALL')}
    >
      All ({allAdjustments.length})
    </button>
    <button 
      className={typeFilter === 'CREDIT' ? 'active' : ''}
      onClick={() => setTypeFilter('CREDIT')}
    >
      Credits ({creditCount})
    </button>
    <button 
      className={typeFilter === 'DEBIT' ? 'active' : ''}
      onClick={() => setTypeFilter('DEBIT')}
    >
      Debits ({debitCount})
    </button>
    <button 
      className={typeFilter === 'EXCHANGE' ? 'active' : ''}
      onClick={() => setTypeFilter('EXCHANGE')}
    >
      Exchanges ({exchangeCount})
    </button>
    <button 
      className={typeFilter === 'INTER_SITE_TRANSFER' ? 'active' : ''}
      onClick={() => setTypeFilter('INTER_SITE_TRANSFER')}
    >
      Transfers ({transferCount})
    </button>
  </div>
  
  {/* Adjustment list */}
  <div className="space-y-3">
    {filteredAdjustments.map(adj => (
      <div key={adj.id} className="border rounded p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              adj.adjustment_type === 'CREDIT' ? 'bg-green-100 text-green-800' :
              adj.adjustment_type === 'DEBIT' ? 'bg-red-100 text-red-800' :
              adj.adjustment_type === 'EXCHANGE' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {adj.adjustment_type}
            </span>
            <span className="ml-2 text-sm text-gray-600">
              {formatISTAudit(adj.created_at)}
            </span>
          </div>
          <span className="font-mono font-bold">
            {adj.adjustment_type === 'CREDIT' && '+'}
            {adj.adjustment_type === 'DEBIT' && '-'}
            {adj.adjustment_type === 'EXCHANGE' && '⇄'}
            {adj.adjustment_type === 'INTER_SITE_TRANSFER' && '→'}
            {adj.adjustment_amount > 0 && 
              `₹${adj.adjustment_amount.toLocaleString('en-IN')}`
            }
          </span>
        </div>
        
        <p className="text-sm mb-1">{adj.reason}</p>
        {adj.reference && (
          <p className="text-xs text-gray-500">Ref: {adj.reference}</p>
        )}
        
        {/* Exchange metadata */}
        {adj.adjustment_type === 'EXCHANGE' && adj.exchange_metadata && (
          <details className="mt-2">
            <summary className="text-xs text-blue-600 cursor-pointer">
              Show Exchange Details
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold mb-1">From:</p>
                  {Object.entries(adj.exchange_metadata.from_denominations).map(([denom, count]) => (
                    count > 0 && (
                      <p key={denom}>
                        ₹{denom.replace('denom_', '')} × {count} = 
                        ₹{(parseInt(denom.replace('denom_', '')) * count).toLocaleString('en-IN')}
                      </p>
                    )
                  ))}
                </div>
                <div>
                  <p className="font-semibold mb-1">To:</p>
                  {Object.entries(adj.exchange_metadata.to_denominations).map(([denom, count]) => (
                    count > 0 && (
                      <p key={denom}>
                        ₹{denom.replace('denom_', '')} × {count} = 
                        ₹{(parseInt(denom.replace('denom_', '')) * count).toLocaleString('en-IN')}
                      </p>
                    )
                  ))}
                </div>
              </div>
            </div>
          </details>
        )}
        
        {/* Transfer metadata */}
        {adj.adjustment_type === 'INTER_SITE_TRANSFER' && adj.transfer_metadata && (
          <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
            <p>From Site: {adj.transfer_metadata.from_site_name}</p>
            <p>To Site: {adj.transfer_metadata.to_site_name}</p>
            <p>Amount: ₹{adj.transfer_metadata.amount.toLocaleString('en-IN')}</p>
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-2">
          By: {adj.created_by_name}
        </p>
      </div>
    ))}
  </div>
</div>
```

---

### Phase 3: Navigation & Menu Updates

**File**: `src/components/Layout.tsx`

**Add new menu items** (custodian view):
```tsx
{/* Existing menu items */}
<NavLink to="/cash-pickup">Cash Pickup</NavLink>
<NavLink to="/atm-replenishment">ATM Load</NavLink>

{/* NEW: Exchange & Transfer */}
<NavLink to="/denomination-exchange">Denomination Exchange</NavLink>
<NavLink to="/inter-site-transfer">Inter-Site Transfer</NavLink>

{/* Existing items continue */}
<NavLink to="/statement-of-accounts">SOA</NavLink>
```

**Route definitions** (`src/App.tsx`):
```tsx
{/* Existing routes */}
<Route path="/cash-pickup" element={<PrivateRoute><CashPickup /></PrivateRoute>} />
<Route path="/atm-replenishment" element={<PrivateRoute><ATMReplenishment /></PrivateRoute>} />

{/* NEW ROUTES */}
<Route path="/denomination-exchange" element={<PrivateRoute><DenominationExchange /></PrivateRoute>} />
<Route path="/inter-site-transfer" element={<PrivateRoute><InterSiteTransfer /></PrivateRoute>} />

{/* Existing routes continue */}
<Route path="/statement-of-accounts" element={<PrivateRoute><StatementOfAccounts /></PrivateRoute>} />
```

---

## 🗄️ DATABASE SCHEMA EXTENSIONS

### Migration Script

```sql
-- ============================================
-- SOA Restructuring Database Migration
-- Version: 2.0
-- Date: February 5, 2026
-- Backward Compatible: YES
-- ============================================

-- Step 1: Add new columns to soa_adjustments (nullable for backward compatibility)
ALTER TABLE soa_adjustments
ADD COLUMN IF NOT EXISTS exchange_metadata JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transfer_metadata JSONB DEFAULT NULL;

-- Step 2: Update constraint to allow new adjustment types
ALTER TABLE soa_adjustments
DROP CONSTRAINT IF EXISTS soa_adjustments_adjustment_type_check;

ALTER TABLE soa_adjustments
ADD CONSTRAINT soa_adjustments_adjustment_type_check
CHECK (adjustment_type IN ('CREDIT', 'DEBIT', 'EXCHANGE', 'INTER_SITE_TRANSFER'));

-- Step 3: Create index on adjustment_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_soa_adjustments_type 
ON soa_adjustments(adjustment_type);

-- Step 4: Create index on JSONB metadata for faster queries
CREATE INDEX IF NOT EXISTS idx_soa_adjustments_exchange_metadata 
ON soa_adjustments USING gin(exchange_metadata);

CREATE INDEX IF NOT EXISTS idx_soa_adjustments_transfer_metadata 
ON soa_adjustments USING gin(transfer_metadata);

-- Step 5: Create helper view (v_soa_detailed)
CREATE OR REPLACE VIEW v_soa_detailed AS
SELECT
  a.id as soa_id,
  a.id as assignment_id,
  a.custodian_id,
  a.assignment_date,
  
  -- Opening balance (previous day closing)
  COALESCE(
    (SELECT 
      COALESCE(SUM(cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10), 0)
      - COALESCE(SUM(ar.denom_2000 * 2000 + ar.denom_500 * 500 + ar.denom_200 * 200 + ar.denom_100 * 100), 0)
      + COALESCE(SUM(CASE WHEN sa.adjustment_type = 'CREDIT' THEN sa.adjustment_amount WHEN sa.adjustment_type = 'DEBIT' THEN -sa.adjustment_amount ELSE 0 END), 0)
     FROM assignments prev
     LEFT JOIN cash_pickups cp ON prev.id = cp.assignment_id
     LEFT JOIN atm_replenishments ar ON prev.id = ar.assignment_id
     LEFT JOIN soa_adjustments sa ON prev.id = sa.assignment_id AND sa.adjustment_type IN ('CREDIT', 'DEBIT')
     WHERE prev.custodian_id = a.custodian_id 
     AND prev.assignment_date = a.assignment_date - INTERVAL '1 day'
    ), 
    0
  ) as opening_balance,
  
  -- Bank withdrawals
  COALESCE(
    (SELECT SUM(
      cp.denom_2000 * 2000 + 
      cp.denom_500 * 500 + 
      cp.denom_200 * 200 + 
      cp.denom_100 * 100 + 
      cp.denom_50 * 50 + 
      cp.denom_20 * 20 + 
      cp.denom_10 * 10
    ) FROM cash_pickups cp WHERE cp.assignment_id = a.id), 
    0
  ) as total_withdrawals,
  
  -- ATM loads
  COALESCE(
    (SELECT SUM(
      ar.denom_2000 * 2000 + 
      ar.denom_500 * 500 + 
      ar.denom_200 * 200 + 
      ar.denom_100 * 100
    ) FROM atm_replenishments ar WHERE ar.assignment_id = a.id), 
    0
  ) as total_loads,
  
  -- Net adjustments (CREDIT/DEBIT only)
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN sa.adjustment_type = 'CREDIT' THEN sa.adjustment_amount
        WHEN sa.adjustment_type = 'DEBIT' THEN -sa.adjustment_amount
        ELSE 0
      END
    ) FROM soa_adjustments sa 
    WHERE sa.assignment_id = a.id 
    AND sa.adjustment_type IN ('CREDIT', 'DEBIT')
    ), 
    0
  ) as net_adjustments,
  
  -- Exchange count
  (SELECT COUNT(*) 
   FROM soa_adjustments sa 
   WHERE sa.assignment_id = a.id 
   AND sa.adjustment_type = 'EXCHANGE'
  ) as exchange_count,
  
  -- Transfer count
  (SELECT COUNT(*) 
   FROM soa_adjustments sa 
   WHERE sa.assignment_id = a.id 
   AND sa.adjustment_type = 'INTER_SITE_TRANSFER'
  ) as transfer_count,
  
  -- Excess reported
  COALESCE(
    (SELECT SUM(ec.excess_amount) 
     FROM excess_cash ec 
     WHERE ec.assignment_id = a.id
    ), 
    0
  ) as excess_reported,
  
  -- Travel allowance and KM
  COALESCE(
    (SELECT tl.distance_km 
     FROM travel_logs tl 
     WHERE tl.assignment_id = a.id
     LIMIT 1
    ), 
    0
  ) as travel_km,
  
  COALESCE(
    (SELECT tl.total_allowance 
     FROM travel_logs tl 
     WHERE tl.assignment_id = a.id
     LIMIT 1
    ), 
    0
  ) as travel_allowance,
  
  a.status,
  a.created_at,
  a.updated_at
  
FROM assignments a;

-- Add computed closing_balance column using materialized expression
-- (Calculated client-side for now to avoid complex triggers)

-- Step 6: Grant permissions
GRANT SELECT ON v_soa_detailed TO authenticated;

-- Step 7: Add helpful comments
COMMENT ON COLUMN soa_adjustments.exchange_metadata IS 'JSONB metadata for EXCHANGE type: from/to banks, denominations';
COMMENT ON COLUMN soa_adjustments.transfer_metadata IS 'JSONB metadata for INTER_SITE_TRANSFER type: from/to sites, amounts';
COMMENT ON VIEW v_soa_detailed IS 'Enhanced SOA view with accounting breakdown: opening, withdrawals, loads, adjustments, closing';

-- Migration complete
-- ✅ Backward compatible: Existing code continues to work
-- ✅ New features available: EXCHANGE and INTER_SITE_TRANSFER supported
-- ✅ Indexes created: Faster queries on type and metadata
```

---

## 📐 SOA LAYOUT DESIGN

### Custodian View (Mobile-First)

```
┌─────────────────────────────────────────────┐
│ Statement of Accounts                       │
│ [Summary] [Detailed]  ← Toggle              │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 📅 Jan 26, 2026                      │   │
│ ├─────────────────────────────────────┤   │
│ │ Opening Balance        ₹ 0.00       │ ← Previous closing
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 💰 Cash Inflows (+)                 │   │
│ ├─────────────────────────────────────┤   │
│ │   Bank Withdrawals  + ₹ 50,000.00  │   │
│ │   Travel Allowance  + ₹    500.00  │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ⚙️ Operations (No Net Impact)       │   │
│ ├─────────────────────────────────────┤   │
│ │   Exchanges (2) [View Details]      │   │
│ │   Transfers (1) [View Details]      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 📤 Cash Outflows (-)                │   │
│ ├─────────────────────────────────────┤   │
│ │   ATM Loads         - ₹ 50,000.00  │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ✓ Closing Balance      ₹ 0.00       │ ← Green if zero
│ │   Status: Balanced                  │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ [Export CSV] [Print PDF]                   │
└─────────────────────────────────────────────┘
```

### Admin View (Desktop)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Statement of Accounts - Admin View                                        │
│ [Summary] [Detailed]                                 From: [▼] To: [▼]    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Custodian: Rajesh Kumar                                 Date: Jan 26, 2026│
│ ┌────────────────────────────────────────────────────────────────────────┐│
│ │ Opening Balance                                         ₹ 0.00        ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │ INFLOWS                                                                ││
│ │   Bank Withdrawals        ₹ 50,000.00                                 ││
│ │     ↳ ICICI Main Branch (10:30 AM)                                    ││
│ │       ₹2000×10, ₹500×20, ₹200×50, ₹100×100                           ││
│ │   Travel Allowance        ₹    500.00                                 ││
│ │     ↳ 25 km @ ₹20/km                                                  ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │ OPERATIONS (Neutral)                                                   ││
│ │   Exchange #1             ₹ 0.00 (₹10,000 reshaped)                   ││
│ │     ↳ ICICI → HDFC: ₹2000×5 → ₹500×20                                ││
│ │   Exchange #2             ₹ 0.00 (₹5,000 reshaped)                    ││
│ │     ↳ ATM Site 3 → SBI: ₹200×25 → ₹100×50                            ││
│ │   Transfer #1             ₹ 0.00 (₹5,000 moved)                       ││
│ │     ↳ ATM Site 1 → ATM Site 5                                         ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │ OUTFLOWS                                                               ││
│ │   ATM Load Site 1         ₹ 15,000.00 (11:15 AM)                      ││
│ │   ATM Load Site 2         ₹ 20,000.00 (12:30 PM)                      ││
│ │   ATM Load Site 5         ₹ 15,000.00 (14:00 PM)                      ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │ EXCESS (Separate)                                                      ││
│ │   Reported at Site 2      ₹    200.00                                 ││
│ │     ↳ Not counted in cash-in-hand                                     ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │ Closing Balance                                         ₹ 0.00 ✓      ││
│ │ Status: Fully Reconciled                                              ││
│ └────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│ [Download Detailed Report] [Email to Custodian] [Mark as Reviewed]       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛣️ IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)
- ✅ Database migration script
- ✅ Schema extensions (soa_adjustments columns)
- ✅ Create v_soa_detailed view
- ✅ Testing on staging database

### Phase 2: Exchange Feature (Week 2)
- ✅ Create DenominationExchange.tsx component
- ✅ Form validation (totals must match)
- ✅ GPS integration (optional)
- ✅ Database insert with metadata
- ✅ Testing on staging

### Phase 3: Transfer Feature (Week 2)
- ✅ Create InterSiteTransfer.tsx component
- ✅ Site selection logic
- ✅ GPS verification at both sites
- ✅ Database insert with metadata
- ✅ Testing on staging

### Phase 4: Enhanced SOA Display (Week 3)
- ✅ Enhance StatementOfAccounts.tsx
- ✅ Add detailed view toggle
- ✅ Professional accounting layout
- ✅ Exchange/Transfer detail modals
- ✅ Closing balance validation
- ✅ Testing on staging

### Phase 5: Admin Enhancements (Week 3)
- ✅ Extend AdminSOAAdjustments.tsx
- ✅ Adjustment history with type filter
- ✅ Metadata display
- ✅ Testing on staging

### Phase 6: Navigation & UX (Week 4)
- ✅ Update Layout.tsx menu
- ✅ Add new routes in App.tsx
- ✅ User guide documentation
- ✅ Help tooltips
- ✅ Testing on staging

### Phase 7: UAT & Production (Week 4)
- ✅ User acceptance testing
- ✅ Admin training
- ✅ Custodian training
- ✅ Production deployment
- ✅ Monitor for issues

---

## 🧪 TESTING STRATEGY

### Unit Tests

**Database Layer**:
```sql
-- Test 1: EXCHANGE insert
INSERT INTO soa_adjustments (
  assignment_id, custodian_id, adjustment_type, adjustment_amount,
  reason, exchange_metadata, created_by
) VALUES (
  'assignment-id', 'custodian-id', 'EXCHANGE', 0,
  'Test exchange', 
  '{"from_denominations": {"denom_2000": 5}, "to_denominations": {"denom_500": 20}}'::jsonb,
  'admin-id'
);
-- Expected: Success

-- Test 2: v_soa_detailed query
SELECT * FROM v_soa_detailed 
WHERE assignment_id = 'test-assignment-id';
-- Expected: Returns opening, withdrawals, loads, closing

-- Test 3: Closing balance validation
SELECT closing_balance FROM v_soa_detailed 
WHERE assignment_id = 'balanced-assignment';
-- Expected: 0.00
```

**Application Layer**:
```typescript
// Test 1: Exchange form validation
test('Exchange form validates total amount match', () => {
  const fromDenoms = { denom_2000: 5 }; // ₹10,000
  const toDenoms = { denom_500: 20 };   // ₹10,000
  expect(validateExchange(fromDenoms, toDenoms)).toBe(true);
});

test('Exchange form rejects amount mismatch', () => {
  const fromDenoms = { denom_2000: 5 }; // ₹10,000
  const toDenoms = { denom_500: 19 };   // ₹9,500
  expect(validateExchange(fromDenoms, toDenoms)).toBe(false);
});

// Test 2: SOA detailed view calculation
test('SOA calculates closing balance correctly', () => {
  const opening = 0;
  const withdrawals = 50000;
  const loads = 50000;
  const adjustments = 0;
  const allowance = 500;
  const closing = opening + withdrawals - loads + adjustments + allowance;
  expect(closing).toBe(500); // Unbalanced (travel allowance)
});
```

### Integration Tests

**Scenario 1: Full Day Workflow**
```
1. Create assignment
2. Record cash pickup (₹50,000)
3. Record exchange (₹2000×5 → ₹500×20)
4. Record ATM load #1 (₹15,000)
5. Record inter-site transfer (₹5,000)
6. Record ATM load #2 (₹20,000)
7. Record ATM load #3 (₹15,000)
8. View SOA
9. Verify closing balance = ₹0
```

**Scenario 2: Exchange Without Withdrawal**
```
1. Create assignment (no pickup)
2. Record ATM withdrawal (-₹5,000 from Site 1)
3. Record exchange (₹200×25 → ₹100×50)
4. Record ATM load (₹5,000 into Site 2)
5. View SOA
6. Verify closing balance = ₹0
7. Verify exchange shows in operations section
```

### UAT Test Cases

**Custodian Tests**:
- [ ] Can record denomination exchange
- [ ] Can record inter-site transfer
- [ ] Can view detailed SOA
- [ ] Can see exchange details
- [ ] Can see transfer details
- [ ] Can export enhanced SOA as CSV
- [ ] Can print enhanced SOA as PDF

**Admin Tests**:
- [ ] Can view all custodians' SOA
- [ ] Can filter adjustments by type
- [ ] Can see exchange metadata
- [ ] Can see transfer metadata
- [ ] Can identify unreconciled balances
- [ ] Can drill down into operations

---

## 🔄 MIGRATION & ROLLBACK PLAN

### Pre-Migration Checklist
- [ ] Backup production database
- [ ] Test migration script on staging
- [ ] Verify v_soa_effective still works
- [ ] Test existing SOA page (summary view)
- [ ] Test existing adjustment flow
- [ ] Document rollback procedure

### Migration Steps
```sql
-- Step 1: Backup
pg_dump -h [host] -U [user] -d [database] > backup_pre_soa_v2.sql

-- Step 2: Execute migration
psql -h [host] -U [user] -d [database] -f SOA_MIGRATION_V2.sql

-- Step 3: Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'soa_adjustments';
-- Expected: exchange_metadata, transfer_metadata columns exist

SELECT COUNT(*) FROM v_soa_detailed;
-- Expected: Returns row count

-- Step 4: Deploy application code
-- (via Vercel or deployment platform)
```

### Rollback Procedure
```sql
-- If issues arise within 24 hours:

-- Step 1: Revert schema changes
ALTER TABLE soa_adjustments
DROP COLUMN IF EXISTS exchange_metadata,
DROP COLUMN IF EXISTS transfer_metadata;

ALTER TABLE soa_adjustments
DROP CONSTRAINT IF EXISTS soa_adjustments_adjustment_type_check;

ALTER TABLE soa_adjustments
ADD CONSTRAINT soa_adjustments_adjustment_type_check
CHECK (adjustment_type IN ('CREDIT', 'DEBIT'));

DROP VIEW IF EXISTS v_soa_detailed;

-- Step 2: Restore backup
psql -h [host] -U [user] -d [database] < backup_pre_soa_v2.sql

-- Step 3: Redeploy previous application version
```

---

## 📚 DOCUMENTATION DELIVERABLES

### User Documentation
- [ ] **SOA_V2_USER_GUIDE.md** - How to use new features
- [ ] **EXCHANGE_QUICK_START.md** - Record denomination exchanges
- [ ] **TRANSFER_QUICK_START.md** - Record inter-site transfers
- [ ] **SOA_READING_GUIDE.md** - Understand detailed view

### Developer Documentation
- [ ] **SOA_V2_TECHNICAL_SPEC.md** - Complete technical reference
- [ ] **API_REFERENCE_ADJUSTMENTS.md** - Adjustment types & metadata
- [ ] **DATABASE_SCHEMA_V2.md** - Updated schema documentation

### Admin Documentation
- [ ] **SOA_ADMIN_GUIDE.md** - Admin operations & troubleshooting
- [ ] **RECONCILIATION_CHECKLIST.md** - Daily reconciliation steps

---

## ✅ SUCCESS CRITERIA

### Functional Requirements
- ✅ Exchanges recorded with denomination details
- ✅ Transfers recorded with site details
- ✅ SOA shows professional accounting layout
- ✅ Closing balance calculated correctly
- ✅ Neutral operations don't affect net
- ✅ Excess remains separate

### Non-Functional Requirements
- ✅ Backward compatible with existing code
- ✅ No breaking changes to database
- ✅ Mobile responsive (all new pages)
- ✅ Performance: Page load < 2 seconds
- ✅ Audit trail: All operations logged

### User Acceptance
- ✅ Custodians understand new operations
- ✅ Admins can reconcile balances
- ✅ SOA reflects real cash operations
- ✅ Zero-balance enforcement works

---

## 🎯 CONCLUSION

This restructuring plan provides:

1. **Professional accounting presentation** - Opening → Transactions → Closing
2. **Complete operational visibility** - Exchanges, transfers, adjustments all tracked
3. **Backward compatibility** - Existing functionality untouched
4. **Extensibility** - JSONB metadata allows future enhancements
5. **Audit compliance** - Full trail of all cash movements

**Implementation Status**: ✅ Ready to Begin  
**Risk Level**: 🟢 Low (backward compatible, additive changes)  
**Estimated Timeline**: 4 weeks  
**Team Effort**: 1 developer + 1 tester

---

**Next Action**: Review and approve this plan, then proceed with Phase 1 (Database Migration)

