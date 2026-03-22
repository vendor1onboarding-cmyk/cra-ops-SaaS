
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../api/supabaseClient";
import { QRCodeCanvas } from "qrcode.react";
import Layout from "../components/Layout";
import india1Logo from "../assets/india1-logo.png";
import { getISTDateString } from "../utils/time";

// --- Utility: INR number to words (simple, for demo; use a robust lib in prod) ---
function numberToWords(num: number): string {
  // Only supports up to crores for demo
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  }
  return inWords(num) + " Only";
}

const A4_STYLE = {
  width: "210mm",
  minHeight: "297mm",
  margin: "auto",
  background: "white",
  padding: "24px",
  fontFamily: "Times New Roman, Arial, serif",
  fontSize: "13px",
  color: "#222",
  boxSizing: "border-box" as const,
};

export default function CashTransitCertificate() {
  const { profile } = useAuth();
  console.log("🧾 Cash Transit Certificate Page Loaded");
  console.log("🧾 Profile:", profile);
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [denomPlans, setDenomPlans] = useState<any[]>([]);
  const [availableAssignments, setAvailableAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [chequeNo, setChequeNo] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [bankOverride, setBankOverride] = useState("");
  const [printPreview, setPrintPreview] = useState(false);
  const [validation, setValidation] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // --- Fetch available assignments ---
  useEffect(() => {
    async function fetchAvailableAssignments() {
      if (!profile) return;
      
      console.log("🧾 Fetching assignments for custodian:", profile.id);
      
      // Get assignments for the current custodian (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
      
      console.log("🧾 Date filter:", dateFilter);
      
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log("🧾 Session data:", sessionData?.session?.user?.id, "Session error:", sessionError);
      
      try {
        // First try a simple query to see if we can get any data
        const { data: simpleAssignments, error: simpleError } = await supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id")
          .limit(5);
        
        console.log("🧾 Simple query (all assignments):", simpleAssignments, "Error:", simpleError);
        
        // Try query with custodian filter
        const { data: custodianAssignments, error: custodianError } = await supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id")
          .eq("custodian_id", profile.id)
          .limit(5);
        
        console.log("🧾 Custodian query result:", custodianAssignments, "Error:", custodianError);
        
        // Try query without any filters (just to see if table is accessible)
        const { data: allAssignments, error: allError } = await supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id")
          .limit(5);
        
        console.log("🧾 All assignments query result:", allAssignments, "Error:", allError);
        
        // Try minimal query - just id
        const { data: idOnly, error: idError } = await supabase
          .from("assignments")
          .select("id")
          .limit(1);
        
        console.log("🧾 ID only query result:", idOnly, "Error:", idError);
        
        // Test query on profiles table
        const { data: profilesTest, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .limit(1);
        
        console.log("🧾 Profiles test query result:", profilesTest, "Error:", profilesError);
        
        // Then try the full query
        const { data: assignments, error } = await supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id")
          .eq("custodian_id", profile.id)
          .order("assignment_date", { ascending: false })
          .limit(10);
        
        console.log("🧾 Simplified query result:", assignments, "Error:", error);
        
        setAvailableAssignments(assignments || []);
        
        // Auto-select the most recent assignment if available
        if (assignments && assignments.length > 0 && !selectedAssignmentId) {
          setSelectedAssignmentId(assignments[0].id.toString());
        }
      } catch (err) {
        console.error("🧾 Error fetching assignments:", err);
      }
    }
    fetchAvailableAssignments();
  }, [profile]);

  // --- Fetch data for selected assignment ---
  useEffect(() => {
    async function fetchAssignmentData() {
      if (!selectedAssignmentId) {
        setAssignment(null);
        setRouteSites([]);
        setDenomPlans([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // 1. Get the selected assignment
      const { data: assign } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", selectedAssignmentId)
        .single();
      
      setAssignment(assign);
      
      // 2. Route sites
      const { data: sites } = await supabase
        .from("route_sites")
        .select("*, site:site_id(bank_name,address,atm_id)")
        .eq("assignment_id", selectedAssignmentId);
      
      setRouteSites(sites || []);
      
      setRouteSites(sites || []);
      
      // 3. Denomination plans
      const { data: plans } = await supabase
        .from("denomination_plans")
        .select("*")
        .eq("assignment_id", selectedAssignmentId);
      
      setDenomPlans(plans || []);
      console.log("🧾 Loaded data:", { assignment: assign, sites: sites?.length || 0, plans: plans?.length || 0 });
      console.log("🧾 Assignment details:", assign);
      console.log("🧾 Route sites:", sites);
      console.log("🧾 Denomination plans:", plans);
      setLoading(false);
    }
    
    fetchAssignmentData();
  }, [selectedAssignmentId]);

  // --- Data mapping ---
  const tableRows = routeSites.map((row, idx) => {
    const plan = denomPlans.find((p) => p.site_id === row.site_id) || {};
    return {
      atmId: row.site?.atm_id || row.site_id,
      location: row.site?.address || "",
      franchise: "India1 ATM",
      d500: plan.denom_500 || 0,
      d200: plan.denom_200 || 0,
      d100: plan.denom_100 || 0,
      indent: (plan.denom_500 || 0) * 500 + (plan.denom_200 || 0) * 200 + (plan.denom_100 || 0) * 100,
    };
  });
  const total500 = tableRows.reduce((a, r) => a + r.d500, 0);
  const total200 = tableRows.reduce((a, r) => a + r.d200, 0);
  const total100 = tableRows.reduce((a, r) => a + r.d100, 0);
  const totalIndent = tableRows.reduce((a, r) => a + r.indent, 0);

  const validationUrl = assignment
    ? `${window.location.origin}/validate-cash-transit-certificate?assignment_id=${assignment.id}`
    : "https://india1atm.com/validate";

  // --- Validation ---
  useEffect(() => {
    const v: string[] = [];
    if (!assignment) v.push("Please select an assignment");
    if (!denomPlans.length) v.push("No ATM denomination plans found for selected assignment");
    if (totalIndent === 0) v.push("Total indent is zero");
    console.log("🧾 Validation check:", { assignment: !!assignment, denomPlansCount: denomPlans.length, totalIndent, validation: v });
    setValidation(v);
  }, [assignment, denomPlans, totalIndent]);

  // --- Print handler ---
  function handlePrint() {
    setPrintPreview(true);
    setTimeout(() => {
      window.print();
      setPrintPreview(false);
    }, 200);
  }

  if (loading) return <Layout><div>Loading...</div></Layout>;

  // --- Main Render ---
  if (printPreview) {
    // Print-only render without Layout
    return (
      <div style={A4_STYLE as any}>
        {/* --- HEADER WITH LOGO --- */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <img src={india1Logo} alt="India1 ATM Logo" style={{ height: 48, margin: "0 auto 8px auto" }} />
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>INDIA1 ATM</div>
        </div>
        <div style={{ textAlign: "center", fontWeight: 500, fontSize: 15, marginBottom: 12 }}>Cash in Transit Certificate</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div>Authorized Franchisee Name: <b>{profile?.full_name || "-"}</b></div>
          <div>Location: <b>Not specified</b></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div>Cash Withdrawal Bank Name & Location: <b>{bankOverride || "Bank not specified"}</b></div>
          <div>Date: <b>{assignment?.assignment_date || getISTDateString()}</b></div>
        </div>
        {/* --- ATM PLANNING TABLE --- */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 13 }} border={1}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th>ATM ID</th>
              <th>Location</th>
              <th>Franchise</th>
              <th>500</th>
              <th>200</th>
              <th>100</th>
              <th>Today Indent</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={i}>
                <td>{row.atmId}</td>
                <td>{row.location}</td>
                <td>{row.franchise}</td>
                <td>{row.d500}</td>
                <td>{row.d200}</td>
                <td>{row.d100}</td>
                <td>₹{row.indent.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* --- Footer summary --- */}
        <div style={{ marginBottom: 8, fontFamily: "cursive", fontSize: 14 }}>
          500 × {total500} = ₹{(total500 * 500).toLocaleString("en-IN")}<br />
          200 × {total200} = ₹{(total200 * 200).toLocaleString("en-IN")}<br />
          100 × {total100} = ₹{(total100 * 100).toLocaleString("en-IN")}<br />
          <b>TOTAL = ₹{totalIndent.toLocaleString("en-IN")}</b>
        </div>
        {/* --- Cash withdrawal details --- */}
        <div style={{ marginBottom: 8 }}>
          Cash Withdrawal Cheque No: <b>{chequeNo || "________"}</b><br />
          Custodian Name & Mobile No: <b>{profile?.full_name || "-"} {profile?.mobile || ""}</b><br />
          Vehicle No: <b>{vehicleNo || "________"}</b>
        </div>
        {/* --- Main certificate text --- */}
        <div style={{ margin: "16px 0", fontSize: 15, lineHeight: 1.7 }}>
          This is to certify that the amount of <b>Rs {totalIndent.toLocaleString("en-IN")}</b><br />
          (Rupees <b>{numberToWords(totalIndent)}</b>) has been withdrawn from the bank<br />
          for loading into ATM machines as per the plan above. The cash is being transported<br />
          in a secure manner by the authorized custodian.
        </div>
        {/* --- Signatures --- */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ borderBottom: "1px solid #000", width: "120px", margin: "0 auto 8px auto" }}></div>
            <div style={{ fontSize: 12 }}>Custodian Signature</div>
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ borderBottom: "1px solid #000", width: "120px", margin: "0 auto 8px auto" }}></div>
            <div style={{ fontSize: 12 }}>Supervisor Signature</div>
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ borderBottom: "1px solid #000", width: "120px", margin: "0 auto 8px auto" }}></div>
            <div style={{ fontSize: 12 }}>Date</div>
          </div>
        </div>
        {/* --- QR Code --- */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <QRCodeCanvas value={`${validationUrl}`} size={100} />
          <div style={{ fontSize: 10, marginTop: 4 }}>Scan to validate this certificate at:</div>
          <div style={{ fontSize: 10 }}>{validationUrl}</div>
        </div>

        {/* --- Bank seal and signatures --- */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div style={{ border: "1px solid #000", padding: 8, width: "45%" }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Bank Manager Signature</div>
            <div style={{ borderBottom: "1px dashed #000", height: 18, marginBottom: 8 }}></div>
            <div style={{ fontSize: 10 }}>Name: ________________________</div>
          </div>
          <div style={{ border: "1px solid #000", padding: 8, width: "45%" }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Bank Seal</div>
            <div style={{ borderBottom: "1px dashed #000", height: 72 }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-6">
        <h2 className="text-xl font-bold mb-2">Cash in Transit Certificate</h2>
        <div className="mb-4 text-sm text-red-600">
          {validation.map((v) => <div key={v}>⚠️ {v}</div>)}
        </div>
        
        {/* Assignment Selector */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Select Assignment</label>
          <select 
            className="border px-3 py-2 rounded w-full max-w-md" 
            value={selectedAssignmentId} 
            onChange={e => setSelectedAssignmentId(e.target.value)}
          >
            <option value="">-- Select an assignment --</option>
            {availableAssignments.map(assign => (
              <option key={assign.id} value={assign.id}>
                {assign.assignment_date} - Assignment #{assign.id}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold">Cheque No</label>
            <input className="border px-2 py-1 rounded w-40" value={chequeNo} onChange={e => setChequeNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold">Vehicle No</label>
            <input className="border px-2 py-1 rounded w-40" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold">Bank Branch (Override)</label>
            <input className="border px-2 py-1 rounded w-48" value={bankOverride} onChange={e => setBankOverride(e.target.value)} />
          </div>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded shadow" onClick={handlePrint} disabled={!!validation.length}>Generate Letter</button>
        <div className="mt-6 border rounded shadow bg-white print:shadow-none print:border-none print:bg-white" ref={printRef} style={A4_STYLE as any}>
          {/* --- HEADER WITH LOGO --- */}
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <img src={india1Logo} alt="India1 ATM Logo" style={{ height: 48, margin: "0 auto 8px auto" }} />
            <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>INDIA1 ATM</div>
          </div>
          <div style={{ textAlign: "center", fontWeight: 500, fontSize: 15, marginBottom: 12 }}>Cash in Transit Certificate</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>Authorized Franchisee Name: <b>{profile?.full_name || "-"}</b></div>
            <div>Location: <b>Not specified</b></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>Cash Withdrawal Bank Name & Location: <b>{bankOverride || "Bank not specified"}</b></div>
            <div>Date: <b>{assignment?.assignment_date || getISTDateString()}</b></div>
          </div>
          {/* --- ATM PLANNING TABLE --- */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 13 }} border={1}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th>ATM ID</th>
                <th>Location</th>
                <th>Franchise</th>
                <th>500</th>
                <th>200</th>
                <th>100</th>
                <th>Today Indent</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i}>
                  <td>{row.atmId}</td>
                  <td>{row.location}</td>
                  <td>{row.franchise}</td>
                  <td>{row.d500}</td>
                  <td>{row.d200}</td>
                  <td>{row.d100}</td>
                  <td>₹{row.indent.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* --- Footer summary --- */}
          <div style={{ marginBottom: 8, fontFamily: "cursive", fontSize: 14 }}>
            500 × {total500} = ₹{(total500 * 500).toLocaleString("en-IN")}<br />
            200 × {total200} = ₹{(total200 * 200).toLocaleString("en-IN")}<br />
            100 × {total100} = ₹{(total100 * 100).toLocaleString("en-IN")}<br />
            <b>TOTAL = ₹{totalIndent.toLocaleString("en-IN")}</b>
          </div>
          {/* --- Cash withdrawal details --- */}
          <div style={{ marginBottom: 8 }}>
            Cash Withdrawal Cheque No: <b>{chequeNo || "________"}</b><br />
            Custodian Name & Mobile No: <b>{profile?.full_name || "-"} {profile?.mobile || ""}</b><br />
            Vehicle No: <b>{vehicleNo || "________"}</b>
          </div>
          {/* --- Main certificate text --- */}
          <div style={{ margin: "16px 0", fontSize: 15, lineHeight: 1.7 }}>
            This is to certify that the amount of <b>Rs {totalIndent.toLocaleString("en-IN")}</b><br />
            is withdrawn from <b>{bankOverride || "Bank not specified"}</b> and handed over to<br />
            Mr. <b>{profile?.full_name || "-"}</b> (Custodian) of India1 ATM<br />
            to load our ATM’s located at the above points<br />
            and the route details have been mentioned above.
          </div>
          {/* --- Route map table (second page style) --- */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 13 }} border={1}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th>S.No</th>
                <th>ATM ID</th>
                <th>Location</th>
                <th>Purpose</th>
                <th>100</th>
                <th>200</th>
                <th>500</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.atmId}</td>
                  <td>{row.location}</td>
                  <td>Cash Replenish</td>
                  <td>{row.d100}</td>
                  <td>{row.d200}</td>
                  <td>{row.d500}</td>
                  <td>₹{row.indent.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* --- Total summary row --- */}
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            Total Amount: ₹{totalIndent.toLocaleString("en-IN")}<br />
            Day End: ₹{totalIndent.toLocaleString("en-IN")}
          </div>
          {/* --- Signature section --- */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
            <div>
              Cash Picked up by:<br />
              <b>{profile?.full_name || "________"}</b>
            </div>
            <div>
              Cash Handed over by:<br />
              <b>Bank Manager Name</b>
            </div>
            <div>
              Signature / Seal:<br />
              <div style={{ border: "1px solid #222", width: 100, height: 50, marginTop: 4 }}></div>
              <span style={{ fontSize: 11, color: "#888" }}>(Bank Stamp area)</span>
            </div>
          </div>
          <div style={{ marginTop: 24, textAlign: "right" }}>
            Custodian Signature:<br />
            <b>{profile?.full_name || "________"}</b>
          </div>
          {/* --- QR code and total in words --- */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontStyle: "italic" }}>Total in words: <b>{numberToWords(totalIndent)}</b></div>
            </div>
            <div>
              <QRCodeCanvas value={assignment?.id ? String(assignment.id) : ""} size={64} />
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">Mobile preview is print-optimized. Please use A4 paper for best results.</div>
      </div>
    </Layout>
  );
}
