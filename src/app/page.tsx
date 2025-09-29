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

  const addRow = () =>
    setRows((prev) => [...prev, { symbol: '', weightPct: 0 }]);

  const removeRow = (i: number) => {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? normalizeTo100(next) : next;
    });
    // Adjust priority index if needed
    setPrioritizeIdx((prev) => {
      if (rows.length <= 1) return 0;
      if (i === prev) return 0; // if removed the priority row, fallback to first
      if (i < prev) return Math.max(0, prev - 1);
      return prev;
    });
  };

  const updateSymbol = (i: number, val: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, symbol: val } : r))
    );

  const updateWeight = (i: number, rawVal: number) => {
    setRows((prev) =>
      rebalanceAfterChange(prev, i, rawToInt(rawVal), prioritizeIdx)
    );
  };

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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
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
              <Th>Priority</Th>
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
                      type="radio"
                      name="priority"
                      checked={i === prioritizeIdx}
                      onChange={() => setPrioritizeIdx(i)}
                      aria-label="Set as priority"
                    />
                  </Td>
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
                      step={1}
                      min={0}
                      max={100}
                      value={
                        Number.isFinite(r.weightPct)
                          ? Math.round(r.weightPct)
                          : 0
                      }
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
                          : 'px-3 py-2 rounded-md border border-neutral-300 text-neutral-500'
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

/* ---------- Helpers: exact-100% integer redistribution ---------- */

function rawToInt(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

// If incoming rows don’t sum to 100, normalize proportionally (priority-safe).
function normalizeTo100(rows: Row[]): Row[] {
  const weights = rows.map((r) => rawToInt(r.weightPct ?? 0));
  const s = sum(weights);
  if (s === 100 || s === 0) {
    // If zero, put 100% on the first row to avoid divide-by-zero.
    if (s === 0 && rows.length) {
      const next = rows.map((r, i) => ({ ...r, weightPct: i === 0 ? 100 : 0 }));
      return next;
    }
    return rows.map((r, i) => ({ ...r, weightPct: weights[i] }));
  }
  // Proportional scaling then largest remainders
  const scaled = weights.map((w) => (w * 100) / s);
  const floors = scaled.map((x) => Math.floor(x));
  let need = 100 - sum(floors);
  const remainders = scaled.map((x, i) => ({ i, frac: x - floors[i] }));
  remainders.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainders.length && need > 0; k += 1) {
    floors[remainders[k].i] += 1;
    need -= 1;
  }
  return rows.map((r, i) => ({ ...r, weightPct: floors[i] }));
}

// --- add this helper near your other helpers ---
function giveEqualWithCapacity(
  receivers: number[],
  amount: number,
  base: number[]
): number[] {
  if (amount <= 0 || receivers.length === 0) return base.slice();
  const next = base.slice();

  // Keep distributing until amount is 0 or no receiver can take more.
  while (amount > 0) {
    const eligible = receivers.filter((j) => next[j] < 100);
    if (eligible.length === 0) break;

    // Give floor(amount / eligibleCount) to each eligible (respecting cap)
    const per = Math.floor(amount / eligible.length);
    if (per > 0) {
      let givenTotal = 0;
      for (const j of eligible) {
        const room = 100 - next[j];
        const give = Math.min(per, room);
        next[j] += give;
        givenTotal += give;
      }
      amount -= givenTotal;
      continue;
    }

    // Distribute remaining 1% chunks round-robin to eligible
    for (const j of eligible) {
      if (amount <= 0) break;
      if (next[j] < 100) {
        next[j] += 1;
        amount -= 1;
      }
    }
  }
  return next;
}

function rebalanceAfterChange(
  rows: Row[],
  i: number,
  newVal: number,
  pIdx: number
): Row[] {
  const n = rows.length;
  if (n === 0) return rows;

  const w = rows.map((r) => rawToInt(r.weightPct ?? 0));
  const current = w[i];
  let delta = newVal - current;

  if (delta === 0) return rows;

  // Helper: proportional take (removes "amount" from donor indexes) and returns new weights
  function takeFrom(
    donors: number[],
    amount: number,
    base: number[]
  ): number[] {
    if (amount <= 0 || donors.length === 0) return base;
    const pool = sum(donors.map((j) => base[j]));
    if (pool <= 0) return base;
    const scaled = donors.map((j) => (base[j] * amount) / pool);
    const floor = scaled.map(Math.floor);
    let need = amount - sum(floor);
    const rem = donors
      .map((j, idx) => ({ j, frac: scaled[idx] - floor[idx] }))
      .sort((a, b) => b.frac - a.frac);
    const adj = [...floor];
    for (let k = 0; k < rem.length && need > 0; k++) {
      const idx = donors.indexOf(rem[k].j);
      adj[idx] += 1;
      need -= 1;
    }
    const next = [...base];
    for (let t = 0; t < donors.length; t++) {
      const j = donors[t];
      next[j] = Math.max(0, next[j] - adj[t]);
    }
    return next;
  }

  // Helper: proportional give (adds "amount" to receiver indexes) and returns new weights
  function giveTo(
    receivers: number[],
    amount: number,
    base: number[]
  ): number[] {
    if (amount <= 0 || receivers.length === 0) return base;
    const pool = sum(receivers.map((j) => base[j]));
    // If pool is 0, just give 1% chunks round-robin
    if (pool <= 0) {
      const next = [...base];
      for (let k = 0; k < amount; k++) {
        const idx = receivers[k % receivers.length];
        next[idx] = Math.min(100, next[idx] + 1);
      }
      return next;
    }
    const scaled = receivers.map((j) => (base[j] * amount) / pool);
    const floor = scaled.map(Math.floor);
    let need = amount - sum(floor);
    const rem = receivers
      .map((j, idx) => ({ j, frac: scaled[idx] - floor[idx] }))
      .sort((a, b) => b.frac - a.frac);
    const adj = [...floor];
    for (let k = 0; k < rem.length && need > 0; k++) {
      const idx = receivers.indexOf(rem[k].j);
      adj[idx] += 1;
      need -= 1;
    }
    const next = [...base];
    for (let t = 0; t < receivers.length; t++) {
      const j = receivers[t];
      next[j] = Math.min(100, next[j] + adj[t]);
    }
    return next;
  }

  // INCREASE ---------------------------------------------------------------
  if (delta > 0) {
    // If increasing the priority row, donors are all non-priority rows.
    // If increasing a non-priority row, donors are all rows except (i and priority).
    const donors =
      i === pIdx
        ? Array.from({ length: n }, (_, j) => j).filter((j) => j !== pIdx)
        : Array.from({ length: n }, (_, j) => j).filter(
            (j) => j !== i && j !== pIdx
          );

    const donorPool = sum(donors.map((j) => w[j]));
    if (donorPool === 0) return rows; // nothing to take from

    const maxNew = Math.min(100, current + donorPool);
    const target = Math.min(newVal, maxNew);
    delta = target - current;
    if (delta <= 0) return rows;

    let nextW = [...w];
    nextW = takeFrom(donors, delta, nextW); // take from donors
    nextW[i] = current + delta; // apply increase to edited row (incl priority case)

    return rows.map((r, idx) => ({ ...r, weightPct: nextW[idx] }));
  }

  // DECREASE ---------------------------------------------------------------
  const F = -delta; // freed amount
  let nextW = [...w];

  if (i !== pIdx) {
    // Give as much as possible to priority, then spread any leftover to others
    nextW[i] = newVal;
    const pHeadroom = 100 - nextW[pIdx];
    const toPriority = Math.min(F, pHeadroom);
    nextW[pIdx] += toPriority;

    const leftover = F - toPriority;
    if (leftover > 0) {
      const receivers = Array.from({ length: n }, (_, j) => j).filter(
        (j) => j !== i && j !== pIdx
      );
      nextW = giveTo(receivers, leftover, nextW);
    }
    return rows.map((r, idx) => ({ ...r, weightPct: nextW[idx] }));
  } else {
    // Priority decreased: spread F across all non-priority rows
    nextW[pIdx] = newVal;
    const receivers = Array.from({ length: n }, (_, j) => j).filter(
      (j) => j !== pIdx
    );
    nextW = giveTo(receivers, F, nextW);
    return rows.map((r, idx) => ({ ...r, weightPct: nextW[idx] }));
  }
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
