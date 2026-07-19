import { FormEvent, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState(""); // Can be email or mobile
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Role-based redirect: admin/supervisor -> /admin, custodian -> /
    if (profile.role === "admin" || profile.role === "supervisor") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [profile, navigate]);

  const convertIdentifierToEmail = (input: string): string => {
    const cleanInput = input.trim();
    
    // Check if input is a mobile number (10 digits, possibly with spaces/hyphens)
    const mobileMatch = cleanInput.replace(/\D/g, "");
    if (mobileMatch.length === 10 && /^\d+$/.test(mobileMatch)) {
      // Convert mobile number to system-generated email format
      return `mobile_${mobileMatch}@system.internal`;
    }
    
    // Return as-is if it's an email
    return cleanInput;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Convert mobile number to email if needed
      const email = convertIdentifierToEmail(identifier);
      await signIn(email, password);
      // DO NOT navigate here.
      // Profile will load → useEffect above will redirect.
    } catch (err: any) {
      setError(err.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary-light to-slate-900 px-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-8 border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-primary shadow">
            CT
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">Cash Track Pro</h1>
            <p className="text-[11px] text-slate-500">
              Track, Manage, Deliver
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm mb-1 text-slate-700 font-semibold">Login ID</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Email or 10-digit mobile number"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <p className="text-xs text-slate-500 mt-1.5">
              ℹ️ Enter your email OR 10-digit mobile number (without spaces or hyphens)
            </p>
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700 font-semibold">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-sm rounded-lg bg-primary text-white font-semibold hover:bg-primary-light disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-[11px] text-slate-600">
          <p className="text-center font-semibold mb-2">📝 How to log in:</p>
          <div className="bg-blue-50 border border-blue-200 rounded p-2.5">
            <p className="font-semibold text-blue-900 mb-1">✉️ Email Users:</p>
            <p className="text-blue-800">Use the email provided by admin</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-2.5">
            <p className="font-semibold text-green-900 mb-1">📱 Mobile-Based Users:</p>
            <p className="text-green-800">Use your 10-digit mobile number (e.g., 9876543210)</p>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-slate-500 text-center">
          Admin can manage access and reset passwords in the system.
        </p>
      </div>
    </div>
  );
}
