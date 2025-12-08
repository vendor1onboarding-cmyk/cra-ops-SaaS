import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import { useAuth } from "../context/AuthContext";

export default function DenominationPlanPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: assignment } = useQuery({
    queryKey: ["current-assignment", profile?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("assignment_date", today)
        .eq("custodian_id", profile?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile && profile.role === "custodian",
  });

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites").select("*");
      if (error) throw error;
      return data;
    },
  });

  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [hasSourceReport, setHasSourceReport] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [denoms, setDenoms] = useState<Record<string, number>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      if (!assignment || !selectedSiteId) return;

      const payload = {
        assignment_id: assignment.id,
        site_id: selectedSiteId,
        has_source_report: hasSourceReport,
        remarks,
        ...denoms,
      };

      const { error } = await supabase
        .from("denomination_plans")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["denomination_plans"] });
      alert("Denomination plan saved");
      setRemarks("");
      setDenoms({});
    },
  });

  const handleDenomChange = (name: string, value: number) => {
    setDenoms((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <h2 className="text-lg font-semibold mb-2 text-slate-800">
          Denomination Planning (Morning)
        </h2>
        {!assignment && profile?.role === "custodian" && (
          <p className="text-sm text-slate-600">
            No assignment found for today.
          </p>
        )}
        {profile?.role !== "custodian" && (
          <p className="text-xs text-slate-500 mb-4">
            Only custodians capture denomination planning. Admin/Supervisor can
            review via Supabase or future admin screens.
          </p>
        )}
        {assignment && profile?.role === "custodian" && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 border-t-4 border-accent">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-semibold">Assignment:</span>{" "}
                {assignment.title || assignment.id}
              </p>
              <p className="text-xs text-slate-500">
                Select site and plan denominations for the first load.
              </p>
            </div>

            <div>
              <label className="block text-xs mb-1">Site</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={selectedSiteId ?? ""}
                onChange={(e) =>
                  setSelectedSiteId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">Select site</option>
                {sites?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.site_code} - {s.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input
                id="hasSource"
                type="checkbox"
                checked={hasSourceReport}
                onChange={(e) => setHasSourceReport(e.target.checked)}
              />
              <label htmlFor="hasSource">
                Source report available (uncheck if report not available, use fallback logic)
              </label>
            </div>

            <DenominationFields
              values={denoms}
              onChange={handleDenomChange}
            />

            <div>
              <label className="block text-xs mb-1">Remarks</label>
              <textarea
                className="w-full border rounded-lg px-2 py-2 text-sm"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Festive / weekend load, high cash-out risk, etc."
              />
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={!selectedSiteId || mutation.isPending}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {mutation.isPending ? "Saving..." : "Save Plan"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
