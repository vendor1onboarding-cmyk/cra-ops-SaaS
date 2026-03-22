import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import AppLayout from "../components/Layout";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { formatISTAudit, formatISTDate } from "../utils/time";

const ADMIN_CORRECTION_TYPE = "ADMIN_CORRECTION";

type Adjustment = {
  id: number;
  assignment_id: number;
  custodian_id: string;
  adjustment_type: "CREDIT" | "DEBIT";
  adjustment_amount: number;
  reason: string;
  reference?: string | null;
  created_at: string;
  created_by?: string | null;
  exchange_metadata?: any;
  requires_custodian_confirmation?: boolean;
  custodian_confirmed?: boolean;
  custodian_confirmed_at?: string | null;
  custodian_signature_url?: string | null;
  created_by_name?: string;
};

export default function CustodianAdjustmentConfirm() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeAdjustment, setActiveAdjustment] = useState<Adjustment | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sigPadRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadAdjustments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadAdjustments() {
    if (!profile) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("soa_adjustments")
        .select(
          "id, assignment_id, custodian_id, adjustment_type, adjustment_amount, reason, reference, created_at, created_by, exchange_metadata, requires_custodian_confirmation, custodian_confirmed"
        )
        .eq("custodian_id", profile.id)
        .eq("requires_custodian_confirmation", true)
        .eq("custodian_confirmed", false)
        .order("created_at", { ascending: false });

      if (queryError) {
        setError("Failed to load pending corrections.");
        console.error("Pending correction query error:", queryError);
        setAdjustments([]);
        return;
      }

      const creatorIds = [...new Set((data || []).map((row: any) => row.created_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        (creators || []).forEach((p: any) => {
          profileMap[p.id] = p.full_name;
        });
      }

      const processed = (data || []).filter((row: any) =>
        row.exchange_metadata?.type === ADMIN_CORRECTION_TYPE
      ).map((row: any) => ({
        ...row,
        created_by_name: profileMap[row.created_by] || "Admin",
      }));

      setAdjustments(processed);
    } catch (err) {
      console.error("Failed to load pending corrections:", err);
      setError("Unexpected error while loading pending corrections.");
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  }

  function openSignatureModal(adj: Adjustment) {
    setActiveAdjustment(adj);
    setSigError(null);
    sigPadRef.current?.clear();
  }

  function closeSignatureModal() {
    setActiveAdjustment(null);
    setSigError(null);
  }

  const resizeSignatureCanvas = () => {
    const pad = sigPadRef.current;
    const wrapper = canvasWrapRef.current;
    if (!pad || !wrapper) return;

    const canvas = pad.getCanvas?.() || pad.canvas;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    if (!width || !height) return;

    const dataUrl = pad.toDataURL?.();

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    pad.clear?.();
    if (dataUrl) pad.fromDataURL?.(dataUrl);
  };

  useEffect(() => {
    if (!activeAdjustment) return;
    resizeSignatureCanvas();
    window.addEventListener("resize", resizeSignatureCanvas);
    return () => window.removeEventListener("resize", resizeSignatureCanvas);
  }, [activeAdjustment]);

  async function validateSignatureNotEmpty(dataUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(true);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let darkPixelCount = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          if (a > 200 && (r < 200 || g < 200 || b < 200)) {
            darkPixelCount++;
          }
        }
        resolve(darkPixelCount > 100);
      };
      img.onerror = () => resolve(true);
      img.src = dataUrl;
    });
  }

  async function confirmAdjustment() {
    if (!activeAdjustment) return;

    const dataUrl = sigPadRef.current?.toDataURL();
    if (!dataUrl) {
      setSigError("Please sign before confirming.");
      return;
    }

    const isValid = await validateSignatureNotEmpty(dataUrl);
    if (!isValid) {
      setSigError("Signature appears empty. Please sign again.");
      return;
    }

    setSubmitting(true);
    setSigError(null);

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `admin-corrections/adjustment_${activeAdjustment.id}_${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("eod-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("eod-signatures")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("soa_adjustments")
        .update({
          custodian_confirmed: true,
          custodian_confirmed_at: new Date().toISOString(),
          custodian_signature_url: data.publicUrl,
        })
        .eq("id", activeAdjustment.id);

      if (updateError) throw updateError;

      closeSignatureModal();
      await loadAdjustments();
    } catch (err) {
      console.error("Failed to confirm adjustment:", err);
      setSigError("Failed to confirm adjustment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function rejectAdjustment(adj: Adjustment) {
    const confirmReject = window.confirm("Reject this correction? It will be returned to admin for review.");
    if (!confirmReject) return;

    try {
      const updatedMeta = {
        ...(adj.exchange_metadata || {}),
        review_status: "rejected",
        review_required: true,
        review_timestamp: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("soa_adjustments")
        .update({
          exchange_metadata: updatedMeta,
          custodian_confirmed: false,
          requires_custodian_confirmation: true,
        })
        .eq("id", adj.id);

      if (updateError) throw updateError;

      await loadAdjustments();
    } catch (err) {
      console.error("Failed to reject adjustment:", err);
      setError("Failed to reject adjustment. Please retry.");
    }
  }

  if (!profile) return null;

  return (
    <AppLayout>
      <div className="container space-y-6 max-w-3xl">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Administrative Corrections
          </h1>
          <p className="text-sm text-slate-600">
            Review and confirm admin corrections to keep your SOA audit safe.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-6 text-sm text-slate-600">
            Loading pending corrections…
          </div>
        ) : adjustments.length === 0 ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-6 text-sm text-emerald-800">
            No pending administrative corrections. You are all clear.
          </div>
        ) : (
          <div className="space-y-4">
            {adjustments.map((adj) => {
              const meta = adj.exchange_metadata || {};
              const deltaTotal = Number(meta.delta_total || 0);
              const originalTotal = Number(meta.original_total || 0);
              const effectiveTotal = Number(meta.effective_total || 0);

              return (
                <div key={adj.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">Reference</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {meta.reference_label || adj.reference || `Adjustment #${adj.id}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Submitted</p>
                      <p className="text-xs font-semibold text-slate-700">{formatISTAudit(adj.created_at)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                      <p className="text-slate-500">Original</p>
                      <p className="font-semibold text-slate-900">₹{originalTotal.toLocaleString("en-IN")}</p>
                      <p className="text-slate-600 mt-1">{meta.original_denominations ? Object.entries(meta.original_denominations).filter(([, v]) => Number(v) !== 0).map(([k, v]) => `${v} × ₹${k.replace("denom_", "")}`).join(", ") : "-"}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                      <p className="text-slate-500">Delta</p>
                      <p className={`font-semibold ${deltaTotal >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {deltaTotal >= 0 ? "+" : "-"}₹{Math.abs(deltaTotal).toLocaleString("en-IN")}
                      </p>
                      <p className="text-slate-600 mt-1">{meta.delta_denominations ? Object.entries(meta.delta_denominations).filter(([, v]) => Number(v) !== 0).map(([k, v]) => `${v} × ₹${k.replace("denom_", "")}`).join(", ") : "-"}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2">
                      <p className="text-slate-500">Effective</p>
                      <p className="font-semibold text-slate-900">₹{effectiveTotal.toLocaleString("en-IN")}</p>
                      <p className="text-slate-600 mt-1">{meta.effective_denominations ? Object.entries(meta.effective_denominations).filter(([, v]) => Number(v) !== 0).map(([k, v]) => `${v} × ₹${k.replace("denom_", "")}`).join(", ") : "-"}</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    <p><span className="font-semibold">Reason:</span> {adj.reason}</p>
                    <p><span className="font-semibold">Admin:</span> {adj.created_by_name}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      onClick={() => openSignatureModal(adj)}
                    >
                      Review & Sign
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => rejectAdjustment(adj)}
                    >
                      Reject & Request Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeAdjustment && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-bold text-slate-900">Custodian Confirmation</h3>
              <button
                className="text-slate-400 hover:text-slate-600 text-2xl"
                onClick={closeSignatureModal}
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                Please sign to acknowledge this administrative correction.
              </p>
              <div
                ref={canvasWrapRef}
                className="border border-slate-300 rounded-lg bg-slate-50 h-48"
              >
                <SignatureCanvas
                  ref={sigPadRef}
                  penColor="black"
                  canvasProps={{
                    width: 1,
                    height: 1,
                    className: "w-full h-full",
                    style: { display: "block", touchAction: "none" },
                  }}
                />
              </div>
              {sigError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {sigError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t bg-slate-50">
              <button
                className="btn-secondary"
                onClick={() => sigPadRef.current?.clear()}
              >
                Clear
              </button>
              <button
                className="btn-primary"
                onClick={confirmAdjustment}
                disabled={submitting}
              >
                {submitting ? "Confirming..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
