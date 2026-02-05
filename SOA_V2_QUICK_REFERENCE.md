# 📘 SOA V2 - QUICK REFERENCE GUIDE
## Enterprise Cash Flow Accounting

**Last Updated**: February 5, 2026  
**Version**: 2.0  

---

## 🎯 WHAT'S NEW

### For Custodians
- ✅ **Denomination Exchange** - Record bank-to-bank or ATM-to-bank denomination changes
- ✅ **Inter-Site Transfer** - Record ATM-to-ATM cash movements
- ✅ **Enhanced SOA View** - Professional accounting presentation with detailed breakdown

### For Admins
- ✅ **Adjustment History** - Filter by type (CREDIT, DEBIT, EXCHANGE, TRANSFER)
- ✅ **Metadata Viewing** - See denomination details in exchanges and transfers
- ✅ **Reconciliation Tools** - Easily identify unbalanced accounts

---

## 📊 SOA STRUCTURE (NEW)

### Professional Accounting Format

```
┌─────────────────────────────────────┐
│ Opening Balance         ₹ 0.00     │ ← Previous day closing
├─────────────────────────────────────┤
│ INFLOWS (+)                         │
│   Bank Withdrawals   +₹50,000.00   │
│   Travel Allowance   +₹   500.00   │
├─────────────────────────────────────┤
│ OPERATIONS (Neutral - No Net Impact)│
│   Exchanges (2)      [View Details]│
│   Transfers (1)      [View Details]│
├─────────────────────────────────────┤
│ OUTFLOWS (-)                        │
│   ATM Loads          -₹50,000.00   │
├─────────────────────────────────────┤
│ Closing Balance         ₹ 0.00  ✓  │ ← Should be ZERO
└─────────────────────────────────────┘
```

---

## 🔄 ADJUSTMENT TYPES

### 1. CREDIT (Financial)
**Purpose**: Add cash to custodian's account  
**Net Impact**: **INCREASES** closing balance  
**Example**: Correction for missing pickup  
**UI Color**: 🟢 Green

### 2. DEBIT (Financial)
**Purpose**: Deduct cash from custodian's account  
**Net Impact**: **DECREASES** closing balance  
**Example**: Correction for duplicate entry  
**UI Color**: 🔴 Red

### 3. EXCHANGE (Operational)
**Purpose**: Record denomination reshaping  
**Net Impact**: **NEUTRAL** (₹0)  
**Example**: ₹2000×5 → ₹500×20  
**UI Color**: 🟡 Yellow

### 4. INTER_SITE_TRANSFER (Operational)
**Purpose**: Record cash movement between ATMs  
**Net Impact**: **NEUTRAL** (₹0)  
**Example**: Site 1 → Site 2 (₹5,000)  
**UI Color**: 🔵 Blue

---

## 📱 CUSTODIAN WORKFLOWS

### Workflow 1: Record Denomination Exchange

**Scenario**: You withdrew ₹2000 notes but bank wants ₹500 notes

1. Navigate to **Denomination Exchange**
2. Select exchange type: "Bank to Bank"
3. Enter **FROM** denominations:
   - ₹2000 × 5 = ₹10,000
4. Enter **TO** denominations:
   - ₹500 × 20 = ₹10,000
5. System validates: ✓ Totals match (₹10,000)
6. Add location and reason
7. Click "Save Exchange"
8. ✓ Exchange recorded (shows in SOA Operations section)

**Result**: Total cash unchanged, denominations updated

---

### Workflow 2: Record Inter-Site Transfer

**Scenario**: Move ₹5,000 from low-traffic ATM to high-traffic ATM

1. Navigate to **Inter-Site Transfer**
2. Select **FROM** site: ATM Site 1
3. Select **TO** site: ATM Site 5
4. Enter denominations being moved:
   - ₹500 × 10 = ₹5,000
5. Enter reason: "Rebalancing inventory"
6. Click "Save Transfer"
7. ✓ Transfer recorded (shows in SOA Operations section)

**Result**: Total cash unchanged, site allocation updated

---

### Workflow 3: View Enhanced SOA

1. Navigate to **Statement of Accounts**
2. Toggle view: [Summary] → [Detailed]
3. See professional accounting layout:
   - Opening balance
   - Inflows (withdrawals, allowance)
   - Operations (exchanges, transfers)
   - Outflows (ATM loads)
   - Closing balance (should be ₹0)
4. Click "View Details" on exchanges/transfers to see denominations
5. Export as CSV or Print as PDF

**Result**: Complete visibility into cash flow

---

## 🎯 ADMIN WORKFLOWS

### Workflow 1: Review Adjustment History

1. Navigate to **SOA Adjustments** (admin menu)
2. Scroll to **Recent Adjustments** section
3. Filter by type:
   - [All] [Credits] [Debits] [Exchanges] [Transfers]
4. Click "Show Exchange Details" to see denominations
5. Verify metadata is complete

**Result**: Full audit trail of all adjustments

---

### Workflow 2: Identify Unreconciled Accounts

1. Navigate to **Statement of Accounts**
2. Toggle to [Detailed] view
3. Look for:
   - 🔴 Red closing balance (not zero)
   - ⚠️ "Unreconciled" warning
4. Drill down into transactions:
   - Check withdrawals vs loads
   - Verify adjustments
   - Review operations
5. Use manual adjustment if needed

**Result**: Balanced accounts

---

## 🧮 CLOSING BALANCE FORMULA

```
Opening Balance (Previous day closing)
+ Bank Withdrawals (cash_pickups)
+ Manual Credits
+ Travel Allowance
- ATM Loads (atm_replenishments)
- Manual Debits
= Closing Balance (MUST BE ₹0 at EOD)
```

**Note**: Exchanges and Transfers do NOT affect this calculation

---

## 💡 COMMON SCENARIOS

### Scenario 1: Exchange Without Withdrawal

**Situation**: Need to reshape existing ATM cash

**Steps**:
1. Record ATM withdrawal (negative, using ATM Excess/Adjustment)
2. Record exchange (ATM → Bank → denominations changed)
3. Record ATM load (new denominations)

**Net Effect**: ₹0 (balanced)

---

### Scenario 2: Full Day Workflow

**Morning**:
1. Record cash pickup from bank (₹50,000)

**Mid-Day**:
2. Record exchange (₹2000 → ₹500)
3. Record ATM Load Site 1 (₹15,000)

**Afternoon**:
4. Record inter-site transfer (Site 1 → Site 2, ₹5,000)
5. Record ATM Load Site 2 (₹20,000)
6. Record ATM Load Site 3 (₹15,000)

**End-of-Day**:
7. View SOA → Verify closing balance = ₹0

**Result**: Fully reconciled day

---

## 🔍 TROUBLESHOOTING

### Issue: Closing Balance Not Zero

**Causes**:
- Missing ATM load entry
- Travel allowance added but not expected
- Manual adjustment error
- Excess reported but counted as cash-in-hand

**Solutions**:
1. Review all ATM loads for the day
2. Verify travel allowance is correct
3. Check manual adjustments
4. Ensure excess is in separate bucket

---

### Issue: Exchange Amounts Don't Match

**Error**: "From and To amounts must match"

**Solution**:
1. Recalculate FROM total:
   - ₹2000×5 = ₹10,000
2. Recalculate TO total:
   - ₹500×20 = ₹10,000
3. Ensure they match exactly
4. Check for typos in counts

---

### Issue: Can't See Exchange Details

**Cause**: Using Summary view

**Solution**:
1. Toggle to [Detailed] view
2. Look for "Operations (Neutral)" section
3. Click "View Details" button
4. Metadata will expand

---

## 📋 DATA VALIDATION RULES

### Exchange
- ✅ FROM total = TO total (exact match)
- ✅ At least one FROM denomination > 0
- ✅ At least one TO denomination > 0
- ✅ Location fields required

### Transfer
- ✅ FROM site ≠ TO site (different sites)
- ✅ At least one denomination > 0
- ✅ Reason field required
- ✅ Both sites exist in today's assignment

### Manual Adjustment
- ✅ Amount ≠ 0 (non-zero)
- ✅ Reason field required (min 10 characters)
- ✅ Reference field optional

---

## 🎨 UI COLOR CODING

### SOA Display

**Green** 🟢
- Inflows (withdrawals, credits, allowance)
- Balanced closing balance (₹0)

**Yellow** 🟡
- Operations section (exchanges, transfers)
- Neutral impact indicators

**Red** 🔴
- Outflows (ATM loads, debits)
- Unreconciled closing balance (≠ ₹0)

**Blue** 🔵
- Opening balance
- Information sections

**Orange** 🟠
- Excess reported (separate bucket)

---

## 🗓️ DAILY CHECKLIST

### For Custodians

**Morning**:
- [ ] Record cash pickups
- [ ] Note denominations received

**During Day**:
- [ ] Record exchanges if needed
- [ ] Record ATM loads immediately
- [ ] Record transfers if reshaping inventory

**End of Day**:
- [ ] View SOA (detailed)
- [ ] Verify closing balance = ₹0
- [ ] If not balanced, review transactions
- [ ] Report discrepancies to supervisor

### For Admins

**Daily**:
- [ ] Review all custodian SOAs
- [ ] Identify unreconciled balances
- [ ] Verify exchange/transfer metadata
- [ ] Approve or flag unusual adjustments

**Weekly**:
- [ ] Audit adjustment history
- [ ] Check for patterns or issues
- [ ] Generate summary reports

---

## 📞 SUPPORT

### Questions?

**Custodian Issues**: Contact your supervisor  
**Technical Issues**: IT support  
**Training**: Review user guide documentation

### Documentation

- **Full Guide**: SOA_V2_USER_GUIDE.md
- **Exchange Guide**: EXCHANGE_QUICK_START.md
- **Transfer Guide**: TRANSFER_QUICK_START.md
- **Technical Spec**: SOA_V2_TECHNICAL_SPEC.md

---

## ✅ QUICK TIPS

1. **Always verify totals** before saving exchanges
2. **Use detailed view** for full visibility
3. **Record immediately** - don't wait until EOD
4. **Check closing balance** daily
5. **Ask if unsure** - better safe than sorry

---

**Version**: 2.0  
**Effective**: February 2026  
**Status**: Production Ready ✅
