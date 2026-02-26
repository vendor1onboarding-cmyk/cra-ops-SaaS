import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AdminRouteAssignmentPage from "./pages/AdminRouteAssignment";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSOAAdjustments from "./pages/AdminSOAAdjustments";
import AdminOperations from "./pages/AdminOperations";
import AdvancedAnalytics from "./pages/analytics/AdvancedAnalytics";
import BankAccountOnboarding from "./pages/admin/BankAccountOnboarding";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DenominationPlanPage from "./pages/DenominationPlan";
import CashPickupPage from "./pages/CashPickup";
import ATMReplenishmentPage from "./pages/ATMReplenishment";
import ATMExcessCashPage from "./pages/ATMExcessCash";
import DenominationExchange from "./pages/DenominationExchange";
import InterSiteTransfer from "./pages/InterSiteTransfer";
import TechnicalIssuesPage from "./pages/TechnicalIssues";
import EODSummaryPage from "./pages/EODSummary";
import TravelTrackingPage from "./pages/TravelTracking";
import StatementOfAccounts from "./pages/StatementOfAccounts";
import CustodianAdjustmentConfirm from "./pages/CustodianAdjustmentConfirm";
import PasswordChange from "./pages/PasswordChange";
import FirstLoginPasswordReset from "./pages/FirstLoginPasswordReset";

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
  
  // Redirect to password reset if first login (unless already on that page)
  if (profile.first_login && window.location.pathname !== "/first-login-reset") {
    return <Navigate to="/first-login-reset" replace />;
  }

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
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
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
          path="/atm-excess-cash"
          element={
            <PrivateRoute>
              <ATMExcessCashPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/denomination-exchange"
          element={
            <PrivateRoute>
              <DenominationExchange />
            </PrivateRoute>
          }
        />

        <Route
          path="/inter-site-transfer"
          element={
            <PrivateRoute>
              <InterSiteTransfer />
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

        <Route
          path="/travel-log"
          element={
            <PrivateRoute>
              <TravelTrackingPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/soa"
          element={
            <PrivateRoute>
              <StatementOfAccounts />
            </PrivateRoute>
          }
        />

        <Route
          path="/adjustments/confirm"
          element={
            <PrivateRoute>
              <CustodianAdjustmentConfirm />
            </PrivateRoute>
          }
        />

        <Route
          path="/password-change"
          element={
            <PrivateRoute>
              <PasswordChange />
            </PrivateRoute>
          }
        />

        {/* Special route: First login password reset (no PrivateRoute to avoid redirect loop) */}
        <Route path="/first-login-reset" element={<FirstLoginPasswordReset />} />

        <Route
          path="/analytics"
          element={
            <RequireAdmin>
              <AdvancedAnalytics />
            </RequireAdmin>
          }
        />

        <Route
          path="/analytics/advanced"
          element={
            <RequireAdmin>
              <AdvancedAnalytics />
            </RequireAdmin>
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
        <Route
          path="/admin/soa-adjustments"
          element={
            <RequireAdmin>
              <AdminSOAAdjustments />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/operations"
          element={
            <RequireAdmin>
              <AdminOperations />
            </RequireAdmin>
          }
        />

        <Route
          path="/admin/bank-accounts"
          element={
            <RequireAdmin>
              <BankAccountOnboarding />
            </RequireAdmin>
          }
        />

        {/* ----------------- FALLBACK ----------------- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
