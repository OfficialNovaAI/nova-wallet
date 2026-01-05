import { NextRequest, NextResponse } from 'next/server';
import paymentService from '@/lib/services/payment.service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('API /payments/create received:', body); // DEBUG LOG
        const { cryptoAmount, cryptoCurrency, receiverWallet, network } = body;

        if (!cryptoAmount || !cryptoCurrency || !receiverWallet) {
            return NextResponse.json(
                { error: 'Missing required fields: cryptoAmount, cryptoCurrency, receiverWallet' },
                { status: 400 }
            );
        }

        const result = await paymentService.createPaymentRequest({
            cryptoAmount: parseFloat(cryptoAmount),
            cryptoCurrency,
            receiverWallet,
            network
        });

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('API Error /payments/create:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
