import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

type SOARow = {
  soa_id: number;
  assignment_date: string;
  cash_picked: number;
  cash_loaded: number;
  cash_adjusted: number;
  excess_reported: number;
  travel_km: number;
  travel_allowance: number;
  final_net_cash_position: number;
  posted_at: string;
};

export default function StatementOfAccounts() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SOARow[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (!profile) return;

    async function loadSOA() {
      setLoading(true);

      let query = supabase
        .from("v_soa_effective")
        .select(`
          soa_id,
          assignment_date,
          cash_picked,
          cash_loaded,
          cash_adjusted,
          excess_reported,
          travel_km,
          travel_allowance,
          final_net_cash_position,
          posted_at,
          custodian_id
        `)
        .gte("assignment_date", fromDate)
        .lte("assignment_date", toDate)
        .order("assignment_date", { ascending: false });

      // 🔐 Custodian isolation
      if (profile.role === "custodian") {
        query = query.eq("custodian_id", profile.id);
      }

      const { data, error } = await query;

      if (!error) setRows(data || []);
      setLoading(false);
    }

    loadSOA();
  }, [profile, fromDate, toDate]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.cashPicked += r.cash_picked;
      acc.cashLoaded += r.cash_loaded;
      acc.allowance += r.travel_allowance;
      acc.net += r.final_net_cash_position;
      return acc;
    },
    { cashPicked: 0, cashLoaded: 0, allowance: 0, net: 0 }
  );

  function exportCSV() {
    const header = [
      "Date",
      "Cash Picked",
      "Cash Loaded",
      "Adjusted",
      "Excess",
      "Travel KM",
      "Allowance",
      "Final Net Position",
    ];

    const csv = [
      header.join(","),
      ...rows.map(r =>
        [
          r.assignment_date,
          r.cash_picked,
          r.cash_loaded,
          r.cash_adjusted,
          r.excess_reported,
          r.travel_km,
          r.travel_allowance,
          r.final_net_cash_position,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "statement_of_accounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="container space-y-6">

        {/* ===== Print Header ===== */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-xl font-bold">Statement of Accounts</h1>
          <p className="text-sm">
            Period: {fromDate} to {toDate}
          </p>
        </div>

        <h2 className="text-xl font-semibold text-primary">
          Statement of Accounts
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-sm">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="text-sm">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="input"
            />
          </div>

          <button
            onClick={exportCSV}
            className="btn-secondary ml-auto print:hidden"
          >
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="btn-primary print:hidden"
          >
            Print / PDF
          </button>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Cash Picked" value={totals.cashPicked} />
          <KPI label="Cash Loaded" value={totals.cashLoaded} />
          <KPI label="Travel Allowance" value={totals.allowance} />
          <KPI label="Net Position" value={totals.net} highlight />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-x-auto">
          {loading ? (
            <p className="p-4 text-sm">Loading SOA…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm">No approved records found.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Picked</th>
                  <th className="th">Loaded</th>
                  <th className="th">Adjusted</th>
                  <th className="th">Excess</th>
                  <th className="th">KM</th>
                  <th className="th">Allowance</th>
                  <th className="th">Final Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="td">{r.assignment_date}</td>
                    <td className="td">{r.cash_picked}</td>
                    <td className="td">{r.cash_loaded}</td>
                    <td className="td">{r.cash_adjusted}</td>
                    <td className="td">{r.excess_reported}</td>
                    <td className="td">{r.travel_km}</td>
                    <td className="td">{r.travel_allowance}</td>
                    <td className="td font-semibold">
                      {r.final_net_cash_position}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== Print Footer ===== */}
        <div className="hidden print:flex justify-between mt-10 text-sm">
          <div>
            Custodian Signature: ______________________
          </div>
          <div>
            Authorized Signatory: ______________________
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

function KPI({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "bg-green-50 border-green-400" : "bg-white"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
