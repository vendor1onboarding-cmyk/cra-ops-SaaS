import { useState } from "react";
import { AppLayout } from "../components/Layout";
import ATMSiteOnboarding from "./admin/ATMSiteOnboarding";
import ATMSiteUpdate from "./admin/ATMSiteUpdate";
import UserOnboarding from "./admin/UserOnboarding";

type AdminAction = 
  | "atm-site-onboarding"
  | "atm-site-update"
  | "user-management"
  | null;

interface ActionOption {
  id: AdminAction;
  label: string;
  description: string;
  icon: string;
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
    label: "User Management",
    description: "Create new users and manage user accounts",
    icon: "👤",
  },
  // Future actions can be added here:
  // { id: "custodian-mapping", label: "Custodian Mapping", ... },
];

export default function AdminOperations() {
  const [selectedAction, setSelectedAction] = useState<AdminAction>(null);

  const selectedActionData = ADMIN_ACTIONS.find((a) => a.id === selectedAction);

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
              onChange={(e) => setSelectedAction(e.target.value as AdminAction || null)}
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

        {/* Placeholder for future actions */}
        {selectedAction && selectedAction !== "atm-site-onboarding" && selectedAction !== "atm-site-update" && selectedAction !== "user-management" && (
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
