/**
 * ATM Site Selector Component
 * Allows selecting multiple ATM sites with denomination entry for internal cash pickup
 */

import { useState, useEffect } from "react";
import { supabase } from "../api/supabaseClient";

interface ATMSite {
  id: number;
  bank_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface SiteDenoms {
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_2000: number;
}

interface SelectedSite {
  site: ATMSite;
  denoms: SiteDenoms;
  available: SiteDenoms;
}

interface Props {
  assignmentId: number;
  selectedSites: SelectedSite[];
  onChange: (sites: SelectedSite[]) => void;
}

const EMPTY_DENOMS: SiteDenoms = {
  denom_100: 0,
  denom_200: 0,
  denom_500: 0,
  denom_2000: 0,
};

export function ATMSiteSelector({ assignmentId, selectedSites, onChange }: Props) {
  const [availableSites, setAvailableSites] = useState<ATMSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSites();
  }, [assignmentId]);

  async function loadSites() {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: siteError } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude)")
        .eq("assignment_id", assignmentId);

      if (siteError) {
        setError("Failed to load ATM sites");
        setAvailableSites([]);
      } else {
        setAvailableSites((data || []).map((r: any) => r.site));
      }
    } catch (err) {
      setError("Error loading ATM sites");
      setAvailableSites([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSiteAvailability(siteId: number): Promise<SiteDenoms> {
    try {
      const { data, error } = await supabase
        .from("atm_replenishments")
        .select("denom_2000, denom_500, denom_200, denom_100")
        .eq("assignment_id", assignmentId)
        .eq("site_id", siteId);

      if (error || !data) {
        console.warn("[ATMSiteSelector] Failed to load availability:", error);
        return EMPTY_DENOMS;
      }

      // Sum up all previous loads for this site
      const total = data.reduce(
        (acc, row) => ({
          denom_100: acc.denom_100 + (row.denom_100 || 0),
          denom_200: acc.denom_200 + (row.denom_200 || 0),
          denom_500: acc.denom_500 + (row.denom_500 || 0),
          denom_2000: acc.denom_2000 + (row.denom_2000 || 0),
        }),
        EMPTY_DENOMS
      );

      return total;
    } catch (err) {
      console.warn("[ATMSiteSelector] Error loading availability:", err);
      return EMPTY_DENOMS;
    }
  }

  async function handleAddSite(siteId: number) {
    const site = availableSites.find((s) => s.id === siteId);
    if (!site) return;

    // Check if already selected
    if (selectedSites.some((s) => s.site.id === siteId)) {
      return;
    }

    // Load available denominations from previous loads
    const available = await loadSiteAvailability(siteId);

    const newSite: SelectedSite = {
      site,
      denoms: EMPTY_DENOMS,
      available,
    };

    onChange([...selectedSites, newSite]);
  }

  function handleRemoveSite(siteId: number) {
    onChange(selectedSites.filter((s) => s.site.id !== siteId));
  }

  function handleDenomChange(siteId: number, key: keyof SiteDenoms, value: number) {
    const updated = selectedSites.map((s) => {
      if (s.site.id === siteId) {
        return {
          ...s,
          denoms: { ...s.denoms, [key]: Math.max(0, value) },
        };
      }
      return s;
    });
    onChange(updated);
  }

  const unselectedSites = availableSites.filter(
    (site) => !selectedSites.some((s) => s.site.id === site.id)
  );

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
        Loading ATM sites...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Site Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Select ATM Site(s) for Internal Transfer
        </label>
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleAddSite(Number(e.target.value));
              e.target.value = "";
            }
          }}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">-- Add ATM site --</option>
          {unselectedSites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.bank_name} - {site.address}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Sites with Denomination Entry */}
      {selectedSites.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">
            Internal Cash Sources ({selectedSites.length})
          </h4>

          {selectedSites.map((selected) => {
            const totalAmount =
              selected.denoms.denom_100 * 100 +
              selected.denoms.denom_200 * 200 +
              selected.denoms.denom_500 * 500 +
              selected.denoms.denom_2000 * 2000;

            const availableAmount =
              selected.available.denom_100 * 100 +
              selected.available.denom_200 * 200 +
              selected.available.denom_500 * 500 +
              selected.available.denom_2000 * 2000;

            return (
              <div
                key={selected.site.id}
                className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-800">
                      {selected.site.bank_name}
                    </div>
                    <div className="text-xs text-slate-600">
                      {selected.site.address}
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      Available: ₹{availableAmount.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSite(selected.site.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-semibold"
                  >
                    Remove
                  </button>
                </div>

                {/* Denomination Entry */}
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["denom_100", 100],
                      ["denom_200", 200],
                      ["denom_500", 500],
                      ["denom_2000", 2000],
                    ] as const
                  ).map(([key, value]) => {
                    const entered = selected.denoms[key];
                    const available = selected.available[key];
                    const exceeds = entered > available;

                    return (
                      <div key={key}>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          ₹{value} (Available: {available})
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={available}
                          value={entered}
                          onChange={(e) =>
                            handleDenomChange(selected.site.id, key, Number(e.target.value))
                          }
                          className={`w-full px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                            exceeds
                              ? "border-red-300 focus:ring-red-500"
                              : "border-slate-300 focus:ring-primary"
                          }`}
                          placeholder="0"
                        />
                        {exceeds && (
                          <div className="text-xs text-red-600 mt-1">Exceeds available</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total for this site */}
                <div className="bg-white border border-amber-300 rounded-md p-2 text-right">
                  <span className="text-xs text-slate-600">Total from this site: </span>
                  <span className="text-sm font-bold text-amber-900">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedSites.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-600">
          No internal ATM sources selected. Select ATM sites above to pick up cash from them.
        </div>
      )}
    </div>
  );
}
