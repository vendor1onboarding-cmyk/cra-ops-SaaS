import { useState } from "react";
import {
  validateDenominationInput,
  calculateEffectiveNotes,
  convertNotesToBundles,
  formatDenominationAmount,
} from "../utils/denominationUtils";

type Props = {
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
  denoms?: number[];
  allowNegative?: boolean;
  /** Enable dual Notes + Bundles input mode (default: true) */
  enableBundles?: boolean;
};

const DEFAULT_DENOMS = [100, 200, 500, 2000];

export function DenominationFields({
  values,
  onChange,
  denoms,
  allowNegative,
  enableBundles = true,
}: Props) {
  const activeDenoms = denoms && denoms.length > 0 ? denoms : DEFAULT_DENOMS;
  
  // Track bundles input per denomination (only used in dual-input mode)
  const [bundlesInput, setBundlesInput] = useState<Record<string, number>>({});
  // Track validation errors per denomination
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = activeDenoms.reduce(
    (sum, d) => sum + (values[`denom_${d}`] || 0) * d,
    0
  );

  /**
   * Handle notes input change
   */
  function handleNotesChange(key: string, notesValue: string) {
    const notesNum = notesValue === "" ? 0 : parseInt(notesValue, 10);
    const bundlesNum = bundlesInput[key] || 0;

    if (enableBundles && (notesNum > 0 || bundlesNum > 0)) {
      // Validate the combination
      const validation = validateDenominationInput(notesNum, bundlesNum);
      if (!validation.valid) {
        setErrors({ ...errors, [key]: validation.error || "" });
        return;
      }
      // Clear error and update effective notes
      setErrors({ ...errors, [key]: "" });
      onChange(key, validation.effectiveNotes || 0);
      if (bundlesNum > 0) {
        setBundlesInput({ ...bundlesInput, [key]: 0 }); // Clear bundles when notes entered
      }
    } else {
      // Single input mode or just notes
      onChange(key, notesNum);
    }
  }

  /**
   * Handle bundles input change
   */
  function handleBundlesChange(key: string, bundlesValue: string) {
    const bundlesNum = bundlesValue === "" ? 0 : parseInt(bundlesValue, 10);
    const notesNum = values[key] || 0;

    if (enableBundles) {
      // Validate the combination
      const validation = validateDenominationInput(notesNum, bundlesNum);
      if (!validation.valid) {
        setErrors({ ...errors, [key]: validation.error || "" });
        return;
      }
      // Clear error and update effective notes
      setErrors({ ...errors, [key]: "" });
      onChange(key, validation.effectiveNotes || 0);
      setBundlesInput({ ...bundlesInput, [key]: bundlesNum });
      if (notesNum > 0) {
        // If bundles entered, clear notes since we validated them as mutually exclusive
        onChange(key, validation.effectiveNotes || 0);
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Header - Hidden on mobile, shown on larger screens */}
      {enableBundles ? (
        <div className="hidden sm:grid sm:grid-cols-5 gap-3 text-xs font-semibold text-slate-600 px-2">
          <span>Denomination</span>
          <span className="text-center">Notes</span>
          <span className="text-center">Bundles</span>
          <span className="text-right">Amount</span>
          <span></span>
        </div>
      ) : (
        <div className="hidden sm:grid sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-600 px-2">
          <span>Denomination</span>
          <span className="text-center">Count</span>
          <span className="text-right">Amount</span>
        </div>
      )}

      {/* Denomination rows - Stack on mobile, grid on larger screens */}
      {activeDenoms.map((d) => {
        const key = `denom_${d}`;
        const count = values[key] || 0;
        const amount = count * d;
        const bundlesCount = bundlesInput[key] || 0;
        const error = errors[key];

        if (enableBundles) {
          return (
            <div
              key={d}
              className={`bg-white border ${
                error ? "border-red-300" : "border-slate-200"
              } rounded-lg p-3 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-5 gap-3 sm:items-start`}
            >
              {/* Denomination label */}
              <div className="flex items-center justify-between sm:justify-start">
                <span className="font-semibold text-sm text-slate-700">₹{d}</span>
                <span className="sm:hidden text-xs text-slate-500">
                  {amount !== 0 && formatDenominationAmount(count, d)}
                </span>
              </div>

              {/* Notes input */}
              <div>
                <label className="text-xs text-slate-600 block mb-1">Notes:</label>
                <input
                  type="number"
                  className={`w-full border ${
                    error ? "border-red-300" : "border-slate-300"
                  } rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    error ? "focus:ring-red-500" : "focus:ring-primary"
                  }`}
                  value={count || ""}
                  min={0}
                  onChange={(e) => handleNotesChange(key, e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* Bundles input */}
              <div>
                <label className="text-xs text-slate-600 block mb-1">Bundles:</label>
                <input
                  type="number"
                  className={`w-full border ${
                    error ? "border-red-300" : "border-slate-300"
                  } rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    error ? "focus:ring-red-500" : "focus:ring-primary"
                  }`}
                  value={bundlesCount || ""}
                  min={0}
                  onChange={(e) => handleBundlesChange(key, e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* Amount display */}
              <div className="hidden sm:block text-right text-sm font-semibold text-primary">
                {formatDenominationAmount(count, d)}
              </div>

              {/* Error message (full width on mobile, spans to end on desktop) */}
              {error && (
                <div className="text-xs text-red-600 font-medium sm:col-span-5">
                  {error}
                </div>
              )}
            </div>
          );
        } else {
          // Single-input mode (backward compatibility)
          return (
            <div
              key={d}
              className="bg-white border border-slate-200 rounded-lg p-3 sm:grid sm:grid-cols-3 gap-3 sm:items-center"
            >
              {/* Denomination label */}
              <div className="flex items-center justify-between mb-3 sm:mb-0">
                <span className="font-semibold text-sm text-slate-700">₹{d}</span>
                <span className="sm:hidden text-xs text-slate-500">
                  {amount !== 0 && formatDenominationAmount(count, d)}
                </span>
              </div>

              {/* Count input */}
              <div className="sm:flex sm:items-center">
                <label className="text-xs text-slate-600 block sm:hidden mb-1">
                  Count:
                </label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={count}
                  min={allowNegative ? undefined : 0}
                  onChange={(e) =>
                    onChange(key, Number(e.target.value || 0))
                  }
                  placeholder="0"
                />
              </div>

              {/* Amount display */}
              <div className="hidden sm:block text-right text-sm font-semibold text-primary">
                {formatDenominationAmount(count, d)}
              </div>
            </div>
          );
        }
      })}

      {/* Total section */}
      <div className="bg-primary bg-opacity-5 rounded-lg p-4 mt-4 border-l-4 border-primary">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700">Total Amount:</span>
          <span className="text-lg font-bold text-primary">
            ₹{total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
