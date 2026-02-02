import { useState, useEffect } from "react";
import { supabase } from "../../api/supabaseClient";

type Site = {
  id: number;
  site_code: string;
  atm_id: string | null;
  bank_name: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function ATMSiteUpdate() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form fields
  const [formData, setFormData] = useState({
    site_code: "",
    atm_id: "",
    bank_name: "",
    address: "",
    city: "",
    latitude: "",
    longitude: "",
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ---------------- Load all sites ---------------- */

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sites")
      .select("id, site_code, atm_id, bank_name, address, city, latitude, longitude")
      .order("site_code");

    if (!error && data) {
      setSites(data);
    }
    setLoading(false);
  }

  /* ---------------- Select site to edit ---------------- */

  function handleSelectSite(siteId: number) {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    setSelectedSiteId(siteId);
    setFormData({
      site_code: site.site_code || "",
      atm_id: site.atm_id || "",
      bank_name: site.bank_name || "",
      address: site.address || "",
      city: site.city || "",
      latitude: site.latitude?.toString() || "",
      longitude: site.longitude?.toString() || "",
    });
    setErrors({});
    setMessage(null);
  }

  /* ---------------- Validation ---------------- */

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.site_code.trim()) {
      newErrors.site_code = "Site Code is required";
    } else if (formData.site_code.length > 100) {
      newErrors.site_code = "Site Code must be ≤ 100 characters";
    }

    if (!formData.bank_name.trim()) {
      newErrors.bank_name = "Bank Name is required";
    } else if (formData.bank_name.length > 100) {
      newErrors.bank_name = "Bank Name must be ≤ 100 characters";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    } else if (formData.address.length > 100) {
      newErrors.address = "Address must be ≤ 100 characters";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    } else if (formData.city.length > 100) {
      newErrors.city = "City must be ≤ 100 characters";
    }

    // GPS validation
    if (!formData.latitude.trim()) {
      newErrors.latitude = "Latitude is required";
    } else {
      const lat = parseFloat(formData.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = "Latitude must be between -90 and 90";
      }
    }

    if (!formData.longitude.trim()) {
      newErrors.longitude = "Longitude is required";
    } else {
      const lng = parseFloat(formData.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = "Longitude must be between -180 and 180";
      }
    }

    // ATM ID (optional, but check length if provided)
    if (formData.atm_id.trim().length > 100) {
      newErrors.atm_id = "ATM ID must be ≤ 100 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /* ---------------- Check for duplicate site_code ---------------- */

  async function checkDuplicateSite(): Promise<boolean> {
    const trimmedCode = formData.site_code.trim();

    // Check if site_code is being changed
    const currentSite = sites.find((s) => s.id === selectedSiteId);
    if (currentSite?.site_code === trimmedCode) {
      // Site code unchanged, no duplicate check needed
      return false;
    }

    // Check if new site_code already exists
    const { data, error } = await supabase
      .from("sites")
      .select("id")
      .eq("site_code", trimmedCode)
      .maybeSingle();

    if (error) {
      console.error("Duplicate check error:", error);
      return false;
    }

    return !!data; // Returns true if duplicate found
  }

  /* ---------------- Submit update ---------------- */

  async function handleSubmit() {
    setMessage(null);

    // UI validation
    if (!validateForm()) {
      setMessage({ type: "error", text: "Please fix validation errors" });
      return;
    }

    if (!selectedSiteId) {
      setMessage({ type: "error", text: "No site selected" });
      return;
    }

    setSaving(true);

    // Business validation: Check for duplicate site_code
    const isDuplicate = await checkDuplicateSite();
    if (isDuplicate) {
      setMessage({ type: "error", text: `Site Code "${formData.site_code.trim()}" already exists` });
      setSaving(false);
      return;
    }

    // Prepare update data
    const updateData = {
      site_code: formData.site_code.trim(),
      atm_id: formData.atm_id.trim() || null,
      bank_name: formData.bank_name.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
    };

    // System validation: Execute update
    const { error } = await supabase
      .from("sites")
      .update(updateData)
      .eq("id", selectedSiteId);

    if (error) {
      console.error("Update error:", error);
      setMessage({ type: "error", text: `Update failed: ${error.message}` });
      setSaving(false);
      return;
    }

    // Success: Reload sites and clear selection
    setMessage({ type: "success", text: "ATM site updated successfully!" });
    setSaving(false);
    await loadSites();
    
    // Reset form
    setSelectedSiteId(null);
    setFormData({
      site_code: "",
      atm_id: "",
      bank_name: "",
      address: "",
      city: "",
      latitude: "",
      longitude: "",
    });
  }

  /* ---------------- Filter sites based on search ---------------- */

  const filteredSites = sites.filter((site) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      site.site_code?.toLowerCase().includes(search) ||
      site.atm_id?.toLowerCase().includes(search) ||
      site.bank_name?.toLowerCase().includes(search) ||
      site.address?.toLowerCase().includes(search) ||
      site.city?.toLowerCase().includes(search)
    );
  });

  /* ---------------- Render ---------------- */

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">📝 Update ATM Site</h3>
        <p className="text-sm text-slate-600">
          Search and select an existing ATM site to update its details. All changes are validated and
          propagate safely to related records.
        </p>
      </div>

      {/* Search & Select Site */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Search Site <span className="text-slate-500">(by code, ATM ID, bank, address, city)</span>
          </label>
          <input
            type="text"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Type to search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading sites...</p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-slate-300 rounded-lg">
            {filteredSites.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">No sites found</p>
            ) : (
              filteredSites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => handleSelectSite(site.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-blue-50 transition-colors ${
                    selectedSiteId === site.id ? "bg-blue-100 font-semibold" : ""
                  }`}
                >
                  <div className="text-sm">
                    <span className="font-medium text-slate-800">{site.site_code}</span>
                    {site.atm_id && (
                      <span className="text-slate-600 ml-2">(ATM: {site.atm_id})</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {site.bank_name} – {site.address}, {site.city}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Form (only show when site selected) */}
      {selectedSiteId && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <h4 className="text-md font-semibold text-slate-800">Edit Site Details</h4>

            {/* Site Code */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Site Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.site_code ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., ATM-MUM-001"
                value={formData.site_code}
                onChange={(e) => setFormData({ ...formData, site_code: e.target.value })}
                maxLength={100}
              />
              {errors.site_code && (
                <p className="text-xs text-red-600 mt-1">{errors.site_code}</p>
              )}
            </div>

            {/* ATM ID */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">ATM ID</label>
              <input
                type="text"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.atm_id ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., ATM123456"
                value={formData.atm_id}
                onChange={(e) => setFormData({ ...formData, atm_id: e.target.value })}
                maxLength={100}
              />
              {errors.atm_id && <p className="text-xs text-red-600 mt-1">{errors.atm_id}</p>}
            </div>

            {/* Bank Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.bank_name ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., State Bank of India"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                maxLength={100}
              />
              {errors.bank_name && (
                <p className="text-xs text-red-600 mt-1">{errors.bank_name}</p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.address ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., 123 Main Street, Andheri West"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                maxLength={100}
              />
              {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.city ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., Mumbai"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                maxLength={100}
              />
              {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}
            </div>

            {/* GPS Coordinates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Latitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.latitude ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="e.g., 19.076090"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
                {errors.latitude && (
                  <p className="text-xs text-red-600 mt-1">{errors.latitude}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Longitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.longitude ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="e.g., 72.877426"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
                {errors.longitude && (
                  <p className="text-xs text-red-600 mt-1">{errors.longitude}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? "Updating..." : "Update Site"}
            </button>

            <button
              onClick={() => {
                setSelectedSiteId(null);
                setFormData({
                  site_code: "",
                  atm_id: "",
                  bank_name: "",
                  address: "",
                  city: "",
                  latitude: "",
                  longitude: "",
                });
                setErrors({});
                setMessage(null);
              }}
              disabled={saving}
              className="px-6 bg-slate-200 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-300 active:scale-95 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}
    </div>
  );
}
