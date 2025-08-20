// src/lib/alloc.ts
export type Currency = "USD" | "CAD";

export interface TickerInput {
  symbol: string;
  currency: Currency;   // "USD" or "CAD"
  price: number;        // in the ticker's currency
  weightPct: number;    // target weight in percent (e.g., 40.95)
}

export interface AllocationResult {
  shares: Record<string, number>;
  spent: number;    // CAD
  leftover: number; // CAD
}

export function normalizeWeights(tickers: TickerInput[]): Record<string, number> {
  const map: Record<string, number> = {};
  const sum = tickers.reduce((acc, t) => acc + (isFinite(t.weightPct) ? t.weightPct : 0), 0);
  if (sum <= 0) {
    const eq = 1 / Math.max(1, tickers.length);
    tickers.forEach(t => (map[t.symbol] = eq));
    return map;
  }
  tickers.forEach(t => (map[t.symbol] = t.weightPct / sum));
  return map;
}

export function toCadPrice(t: TickerInput, usdToCad: number): number {
  return t.currency === "USD" ? t.price * usdToCad : t.price;
}

/**
 * Allocate integer shares to spend as close to amountCad as possible.
 * - Start at floor(target shares) for each ETF
 * - Try rounding up the prioritized symbol as much as possible
 * - Then greedily buy more using leftover (highest fractional remainder first, tiebreaker cheapest)
 */
export function allocateShares(
  amountCad: number,
  tickers: TickerInput[],
  usdToCad: number,
  prioritize?: string
): AllocationResult {
  const weights = normalizeWeights(tickers);
  const cadPrices: Record<string, number> = {};
  tickers.forEach(t => (cadPrices[t.symbol] = toCadPrice(t, usdToCad)));

  const targets: Record<string, number> = {};
  const floors: Record<string, number> = {};
  tickers.forEach(t => {
    const dollars = amountCad * (weights[t.symbol] ?? 0);
    const px = cadPrices[t.symbol];
    const target = px > 0 ? dollars / px : 0;
    targets[t.symbol] = target;
    floors[t.symbol] = Math.max(0, Math.floor(target));
  });

  const shares = { ...floors };
  let spent = tickers.reduce((s, t) => s + shares[t.symbol] * cadPrices[t.symbol], 0);
  let leftover = amountCad - spent;

  const remainders: Record<string, number> = {};
  tickers.forEach(t => (remainders[t.symbol] = targets[t.symbol] - floors[t.symbol]));

  // 1) Prioritize: buy as many as possible first
  if (prioritize) {
    const px = cadPrices[prioritize];
    if (isFinite(px) && px > 0) {
      while (leftover + 1e-9 >= px) {
        shares[prioritize] = (shares[prioritize] ?? 0) + 1;
        leftover -= px;
      }
    }
  }

  // 2) Greedy fill with remainder-based preference, then cheapest
  let guard = 0;
  while (guard++ < 10000) {
    const affordable = tickers
      .filter(t => cadPrices[t.symbol] <= leftover + 1e-9)
      .map(t => ({ sym: t.symbol, rem: remainders[t.symbol] ?? 0, px: cadPrices[t.symbol] }))
      .sort((a, b) => (b.rem !== a.rem ? b.rem - a.rem : a.px - b.px));

    if (affordable.length === 0) break;

    const choice = affordable[0];
    if (choice.px <= leftover + 1e-9) {
      shares[choice.sym] = (shares[choice.sym] ?? 0) + 1;
      leftover -= choice.px;
      continue;
    }

    // Fallback: absolutely cheapest affordable
    const cheapest = tickers
      .filter(t => cadPrices[t.symbol] <= leftover + 1e-9)
      .map(t => ({ sym: t.symbol, px: cadPrices[t.symbol] }))
      .sort((a, b) => a.px - b.px)[0];

    if (cheapest) {
      shares[cheapest.sym] = (shares[cheapest.sym] ?? 0) + 1;
      leftover -= cheapest.px;
    } else {
      break;
    }
  }

  spent = amountCad - leftover;
  return { shares, spent, leftover };
}
