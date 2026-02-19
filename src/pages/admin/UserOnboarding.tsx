import { useState } from "react";
import { supabase, invokeEdgeFunction } from "../../api/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import ConfirmationModal from "../../components/ConfirmationModal";

type UserRole = "admin" | "supervisor" | "custodian";
type LoginIdentifierType = "email" | "mobile";

export default function UserOnboarding() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  
  // Form fields
  const [identifierType, setIdentifierType] = useState<LoginIdentifierType>("email");
  const [formData, setFormData] = useState({
    email: "",
    mobileNumber: "",
    fullName: "",
    role: "custodian" as UserRole,
  });
  
  // Generated credentials (shown after successful creation)
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    email: string;
    mobileNumber?: string;
    tempPassword: string;
    identifierType: LoginIdentifierType;
  } | null>(null);
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  /* ---------------- Validation ---------------- */
  
  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    
    // Email validation (if email is selected)
    if (identifierType === "email") {
      if (!formData.email.trim()) {
        newErrors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email format";
      }
    }
    
    // Mobile number validation (if mobile is selected)
    if (identifierType === "mobile") {
      if (!formData.mobileNumber.trim()) {
        newErrors.mobileNumber = "Mobile number is required";
      } else if (!/^\d{10}$/.test(formData.mobileNumber.replace(/\D/g, ''))) {
        newErrors.mobileNumber = "Invalid mobile number (must be 10 digits)";
      }
    }
    
    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 3) {
      newErrors.fullName = "Name must be at least 3 characters";
    } else if (formData.fullName.length > 100) {
      newErrors.fullName = "Name must be ≤ 100 characters";
    }
    
    // Role validation
    if (!["admin", "supervisor", "custodian"].includes(formData.role)) {
      newErrors.role = "Invalid role selected";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }
  
  /* ---------------- Generate Secure Temporary Password ---------------- */
  
  function generateTempPassword(): string {
    // Generate 12-character password with uppercase, lowercase, numbers, and special chars
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + special;
    
    let password = "";
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill remaining characters randomly
    for (let i = 4; i < 12; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  /* ---------------- Check for Duplicate User ---------------- */
  
  async function checkDuplicateUser(): Promise<{ isDuplicate: boolean; field?: string }> {
    if (identifierType === "email") {
      const trimmedEmail = formData.email.trim().toLowerCase();
      
      // Check if user already exists in profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle();
      
      if (error) {
        console.error("Duplicate check error:", error);
        return { isDuplicate: false };
      }
      
      return { isDuplicate: !!data, field: "email" };
    } else {
      // Mobile number duplicate check
      const cleanMobile = formData.mobileNumber.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile_number", cleanMobile)
        .maybeSingle();
      
      if (error) {
        console.error("Duplicate check error:", error);
        return { isDuplicate: false };
      }
      
      return { isDuplicate: !!data, field: "mobile_number" };
    }
  }
  
  /* ---------------- Create User via Supabase Auth API ---------------- */
  
  async function handleSubmit() {
    if (submitLocked || loading) return;
    setMessage(null);
    setGeneratedCredentials(null);
    
    // UI validation
    if (!validateForm()) {
      setMessage({ type: "error", text: "Please fix validation errors" });
      return;
    }
    
    setLoading(true);
    
    try {
      // Business validation: Check for duplicate
      const dupResult = await checkDuplicateUser();
      if (dupResult.isDuplicate) {
        const fieldLabel = dupResult.field === "email" ? 'email' : "mobile number";
        setMessage({ 
          type: "error", 
          text: `User with this ${fieldLabel} already exists` 
        });
        setLoading(false);
        return;
      }
      
      // Prepare credentials
      const tempPassword = generateTempPassword();
      
      // Call Edge Function to create user securely on the server
      const result = await invokeEdgeFunction('create-user', {
        email: identifierType === "email" ? formData.email.trim().toLowerCase() : undefined,
        mobileNumber: identifierType === "mobile" ? formData.mobileNumber : undefined,
        fullName: formData.fullName.trim(),
        role: formData.role,
        tempPassword: tempPassword,
        identifierType: identifierType,
      });
      
      if (!result.success) {
        setMessage({ 
          type: "error", 
          text: `Failed to create user: ${result.error || 'Unknown error'}` 
        });
        setLoading(false);
        return;
      }
      
      // Success: Show credentials to admin
      setGeneratedCredentials({
        email: result.user.email,
        mobileNumber: result.user.mobileNumber,
        tempPassword: tempPassword,
        identifierType: identifierType,
      });
      
      setMessage({ 
        type: "success", 
        text: `User created successfully! Share credentials securely with ${formData.fullName}.` 
      });
      setSubmitLocked(true);
      setConfirmMessage(
        `User created successfully for ${formData.fullName.trim() || "user"}.`
      );
      setShowConfirm(true);
      
    } catch (err) {
      console.error("Unexpected error during user creation:", err);
      setMessage({ 
        type: "error", 
        text: "An unexpected error occurred. Please try again." 
      });
    } finally {
      setLoading(false);
    }
  }
  
  /* ---------------- Reset Form ---------------- */
  
  function handleReset() {
    setFormData({
      email: "",
      mobileNumber: "",
      fullName: "",
      role: "custodian",
    });
    setIdentifierType("email");
    setErrors({});
    setMessage(null);
    setGeneratedCredentials(null);
    setSubmitLocked(false);
  }
  
  /* ---------------- Copy to Clipboard ---------------- */
  
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "success", text: "Copied to clipboard!" });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
  
  /* ---------------- Render ---------------- */
  
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">👤 User Onboarding</h3>
        <p className="text-sm text-slate-600">
          Create new users (custodians, supervisors, admins) with secure temporary credentials.
          Users will be required to change their password on first login.
        </p>
      </div>
      
      {/* User Creation Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h4 className="text-md font-semibold text-slate-800">Create New User</h4>
        
        {/* Login Identifier Type Selector */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Login Identifier Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="identifierType"
                value="email"
                checked={identifierType === "email"}
                onChange={(e) => {
                  setIdentifierType(e.target.value as LoginIdentifierType);
                  setErrors({});
                }}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="identifierType"
                value="mobile"
                checked={identifierType === "mobile"}
                onChange={(e) => {
                  setIdentifierType(e.target.value as LoginIdentifierType);
                  setErrors({});
                }}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">Mobile Number</span>
            </label>
          </div>
        </div>
        
        {/* Email Input */}
        {identifierType === "email" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email (Username) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.email ? "border-red-500" : "border-slate-300"
              }`}
              placeholder="e.g., john.doe@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email}</p>
            )}
          </div>
        )}
        
        {/* Mobile Number Input */}
        {identifierType === "mobile" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mobile Number (Username) <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.mobileNumber ? "border-red-500" : "border-slate-300"
              }`}
              placeholder="e.g., 9876543210"
              value={formData.mobileNumber}
              onChange={(e) => {
                // Allow only digits
                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, mobileNumber: cleaned });
              }}
              maxLength={10}
              disabled={loading}
            />
            {errors.mobileNumber && (
              <p className="text-xs text-red-600 mt-1">{errors.mobileNumber}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">10-digit mobile number</p>
          </div>
        )}
        
        {/* Full Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.fullName ? "border-red-500" : "border-slate-300"
            }`}
            placeholder="e.g., John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            maxLength={100}
            disabled={loading}
          />
          {errors.fullName && (
            <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>
          )}
        </div>
        
        {/* Role */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.role ? "border-red-500" : "border-slate-300"
            }`}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            disabled={loading}
          >
            <option value="custodian">Custodian (Standard User)</option>
            <option value="supervisor">Supervisor (Can manage custodians)</option>
            <option value="admin">Admin (Full System Access)</option>
          </select>
          {errors.role && (
            <p className="text-xs text-red-600 mt-1">{errors.role}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            ⚠️ Admins and supervisors have elevated privileges. Assign carefully.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading || submitLocked}
            className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Creating User..." : "Create User"}
          </button>
          
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-6 bg-slate-200 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-300 active:scale-95 disabled:opacity-50 transition-all"
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Generated Credentials Display (Only after successful creation) */}
      {generatedCredentials && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔐</span>
            <div className="flex-1">
              <h4 className="text-md font-semibold text-amber-900 mb-2">
                Temporary Credentials Generated
              </h4>
              <p className="text-sm text-amber-800 mb-4">
                Share these credentials securely with the new user. The password is temporary and 
                must be changed on first login. Do NOT store or share via insecure channels.
              </p>
              
              <div className="space-y-3">
                {/* Username - Always show the login email */}
                {generatedCredentials.email && (
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <div className="text-xs font-semibold text-slate-600 mb-1">
                      Login Username
                      {generatedCredentials.identifierType === "mobile" && (
                        <span className="ml-1 text-amber-700">(System Generated)</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono text-slate-800 break-all">
                        {generatedCredentials.email}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCredentials.email || "")}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    {generatedCredentials.identifierType === "mobile" && (
                      <p className="text-xs text-amber-700 mt-2">
                        ℹ️ For mobile-based users, this system-generated email is used for login
                      </p>
                    )}
                  </div>
                )}
                
                {/* Mobile Number - Show separately for mobile users */}
                {generatedCredentials.identifierType === "mobile" && generatedCredentials.mobileNumber && (
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <div className="text-xs font-semibold text-slate-600 mb-1">Mobile Number (Reference Only)</div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono text-slate-800 break-all">
                        {generatedCredentials.mobileNumber}
                      </code>
                      <button
                        onClick={() => copyToClipboard(generatedCredentials.mobileNumber || "")}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Temporary Password</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono text-slate-800 break-all">
                      {generatedCredentials.tempPassword}
                    </code>
                    <button
                      onClick={() => copyToClipboard(generatedCredentials.tempPassword)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                <p className="text-xs text-amber-900 font-semibold mb-1">⚠️ Security Reminder</p>
                <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc">
                  <li>Share credentials via secure channel (encrypted email, chat, or in-person)</li>
                  <li>User MUST change password on first login (system enforced)</li>
                  <li>Temporary password expires logically after first reset</li>
                  <li>Do NOT save credentials in plaintext</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
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
      
      {/* Help Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <h4 className="text-md font-semibold text-slate-800 mb-3">📋 User Onboarding Process</h4>
        <ol className="text-sm text-slate-600 space-y-2 ml-5 list-decimal">
          <li>Admin selects login identifier type (Email or Mobile Number)</li>
          <li>Admin creates user with chosen identifier, name, and role</li>
          <li>System generates secure temporary password (12 characters)</li>
          <li>Admin shares credentials securely with new user</li>
          <li>User logs in with chosen identifier and temporary password</li>
          <li>System forces password reset on first login</li>
          <li>User sets permanent password and gains full access</li>
          <li>User can change password anytime from settings</li>
        </ol>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900 font-semibold mb-1">💡 Best Practices</p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
            <li><strong>Email:</strong> Use official company email addresses for corporate users</li>
            <li><strong>Mobile:</strong> Use 10-digit mobile number for field custodians or mobile-first users</li>
            <li>Verify identifier spelling/format before creating user</li>
            <li>Share credentials via secure communication only</li>
            <li>Instruct user to change password immediately on first login</li>
            <li>Assign lowest necessary role (follow principle of least privilege)</li>
          </ul>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="User Created"
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          handleReset();
        }}
      />
    </div>
  );
}
