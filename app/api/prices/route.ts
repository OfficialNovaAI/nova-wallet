import { NextResponse } from "next/server";

// CoinGecko API endpoint (free tier, no API key needed)
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

// Token ID mapping for CoinGecko
const TOKEN_IDS: Record<string, string> = {
    'ETH': 'ethereum',
    'MNT': 'mantle',
    'LSK': 'lisk',
    'MATIC': 'matic-network', // Updated to correct CoinGecko ID
    'POL': 'matic-network',
    'USDC': 'usd-coin',
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbols } = body as { symbols: string[] };

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json(
                { error: "Symbols array is required" },
                { status: 400 }
            );
        }

        // Get CoinGecko IDs for the requested symbols
        const ids = symbols
            .map(symbol => TOKEN_IDS[symbol])
            .filter(id => id !== undefined)
            .join(',');

        if (!ids) {
            return NextResponse.json(
                { error: "No valid token symbols provided" },
                { status: 400 }
            );
        }

        // Fetch prices from CoinGecko with 24h change
        const response = await fetch(
            `${COINGECKO_API}?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
            {
                headers: {
                    'Accept': 'application/json',
                },
                next: { revalidate: 60 } // Cache for 60 seconds
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();

        // Convert back to symbol-based format
        // Structure: { ETH: { price: 3000, change: 2.5 } }
        const prices: Record<string, { price: number; change: number }> = {};

        symbols.forEach(symbol => {
            const id = TOKEN_IDS[symbol];
            if (id && data[id]) {
                prices[symbol] = {
                    price: data[id].usd || 0,
                    change: data[id].usd_24h_change || 0
                };
            }
        });

        return NextResponse.json({ prices });
    } catch (error) {
        console.error("[prices] error", error);
        return NextResponse.json(
            {
                error: "Failed to fetch token prices",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
