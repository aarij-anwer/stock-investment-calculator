'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import NumericInput from './components/NumericInput';
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
    { symbol: 'BTCC.TO', weightPct: 10 },
  ], // your original default
};

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Read strategy from URL query param on mount
  useEffect(() => {
    const strategyParam = searchParams.get('strategy');
    if (strategyParam) {
      const normalized =
        strategyParam.charAt(0).toUpperCase() +
        strategyParam.slice(1).toLowerCase();
      if (normalized in PRESETS) {
        const preset = normalized as
          | 'Aggressive'
          | 'Balanced'
          | 'Defensive'
          | 'Custom';
        setActivePreset(preset);
        setPrioritizeIdx(0);

        // Load from localStorage if Custom strategy
        if (preset === 'Custom') {
          const saved = loadCustomPortfolio();
          if (saved) {
            setRows(saved.rows);
            setPrioritizeIdx(saved.prioritizeIdx);
            return;
          }
        }

        setRows(PRESETS[preset].map((r) => ({ ...r })));
      }
    }
  }, []);

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

  function saveCustomPortfolio() {
    try {
      const data = {
        rows,
        prioritizeIdx,
      };
      localStorage.setItem('customPortfolio', JSON.stringify(data));
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (err) {
      console.error('Failed to save portfolio:', err);
      setSaveMessage('Save failed');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }

  function loadCustomPortfolio(): {
    rows: Row[];
    prioritizeIdx: number;
  } | null {
    try {
      const saved = localStorage.getItem('customPortfolio');
      if (!saved) return null;
      const data = JSON.parse(saved);
      if (data?.rows && Array.isArray(data.rows)) {
        return {
          rows: data.rows,
          prioritizeIdx: data.prioritizeIdx ?? 0,
        };
      }
      return null;
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      return null;
    }
  }

  function applyPreset(
    preset: 'Aggressive' | 'Balanced' | 'Defensive' | 'Custom'
  ) {
    setActivePreset(preset);
    setPrioritizeIdx(0);

    // Load from localStorage if Custom
    if (preset === 'Custom') {
      const saved = loadCustomPortfolio();
      if (saved) {
        setRows(saved.rows);
        setPrioritizeIdx(saved.prioritizeIdx);
        router.push(`?strategy=${preset.toLowerCase()}`, { scroll: false });
        return;
      }
    }

    // Deep copy to avoid accidental state linkage
    const next = PRESETS[preset].map((r) => ({ ...r }));
    setRows(next);
    // Update URL with strategy query param
    router.push(`?strategy=${preset.toLowerCase()}`, { scroll: false });
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
          <NumericInput
            prefix="$"
            step={1}
            min={0}
            value={amount}
            onNumberChange={setAmount}
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

      {/* Save button for Custom portfolio */}
      {activePreset === 'Custom' && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() =>
              setRows((prev) => [...prev, { symbol: '', weightPct: 0 }])
            }
            className="px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
          >
            Add row
          </button>
          <button
            onClick={saveCustomPortfolio}
            className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
          >
            Save!
          </button>
          {saveMessage && (
            <span className="text-sm text-green-600 dark:text-green-400">
              {saveMessage}
            </span>
          )}
        </div>
      )}

      <SharesToPurchase
        allocation={allocation}
        cadPriceOf={cadPriceOf}
        amount={amount}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-5xl p-6">Loading...</div>}
    >
      <PortfolioContent />
    </Suspense>
  );
}
