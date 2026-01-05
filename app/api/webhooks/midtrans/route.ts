import { NextRequest, NextResponse } from 'next/server';
import midtransService from '@/lib/services/midtrans.service';
import paymentService from '@/lib/services/payment.service';

export async function POST(req: NextRequest) {
    try {
        // Check if body is empty or not
        const text = await req.text();
        if (!text) return NextResponse.json({ error: 'Empty body' }, { status: 400 });

        const notification = JSON.parse(text);

        // 1. Verify Signature
        // 💡 Hackathon Tip: You can disable this check in local/dev if hashing is tricky,
        // but better to keep for "production-ready" vibes.
        const isValid = midtransService.verifySignature(notification);
        if (!isValid) {
            console.error('❌ Invalid Midtrans Signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        const {
            order_id,
            transaction_status,
            fraud_status
        } = notification;

        console.log(`Webhook Midtrans: ${order_id} -> ${transaction_status}`);

        // 2. Handle Status
        if (midtransService.isTransactionSuccessful(transaction_status, fraud_status)) {
            await paymentService.handleMidtransSuccess(order_id, notification);
        } else if (midtransService.isTransactionFailed(transaction_status)) {
            // Find payment by midtransOrderId
            // Need to query payment first or catch in service
            // For hackathon, we skip explicit failure updates to keep user in "Try Again" loop or "Pending"
        }

        return NextResponse.json({ status: 'OK' });
    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
