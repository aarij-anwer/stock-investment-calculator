// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { allocateShares, TickerInput } from "@/lib/alloc";
import type { Row } from "@/lib/types";

type FetchState = "idle" | "loading" | "ok" | "error";

const initialRows: Row[] = [
  { symbol: "SPUS", weightPct: 50 },
  { symbol: "SPSK", weightPct: 15 },
  { symbol: "SPRE", weightPct: 25 },
  { symbol: "WSHR", weightPct: 10 },
];

// simple debounce hook
function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function Home() {
  const [amount, setAmount] = useState(750);
  const [usdToCad, setUsdToCad] = useState(1.4);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [prioritize, setPrioritize] = useState<string>(initialRows[0].symbol);
  const [fetchStatuses, setFetchStatuses] = useState<FetchState[]>(
    initialRows.map(() => "idle")
  );
  const [fxLoading, setFxLoading] = useState(false);
  const [fxProvider, setFxProvider] = useState<string | null>(null);

  const debouncedSymbols = useDebounced(rows.map(r => r.symbol), 400);

  // Fetch USD->CAD on initial load and set up a 5-min auto-refresh
  useEffect(() => {
    const fetchFx = async () => {
      try {
        setFxLoading(true);
        const res = await fetch("/api/fx?base=USD&quote=CAD", { cache: "no-store" });
        if (!res.ok) throw new Error("fx error");
        const data = await res.json();
        if (typeof data.rate === "number") {
          setUsdToCad(data.rate);
          setFxProvider(data.provider ?? null);
        }
      } catch (_) {
        // keep previous usdToCad if error
      } finally {
        setFxLoading(false);
      }
    };

    fetchFx();
    const id = setInterval(fetchFx, 5 * 60 * 1000); // auto-refresh every 5 min
    return () => clearInterval(id);
  }, []);

  // Fetch price/currency when a symbol changes (debounced)
  useEffect(() => {
    async function run() {
      await Promise.all(
        debouncedSymbols.map(async (sym, i) => {
          const clean = (sym || "").trim().toUpperCase();
          if (!clean) {
            setRows(prev => {
              const copy = [...prev];
              copy[i] = { ...copy[i], resolved: undefined, currency: undefined, price: undefined };
              return copy;
            });
            setFetchStatuses(prev => prev.map((s, idx) => (idx === i ? "idle" : s)));
            return;
          }
          try {
            setFetchStatuses(prev => prev.map((s, idx) => (idx === i ? "loading" : s)));
            const res = await fetch(`/api/quote?symbol=${encodeURIComponent(clean)}`);
            if (!res.ok) throw new Error("quote not found");
            const data = await res.json();
            const { resolved, price, currency } = data;
            setRows(prev => {
              const copy = [...prev];
              copy[i] = { ...copy[i], symbol: clean, resolved, price, currency };
              return copy;
            });
            setFetchStatuses(prev => prev.map((s, idx) => (idx === i ? "ok" : s)));
          } catch {
            setRows(prev => {
              const copy = [...prev];
              copy[i] = { ...copy[i], resolved: undefined, price: undefined, currency: undefined };
              return copy;
            });
            setFetchStatuses(prev => prev.map((s, idx) => (idx === i ? "error" : s)));
          }
        })
      );
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSymbols.join("|")]);

  // Keep prioritize defaulting to the first row if it's empty/invalid
  useEffect(() => {
    const first = rows[0]?.symbol?.trim().toUpperCase() ?? "";
    const current = (prioritize || "").trim().toUpperCase();
    const exists = rows.some(r => (r.symbol || "").trim().toUpperCase() === current);
    if (!current || !exists) setPrioritize(first);
  }, [rows, prioritize]);

  const tickerInputs: TickerInput[] = useMemo(() => {
    return rows
      .filter(r => r.symbol && typeof r.price === "number" && r.price > 0)
      .map(r => ({
        symbol: r.symbol.toUpperCase(),
        currency: (r.currency === "USD" ? "USD" : "CAD") as "USD" | "CAD",
        price: r.price as number,
        weightPct: r.weightPct,
      }));
  }, [rows]);

  const result = useMemo(() => {
    if (tickerInputs.length === 0) return null;
    return allocateShares(amount, tickerInputs, usdToCad, prioritize);
  }, [amount, usdToCad, tickerInputs, prioritize]);

  const totalWeight = useMemo(
    () =>
      rows
        .reduce((s, r) => s + (Number.isFinite(r.weightPct) ? r.weightPct : 0), 0)
        .toFixed(2),
    [rows]
  );

  const addRow = () => {
    setRows(prev => [...prev, { symbol: "", weightPct: 0 }]); // existing weights untouched
    setFetchStatuses(prev => [...prev, "idle"]);
  };

  const removeRow = (i: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== i));
    setFetchStatuses(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateSymbol = (i: number, val: string) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, symbol: val } : r)));
  };

  const updateWeight = (i: number, val: number) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, weightPct: val } : r)));
  };

  // CAD price helper (for the allocation cost table)
  const cadPriceOf = (symbol: string) => {
    const row = rows.find(r => (r.symbol || "").toUpperCase() === symbol.toUpperCase());
    if (!row || typeof row.price !== "number") return 0;
    return row.currency === "USD" ? row.price * usdToCad : row.price;
  };

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-3xl font-bold mb-2">Stock / ETF Monthly Allocator (CAD)</h1>
      <h2 className="text-2xl">Instructions:</h2>
      <ul className="px-6 list-disc mb-6 text-md">
        <li>Type a symbol; price & currency will fetch automatically. </li>
        <li>Weights don’t need to sum to 100%.</li> 
        <li>The prioritized symbol avoids rounding down when possible.</li>
      </ul>

      {/* Controls */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-center">
        <div>
          <label className="block text-md mb-1">Monthly budget (CAD)</label>
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
            value={prioritize}
            onChange={(e) => setPrioritize(e.target.value.trim().toUpperCase())}
            className="w-full text-center rounded-lg border border-neutral-300 p-2"
            placeholder={rows[0]?.symbol || "SPUS"}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Total weight (%)</label>
          <input
            value={totalWeight}
            readOnly
            className="w-full text-center rounded-lg border border-neutral-200 p-2 bg-neutral-50"
          />
        </div>
      </section>

      {/* Table */}
      <div className="overflow-x-auto border border-neutral-200 rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-neutral-50">
            <tr>
              <Th>Symbol (input)</Th>
              <Th>Currency</Th>
              <Th>Price</Th>
              <Th>Weight % (input)</Th>
              <Th>&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const status = fetchStatuses[i];
              const showCurrency =
                status === "ok" ? r.currency : status === "loading" ? "…" : status === "error" ? "—" : "";
              const showPrice =
                status === "ok"
                  ? (typeof r.price === "number" ? r.price.toFixed(2) : "")
                  : status === "loading"
                    ? "…"
                    : status === "error"
                      ? "—"
                      : "";

              return (
                <tr key={i} className="border-t">
                  <Td>
                    <input
                      value={r.symbol}
                      onChange={(e) => updateSymbol(i, e.target.value)}
                      className="w-full text-center rounded-md border border-neutral-300 p-2"
                      placeholder="e.g., SPUS"
                    />
                    {r.resolved && r.resolved !== r.symbol && (
                      <div className="text-xs text-neutral-500 mt-1">Resolved: {r.resolved}</div>
                    )}
                  </Td>
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
                      className="px-3 py-2 rounded-md border border-red-300 text-red-700 hover:bg-red-50"
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

      {/* Add row button moved below the table */}
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
        {!result ? (
          <p className="text-neutral-600">Enter at least one valid symbol and wait for its price to load.</p>
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
                {Object.entries(result.shares).map(([sym, qty]) => {
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
                  <Td className="text-right font-medium">${amount.toFixed(2)} CAD</Td>
                </tr>
                <tr className="border-t bg-neutral-50">
                    <Td className="font-medium text-left">Total (spent)</Td>
                  <Td>&nbsp;</Td>
                  <Td className="text-right font-medium">${result.spent.toFixed(2)} CAD</Td>
                </tr>
                <tr className="border-t bg-neutral-50">
                    <Td className="font-medium text-left">Leftover</Td>
                  <Td>&nbsp;</Td>
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
  return <th className={`text-center text-sm font-medium px-3 py-2 ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`text-center p-2 align-middle ${className}`}>{children}</td>;
}
