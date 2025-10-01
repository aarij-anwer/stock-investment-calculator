'use client';

import React from 'react';
import type { Row } from '@/lib/types';

/* ---------- Types ---------- */
type Status = 'idle' | 'loading' | 'ok' | 'error';

type AllocationsProps = {
  usdToCad: number;
  fxLoading: boolean;
  setUsdToCad: (n: number) => void;
  rows: Row[];
  setRows: React.Dispatch<React.SetStateAction<Row[]>>;
  prioritizeIdx: number;
  setPrioritizeIdx: React.Dispatch<React.SetStateAction<number>>;
  fetchStatuses: Status[];
  totalWeightPct: number;
  disabled?: boolean;
};

/* ---------- Component ---------- */
export default function Allocations({
  rows,
  setRows,
  prioritizeIdx,
  setPrioritizeIdx,
  fetchStatuses,
  disabled,
}: AllocationsProps) {
  const addRow = () =>
    setRows((prev) => [...prev, { symbol: '', weightPct: 0 }]);

  const removeRow = (removeIndex: number) => {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== removeIndex);
      return next.length ? normalizeTo100(next) : next;
    });

    // Update priority safely based on previous length and removed index
    setPrioritizeIdx((prevIdx) => {
      if (rows.length <= 1) return 0;
      if (removeIndex === prevIdx) return 0;
      if (removeIndex < prevIdx) return Math.max(0, prevIdx - 1);
      return prevIdx;
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
    <>
      {/* Editable table */}
      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
        <table className="w-full border-collapse text-neutral-900 dark:text-neutral-100">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              {!disabled && <Th>Priority</Th>}
              <Th>Symbol (input)</Th>
              <Th>Currency</Th>
              <Th>Price</Th>
              <Th>Weight % (input)</Th>
              {!disabled && <Th>&nbsp;</Th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900">
            {rows.map((r, i) => {
              const status = (fetchStatuses[i] ?? 'idle') as Status;

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
                <tr key={i} className="">
                  {!disabled && (
                    <Td className="">
                      <input
                        type="radio"
                        name="priority"
                        checked={i === prioritizeIdx}
                        onChange={() => setPrioritizeIdx(i)}
                        aria-label="Set as priority"
                      />
                    </Td>
                  )}
                  <Td>
                    <input
                      value={r.symbol}
                      onChange={(e) => updateSymbol(i, e.target.value)}
                      className={
                        disabled
                          ? 'w-20 text-center p-2 border border-transparent bg-transparent text-neutral-900 dark:text-neutral-100'
                          : 'w-20 sm:w-full text-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-400 p-2'
                      }
                      placeholder="e.g., SPUS"
                      readOnly={disabled}
                    />
                  </Td>
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
                          ? Math.round(r.weightPct!)
                          : 0
                      }
                      onChange={(e) => updateWeight(i, Number(e.target.value))}
                      className={
                        disabled
                          ? 'w-16 text-center p-2 '
                          : 'w-16 text-center rounded-md border border-neutral-300 p-2 sm:w-full'
                      }
                      readOnly={disabled}
                    />
                  </Td>
                  {!disabled && (
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
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Add row */}
      {!disabled && (
        <div className="flex gap-3 mt-3">
          <button
            onClick={addRow}
            className="px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
          >
            Add row
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- Local table cells ---------- */
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

  function giveTo(
    receivers: number[],
    amount: number,
    base: number[]
  ): number[] {
    if (amount <= 0 || receivers.length === 0) return base;
    const pool = sum(receivers.map((j) => base[j]));

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

  // INCREASE
  if (delta > 0) {
    const donors =
      i === pIdx
        ? Array.from({ length: n }, (_, j) => j).filter((j) => j !== pIdx)
        : Array.from({ length: n }, (_, j) => j).filter(
            (j) => j !== i && j !== pIdx
          );

    const donorPool = sum(donors.map((j) => w[j]));
    if (donorPool === 0) return rows;

    const maxNew = Math.min(100, current + donorPool);
    const target = Math.min(newVal, maxNew);
    delta = target - current;
    if (delta <= 0) return rows;

    let nextW = [...w];
    nextW = takeFrom(donors, delta, nextW);
    nextW[i] = current + delta;

    return rows.map((r, idx) => ({ ...r, weightPct: nextW[idx] }));
  }

  // DECREASE
  const freed = -delta;
  let nextW = [...w];

  if (i !== pIdx) {
    nextW[i] = newVal;
    const pHeadroom = 100 - nextW[pIdx];
    const toPriority = Math.min(freed, pHeadroom);
    nextW[pIdx] += toPriority;

    const leftover = freed - toPriority;
    if (leftover > 0) {
      const receivers = Array.from({ length: n }, (_, j) => j).filter(
        (j) => j !== i && j !== pIdx
      );
      nextW = giveTo(receivers, leftover, nextW);
    }
    return rows.map((r, idx) => ({ ...r, weightPct: nextW[idx] }));
  } else {
    const receivers = Array.from({ length: n }, (_, j) => j).filter(
      (j) => j !== pIdx
    );
    const capacity = receivers.reduce((acc, j) => acc + (100 - w[j]), 0);
    const maxFree = Math.min(freed, capacity);
    const targetPriority = current - maxFree;
    nextW[pIdx] = targetPriority;

    // Equal with cap
    let remaining = maxFree;
    while (remaining > 0) {
      const eligible = receivers.filter((j) => nextW[j] < 100);
      if (eligible.length === 0) break;
      for (const j of eligible) {
        if (remaining <= 0) break;
        if (nextW[j] < 100) {
          nextW[j] += 1;
          remaining -= 1;
        }
      }
    }
    return rows.map((r, idx) => ({ ...r, weightPct: nextW[idx] }));
  }
}
