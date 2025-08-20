// src/app/page.tsx
"use client";

import { useMemo, useState } from "react";
import { allocateShares, TickerInput } from "@/lib/alloc";

type Row = TickerInput;

const defaultRows: Row[] = [
  { symbol: "SPUS", currency: "USD", price: 46.45, weightPct: 40.95 },
  { symbol: "SPSK", currency: "USD", price: 18.43, weightPct: 13.54 },
  { symbol: "SPRE", currency: "USD", price: 19.45, weightPct: 28.57 },
  { symbol: "WSHR", currency: "CAD", price: 32.24, weightPct: 16.94 },
];

export default function Home() {
  const [amount, setAmount] = useState(750);
  const [usdToCad, setUsdToCad] = useState(1.4);
  const [rows, setRows] = useState<Row[]>(defaultRows);
  const [prioritize, setPrioritize] = useState<string>("SPUS");

  const totalWeight = useMemo(
    () => rows.reduce((s, r) => s + (isFinite(r.weightPct) ? r.weightPct : 0), 0),
    [rows]
  );

  const result = useMemo(() => {
    const valid = rows.filter(r => r.symbol && r.price > 0);
    if (valid.length === 0) return null;
    return allocateShares(amount, valid, usdToCad, prioritize);
  }, [amount, usdToCad, rows, prioritize]);

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addRow = () =>
    setRows(prev => [...prev, { symbol: "", currency: "USD", price: 0, weightPct: 0 }]);

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold mb-2">ETF Monthly Allocator (CAD)</h1>
      <p className="text-neutral-600 mb-6">
        Enter your budget, FX rate, and ETF rows (symbol, currency, price, weight%). Pick a
        prioritized ETF to avoid rounding down when possible.
      </p>

      {/* Controls */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1">Monthly budget (CAD)</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-300 p-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">USD → CAD</label>
          <input
            type="number"
            step="0.0001"
            min={0}
            value={usdToCad}
            onChange={(e) => setUsdToCad(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-300 p-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Prioritize (symbol)</label>
          <input
            value={prioritize}
            onChange={(e) => setPrioritize(e.target.value.trim().toUpperCase())}
            className="w-full rounded-lg border border-neutral-300 p-2"
            placeholder="SPUS"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Total weight (%)</label>
          <input
            value={Number.isFinite(totalWeight) ? totalWeight.toFixed(2) : ""}
            readOnly
            className="w-full rounded-lg border border-neutral-200 p-2 bg-neutral-50"
          />
        </div>
      </section>

      {/* Table */}
      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-neutral-50">
            <tr>
              <Th>Symbol</Th>
              <Th>Currency</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">Weight %</Th>
              <Th children={undefined}></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <Td>
                  <input
                    value={r.symbol}
                    onChange={(e) => updateRow(i, { symbol: e.target.value.trim().toUpperCase() })}
                    className="w-full rounded-md border border-neutral-300 p-2"
                    placeholder="SPUS"
                  />
                </Td>
                <Td>
                  <select
                    value={r.currency}
                    onChange={(e) => updateRow(i, { currency: e.target.value as Row["currency"] })}
                    className="w-full rounded-md border border-neutral-300 p-2"
                  >
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                  </select>
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    step="0.0001"
                    min={0}
                    value={r.price}
                    onChange={(e) => updateRow(i, { price: Number(e.target.value) })}
                    className="w-full text-right rounded-md border border-neutral-300 p-2"
                    placeholder="0.00"
                  />
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={r.weightPct}
                    onChange={(e) => updateRow(i, { weightPct: Number(e.target.value) })}
                    className="w-full text-right rounded-md border border-neutral-300 p-2"
                    placeholder="0"
                  />
                </Td>
                <Td>
                  <button
                    onClick={() => removeRow(i)}
                    className="px-3 py-2 rounded-md border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-3">
        <button
          onClick={addRow}
          className="px-4 py-2 rounded-md border border-neutral-300 hover:bg-neutral-50"
        >
          Add row
        </button>
      </div>

      {/* Results */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Allocation</h2>
        {!result ? (
          <p className="text-neutral-600">Enter at least one valid row with a positive price.</p>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full border-collapse">
              <thead className="bg-neutral-50">
                <tr>
                  <Th>Symbol</Th>
                  <Th className="text-right">Buy (shares)</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.shares).map(([sym, qty]) => (
                  <tr key={sym} className="border-t">
                    <Td>{sym}</Td>
                    <Td className="text-right">{qty}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-neutral-50">
                  <Td className="font-medium">Spent</Td>
                  <Td className="text-right font-medium">${result.spent.toFixed(2)} CAD</Td>
                </tr>
                <tr className="border-t bg-neutral-50">
                  <Td className="font-medium">Leftover</Td>
                  <Td className="text-right font-medium">${result.leftover.toFixed(2)} CAD</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left text-sm font-medium px-3 py-2 ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
