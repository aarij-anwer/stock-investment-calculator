// src/app/api/quote/route.ts
import yahooFinance from "yahoo-finance2";
import { NextResponse } from "next/server";

const SUFFIXES = ["", ".TO", ".NE", ".TSX", ".CN"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("symbol") || "").trim().toUpperCase();

  if (!raw) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  for (const suf of SUFFIXES) {
    const sym = `${raw}${suf}`;
    try {
      const quote = await yahooFinance.quote(sym);
      if (quote?.regularMarketPrice && quote?.currency) {
        return NextResponse.json({
          input: raw,
          resolved: sym,
          price: quote.regularMarketPrice,
          currency: quote.currency as "USD" | "CAD" | string,
        });
      }
    } catch {
      // try next suffix
    }
  }

  return NextResponse.json(
    { error: `Could not resolve price for ${raw}` },
    { status: 404 }
  );
}
