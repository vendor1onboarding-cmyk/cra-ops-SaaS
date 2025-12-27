import { useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [atmLoads, setAtmLoads] = useState<any[]>([]);
  const [cashPickups, setCashPickups] = useState<any[]>([]);
  const [cashAdjustments, setCashAdjustments] = useState<any[]>([]);

  // --------------------------------------------------
  // Load Custodian Assignment
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadData() {
      setLoading(true);

      const { data: asg } = await supabase
        .from("assignments")
        .select("*")
        .eq("custodian_id", profile.id)
        .in("status", ["open", "submitted"])
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!asg) {
        setAssignment(null);
        setLoading(false);
        return;
      }

      setAssignment(asg);

      const [routes, loads, pickups, adjustments] = await Promise.all([
        supabase
          .from("route_sites")
          .select("site:sites(id, bank_name, address)")
          .eq("assignment_id", asg.id),

        supabase
          .from("atm_replenishments")
          .select("*, site:sites(bank_name, address)")
          .eq("assignment_id", asg.id),

        supabase
          .from("cash_pickups")
          .select("*")
          .eq("assignment_id", asg.id),

        supabase
          .from("atm_cash_adjustments")
          .select("*")
          .eq("assignment_id", asg.id),
      ]);

      setRouteSites(routes.data || []);
      setAtmLoads(loads.data || []);
      setCashPickups(pickups.data || []);
      setCashAdjustments(adjustments.data || []);
      setLoading(false);
    }

    loadData();
  }, [profile]);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  const sumDenoms = (rows: any[]) => ({
    d100: rows.reduce((s, r) => s + (r.denom_100 || 0), 0),
    d200: rows.reduce((s, r) => s + (r.denom_200 || 0), 0),
    d500: rows.reduce((s, r) => s + (r.denom_500 || 0), 0),
    d2000: rows.reduce((s, r) => s + (r.denom_2000 || 0), 0),
  });

  const picked = sumDenoms(cashPickups);
  const loaded = sumDenoms(atmLoads);
  const adjusted = sumDenoms(cashAdjustments);

  const inHand = {
    d100: picked.d100 - loaded.d100 + adjusted.d100,
    d200: picked.d200 - loaded.d200 + adjusted.d200,
    d500: picked.d500 - loaded.d500 + adjusted.d500,
    d2000: picked.d2000 - loaded.d2000 + adjusted.d2000,
  };

  const total = (d: any) =>
    d.d100 * 100 + d.d200 * 200 + d.d500 * 500 + d.d2000 * 2000;

  const loadedSiteIds = atmLoads.map((a) => a.site_id);
  const pendingSites = routeSites.filter(
    (r) => !loadedSiteIds.includes(r.site.id)
  );

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  if (loading) {
    return (
      <AppLayout>
        <div className="text-sm">Loading dashboard…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-primary">
          Today’s Dashboard
        </h2>

        {!assignment && (
          <div className="bg-yellow-100 p-4 rounded text-sm">
            No assignment found for today.
          </div>
        )}

        {assignment && (
          <>
            {/* ================= KPI GRID ================= */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Cash Picked" value={`₹${total(picked)}`} />
              <KPI label="Cash Loaded" value={`₹${total(loaded)}`} />
              <KPI
                label="Cash In Hand"
                value={`₹${total(inHand)}`}
                highlight
              />
              <KPI
                label="ATMs"
                value={`${atmLoads.length} / ${routeSites.length}`}
              />
            </div>

            {/* ========== DENOMINATION CASH POSITION ========= */}
            <div className="bg-white p-4 rounded shadow text-sm">
              <h3 className="font-semibold mb-3">
                Denomination-wise Cash Position
              </h3>
              <table className="w-full border text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">₹100</th>
                    <th className="p-2 border">₹200</th>
                    <th className="p-2 border">₹500</th>
                    <th className="p-2 border">₹2000</th>
                    <th className="p-2 border">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="Picked" d={picked} />
                  <Row label="Loaded" d={loaded} />
                  <Row label="Adjusted" d={adjusted} />
                  <Row label="In Hand" d={inHand} bold />
                </tbody>
              </table>
            </div>

            {/* ========== LOADED ATMs ========= */}
            <div className="bg-white p-4 rounded shadow text-sm">
              <h3 className="font-semibold mb-2">Loaded ATMs</h3>
              {atmLoads.length === 0 && (
                <p className="text-xs text-slate-500">
                  No ATMs loaded yet.
                </p>
              )}
              {atmLoads.map((a) => (
                <div
                  key={a.id}
                  className="border rounded p-2 mb-2"
                >
                  <div className="font-medium">
                    {a.site.bank_name} – {a.site.address}
                  </div>
                  <div className="text-xs mt-1">
                    ₹100:{a.denom_100} | ₹200:{a.denom_200} | ₹500:
                    {a.denom_500} | ₹2000:{a.denom_2000}
                  </div>
                </div>
              ))}
            </div>

            {/* ========== PENDING ATMs ========= */}
            <div className="bg-white p-4 rounded shadow text-sm">
              <h3 className="font-semibold mb-2">Pending ATMs</h3>
              {pendingSites.length === 0 && (
                <p className="text-xs text-green-600">
                  All ATMs loaded.
                </p>
              )}
              <ul className="list-disc ml-5 text-xs">
                {pendingSites.map((s) => (
                  <li key={s.site.id}>
                    {s.site.bank_name} – {s.site.address}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-right">
              <Link
                to="/eod-summary"
                className="text-primary underline text-sm"
              >
                View / Submit EOD Summary
              </Link>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ------------------ Components ------------------ */

function KPI({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded shadow text-center ${
        highlight ? "bg-primary text-white" : "bg-white"
      }`}
    >
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Row({
  label,
  d,
  bold,
}: {
  label: string;
  d: any;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "font-semibold bg-slate-50" : ""}>
      <td className="p-2 border">{label}</td>
      <td className="p-2 border">{d.d100}</td>
      <td className="p-2 border">{d.d200}</td>
      <td className="p-2 border">{d.d500}</td>
      <td className="p-2 border">{d.d2000}</td>
      <td className="p-2 border">₹{total(d)}</td>
    </tr>
  );
}

function total(d: any) {
  return d.d100 * 100 + d.d200 * 200 + d.d500 * 500 + d.d2000 * 2000;
}
