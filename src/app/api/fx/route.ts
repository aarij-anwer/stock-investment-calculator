// src/app/api/fx/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();
  const quote = (searchParams.get("quote") || "CAD").toUpperCase();

  // Provider 1: frankfurter.app (no key)
  try {
    const r = await fetch(
      `https://api.frankfurter.app/latest?from=${base}&to=${quote}`,
      { cache: "no-store" }
    );
    if (r.ok) {
      const data = await r.json();
      const rate = data?.rates?.[quote];
      if (typeof rate === "number") {
        return NextResponse.json({ base, quote, rate, provider: "frankfurter" });
      }
    }
  } catch (_) {}

  // Provider 2: exchangerate.host (fallback)
  try {
    const r = await fetch(
      `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`,
      { cache: "no-store" }
    );
    if (r.ok) {
      const data = await r.json();
      const rate = data?.rates?.[quote];
      if (typeof rate === "number") {
        return NextResponse.json({ base, quote, rate, provider: "exchangerate.host" });
      }
    }
  } catch (_) {}

  return NextResponse.json({ error: "FX fetch failed" }, { status: 502 });
}
