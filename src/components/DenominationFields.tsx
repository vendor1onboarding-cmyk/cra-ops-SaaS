type Props = {
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
};

const DENOMS = [2000, 500, 200, 100, 50, 20, 10];

export function DenominationFields({ values, onChange }: Props) {
  const total = DENOMS.reduce(
    (sum, d) => sum + (values[`denom_${d}`] || 0) * d,
    0
  );

  return (
    <div className="space-y-3">
      {/* Header - Hidden on mobile, shown on larger screens */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-600 px-2">
        <span>Denomination</span>
        <span className="text-center">Count</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Denomination rows - Stack on mobile, grid on larger screens */}
      {DENOMS.map((d) => {
        const key = `denom_${d}`;
        const count = values[key] || 0;
        const amount = count * d;

        return (
          <div
            key={d}
            className="bg-white border border-slate-200 rounded-lg p-3 sm:grid sm:grid-cols-3 gap-3 sm:items-center"
          >
            {/* Denomination label */}
            <div className="flex items-center justify-between mb-3 sm:mb-0">
              <span className="font-semibold text-sm text-slate-700">₹{d}</span>
              <span className="sm:hidden text-xs text-slate-500">
                {amount > 0 && `₹${amount.toLocaleString()}`}
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
                min={0}
                onChange={(e) =>
                  onChange(key, Number(e.target.value || 0))
                }
                placeholder="0"
              />
            </div>

            {/* Amount display */}
            <div className="hidden sm:block text-right text-sm font-semibold text-primary">
              ₹{amount.toLocaleString()}
            </div>
          </div>
        );
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
