import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

export default function TechnicalIssuesPage() {
  const { profile } = useAuth();
  const [siteId, setSiteId] = useState<number | null>(null);
  const [issueType, setIssueType] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [description, setDescription] = useState("");

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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!assignment || !siteId) return;

      const payload = {
        assignment_id: assignment.id,
        site_id: siteId,
        issue_type: issueType,
        error_code: errorCode,
        description,
      };

      const { error } = await supabase
        .from("technical_issues")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      alert("Technical issue logged");
      setIssueType("");
      setErrorCode("");
      setDescription("");
    },
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <h2 className="text-lg font-semibold mb-2 text-slate-800">
          Technical Support / ATM Issues
        </h2>
        {!assignment && profile?.role === "custodian" && (
          <p className="text-sm text-slate-600">
            No assignment found for today.
          </p>
        )}
        {profile?.role !== "custodian" && (
          <p className="text-xs text-slate-500 mb-4">
            Custodians log on-field issues here. Admin/Supervisor can analyse in reports.
          </p>
        )}
        {assignment && profile?.role === "custodian" && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 border-t-4 border-accent">
            <div>
              <label className="block text-xs mb-1">Site</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={siteId ?? ""}
                onChange={(e) =>
                  setSiteId(
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

            <div>
              <label className="block text-xs mb-1">Issue Type</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
              >
                <option value="">Select</option>
                <option value="dispenser">Dispenser jam / cassette</option>
                <option value="power">Power / UPS / mains</option>
                <option value="hardware">
                  Hardware (screen, card reader, shutter)
                </option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1">Error Code</label>
              <input
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Description</label>
              <textarea
                className="w-full border rounded-lg px-2 py-2 text-sm"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe symptoms, on-screen message, steps taken, etc."
              />
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {mutation.isPending ? "Saving..." : "Log Issue"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
