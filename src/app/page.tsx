'use client';

import {
  useFxRate,
  useQuoteResolver,
  useTickerInputs,
  useAllocation,
  totalWeight,
  cadPriceLookup,
} from '@/lib/alloc';
import { Row } from '@/lib/types';
import React, { useMemo, useState } from 'react';

const initialRows: Row[] = [
  { symbol: 'SPUS', weightPct: 50 },
  { symbol: 'SPSK', weightPct: 15 },
  { symbol: 'SPRE', weightPct: 25 },
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
  const [prioritize, setPrioritize] = useState<string>(initialRows[0].symbol);

  const { fetchStatuses } = useQuoteResolver(rows, setRows);

  const effectivePrioritize = useMemo(() => {
    const current = (prioritize || '').trim().toUpperCase();
    const exists = rows.some(
      (r) => (r.symbol || '').trim().toUpperCase() === current
    );
    return exists ? current : rows[0]?.symbol?.trim().toUpperCase() ?? '';
  }, [rows, prioritize]);

  const tickerInputs = useTickerInputs(rows);
  const allocation = useAllocation(
    amount,
    usdToCad,
    tickerInputs,
    effectivePrioritize
  );

  const totalWeightPct = useMemo(() => totalWeight(rows).toFixed(2), [rows]);
  const cadPriceOf = useMemo(
    () => cadPriceLookup(rows, usdToCad),
    [rows, usdToCad]
  );

  const addRow = () =>
    setRows((prev) => [...prev, { symbol: '', weightPct: 0 }]);
  const removeRow = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  const updateSymbol = (i: number, val: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, symbol: val } : r))
    );
  const updateWeight = (i: number, val: number) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, weightPct: val } : r))
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

      {/* Controls */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-center">
        <div>
          <label className="block text-sm mb-1">Monthly budget (CAD)</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full text-center rounded-lg border border-neutral-300 p-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">USD → CAD</label>
          <input
            type="number"
            step="0.0001"
            min={0}
            value={fxLoading ? '' : usdToCad}
            onChange={(e) => setUsdToCad(Number(e.target.value))}
            className="w-full text-center rounded-lg border border-neutral-300 p-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Prioritize (symbol)</label>
          <input
            value={effectivePrioritize}
            onChange={(e) => setPrioritize(e.target.value.trim().toUpperCase())}
            className="w-full text-center rounded-lg border border-neutral-300 p-2"
            placeholder={rows[0]?.symbol || 'SPUS'}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Total weight (%)</label>
          <input
            value={totalWeightPct}
            readOnly
            className="w-full text-center rounded-lg border border-neutral-200 p-2 bg-neutral-50"
          />
        </div>
      </section>

      {/* Editable table */}
      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-neutral-50">
            <tr>
              <Th>Symbol (input)</Th>
              <Th>Resolved</Th>
              <Th>Currency</Th>
              <Th>Price</Th>
              <Th>Weight % (input)</Th>
              <Th>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const status = fetchStatuses[i] ?? 'idle';
              const showResolved =
                status === 'ok'
                  ? r.resolved || ''
                  : status === 'loading'
                  ? '…'
                  : status === 'error'
                  ? '—'
                  : '';

              const showCurrency =
                status === 'ok'
                  ? r.currency || ''
                  : status === 'loading'
                  ? '…'
                  : status === 'error'
                  ? '—'
                  : '';

              const showPrice =
                status === 'ok'
                  ? typeof r.price === 'number'
                    ? r.price.toFixed(2)
                    : ''
                  : status === 'loading'
                  ? '…'
                  : status === 'error'
                  ? '—'
                  : '';

              return (
                <tr key={i} className="border-t">
                  <Td>
                    <input
                      value={r.symbol}
                      onChange={(e) => updateSymbol(i, e.target.value)}
                      className="w-full text-center rounded-md border border-neutral-300 p-2"
                      placeholder="e.g., SPUS"
                    />
                  </Td>
                  <Td className="text-xs text-neutral-600">{showResolved}</Td>
                  <Td>{showCurrency}</Td>
                  <Td>{showPrice}</Td>
                  <Td>
                    <input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(r.weightPct) ? r.weightPct : 0}
                      onChange={(e) => updateWeight(i, Number(e.target.value))}
                      className="w-full text-center rounded-md border border-neutral-300 p-2"
                    />
                  </Td>
                  <Td>
                    <button
                      onClick={() => removeRow(i)}
                      disabled={rows.length === 1}
                      className={
                        rows.length > 1
                          ? 'px-3 py-2 rounded-md border border-red-300 text-red-700 hover:bg-red-50'
                          : 'px-3 py-2 rounded-md border border-grey-300 text-grey-700'
                      }
                    >
                      Remove
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <div className="flex gap-3 mt-3">
        <button
          onClick={addRow}
          className="px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50"
        >
          Add row
        </button>
      </div>

      {/* Allocation */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Allocation</h2>
        {!allocation ? (
          <p className="text-neutral-600">
            Enter at least one valid symbol and wait for its price to load.
          </p>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full border-collapse">
              <thead className="bg-neutral-50">
                <tr>
                  <Th>Symbol</Th>
                  <Th>Buy (shares)</Th>
                  <Th>Cost (CAD)</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  allocation.shares as Record<string, number>
                ).map(([sym, qty]) => {
                  const cost = qty * cadPriceOf(sym);
                  return (
                    <tr key={sym} className="border-t">
                      <Td>{sym}</Td>
                      <Td>{qty}</Td>
                      <Td>${cost.toFixed(2)}</Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-neutral-50">
                  <Td className="font-medium text-left">Budget</Td>
                  <Td>&nbsp;</Td>
                  <Td className="text-right font-medium">
                    ${amount.toFixed(2)} CAD
                  </Td>
                </tr>
                <tr className="border-t bg-neutral-50">
                  <Td className="font-medium text-left">Total (spent)</Td>
                  <Td>&nbsp;</Td>
                  <Td className="text-right font-medium">
                    ${allocation.spent.toFixed(2)} CAD
                  </Td>
                </tr>
                <tr className="border-t bg-neutral-50">
                  <Td className="font-medium text-left">Leftover</Td>
                  <Td>&nbsp;</Td>
                  <Td className="text-right font-medium">
                    ${allocation.leftover.toFixed(2)} CAD
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`text-center text-sm font-medium px-3 py-2 ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`text-center p-2 align-middle ${className}`}>{children}</td>
  );
}
