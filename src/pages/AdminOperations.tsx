import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/Layout";
import ATMSiteOnboarding from "./admin/ATMSiteOnboarding";
import ATMSiteUpdate from "./admin/ATMSiteUpdate";
import UserOnboarding from "./admin/UserOnboarding";
import PasswordReset from "./admin/PasswordReset";
import DeleteUser from "./admin/DeleteUser";

type AdminAction = 
  | "atm-site-onboarding"
  | "atm-site-update"
  | "user-management"
  | "password-reset"
  | "delete-user"
  | "bank-account-onboarding"
  | "cheque-verification"
  | null;

interface ActionOption {
  id: AdminAction;
  label: string;
  description: string;
  icon: string;
  navigateTo?: string;
}

const ADMIN_ACTIONS: ActionOption[] = [
  {
    id: "atm-site-onboarding",
    label: "ATM Site Onboarding",
    description: "Register new ATM sites into the system",
    icon: "🏧",
  },
  {
    id: "atm-site-update",
    label: "Update ATM Site",
    description: "Modify existing ATM site details with full validation",
    icon: "✏️",
  },
  {
    id: "user-management",
    label: "Create User",
    description: "Create new user accounts with email or mobile number",
    icon: "👤",
  },
  {
    id: "password-reset",
    label: "Reset Password",
    description: "Generate temporary password for users who forgot their password",
    icon: "🔑",
  },
  {
    id: "delete-user",
    label: "Delete User",
    description: "Permanently remove user accounts from the system",
    icon: "🗑️",
  },
  {
    id: "bank-account-onboarding",
    label: "Bank Account Management",
    description: "Onboard and manage bank accounts for cash pickup operations",
    icon: "🏦",
    navigateTo: "/admin/bank-accounts",
  },
  {
    id: "cheque-verification",
    label: "Cheque Verification",
    description: "Review, verify, and audit bank cash pickup cheques for fraud traceability",
    icon: "💳",
    navigateTo: "/admin/cheque-verification",
  },
  // Future actions can be added here:
  // { id: "custodian-mapping", label: "Custodian Mapping", ... },
];

export default function AdminOperations() {
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState<AdminAction>(null);

  const selectedActionData = ADMIN_ACTIONS.find((a) => a.id === selectedAction);

  const handleSelect = (action: AdminAction) => {
    setSelectedAction(action);
    const actionData = ADMIN_ACTIONS.find((a) => a.id === action);
    if (actionData?.navigateTo) {
      navigate(actionData.navigateTo);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1">
            Admin Operations
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            System administration and data management tools
          </p>
        </div>

        {/* Action Selector */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Operation
            </label>
            <select
              value={selectedAction || ""}
              onChange={(e) => handleSelect(e.target.value as AdminAction || null)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Choose an administrative action --</option>
              {ADMIN_ACTIONS.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.icon} {action.label}
                </option>
              ))}
            </select>
          </div>

          {selectedActionData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl" aria-hidden>
                  {selectedActionData.icon}
                </span>
                <div>
                  <div className="font-semibold text-slate-800">
                    {selectedActionData.label}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {selectedActionData.description}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Dynamic Action Content */}
        {selectedAction === "atm-site-onboarding" && <ATMSiteOnboarding />}
        {selectedAction === "atm-site-update" && <ATMSiteUpdate />}
        {selectedAction === "user-management" && <UserOnboarding />}
        {selectedAction === "password-reset" && <PasswordReset />}
        {selectedAction === "delete-user" && <DeleteUser />}

        {/* Placeholder for future actions */}
        {selectedAction && selectedAction !== "atm-site-onboarding" && selectedAction !== "atm-site-update" && selectedAction !== "user-management" && selectedAction !== "password-reset" && selectedAction !== "delete-user" && (
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-center text-slate-500 text-sm">
              This feature is coming soon.
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
