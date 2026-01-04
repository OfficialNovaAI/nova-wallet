// nova-wallet/app/api/blockchain/route.ts
// Server-side API route for blockchain analysis

import { NextRequest, NextResponse } from 'next/server';
import { 
    getPortfolioAnalysis, 
    getTokenActivity, 
    getTransactionStats 
} from '@/lib/blockchainAgentWrapper';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, address, chainId, timeframeDays } = body;

        if (!address || !chainId) {
            return NextResponse.json(
                { error: 'Address and chainId are required' },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case 'portfolio':
                result = await getPortfolioAnalysis(address, chainId);
                break;

            case 'token_activity':
                result = await getTokenActivity(address, chainId, timeframeDays);
                break;

            case 'transaction_stats':
                result = await getTransactionStats(address, chainId);
                break;

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true, data: result });

    } catch (error: any) {
        console.error('[Blockchain API Error]', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message || 'Failed to analyze blockchain data' 
            },
            { status: 500 }
        );
    }
}