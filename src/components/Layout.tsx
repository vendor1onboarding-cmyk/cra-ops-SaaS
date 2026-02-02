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
  "Travel Log": "🚗",
  "ATM Excess Cash": "🧾💵",
  "ATM Cash Adjustment": "🔄💵",
  "Tech Issues": "⚠️",
  EOD: "🧾",
  "Route Assignment": "🗺️",
  "EOD Approvals": "✅",
  "SOA Adjustments": "🧮",
  "Advanced Analytics": "📈",
  "Admin Operations": "⚙️",
  "Change Password": "🔐",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
      { to: "/soa", label: "Statement of Accounts" },
      { to: "/admin/soa-adjustments", label: "SOA Adjustments" },
      { to: "/admin/operations", label: "Admin Operations" },
      { to: "/analytics/advanced", label: "Advanced Analytics" },
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

        <div className="flex items-center gap-3 text-xs md:text-sm relative">
          {profile && (
            <>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="hidden sm:flex items-center gap-2 text-right hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
              >
                <span>
                  <span className="font-semibold block">
                    {profile.full_name || "User"}
                  </span>
                  <span className="capitalize opacity-80 text-[11px]">
                    {profile.role}
                  </span>
                </span>
                <span>{userMenuOpen ? "▲" : "▼"}</span>
              </button>
              
              {/* User Menu Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                  <Link
                    to="/password-change"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <span>{ICONS["Change Password"]}</span>
                    <span className="text-sm">Change Password</span>
                  </Link>
                  <hr className="my-2" />
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <span>🚪</span>
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              )}
            </>
          )}
          
          {/* Mobile Logout Button */}
          <button
            className="sm:hidden border border-white/60 px-3 py-1 rounded-md text-[11px] hover:bg-white/10"
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
            
            {/* User Options in Mobile Menu */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    to="/password-change"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 text-slate-700"
                  >
                    <span className="text-lg">{ICONS["Change Password"]}</span>
                    <span className="flex-1">Change Password</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* PWA META */}
      <meta name="theme-color" content="#0f172a" />
    </div>
  );
}
