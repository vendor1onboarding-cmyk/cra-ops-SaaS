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
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);
  const [supervisorAssignments, setSupervisorAssignments] = useState<any[]>([]);

  /* --------------------------------------------------
     LOAD DATA
  -------------------------------------------------- */
  useEffect(() => {
    if (!profile) return;

    async function load() {
      setLoading(true);

      // Custodian
      if (profile.role === "custodian") {
        const { data: asg } = await supabase
          .from("assignments")
          .select("*")
          .eq("custodian_id", profile.id)
          .in("status", ["open", "submitted"])
          .order("assignment_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (asg) {
          setAssignment(asg);

          const [routes, loads, pickups, adjustments] =
            await Promise.all([
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
        }
      }

      // Supervisor
      if (profile.role === "supervisor") {
        const { data } = await supabase
          .from("assignments")
          .select(`
            id,
            assignment_date,
            status,
            custodian:profiles!assignments_custodian_id_fkey(full_name),
            atm_replenishments(id),
            cash_pickups(id),
            atm_cash_adjustments(id)
          `)
          .order("assignment_date", { ascending: false });

        setSupervisorAssignments(data || []);
      }

      // Admin
      if (profile.role === "admin") {
        const { data } = await supabase
          .from("assignments")
          .select(`
            id,
            assignment_date,
            status,
            custodian:profiles!assignments_custodian_id_fkey(full_name)
          `)
          .order("assignment_date", { ascending: false });

        setAdminAssignments(data || []);
      }

      setLoading(false);
    }

    load();
  }, [profile]);

  /* --------------------------------------------------
     HELPERS
  -------------------------------------------------- */
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

  /* --------------------------------------------------
     UI
  -------------------------------------------------- */
  if (loading) {
    return (
      <AppLayout>
        <div className="text-sm">Loading dashboard…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* =================== CUSTODIAN =================== */}
      {profile?.role === "custodian" && (
        <div className="space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 p-3 md:p-6 print:bg-white print:p-0">
         <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 print:hidden">
  <h2 className="text-lg md:text-xl font-semibold text-primary">
    Custodian Dashboard – Today
  </h2>

  <button
    onClick={() => window.print()}
    className="self-start md:self-auto px-4 py-1.5 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary/90 shadow"
  >
    Save / Print PDF
  </button>
</div>
          {/* KPI GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="Cash Picked" value={`₹${total(picked)}`} />
            <KPI label="Cash Loaded" value={`₹${total(loaded)}`} />
            <KPI
              label="Cash In Hand"
              value={`₹${total(inHand)}`}
              highlight
            />
            <KPI
              label="ATMs Loaded"
              value={`${atmLoads.length} / ${routeSites.length}`}
            />
          </div>

          {/* DENOMINATION TABLE */}
          <Section title="Denomination-wise Cash Position">
            <DenomTable
              picked={picked}
              loaded={loaded}
              adjusted={adjusted}
              inHand={inHand}
            />
          </Section>

          {/* LOADED ATMs */}
          <Section title="Loaded ATMs (Denomination-wise)">
            <table className="w-full border text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 border">ATM</th>
                  <th className="p-2 border">₹100</th>
                  <th className="p-2 border">₹200</th>
                  <th className="p-2 border">₹500</th>
                  <th className="p-2 border">₹2000</th>
                  <th className="p-2 border">Total</th>
                </tr>
              </thead>
              <tbody>
                {atmLoads.map((a) => (
                  <tr key={a.id}>
                    <td className="p-2 border">
                      {a.site.bank_name} – {a.site.address}
                    </td>
                    <td className="p-2 border">{a.denom_100}</td>
                    <td className="p-2 border">{a.denom_200}</td>
                    <td className="p-2 border">{a.denom_500}</td>
                    <td className="p-2 border">{a.denom_2000}</td>
                    <td className="p-2 border">
                      ₹{a.denom_100 * 100 +
                        a.denom_200 * 200 +
                        a.denom_500 * 500 +
                        a.denom_2000 * 2000}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* PENDING ATMs */}
          <Section title="Pending ATMs">
            <ul className="list-disc ml-5 text-sm">
              {pendingSites.map((s) => (
                <li key={s.site.id}>
                  {s.site.bank_name} – {s.site.address}
                </li>
              ))}
            </ul>
          </Section>

          <div className="text-right">
            <Link to="/eod-summary" className="text-primary underline">
              View / Submit EOD Summary
            </Link>
          </div>
        </div>
      )}

      {/* =================== SUPERVISOR =================== */}
      {profile?.role === "supervisor" && (
        <ReadOnlyTable
          title="Supervisor – Daily Overview"
          rows={supervisorAssignments}
        />
      )}

      {/* =================== ADMIN =================== */}
      {profile?.role === "admin" && (
        <ReadOnlyTable
          title="Admin – Assignment Overview"
          rows={adminAssignments}
          admin
        />
      )}
    </AppLayout>
  );
}

/* ------------------ SHARED COMPONENTS ------------------ */

function KPI({ label, value, highlight }: any) {
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

function Section({ title, children }: any) {
  return (
    <div className="bg-white p-4 rounded shadow text-sm">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DenomTable({ picked, loaded, adjusted, inHand }: any) {
  const rows = [
    ["Picked", picked],
    ["Loaded", loaded],
    ["Adjusted", adjusted],
    ["In Hand", inHand],
  ];

  return (
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
        {rows.map(([label, d]: any) => (
          <tr key={label}>
            <td className="p-2 border font-medium">{label}</td>
            <td className="p-2 border">{d.d100}</td>
            <td className="p-2 border">{d.d200}</td>
            <td className="p-2 border">{d.d500}</td>
            <td className="p-2 border">{d.d2000}</td>
            <td className="p-2 border">
              ₹{d.d100 * 100 + d.d200 * 200 + d.d500 * 500 + d.d2000 * 2000}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReadOnlyTable({ title, rows, admin }: any) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <table className="w-full border text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 border">Date</th>
            <th className="p-2 border">Custodian</th>
            <th className="p-2 border">Status</th>
            {admin && <th className="p-2 border">EOD</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id}>
              <td className="p-2 border">{r.assignment_date}</td>
              <td className="p-2 border">{r.custodian?.full_name}</td>
              <td className="p-2 border capitalize">{r.status}</td>
              {admin && (
                <td className="p-2 border text-center">
                  <Link
                    to={`/admin/approvals`}
                    className="text-primary underline"
                  >
                    View
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
