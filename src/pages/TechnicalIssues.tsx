import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import FileUpload from "../components/FileUpload";
import { getISTDateString } from "../utils/time";

type SiteOption = {
  site_id: number;
  display_label: string;
};

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function TechnicalIssues() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<number | null>(null);

  const [issueType, setIssueType] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = getISTDateString();

  // --------------------------------------------------
  // Load TODAY's assignment and sites (DATE-FIRST)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadAssignmentAndSites() {
      setLoading(true);

      const { data: assignment } = await supabase
        .from("assignments")
        .select(`
          id,
          route_sites (
            site_id,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id
            )
          )
        `)
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!assignment) {
        setAssignmentId(null);
        setSites([]);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      const mappedSites: SiteOption[] =
        assignment.route_sites?.map((r: any) => ({
          site_id: r.site_id,
          display_label: formatSite(r.site),
        })) || [];

      setSites(mappedSites);
      setLoading(false);
    }

    loadAssignmentAndSites();
  }, [profile]);

  // --------------------------------------------------
  // Save Technical Issue
  // --------------------------------------------------
  async function handleSave() {
    if (!assignmentId || !selectedSite || !issueType) {
      setMessage("Assignment, Site, and Issue Type are required");
      return;
    }

    setLoading(true);
    setMessage(null);

    let photoUrl: string | null = null;

    // Upload photo if selected
    if (photo) {
      const fileName = `issue-${Date.now()}-${photo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("issue-photos")
        .upload(fileName, photo);

      if (uploadError) {
        setMessage("Photo upload failed");
        setLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("issue-photos")
        .getPublicUrl(fileName);

      photoUrl = data.publicUrl;
    }

    const { error } = await supabase.from("technical_issues").insert({
      assignment_id: assignmentId,
      site_id: selectedSite,
      issue_type: issueType,
      error_code: errorCode || null,
      description,
      status: "new",
      photo_url: photoUrl,
    });

    if (error) {
      console.error(error);
      setMessage("Failed to report issue");
    } else {
      setMessage("Issue reported successfully");
      setIssueType("");
      setErrorCode("");
      setDescription("");
      setPhoto(null);
      setSelectedSite(null);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            Technical Issue Reporting
          </h2>
          <p className="text-sm text-slate-600">
            Report any technical issues encountered at ATM sites
          </p>
        </div>

        {!assignmentId && !loading && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="font-semibold">ℹ️ No assignment available</span> for today or route not assigned yet.
          </div>
        )}

        {assignmentId && (
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Site <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedSite ?? ""}
                  onChange={(e) => setSelectedSite(Number(e.target.value))}
                >
                  <option value="">-- Select Site --</option>
                  {sites.map((s) => (
                    <option key={s.site_id} value={s.site_id}>
                      {s.display_label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Issue Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                >
                  <option value="">-- Select Issue Type --</option>
                  <option value="dispenser">💵 Cash Dispenser</option>
                  <option value="power">⚡ Power / Electrical</option>
                  <option value="network">📶 Network / Connectivity</option>
                  <option value="hardware">🔧 Hardware Fault</option>
                  <option value="other">❓ Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Error Code (optional)
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  placeholder="e.g. ERR-DS-02"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue observed at site..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Attach Photo (optional)
                </label>
                <FileUpload onSelect={setPhoto} />
                {photo && (
                  <p className="text-xs text-slate-500 mt-2">
                    ✓ Selected: {photo.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {loading ? "Submitting..." : "Report Issue"}
              </button>
            </div>

            {message && (
              <p className={`text-sm text-center p-3 rounded-lg ${
                message.includes("success")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
