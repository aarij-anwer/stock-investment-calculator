// src/lib/types.ts
export type Currency = "USD" | "CAD" | string;

export interface Row {
  symbol: string;           // user input
  resolved?: string;        // resolved symbol (e.g., WSHR.NE)
  currency?: Currency;      // fetched
  price?: number;           // fetched (native currency)
  weightPct: number;        // editable; can be >100 or <0
}
