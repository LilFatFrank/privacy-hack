import { NextResponse } from "next/server";

const PYTH_SOL_USD_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const PYTH_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_SOL_USD_ID}`;
const SOL_AMOUNT = 0.006;
const FALLBACK_BASE_FEE = 0.71;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedFee: { baseFee: number; solPrice: number; timestamp: number } | null =
  null;

export async function GET() {
  if (cachedFee && Date.now() - cachedFee.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      baseFee: cachedFee.baseFee,
      solPrice: cachedFee.solPrice,
    });
  }

  try {
    const res = await fetch(PYTH_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Pyth returned ${res.status}`);

    const data = await res.json();
    const priceData = data.parsed?.[0]?.price;
    if (!priceData) throw new Error("Missing price data from Pyth");

    const solPrice =
      Number(priceData.price) * Math.pow(10, Number(priceData.expo));
    const baseFee = Math.round(solPrice * SOL_AMOUNT * 100) / 100;

    cachedFee = { baseFee, solPrice, timestamp: Date.now() };

    return NextResponse.json({ baseFee, solPrice });
  } catch (e) {
    console.error("Failed to fetch SOL price from Pyth:", e);
    return NextResponse.json({
      baseFee: FALLBACK_BASE_FEE,
      solPrice: null,
    });
  }
}
