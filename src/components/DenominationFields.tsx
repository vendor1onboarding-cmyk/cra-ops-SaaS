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
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
        <span>Denomination</span>
        <span>Count</span>
        <span>Amount</span>
      </div>
      {DENOMS.map((d) => {
        const key = `denom_${d}`;
        const count = values[key] || 0;
        return (
          <div key={d} className="grid grid-cols-3 gap-2 items-center text-xs">
            <span>₹{d}</span>
            <input
              type="number"
              className="border rounded-md px-2 py-1 text-xs"
              value={count}
              min={0}
              onChange={(e) =>
                onChange(key, Number(e.target.value || 0))
              }
            />
            <span className="text-right">₹{count * d}</span>
          </div>
        );
      })}
      <div className="text-right text-sm font-semibold mt-2 text-primary">
        Total: ₹{total}
      </div>
    </div>
  );
}
