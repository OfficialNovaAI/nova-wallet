
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, amount, side } = body;

        if (!symbol || !amount || !side) {
            return NextResponse.json(
                { error: "Missing required fields: symbol, amount, side" },
                { status: 400 }
            );
        }

        const externalApiUrl = "https://web-production-97230.up.railway.app/predict";

        const response = await fetch(externalApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                symbol,
                amount,
                side,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`External API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[predict-cost] error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch prediction" },
            { status: 500 }
        );
    }
}
