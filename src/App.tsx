import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AdminRouteAssignmentPage from "./pages/AdminRouteAssignment";


import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DenominationPlanPage from "./pages/DenominationPlan";
import CashPickupPage from "./pages/CashPickup";
import ATMReplenishmentPage from "./pages/ATMReplenishment";
import ATMCashAdjustmentPage from "./pages/ATMCashAdjustment";
import TechnicalIssuesPage from "./pages/TechnicalIssues";
import EODSummaryPage from "./pages/EODSummary";

import AdminApprovalsPage from "./pages/AdminApprovals";
import AdminEODDetailPage from "./pages/AdminEODDetail";

import RequireAdmin from "./components/RequireAdmin";

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
        {/* ----------------- AUTH ----------------- */}
        <Route path="/login" element={<Login />} />

        {/* ----------------- USER ROUTES ----------------- */}
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
  path="/atm-adjustment"
  element={
    <PrivateRoute>
      <ATMCashAdjustmentPage />
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

        {/* ----------------- ADMIN ROUTES ----------------- */}
        <Route
          path="/admin/approvals"
          element={
            <RequireAdmin>
              <AdminApprovalsPage />
            </RequireAdmin>
          }
        />

        {/* 🔴 THIS ROUTE WAS MISSING */}
        <Route
          path="/admin/approvals/:assignmentId"
          element={
            <RequireAdmin>
              <AdminEODDetailPage />
            </RequireAdmin>
          }
        />
		{/* ----------------- ADMIN ROUTES ASSIGNMENT----------------- */}
		<Route
  path="/admin/route-assignment"
  element={
    <RequireAdmin>
      <AdminRouteAssignmentPage />
    </RequireAdmin>
  }
/>

        {/* ----------------- FALLBACK ----------------- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
