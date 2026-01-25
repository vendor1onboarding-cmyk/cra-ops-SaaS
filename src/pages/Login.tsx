import { FormEvent, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // -------------------------------------------
  // FIX: Auto redirect after login & profile load
  // -------------------------------------------
  useEffect(() => {
    if (profile) {
      // Redirect based on role
      if (profile.role === "admin" || profile.role === "supervisor") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
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
            ST
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">Sruthi CRA Ops</h1>
            <p className="text-[11px] text-slate-500">
              Cash Replenishment & Field Support Partner
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm mb-1 text-slate-700">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-700">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-sm rounded-lg bg-primary text-white font-semibold hover:bg-primary-light disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-500 text-center">
          Use your Sruthi CRA Ops email credentials. Admin can manage access in Supabase.
        </p>
      </div>
    </div>
  );
}
