import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DenominationPlanPage from "./pages/DenominationPlan";
import CashPickupPage from "./pages/CashPickup";
import ATMReplenishmentPage from "./pages/ATMReplenishment";
import TechnicalIssuesPage from "./pages/TechnicalIssues";
import EODSummaryPage from "./pages/EODSummary";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm">
        Loading...
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/denomination-plan"
          element={
            <PrivateRoute>
              <DenominationPlanPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/cash-pickup"
          element={
            <PrivateRoute>
              <CashPickupPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/atm-replenishment"
          element={
            <PrivateRoute>
              <ATMReplenishmentPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/technical-issues"
          element={
            <PrivateRoute>
              <TechnicalIssuesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/eod-summary"
          element={
            <PrivateRoute>
              <EODSummaryPage />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
