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
import TypewriterList from './components/TypewriterList';
import TypewriterText from './components/TypewriterText';

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

// Helper to load custom portfolio from localStorage
function loadCustomPortfolio(): {
  rows: Row[];
  prioritizeIdx: number;
} | null {
  try {
    if (typeof window === 'undefined') return null;
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

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [amount, setAmount] = useState<number>(750);
  const {
    rate: usdToCad,
    loading: fxLoading,
    setRate: setUsdToCad,
  } = useFxRate(1.4);

  // Initialize state based on URL parameter
  const getInitialPreset = ():
    | 'Aggressive'
    | 'Balanced'
    | 'Defensive'
    | 'Custom' => {
    const strategyParam = searchParams.get('strategy');
    if (strategyParam) {
      const normalized =
        strategyParam.charAt(0).toUpperCase() +
        strategyParam.slice(1).toLowerCase();
      if (normalized in PRESETS) {
        return normalized as 'Aggressive' | 'Balanced' | 'Defensive' | 'Custom';
      }
    }
    return 'Aggressive';
  };

  const getInitialRows = (): Row[] => {
    const preset = getInitialPreset();
    if (preset === 'Custom') {
      const saved = loadCustomPortfolio();
      if (saved) {
        return saved.rows;
      }
    }
    return PRESETS[preset].map((r) => ({ ...r }));
  };

  const getInitialPriority = (): number => {
    const preset = getInitialPreset();
    if (preset === 'Custom') {
      const saved = loadCustomPortfolio();
      if (saved) {
        return saved.prioritizeIdx;
      }
    }
    return 0;
  };

  const [activePreset, setActivePreset] = useState<
    'Aggressive' | 'Balanced' | 'Defensive' | 'Custom'
  >(getInitialPreset);
  const [rows, setRows] = useState<Row[]>(getInitialRows);
  const [prioritizeIdx, setPrioritizeIdx] =
    useState<number>(getInitialPriority);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [fractional, setFractional] = useState<boolean>(false);

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
    effectivePrioritize,
    fractional
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
    <main className="mx-auto max-w-5xl p-6 mb-6 lg:mb-10">
      {/* Header Section */}
      <section className="mb-6">
        <h1 className="text-5xl font-bold mb-2">Smart Portfolio Allocator</h1>
        <p className="text-xl mb-2">Build a smarter monthly portfolio.</p>
        <div className="relative mb-3">
          {/* Hidden content to reserve space */}
          <ul className="text-neutral-600 text-base dark:text-neutral-400 space-y-1.5 invisible">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
                ✓
              </span>
              <span>
                Choose preset strategies or customize your own portfolio mix
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
                ✓
              </span>
              <span>Real-time pricing with automatic CAD/USD conversion</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">
                ✓
              </span>
              <span>Calculate whole or fractional share purchases</span>
            </li>
          </ul>
          {/* Visible animated content */}
          <TypewriterList
            items={[
              'Choose preset strategies or customize your own portfolio mix',
              'Real-time pricing with automatic CAD/USD conversion',
              'Calculate whole or fractional share purchases',
            ]}
            delay={15}
            itemDelay={200}
            className="text-neutral-600 text-base dark:text-neutral-400 space-y-1.5 absolute top-0 left-0 right-0"
          />
        </div>

        {/* Configuration Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 shadow-sm">
          <h3 className="text-xl lg:text-2xl font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
            Investment Setup
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-neutral-700 dark:text-neutral-300">
                Monthly Budget (CAD)
              </label>
              <div className="relative w-full rounded-lg border border-neutral-300 dark:border-neutral-600 p-2 flex items-center">
                <span className="text-neutral-900 dark:text-neutral-100">
                  $
                </span>
                <NumericInput
                  step={1}
                  min={0}
                  value={amount}
                  onNumberChange={setAmount}
                  className="flex-1 text-right bg-transparent border-none outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-neutral-700 dark:text-neutral-300">
                Share Type
              </label>
              <div className="flex flex-row gap-2 p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="shareType"
                    checked={!fractional}
                    onChange={() => setFractional(false)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    Whole
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="shareType"
                    checked={fractional}
                    onChange={() => setFractional(true)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    Fractional
                  </span>
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-neutral-700 dark:text-neutral-300">
                Exchange Rate
              </label>
              <div className="text-center p-2 text-neutral-600 dark:text-neutral-400 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                USD → CAD:{' '}
                <span className="font-medium">
                  {fxLoading ? '...' : usdToCad.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strategy Selection Card */}
      <section className="mb-6">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 shadow-sm">
          <h3 className="text-xl lg:text-2xl font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
            Strategy
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(['Aggressive', 'Defensive', 'Balanced', 'Custom'] as const).map(
              (label) => {
                const isActive = activePreset === label;
                return (
                  <button
                    key={label}
                    onClick={() => applyPreset(label)}
                    className={
                      isActive
                        ? 'flex-1 px-3 py-2 rounded-md border border-blue-600 text-white bg-blue-600 font-medium cursor-pointer'
                        : 'flex-1 px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer'
                    }
                    aria-pressed={isActive}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </section>

      {/* Two Column Layout: Portfolio Composition | Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Portfolio Composition */}
        <div className="flex flex-col gap-6">
          {/* Portfolio Composition Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 shadow-sm">
            <h3 className="text-xl lg:text-2xl font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              Portfolio Composition
            </h3>
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
              fractional={fractional}
            />

            {/* Save button for Custom portfolio */}
            {activePreset === 'Custom' ? (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() =>
                    setRows((prev) => [...prev, { symbol: '', weightPct: 0 }])
                  }
                  disabled={rows.length >= 10}
                  className={
                    rows.length >= 10
                      ? 'px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                      : 'px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer'
                  }
                >
                  Add row {rows.length >= 10 && '(max 10)'}
                </button>
                <button
                  onClick={saveCustomPortfolio}
                  className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                >
                  Save!
                </button>
                {saveMessage && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {saveMessage}
                  </span>
                )}
              </div>
            ) : (
              <div className="mb-0 lg:mb-16" />
            )}
          </div>
        </div>

        {/* Right Column: Purchase Results */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 shadow-sm">
          <SharesToPurchase
            allocation={allocation}
            cadPriceOf={cadPriceOf}
            amount={amount}
            fractional={fractional}
            setFractional={setFractional}
          />
        </div>
      </div>
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
