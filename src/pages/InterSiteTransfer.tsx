import { useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";

type Site = {
  id: number;
  bank_name: string;
  address: string;
};

type Denoms = {
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_2000: number;
};

const EMPTY_DENOMS: Denoms = {
  denom_100: 0,
  denom_200: 0,
  denom_500: 0,
  denom_2000: 0,
};

function denomTotal(denoms: Denoms) {
  return (
    denoms.denom_100 * 100 +
    denoms.denom_200 * 200 +
    denoms.denom_500 * 500 +
    denoms.denom_2000 * 2000
  );
}

export default function InterSiteTransfer() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [soaId, setSoaId] = useState<number | null>(null);
  const [sites, setSites] = useState<Site[]>([]);

  const [fromSiteId, setFromSiteId] = useState<number | null>(null);
  const [toSiteId, setToSiteId] = useState<number | null>(null);
  const [reason, setReason] = useState("Inter-site transfer");
  const [reference, setReference] = useState("");

  const [denoms, setDenoms] = useState<Denoms>(EMPTY_DENOMS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    async function loadAssignment() {
      setLoading(true);
      setError(null);

      const today = getISTDateString();

      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .single();

      if (assignmentError || !assignment) {
        setError("No active assignment found for today.");
        setAssignmentId(null);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      const { data: siteData, error: siteError } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address)")
        .eq("assignment_id", assignment.id);

      if (siteError) {
        setError("Unable to load sites for this assignment.");
        setSites([]);
      } else {
        setSites((siteData || []).map((r: any) => r.site));
      }

      const { data: soaData, error: soaError } = await supabase
        .from("v_soa_effective")
        .select("soa_id")
        .eq("assignment_id", assignment.id)
        .maybeSingle();

      if (soaError || !soaData) {
        setWarning(
          "SOA view not available yet for this assignment. Using assignment ID for posting."
        );
        setSoaId(assignment.id);
        setLoading(false);
        return;
      }

      setSoaId(soaData.soa_id);
      setWarning(null);
      setLoading(false);
    }

    loadAssignment();
  }, [profile]);

  const total = useMemo(() => denomTotal(denoms), [denoms]);

  const fromSite = sites.find((s) => s.id === fromSiteId);
  const toSite = sites.find((s) => s.id === toSiteId);

  const canSubmit =
    !saving &&
    assignmentId &&
    soaId &&
    fromSiteId &&
    toSiteId &&
    fromSiteId !== toSiteId &&
    reason.trim().length > 0 &&
    total > 0;

  async function handleSubmit() {
    if (!canSubmit || !profile) return;

    setSaving(true);
    setError(null);
    setWarning(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase
        .from("soa_adjustments")
        .insert({
          soa_id: soaId,
          assignment_id: assignmentId,
          custodian_id: profile.id,
          adjustment_type: "INTER_SITE_TRANSFER",
          adjustment_amount: 0,
          reason: reason.trim(),
          reference: reference.trim() || null,
          created_by: profile.id,
          transfer_metadata: {
            from_site_id: fromSite?.id,
            to_site_id: toSite?.id,
            from_site_name: fromSite
              ? `${fromSite.bank_name} – ${fromSite.address}`
              : undefined,
            to_site_name: toSite
              ? `${toSite.bank_name} – ${toSite.address}`
              : undefined,
            amount: total,
            denominations: denoms,
            transfer_reason: reason.trim(),
            transfer_time: new Date().toISOString(),
          },
        });

      if (insertError) {
        setError(insertError.message || "Failed to record transfer.");
        setSaving(false);
        return;
      }

      setSuccess("Inter-site transfer recorded successfully.");
      setFromSiteId(null);
      setToSiteId(null);
      setReason("Inter-site transfer");
      setReference("");
      setDenoms(EMPTY_DENOMS);
    } catch (err) {
      setError("Unexpected error while saving transfer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Inter-Site Transfer
          </h1>
          <p className="text-sm text-slate-600">
            Record cash movement between sites without affecting net position.
          </p>
        </div>

        {loading && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            Loading assignment details…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {warning && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            ⚠️ {warning}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                From Site <span className="text-red-600">*</span>
              </label>
              <select
                className="input w-full"
                value={fromSiteId ?? ""}
                onChange={(e) => setFromSiteId(Number(e.target.value) || null)}
              >
                <option value="">-- Select site --</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.bank_name} – {site.address}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                To Site <span className="text-red-600">*</span>
              </label>
              <select
                className="input w-full"
                value={toSiteId ?? ""}
                onChange={(e) => setToSiteId(Number(e.target.value) || null)}
              >
                <option value="">-- Select site --</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.bank_name} – {site.address}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Reason <span className="text-red-600">*</span>
              </label>
              <input
                className="input w-full"
                placeholder="Reason for transfer"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Reference (Optional)
              </label>
              <input
                className="input w-full"
                placeholder="Reference ID or note"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Transfer Denominations
            </h2>
            <span className="text-sm font-semibold text-slate-600">
              ₹{total.toLocaleString("en-IN")}
            </span>
          </div>
          <DenominationFields
            values={denoms}
            onChange={(name, value) =>
              setDenoms({
                ...denoms,
                [name]: value,
              })
            }
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Transfer Validation</span>
            <span
              className={`font-semibold ${
                total > 0 && fromSiteId && toSiteId && fromSiteId !== toSiteId
                  ? "text-green-600"
                  : "text-amber-600"
              }`}
            >
              {total === 0
                ? "Enter denominations to proceed"
                : fromSiteId === toSiteId
                ? "From and To sites must differ"
                : "Ready to submit"}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full btn-primary"
          >
            {saving ? "Saving…" : "Record Transfer"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
