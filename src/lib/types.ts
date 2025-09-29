// Shared types for allocator

export type Currency = 'USD' | 'CAD';

export type Row = {
  symbol: string;
  weightPct: number;
  resolved?: string;
  currency?: Currency;
  price?: number;
};

export type TickerInput = {
  symbol: string;
  currency: Currency;
  price: number;
  weightPct: number;
};

export type FetchState = 'idle' | 'loading' | 'ok' | 'error';

export type AllocationResult = {
  shares: Record<string, number>;
  spent: number; // in CAD
  leftover: number; // in CAD
};
