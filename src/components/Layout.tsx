import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Simple emoji icons to avoid new dependencies.
 * Can be replaced later with HeroIcons / Lucide if needed.
 */
const ICONS: Record<string, string> = {
  Dashboard: "📊",
  "Admin Dashboard": "📊",
  Denomination: "💰",
  "Cash Pickup": "🏦",
  "ATM Load": "🏧",
  "Statement of Accounts": "📑",
  "Travel Log": "🚗", // ✅ NEW
  "ATM Excess Cash": "🧾💵",
  "ATM Cash Adjustment": "🔄💵",
  "Tech Issues": "⚠️",
  EOD: "🧾",
   "Route Assignment": "🗺️",
  "EOD Approvals": "✅",
  "SOA Adjustments": "🧮",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ---------------- OFFLINE STATE ---------------- */
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

 const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";

const navItems = isAdmin
  ? [
      { to: "/admin", label: "Admin Dashboard" },
      { to: "/admin/approvals", label: "EOD Approvals" },
      { to: "/admin/route-assignment", label: "Route Assignment" },
      { to: "/admin/soa-adjustments", label: "SOA Adjustments" },
    ]
  : [
    { to: "/", label: "Dashboard" },
    { to: "/denomination-plan", label: "Denomination" },
    { to: "/cash-pickup", label: "Cash Pickup" },
    { to: "/atm-replenishment", label: "ATM Load" },
	{ to: "/atm-excess-cash", label: "ATM Excess Cash",},
	{ to: "/atm-adjustment", label: "ATM Cash Adjustment" },
    { to: "/technical-issues", label: "Tech Issues" },
    { to: "/eod-summary", label: "EOD" },
	{ to: "/soa", label: "Statement of Accounts" },
	{ to: "/travel-log", label: "Travel Log" },
	
    ];

  function NavLinks({ onClick }: { onClick?: () => void }) {
    return (
      <ul className="space-y-1 text-sm">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  active
                    ? "bg-primary text-white"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span className="text-lg">
                  {ICONS[item.label] || "•"}
                </span>
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span className="w-2 h-2 rounded-full bg-accent" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-primary text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          {/* Mobile / Tablet Menu Button */}
          <button
            className="md:hidden text-2xl"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-primary shadow">
            ST
          </div>

          <div>
            <h1 className="text-base font-semibold leading-tight">
              Sruthi CRA Ops
            </h1>
            <p className="text-[11px] opacity-80">
              Cash Replenishment & Field Support
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs md:text-sm">
          {profile && (
            <span className="hidden sm:block text-right">
              <span className="font-semibold">
                {profile.full_name || "User"}
              </span>
              <span className="block capitalize opacity-80">
                {profile.role}
              </span>
            </span>
          )}
          <button
            className="border border-white/60 px-3 py-1 rounded-md text-[11px] hover:bg-white/10"
            onClick={() => signOut()}
          >
            Logout
          </button>
        </div>
      </header>

      {/* OFFLINE WARNING BANNER */}
      {offline && (
        <div className="bg-red-600 text-white text-xs text-center py-2">
          ⚠️ You are offline. Data will sync once network is restored.
        </div>
      )}

      {/* DESKTOP / TABLET */}
      <div className="flex flex-1">
        <nav className="hidden md:block w-64 bg-white border-r p-3">
          <NavLinks />
        </nav>

        <main className="flex-1 bg-slate-100">
  <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-4">
    {children}
  </div>
</main>

      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-primary text-base">
                Menu
              </h2>
              <button
                className="text-2xl"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <NavLinks onClick={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* PWA META */}
      <meta name="theme-color" content="#0f172a" />
    </div>
  );
}
