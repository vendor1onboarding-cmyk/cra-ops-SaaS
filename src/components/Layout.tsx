import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Dashboard" },
    { to: "/denomination-plan", label: "Denomination" },
    { to: "/cash-pickup", label: "Cash Pickup" },
    { to: "/atm-replenishment", label: "ATM Load" },
    { to: "/technical-issues", label: "Tech Issues" },
    { to: "/eod-summary", label: "EOD" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
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
            <span className="text-right">
              <span className="font-semibold">{profile.full_name || "User"}</span>
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

      <div className="flex flex-1">
        <nav className="hidden md:block w-60 bg-white border-r">
          <ul className="py-4 space-y-1 text-sm">
            {navItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex items-center justify-between px-4 py-2 ${
                    location.pathname === item.to
                      ? "bg-primary text-white"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <span>{item.label}</span>
                  {location.pathname === item.to && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-4 md:p-6 bg-slate-100">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around text-[11px] shadow-inner">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex-1 text-center py-2 ${
              location.pathname === item.to ? "text-primary font-semibold" : "text-slate-600"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
