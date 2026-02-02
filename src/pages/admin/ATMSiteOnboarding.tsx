import { useState } from "react";
import { supabase } from "../../api/supabaseClient";

interface SiteFormData {
  site_code: string;
  atm_id: string;
  bank_name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
}

interface ValidationError {
  field: keyof SiteFormData;
  message: string;
}

const INITIAL_FORM_DATA: SiteFormData = {
  site_code: "",
  atm_id: "",
  bank_name: "",
  address: "",
  city: "",
  latitude: "",
  longitude: "",
};

export default function ATMSiteOnboarding() {
  const [formData, setFormData] = useState<SiteFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateField = (field: keyof SiteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    setErrors((prev) => prev.filter((e) => e.field !== field));
    setSuccessMessage(null);
  };

  const validateForm = (): ValidationError[] => {
    const newErrors: ValidationError[] = [];

    // Site Code - Required, alphanumeric with hyphens/underscores
    if (!formData.site_code.trim()) {
      newErrors.push({ field: "site_code", message: "Site Code is required" });
    } else if (!/^[A-Za-z0-9_-]+$/.test(formData.site_code)) {
      newErrors.push({
        field: "site_code",
        message: "Site Code must be alphanumeric (letters, numbers, -, _)",
      });
    } else if (formData.site_code.length > 50) {
      newErrors.push({
        field: "site_code",
        message: "Site Code must be 50 characters or less",
      });
    }

    // ATM ID - Optional, but must be alphanumeric if provided
    if (formData.atm_id.trim()) {
      if (!/^[A-Za-z0-9_-]+$/.test(formData.atm_id)) {
        newErrors.push({
          field: "atm_id",
          message: "ATM ID must be alphanumeric (letters, numbers, -, _)",
        });
      } else if (formData.atm_id.length > 50) {
        newErrors.push({
          field: "atm_id",
          message: "ATM ID must be 50 characters or less",
        });
      }
    }

    // Bank Name - Optional, but validate if provided
    if (formData.bank_name.trim() && formData.bank_name.length > 100) {
      newErrors.push({
        field: "bank_name",
        message: "Bank Name must be 100 characters or less",
      });
    }

    // Address - Optional, but validate if provided
    if (formData.address.trim() && formData.address.length > 200) {
      newErrors.push({
        field: "address",
        message: "Address must be 200 characters or less",
      });
    }

    // City - Optional, but validate if provided
    if (formData.city.trim() && formData.city.length > 50) {
      newErrors.push({
        field: "city",
        message: "City must be 50 characters or less",
      });
    }

    // Latitude - Optional, but must be valid if provided
    if (formData.latitude.trim()) {
      const lat = parseFloat(formData.latitude);
      if (isNaN(lat)) {
        newErrors.push({
          field: "latitude",
          message: "Latitude must be a valid number",
        });
      } else if (lat < -90 || lat > 90) {
        newErrors.push({
          field: "latitude",
          message: "Latitude must be between -90 and 90",
        });
      }
    }

    // Longitude - Optional, but must be valid if provided
    if (formData.longitude.trim()) {
      const lng = parseFloat(formData.longitude);
      if (isNaN(lng)) {
        newErrors.push({
          field: "longitude",
          message: "Longitude must be a valid number",
        });
      } else if (lng < -180 || lng > 180) {
        newErrors.push({
          field: "longitude",
          message: "Longitude must be between -180 and 180",
        });
      }
    }

    // GPS Coordinates - Both or neither
    if (
      (formData.latitude.trim() && !formData.longitude.trim()) ||
      (!formData.latitude.trim() && formData.longitude.trim())
    ) {
      newErrors.push({
        field: "latitude",
        message: "Both Latitude and Longitude are required for GPS",
      });
      newErrors.push({
        field: "longitude",
        message: "Both Latitude and Longitude are required for GPS",
      });
    }

    return newErrors;
  };

  const checkDuplicateSite = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("id, site_code")
        .eq("site_code", formData.site_code.trim())
        .maybeSingle();

      if (error) {
        console.error("Duplicate check error:", error);
        return false;
      }

      if (data) {
        setErrors([
          {
            field: "site_code",
            message: `Site Code "${formData.site_code}" already exists (ID: ${data.id})`,
          },
        ]);
        return true; // Duplicate found
      }

      return false; // No duplicate
    } catch (err) {
      console.error("Unexpected error during duplicate check:", err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSuccessMessage(null);

    // Step 1: UI Validation
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);

    try {
      // Step 2: Business Validation - Check for duplicates
      const isDuplicate = await checkDuplicateSite();
      if (isDuplicate) {
        setSaving(false);
        return;
      }

      // Step 3: Prepare data for insertion
      const siteData: any = {
        site_code: formData.site_code.trim(),
      };

      // Add optional fields only if provided
      if (formData.atm_id.trim()) {
        siteData.atm_id = formData.atm_id.trim();
      }
      if (formData.bank_name.trim()) {
        siteData.bank_name = formData.bank_name.trim();
      }
      if (formData.address.trim()) {
        siteData.address = formData.address.trim();
      }
      if (formData.city.trim()) {
        siteData.city = formData.city.trim();
      }
      if (formData.latitude.trim() && formData.longitude.trim()) {
        siteData.latitude = parseFloat(formData.latitude.trim());
        siteData.longitude = parseFloat(formData.longitude.trim());
      }

      // Step 4: Insert into database
      const { data: newSite, error: insertError } = await supabase
        .from("sites")
        .insert([siteData])
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        setErrors([
          {
            field: "site_code",
            message: `Failed to create site: ${insertError.message}`,
          },
        ]);
        return;
      }

      // Step 5: Success handling
      const displayName =
        formData.bank_name.trim() ||
        formData.atm_id.trim() ||
        formData.site_code.trim();

      setSuccessMessage(
        `✓ Site "${displayName}" onboarded successfully (ID: ${newSite.id})`
      );

      // Reset form
      setFormData(INITIAL_FORM_DATA);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setErrors([
        {
          field: "site_code",
          message: `System error: ${err.message || "Unknown error occurred"}`,
        },
      ]);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_DATA);
    setErrors([]);
    setSuccessMessage(null);
  };

  const getFieldError = (field: keyof SiteFormData) =>
    errors.find((e) => e.field === field)?.message;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">
            Site Information
          </h2>
          <p className="text-xs text-slate-500">
            Fields marked with <span className="text-red-500">*</span> are required
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            {successMessage}
          </div>
        )}

        {/* Site Code - Required */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Site Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.site_code}
            onChange={(e) => updateField("site_code", e.target.value)}
            placeholder="e.g., SITE-001, BRANCH-MAIN"
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              getFieldError("site_code")
                ? "border-red-300 bg-red-50"
                : "border-slate-300"
            }`}
            disabled={saving}
          />
          {getFieldError("site_code") && (
            <p className="text-xs text-red-600 mt-1">
              {getFieldError("site_code")}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Unique identifier for the site (letters, numbers, hyphens, underscores only)
          </p>
        </div>

        {/* ATM ID - Optional */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            ATM ID
          </label>
          <input
            type="text"
            value={formData.atm_id}
            onChange={(e) => updateField("atm_id", e.target.value)}
            placeholder="e.g., ATM-12345"
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              getFieldError("atm_id")
                ? "border-red-300 bg-red-50"
                : "border-slate-300"
            }`}
            disabled={saving}
          />
          {getFieldError("atm_id") && (
            <p className="text-xs text-red-600 mt-1">
              {getFieldError("atm_id")}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            ATM machine identifier (optional)
          </p>
        </div>

        {/* Bank Name - Optional */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Bank Name
          </label>
          <input
            type="text"
            value={formData.bank_name}
            onChange={(e) => updateField("bank_name", e.target.value)}
            placeholder="e.g., State Bank of India"
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              getFieldError("bank_name")
                ? "border-red-300 bg-red-50"
                : "border-slate-300"
            }`}
            disabled={saving}
          />
          {getFieldError("bank_name") && (
            <p className="text-xs text-red-600 mt-1">
              {getFieldError("bank_name")}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Name of the bank operating this ATM
          </p>
        </div>

        {/* Address - Optional */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Address
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder="e.g., Main Street, Near Railway Station"
            rows={2}
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              getFieldError("address")
                ? "border-red-300 bg-red-50"
                : "border-slate-300"
            }`}
            disabled={saving}
          />
          {getFieldError("address") && (
            <p className="text-xs text-red-600 mt-1">
              {getFieldError("address")}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            Full address of the ATM site
          </p>
        </div>

        {/* City - Optional */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            City / District
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="e.g., Mumbai, Delhi"
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              getFieldError("city")
                ? "border-red-300 bg-red-50"
                : "border-slate-300"
            }`}
            disabled={saving}
          />
          {getFieldError("city") && (
            <p className="text-xs text-red-600 mt-1">
              {getFieldError("city")}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            City or district name (used for route assignment filters)
          </p>
        </div>

        {/* GPS Coordinates */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            GPS Coordinates (Optional)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Latitude
              </label>
              <input
                type="text"
                value={formData.latitude}
                onChange={(e) => updateField("latitude", e.target.value)}
                placeholder="e.g., 19.0760"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  getFieldError("latitude")
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300"
                }`}
                disabled={saving}
              />
              {getFieldError("latitude") && (
                <p className="text-xs text-red-600 mt-1">
                  {getFieldError("latitude")}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Longitude
              </label>
              <input
                type="text"
                value={formData.longitude}
                onChange={(e) => updateField("longitude", e.target.value)}
                placeholder="e.g., 72.8777"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  getFieldError("longitude")
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300"
                }`}
                disabled={saving}
              />
              {getFieldError("longitude") && (
                <p className="text-xs text-red-600 mt-1">
                  {getFieldError("longitude")}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            GPS coordinates enable proximity verification during ATM loads. Both
            latitude and longitude must be provided together.
          </p>
        </div>

        {/* Global Errors */}
        {errors.length > 0 && !errors.every((e) => getFieldError(e.field)) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            <div className="font-semibold mb-1">Please fix the following issues:</div>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((err, idx) => (
                <li key={idx}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Creating Site..." : "Create ATM Site"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-200 active:scale-95 disabled:opacity-50 transition-all"
          >
            Reset Form
          </button>
        </div>
      </section>
    </form>
  );
}
