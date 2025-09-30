'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AllocationResult,
  Currency,
  FetchState,
  Row,
  TickerInput,
} from './types';

/* ------------------------------ Utilities ------------------------------ */

export function normalizeSymbol(sym: string): string {
  return (sym || '').trim().toUpperCase();
}

export function totalWeight(rows: Row[]): number {
  return rows.reduce(
    (sum, r) => sum + (Number.isFinite(r.weightPct) ? Number(r.weightPct) : 0),
    0
  );
}

export function cadPriceOfRow(row: Row, usdToCad: number): number {
  if (!row || typeof row.price !== 'number' || row.price <= 0) return 0;
  return row.currency === 'USD' ? row.price * usdToCad : row.price;
}

export function cadPriceLookup(
  rows: Row[],
  usdToCad: number
): (symbol: string) => number {
  return (symbol: string) => {
    const s = normalizeSymbol(symbol);
    const row = rows.find((r) => normalizeSymbol(r.symbol) === s);
    return row ? cadPriceOfRow(row, usdToCad) : 0;
  };
}

export function buildTickerInputs(rows: Row[]): TickerInput[] {
  return rows
    .filter(
      (r) =>
        r.symbol &&
        typeof r.price === 'number' &&
        Number.isFinite(r.price) &&
        r.price > 0
    )
    .map((r) => ({
      symbol: normalizeSymbol(r.symbol),
      currency: (r.currency === 'USD' ? 'USD' : 'CAD') as Currency,
      price: r.price as number,
      weightPct: Number(r.weightPct) || 0,
    }));
}

/* ----------------------------- Core (pure) ----------------------------- */

export function allocateShares(
  budgetCad: number,
  inputs: TickerInput[],
  usdToCad: number,
  prioritize?: string
): AllocationResult {
  const shares: Record<string, number> = {};
  if (!Array.isArray(inputs) || inputs.length === 0 || budgetCad <= 0) {
    return { shares, spent: 0, leftover: Math.max(0, budgetCad) };
  }

  const prio = prioritize ? normalizeSymbol(prioritize) : undefined;
  const sumW = inputs.reduce(
    (s, i) => s + (Number.isFinite(i.weightPct) ? Number(i.weightPct) : 0),
    0
  );

  const weights = inputs.map((i) => ({
    sym: normalizeSymbol(i.symbol),
    cadPrice: i.currency === 'USD' ? i.price * usdToCad : i.price,
    weight: sumW > 0 ? i.weightPct / sumW : 1 / inputs.length,
  }));

  // Initial floor allocation
  let spent = 0;
  for (const w of weights) {
    if (w.cadPrice <= 0) continue;
    const targetCad = budgetCad * w.weight;
    const qty = Math.floor(targetCad / w.cadPrice);
    const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
    if (q > 0) {
      shares[w.sym] = (shares[w.sym] ?? 0) + q;
      spent += q * w.cadPrice;
    } else {
      shares[w.sym] = shares[w.sym] ?? 0;
    }
  }

  // Greedy fill with leftover
  let leftover = Math.max(0, budgetCad - spent);
  const ordered = [...weights].sort((a, b) => {
    if (prio && (a.sym === prio || b.sym === prio)) {
      return a.sym === prio ? -1 : 1;
    }
    return b.weight - a.weight;
  });

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const w of ordered) {
      if (w.cadPrice > 0 && leftover + 1e-8 >= w.cadPrice) {
        shares[w.sym] = (shares[w.sym] ?? 0) + 1;
        leftover -= w.cadPrice;
        spent += w.cadPrice;
        progressed = true;
      }
    }
  }

  return { shares, spent, leftover };
}

/* ---------------------------- React utilities --------------------------- */

export function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/** Poll USD→CAD. Falls back to initial on error. */
export function useFxRate(initial = 1.4) {
  const [rate, setRate] = useState(initial);
  const [provider, setProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchFx = async () => {
      try {
        if (!mounted) return;
        setLoading(true);
        const res = await fetch('/api/fx?base=USD&quote=CAD', {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('fx error');
        const data = (await res.json()) as { rate?: number; provider?: string };
        if (typeof data.rate === 'number' && Number.isFinite(data.rate)) {
          setRate(data.rate);
          setProvider(data.provider ?? null);
        }
      } catch {
        // keep old rate on failure
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchFx();
    const id = setInterval(fetchFx, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return { rate, provider, loading, setRate };
}

/**
 * Resolve quotes for current rows. Keeps a status per row.
 * IMPORTANT: This hook does not reference any outer `rows` variable.
 */
export function useQuoteResolver(
  rows: Row[],
  setRows: Dispatch<SetStateAction<Row[]>>
) {
  const [fetchStatuses, setFetchStatuses] = useState<FetchState[]>([]);

  // Keep statuses array length aligned with rows (preserve existing statuses)
  useEffect(() => {
    setFetchStatuses((prev) => {
      if (prev.length === rows.length) return prev;
      const next = prev.slice(0, rows.length);
      while (next.length < rows.length) next.push('idle');
      return next;
    });
  }, [rows.length]);

  const symbols = useMemo(() => rows.map((r) => r.symbol || ''), [rows]);
  const debouncedSymbols = useDebounced(symbols, 400);
  const triggerKey = useMemo(
    () => debouncedSymbols.map((s) => s.trim().toUpperCase()).join('|'),
    [debouncedSymbols]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveAt(i: number, rawSym: string) {
      const clean = normalizeSymbol(rawSym);

      // Empty symbol → clear row fields
      if (!clean) {
        if (cancelled) return;
        setRows((prev) => {
          const copy = [...prev];
          if (copy[i]) {
            copy[i] = {
              ...copy[i],
              resolved: undefined,
              currency: undefined,
              price: undefined,
            };
          }
          return copy;
        });
        setFetchStatuses((prev) => {
          const next = [...prev];
          next[i] = 'idle';
          return next;
        });
        return;
      }

      try {
        if (cancelled) return;
        setFetchStatuses((prev) => {
          const next = [...prev];
          next[i] = 'loading';
          return next;
        });

        const res = await fetch(
          `/api/quote?symbol=${encodeURIComponent(clean)}`
        );
        if (!res.ok) throw new Error('quote not found');
        const data = (await res.json()) as {
          resolved?: string;
          price?: number;
          currency?: Currency;
        };

        if (cancelled) return;
        setRows((prev) => {
          const copy = [...prev];
          if (copy[i]) {
            copy[i] = {
              ...copy[i],
              symbol: clean,
              resolved: data.resolved,
              price: typeof data.price === 'number' ? data.price : undefined,
              currency: data.currency,
            };
          }
          return copy;
        });
        setFetchStatuses((prev) => {
          const next = [...prev];
          next[i] = 'ok';
          return next;
        });
      } catch {
        if (cancelled) return;
        setRows((prev) => {
          const copy = [...prev];
          if (copy[i]) {
            copy[i] = {
              ...copy[i],
              resolved: undefined,
              price: undefined,
              currency: undefined,
            };
          }
          return copy;
        });
        setFetchStatuses((prev) => {
          const next = [...prev];
          next[i] = 'error';
          return next;
        });
      }
    }

    // Kick off all resolutions in parallel
    (async () => {
      await Promise.all(debouncedSymbols.map((sym, i) => resolveAt(i, sym)));
    })();

    return () => {
      cancelled = true;
    };
  }, [triggerKey, setRows]);

  return { fetchStatuses, setFetchStatuses };
}

/* ---------------------------- Memoized helpers --------------------------- */

export function useTickerInputs(rows: Row[]) {
  return useMemo(() => buildTickerInputs(rows), [rows]);
}

export function useAllocation(
  amountCad: number,
  usdToCad: number,
  tickerInputs: TickerInput[],
  prioritize?: string
) {
  console.log(tickerInputs);
  return useMemo(() => {
    if (!tickerInputs || tickerInputs.length === 0 || amountCad <= 0)
      return null;
    return allocateShares(amountCad, tickerInputs, usdToCad, prioritize);
  }, [amountCad, usdToCad, tickerInputs, prioritize]);
}
