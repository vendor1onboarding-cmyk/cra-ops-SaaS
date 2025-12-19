import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

const DENOMS = [2000, 500, 200, 100, 50, 20, 10];

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Custodian state
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [cashUtil, setCashUtil] = useState<any>(null);
  const [siteLoads, setSiteLoads] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  // Admin state
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!profile) return;

    if (profile.role === "custodian") {
      loadCustodianDashboard();
    } else if (profile.role === "admin" || profile.role === "supervisor") {
      loadAdminDashboard();
    }
  }, [profile]);

  // --------------------------------------------------
  // CUSTODIAN DASHBOARD (UNCHANGED LOGIC)
  // --------------------------------------------------
  async function loadCustodianDashboard() {
    setLoading(true);

    const { data: assign } = await supabase
      .from("assignments")
      .select("*")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .eq("status", "open")
      .maybeSingle();

    if (!assign) {
      setAssignment(null);
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const [{ data: rsites }, { data: loads }, { data: plansData }, { data: pickups }] =
      await Promise.all([
        supabase
          .from("route_sites")
          .select("*, site:site_id(site_code, bank_name, address, atm_id)")
          .eq("assignment_id", assign.id)
          .order("sequence_no"),

        supabase
          .from("atm_replenishments")
          .select("*, site:site_id(site_code, bank_name, address, atm_id)")
          .eq("assignment_id", assign.id),

        supabase
          .from("denomination_plans")
          .select("*")
          .eq("assignment_id", assign.id),

        supabase
          .from("cash_pickups")
          .select("*")
          .eq("assignment_id", assign.id),
      ]);

    setRouteSites(rsites || []);
    setSiteLoads(loads || []);
    setPlans(plansData || []);

    computeCashUtil(rsites || [], loads || [], plansData || [], pickups || []);
    setLoading(false);
  }

  function computeCashUtil(
    rsites: any[],
    loads: any[],
    plans: any[],
    pickups: any[]
  ) {
    const totalPicked = pickups.reduce((s, p) => s + (p.total_amount || 0), 0);

    const totalLoaded = loads.reduce(
      (s, l) =>
        s +
        DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );

    const loadedSites = new Set(loads.map(l => l.site_id)).size;
    const remainingSites = rsites.length - loadedSites;

    const remainingCash =
      plans.reduce(
        (s, p) =>
          s +
          DENOMS.reduce((ds, d) => ds + (p[`denom_${d}`] || 0) * d, 0),
        0
      ) - totalLoaded;

    setCashUtil({
      totalPicked,
      totalLoaded,
      cashInHand: totalPicked - totalLoaded,
      remainingCash,
      remainingSites,
    });
  }

  // --------------------------------------------------
  // ADMIN / SUPERVISOR DASHBOARD (FIXED)
  // --------------------------------------------------
  async function loadAdminDashboard() {
    setLoading(true);

    // 1️⃣ Load assignments (NO REST JOIN)
    const { data: assigns, error } = await supabase
      .from("assignments")
      .select("id, assignment_date, status, custodian_id")
      .eq("assignment_date", today);

    if (error) {
      console.error("Admin dashboard load failed", error);
      setAdminAssignments([]);
      setLoading(false);
      return;
    }

    // 2️⃣ Load custodian names
    const custodianIds = Array.from(
      new Set(assigns.map(a => a.custodian_id))
    );

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", custodianIds);

    const profileMap = new Map(
      profilesData?.map(p => [p.id, p.full_name]) || []
    );

    // 3️⃣ Merge
    const merged = assigns.map(a => ({
      ...a,
      custodian_name: profileMap.get(a.custodian_id) || "Custodian",
    }));

    setAdminAssignments(merged);
    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      {loading && <div className="text-center text-sm">Loading…</div>}

      {!loading && profile?.role === "custodian" && assignment && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Cash Utilization – Today</h2>

          {cashUtil && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Box label="Cash Picked" value={`₹${cashUtil.totalPicked.toLocaleString()}`} />
              <Box label="Cash Loaded" value={`₹${cashUtil.totalLoaded.toLocaleString()}`} />
              <Box label="Cash In Hand" value={`₹${cashUtil.cashInHand.toLocaleString()}`} />
              <Box label="Remaining Sites" value={cashUtil.remainingSites} />
            </div>
          )}

          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-2">Route Sites</h3>
            {routeSites.map((rs: any, idx: number) => (
              <div key={rs.id} className="text-sm py-1">
                {idx + 1}. {formatSite(rs.site)}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (profile?.role === "admin" || profile?.role === "supervisor") && (
        <div className="max-w-4xl mx-auto space-y-4">
          <h2 className="text-lg font-semibold">Admin Dashboard – Today</h2>

          {adminAssignments.length === 0 && (
            <div className="p-4 bg-yellow-100 rounded text-sm">
              No assignments for today.
            </div>
          )}

          {adminAssignments.map(a => (
            <div key={a.id} className="p-4 bg-white rounded shadow text-sm">
              <div><strong>Assignment ID:</strong> {a.id}</div>
              <div><strong>Custodian:</strong> {a.custodian_name}</div>
              <div><strong>Status:</strong> {a.status}</div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function Box({ label, value }: any) {
  return (
    <div className="p-3 bg-white rounded shadow text-center">
      <div className="font-bold text-primary">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
