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
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-lg font-semibold text-primary">
          Technical Issue Reporting
        </h2>

        {!assignmentId && !loading && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No assignment available for today or route not assigned yet.
          </div>
        )}

        {assignmentId && (
          <>
            <div>
              <label className="text-sm block mb-1">Select Site</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
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
              <label className="text-sm block mb-1">Issue Type</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
              >
                <option value="">-- Select Issue Type --</option>
                <option value="dispenser">Cash Dispenser</option>
                <option value="power">Power / Electrical</option>
                <option value="network">Network / Connectivity</option>
                <option value="hardware">Hardware Fault</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm block mb-1">
                Error Code (optional)
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                placeholder="e.g. ERR-DS-02"
              />
            </div>

            <div>
              <label className="text-sm block mb-1">Description</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue observed at site"
              />
            </div>

            <div>
              <FileUpload onSelect={setPhoto} />
              {photo && (
                <p className="text-xs text-slate-500">
                  Selected: {photo.name}
                </p>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded text-sm"
            >
              {loading ? "Submitting..." : "Report Issue"}
            </button>

            {message && (
              <p className="text-xs text-center text-slate-700">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
