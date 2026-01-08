// src/app/api/quote/route.ts
import yahooFinance from "yahoo-finance2";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUFFIXES = ["", ".TO", ".NE", ".TSX", ".CN"];
const CAD_SUFFIXES = new Set([".TO", ".NE", ".TSX", ".CN"]);
const YAHOO_QUOTE_URL =
  "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const YAHOO_UA = "Mozilla/5.0 (compatible; stock-investment-calculator/1.0)";
const STOOQ_URL = "https://stooq.com/q/l/?s=";
const STOOQ_FIELDS = "&f=sd2t2ohlcv&h&e=csv";
const CACHE_TTL_MS = 60_000;

type QuotePayload = {
  input: string;
  resolved: string;
  price: number;
  currency: "USD" | "CAD" | string;
  provider: string;
};

const quoteCache = new Map<string, { ts: number; data: QuotePayload }>();

function getCachedQuote(key: string): QuotePayload | null {
  const cached = quoteCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > CACHE_TTL_MS) {
    quoteCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCachedQuote(key: string, data: QuotePayload) {
  quoteCache.set(key, { ts: Date.now(), data });
}

function inferCurrency(symbol: string): "USD" | "CAD" {
  for (const suf of CAD_SUFFIXES) {
    if (symbol.endsWith(suf)) return "CAD";
  }
  return "USD";
}

function toStooqSymbol(symbol: string): string {
  const lower = symbol.toLowerCase();
  if (lower.endsWith(".us") || lower.endsWith(".ca")) return lower;
  if (
    lower.endsWith(".to") ||
    lower.endsWith(".ne") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".cn")
  ) {
    return lower.replace(/\.(to|ne|tsx|cn)$/, ".ca");
  }
  return `${lower}.us`;
}

function parseStooqCsv(csv: string): number | null {
  const trimmed = csv.trim();
  if (!trimmed) return null;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length === 0) return null;
  if (lines.length === 1 && lines[0].toLowerCase().includes("no data")) {
    return null;
  }

  let header: string[] = [];
  let values: string[] = [];
  if (lines.length >= 2) {
    header = lines[0].split(",");
    values = lines[1].split(",");
    if (header[0].trim().toLowerCase() !== "symbol") {
      header = ["Symbol", "Date", "Time", "Open", "High", "Low", "Close", "Volume"];
      values = lines[0].split(",");
    }
  } else {
    header = ["Symbol", "Date", "Time", "Open", "High", "Low", "Close", "Volume"];
    values = lines[0].split(",");
  }

  const closeIdx = header.findIndex(
    (h) => h.trim().toLowerCase() === "close"
  );
  const raw = closeIdx >= 0 ? values[closeIdx] : values[6];
  const price = Number(raw);
  return Number.isFinite(price) ? price : null;
}

async function fetchStooqQuote(
  symbol: string
): Promise<{ price: number; currency: "USD" | "CAD" } | null> {
  const stooqSymbol = toStooqSymbol(symbol);
  const r = await fetch(
    `${STOOQ_URL}${encodeURIComponent(stooqSymbol)}${STOOQ_FIELDS}`,
    { cache: "no-store" }
  );
  if (!r.ok) return null;
  const text = await r.text();
  const price = parseStooqCsv(text);
  if (typeof price !== "number") return null;
  return { price, currency: inferCurrency(symbol) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("symbol") || "").trim().toUpperCase();
  const debug = searchParams.get("debug") === "1";
  const errors: Array<{ symbol: string; provider: string; message: string }> =
    [];
  const cached = debug ? null : getCachedQuote(raw);

  if (!raw) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }
  if (cached) return NextResponse.json(cached);

  let yahooBlocked = false;
  let yahooDirectBlocked = false;

  for (const suf of SUFFIXES) {
    const sym = `${raw}${suf}`;
    if (!yahooBlocked) {
      try {
        const quote = await yahooFinance.quote(sym);
        if (
          typeof quote?.regularMarketPrice === "number" &&
          typeof quote?.currency === "string"
        ) {
          const payload = {
            input: raw,
            resolved: sym,
            price: quote.regularMarketPrice,
            currency: quote.currency as "USD" | "CAD" | string,
            provider: "yahoo-finance2",
          };
          if (!debug) setCachedQuote(raw, payload);
          return NextResponse.json(payload);
        }
        if (debug) {
          errors.push({
            symbol: sym,
            provider: "yahoo-finance2",
            message: "Missing price or currency in response",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.toLowerCase().includes("too many requests")) {
          yahooBlocked = true;
        }
        if (debug) {
          errors.push({
            symbol: sym,
            provider: "yahoo-finance2",
            message,
          });
        }
      }
    }

    if (!yahooDirectBlocked) {
      try {
        const r = await fetch(`${YAHOO_QUOTE_URL}${encodeURIComponent(sym)}`, {
          cache: "no-store",
          headers: { "User-Agent": YAHOO_UA },
        });
        if (r.ok) {
          const data = await r.json();
          const result = data?.quoteResponse?.result?.[0];
          const price = result?.regularMarketPrice;
          const currency = result?.currency;
          if (typeof price === "number" && typeof currency === "string") {
            const payload = {
              input: raw,
              resolved: sym,
              price,
              currency,
              provider: "yahoo-direct",
            };
            if (!debug) setCachedQuote(raw, payload);
            return NextResponse.json(payload);
          }
          if (debug) {
            errors.push({
              symbol: sym,
              provider: "yahoo-direct",
              message: "Missing price or currency in response",
            });
          }
        } else {
          if (r.status === 401 || r.status === 429) {
            yahooDirectBlocked = true;
          }
          if (debug) {
            errors.push({
              symbol: sym,
              provider: "yahoo-direct",
              message: `HTTP ${r.status} ${r.statusText}`,
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (debug) {
          errors.push({
            symbol: sym,
            provider: "yahoo-direct",
            message,
          });
        }
      }
    }

    try {
      const stooq = await fetchStooqQuote(sym);
      if (stooq) {
        const payload = {
          input: raw,
          resolved: sym,
          price: stooq.price,
          currency: stooq.currency,
          provider: "stooq",
        };
        if (!debug) setCachedQuote(raw, payload);
        return NextResponse.json(payload);
      }
      if (debug) {
        errors.push({
          symbol: sym,
          provider: "stooq",
          message: "No quote in response",
        });
      }
    } catch (err) {
      if (debug) {
        errors.push({
          symbol: sym,
          provider: "stooq",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  return NextResponse.json(
    {
      error: `Could not resolve price for ${raw}`,
      ...(debug ? { debug: errors } : {}),
    },
    { status: 404 }
  );
}
