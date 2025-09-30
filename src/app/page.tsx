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

export default function Page() {
  const [amount, setAmount] = useState<number>(750);
  const {
    rate: usdToCad,
    loading: fxLoading,
    setRate: setUsdToCad,
  } = useFxRate(1.4);

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [prioritizeIdx, setPrioritizeIdx] = useState<number>(0);

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

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold mb-2">
        Stock / ETF Monthly Allocator (CAD)
      </h1>
      <p className="text-neutral-600 mb-6">
        Enter symbols, assign weights, and get whole-share allocations against a
        CAD budget.
      </p>

      <Allocations
        amount={amount}
        setAmount={setAmount}
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
