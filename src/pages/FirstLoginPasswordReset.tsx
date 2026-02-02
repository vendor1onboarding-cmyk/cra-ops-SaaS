import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function FirstLoginPasswordReset() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  
  /* ---------------- Redirect if not first login ---------------- */
  
  useEffect(() => {
    // If user is not on first login, redirect to dashboard
    if (profile && !profile.first_login) {
      navigate("/");
    }
  }, [profile, navigate]);
  
  /* ---------------- Validation ---------------- */
  
  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    
    // New password validation
    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(formData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(formData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(formData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one number";
    } else if (!/[!@#$%^&*]/.test(formData.newPassword)) {
      newErrors.newPassword = "Password must contain at least one special character (!@#$%^&*)";
    }
    
    // Confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }
  
  /* ---------------- Reset Password ---------------- */
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    
    // Validate form
    if (!validateForm()) {
      setMessage({ type: "error", text: "Please fix validation errors" });
      return;
    }
    
    setLoading(true);
    
    try {
      // Update password using Supabase Auth API
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });
      
      if (updateError) {
        console.error("Password update error:", updateError);
        setMessage({ 
          type: "error", 
          text: `Failed to update password: ${updateError.message}` 
        });
        setLoading(false);
        return;
      }
      
      // Update first_login flag in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_login: false })
        .eq("id", profile!.id);
      
      if (profileError) {
        console.error("Profile update error:", profileError);
        setMessage({ 
          type: "error", 
          text: "Password updated but failed to update profile. Please contact support." 
        });
        setLoading(false);
        return;
      }
      
      // Success - show message and redirect
      setMessage({ 
        type: "success", 
        text: "Password changed successfully! Redirecting to dashboard..." 
      });
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate("/");
        // Force page reload to refresh auth context
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error("Unexpected error during password reset:", err);
      setMessage({ 
        type: "error", 
        text: "An unexpected error occurred. Please try again." 
      });
      setLoading(false);
    }
  }
  
  /* ---------------- Password Strength Indicator ---------------- */
  
  function getPasswordStrength(password: string): { level: string; color: string; width: string } {
    if (!password) return { level: "", color: "", width: "0%" };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    
    if (strength <= 2) return { level: "Weak", color: "bg-red-500", width: "33%" };
    if (strength <= 4) return { level: "Medium", color: "bg-yellow-500", width: "66%" };
    return { level: "Strong", color: "bg-green-500", width: "100%" };
  }
  
  const passwordStrength = getPasswordStrength(formData.newPassword);
  
  /* ---------------- Render ---------------- */
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            First Login Setup
          </h1>
          <p className="text-slate-600">
            Welcome! Please set a new password to continue.
          </p>
        </div>
        
        {/* Alert */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Password Reset Required
              </p>
              <p className="text-xs text-amber-800">
                Your temporary password must be changed before you can access the system. 
                This is a one-time security requirement.
              </p>
            </div>
          </div>
        </div>
        
        {/* Password Reset Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg border border-slate-200 p-6 space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? "text" : "password"}
                className={`w-full px-4 py-2.5 pr-12 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.newPassword ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="Enter your new password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPasswords.new ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-red-600 mt-1">{errors.newPassword}</p>
            )}
            
            {/* Password Strength Indicator */}
            {formData.newPassword && !errors.newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">Password Strength</span>
                  <span className={`text-xs font-semibold ${
                    passwordStrength.level === "Weak" ? "text-red-600" :
                    passwordStrength.level === "Medium" ? "text-yellow-600" :
                    "text-green-600"
                  }`}>
                    {passwordStrength.level}
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? "text" : "password"}
                className={`w-full px-4 py-2.5 pr-12 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.confirmPassword ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="Re-enter your new password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPasswords.confirm ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>
            )}
          </div>
          
          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Setting Password..." : "Set New Password"}
            </button>
          </div>
        </form>
        
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
        
        {/* Password Requirements */}
        <div className="bg-white rounded-lg shadow border border-slate-200 p-5">
          <h4 className="text-md font-semibold text-slate-800 mb-3">🔒 Password Requirements</h4>
          <ul className="text-sm text-slate-600 space-y-2 ml-5 list-disc">
            <li>Minimum 8 characters long</li>
            <li>At least one uppercase letter (A-Z)</li>
            <li>At least one lowercase letter (a-z)</li>
            <li>At least one number (0-9)</li>
            <li>At least one special character (!@#$%^&*)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
