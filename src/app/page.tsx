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

/** Preset strategies */
const PRESETS: Record<
  'Aggressive' | 'Balanced' | 'Defensive' | 'Custom',
  Row[]
> = {
  Aggressive: [
    { symbol: 'SPTE', weightPct: 40 },
    { symbol: 'SPUS', weightPct: 40 },
    { symbol: 'SPWO', weightPct: 10 },
    { symbol: 'SPRE', weightPct: 10 },
  ],
  Balanced: [
    { symbol: 'SPUS', weightPct: 40 },
    { symbol: 'SPWO', weightPct: 25 },
    { symbol: 'SPTE', weightPct: 20 },
    { symbol: 'SPRE', weightPct: 15 },
  ],
  Defensive: [
    { symbol: 'SPSK', weightPct: 40 },
    { symbol: 'SPRE', weightPct: 40 },
    { symbol: 'SPUS', weightPct: 15 },
    { symbol: 'SPTE', weightPct: 5 },
  ],
  Custom: [
    { symbol: 'SPUS', weightPct: 50 },
    { symbol: 'SPRE', weightPct: 25 },
    { symbol: 'SPSK', weightPct: 15 },
    { symbol: 'WSHR', weightPct: 10 },
  ], // your original default
};

export default function Page() {
  const [amount, setAmount] = useState<number>(750);
  const {
    rate: usdToCad,
    loading: fxLoading,
    setRate: setUsdToCad,
  } = useFxRate(1.4);

  const initialRow = 'Aggressive';

  const [prioritizeIdx, setPrioritizeIdx] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<
    'Aggressive' | 'Balanced' | 'Defensive' | 'Custom'
  >(initialRow);
  const [rows, setRows] = useState<Row[]>(PRESETS[activePreset]);

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
        <h1 className="text-3xl font-bold">Smart Portfolio Allocator</h1>
        <p className="text-xl">
          Build a smarter monthly portfolio—by percent, by priority, by price.
        </p>
        <p className="text-neutral-600 text-base  dark:text-neutral-100">
          Enter your monthly budget, pick a curated portfolio aligned to your
          preferences—or customize a bespoke mix—and get whole-share buys in
          CAD.{' '}
        </p>
        <div className="flex items-center gap-1 text-neutral-600  dark:text-neutral-100">
          <label className="block text-sm">(USD → CAD:</label>
          <label className="block text-sm">
            {fxLoading ? '' : usdToCad.toFixed(2)})
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
            className="w-24 text-center rounded-lg border border-neutral-300 p-1"
          />
        </div>
      </section>

      {/* Strategy buttons */}
      <div className="flex flex-col gap-2 mb-4 sm:flex-row">
        {(['Aggressive', 'Defensive', 'Balanced', 'Custom'] as const).map(
          (label) => {
            const isActive = activePreset === label;
            return (
              <button
                key={label}
                onClick={() => applyPreset(label)}
                className={
                  isActive
                    ? 'flex-1 px-3 py-2 rounded-md border border-blue-600 text-white bg-blue-600'
                    : 'flex-1 px-3 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
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
        disabled={activePreset !== 'Custom'}
      />

      <SharesToPurchase
        allocation={allocation}
        cadPriceOf={cadPriceOf}
        amount={amount}
      />
    </main>
  );
}
