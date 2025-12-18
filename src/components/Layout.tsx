import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { to: "/", label: "Dashboard" },
    { to: "/denomination-plan", label: "Denomination" },
    { to: "/cash-pickup", label: "Cash Pickup" },
    { to: "/atm-replenishment", label: "ATM Load" },
    { to: "/technical-issues", label: "Tech Issues" },
    { to: "/eod-summary", label: "EOD" },
  ];

  if (profile?.role === "admin") {
    navItems.push(
      { to: "/admin/route-assignment", label: "Route Assignment" },
      { to: "/admin/approvals", label: "EOD Approvals" }
    );
  }

  function NavLinks({ onClick }: { onClick?: () => void }) {
    return (
      <ul className="space-y-1 text-sm">
        {navItems.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onClick}
              className={`flex items-center justify-between px-4 py-3 rounded ${
                location.pathname === item.to
                  ? "bg-primary text-white"
                  : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-primary text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-xl"
            onClick={() => setMobileMenuOpen(true)}
          >
            ☰
          </button>

          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-primary shadow">
            ST
          </div>
          <div>
            <h1 className="text-lg font-semibold">Sruthi CRA Ops</h1>
            <p className="text-[11px] opacity-80">
              Cash Replenishment & Field Support Partner
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs md:text-sm">
          {profile && (
            <span className="text-right hidden sm:block">
              <span className="font-semibold">
                {profile.full_name || "User"}
              </span>
              <span className="block capitalize opacity-80">
                {profile.role}
              </span>
            </span>
          )}
          <button
            className="border border-white/60 px-3 py-1 rounded-md text-[11px] md:text-xs hover:bg-white/10"
            onClick={() => signOut()}
          >
            Logout
          </button>
        </div>
      </header>

      {/* DESKTOP LAYOUT */}
      <div className="flex flex-1">
        <nav className="hidden md:block w-60 bg-white border-r p-3">
          <NavLinks />
        </nav>

        <main className="flex-1 p-4 md:p-6 bg-slate-100">
          {children}
        </main>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-primary">Menu</h2>
              <button
                className="text-xl"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <NavLinks onClick={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
