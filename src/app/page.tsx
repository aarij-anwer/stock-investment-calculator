'use client';

import React, { useMemo, useState } from 'react';
import { Row } from '@/lib/types';
import {
  useFxRate,
  useQuoteResolver,
  useTickerInputs,
  useAllocation,
  totalWeight,
  cadPriceLookup,
} from '@/lib/alloc';
import Allocations from './components/Allocations';
import SharesToPurchase from './components/SharesToPurchase';

const initialRows: Row[] = [
  { symbol: 'SPUS', weightPct: 50 },
  { symbol: 'SPRE', weightPct: 25 },
  { symbol: 'SPSK', weightPct: 15 },
  { symbol: 'WSHR', weightPct: 10 },
];

/** Preset strategies */
const PRESETS: Record<
  'Aggressive' | 'Balanced' | 'Defensive' | 'Custom',
  Row[]
> = {
  Aggressive: [
    { symbol: 'SPUS', weightPct: 60 },
    { symbol: 'WSHR', weightPct: 25 },
    { symbol: 'SPRE', weightPct: 10 },
    { symbol: 'SPSK', weightPct: 5 },
  ],
  Balanced: [
    { symbol: 'SPUS', weightPct: 40 },
    { symbol: 'WSHR', weightPct: 25 },
    { symbol: 'SPRE', weightPct: 20 },
    { symbol: 'SPSK', weightPct: 15 },
  ],
  Defensive: [
    { symbol: 'SPSK', weightPct: 50 },
    { symbol: 'SPUS', weightPct: 25 },
    { symbol: 'SPRE', weightPct: 15 },
    { symbol: 'WSHR', weightPct: 10 },
  ],
  Custom: initialRows, // your original default
};

export default function Page() {
  const [amount, setAmount] = useState<number>(750);
  const {
    rate: usdToCad,
    loading: fxLoading,
    setRate: setUsdToCad,
  } = useFxRate(1.4);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [prioritizeIdx, setPrioritizeIdx] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<
    'Aggressive' | 'Balanced' | 'Defensive' | 'Custom'
  >('Custom');

  const { fetchStatuses } = useQuoteResolver(rows, setRows);

  const effectivePrioritize = useMemo(() => {
    const sym =
      rows[prioritizeIdx]?.symbol?.trim().toUpperCase() ??
      rows[0]?.symbol?.trim().toUpperCase() ??
      '';
    return sym;
  }, [rows, prioritizeIdx]);

  const tickerInputs = useTickerInputs(rows);
  const allocation = useAllocation(
    amount,
    usdToCad,
    tickerInputs,
    effectivePrioritize
  );

  const totalWeightPct = useMemo(() => Math.round(totalWeight(rows)), [rows]);
  const cadPriceOf = useMemo(
    () => cadPriceLookup(rows, usdToCad),
    [rows, usdToCad]
  );

  function applyPreset(
    preset: 'Aggressive' | 'Balanced' | 'Defensive' | 'Custom'
  ) {
    setActivePreset(preset);
    setPrioritizeIdx(0);
    // Deep copy to avoid accidental state linkage
    const next = PRESETS[preset].map((r) => ({ ...r }));
    setRows(next);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <section className="flex flex-col mb-4 gap-1">
        <h1 className="text-3xl font-bold">Smart Allocator</h1>
        <p className="text-xl">
          Build a smarter monthly portfolio—by percent, by priority, by price.
        </p>
        <p className="text-neutral-600 text-base">
          Enter weights, set a priority, and get whole-share buys in CAD.
        </p>
        <div className="flex items-center gap-1 text-neutral-600">
          <label className="block text-sm">USD → CAD:</label>
          <label className="block text-sm">
            {fxLoading ? '' : usdToCad.toFixed(2)}
          </label>
        </div>
      </section>

      <section className="mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm">Monthly budget (CAD)</label>
          <input
            type="number"
            prefix="$"
            step={1}
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-20 text-center rounded-lg border border-neutral-300 p-2"
          />
        </div>
      </section>

      {/* Strategy buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['Aggressive', 'Defensive', 'Balanced', 'Custom'] as const).map(
          (label) => {
            const isActive = activePreset === label;
            return (
              <button
                key={label}
                onClick={() => applyPreset(label)}
                className={
                  isActive
                    ? 'px-3 py-2 rounded-md border border-blue-600 text-white bg-blue-600'
                    : 'px-3 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50'
                }
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          }
        )}
      </div>

      <Allocations
        usdToCad={usdToCad}
        fxLoading={fxLoading}
        setUsdToCad={setUsdToCad}
        rows={rows}
        setRows={setRows}
        prioritizeIdx={prioritizeIdx}
        setPrioritizeIdx={setPrioritizeIdx}
        fetchStatuses={fetchStatuses}
        totalWeightPct={totalWeightPct}
      />

      <SharesToPurchase
        allocation={allocation}
        cadPriceOf={cadPriceOf}
        amount={amount}
      />
    </main>
  );
}
