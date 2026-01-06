import { NextRequest, NextResponse } from 'next/server';
import paymentService from '@/lib/services/payment.service';
import midtransService from '@/lib/services/midtrans.service';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }

    try {
        let country = req.headers.get('x-vercel-ip-country') || 'US';

        if (country === 'US' || !country) {
            const url = new URL(req.url);
            if (url.searchParams.get('country') === 'ID') {
                country = 'ID';
            }
        }

        let payment = await paymentService.getPaymentDetails(id, country);

        // --- PROACTIVE SYNC (Fix for Localhost / Missing Webhooks) ---
        // If payment is waiting for fiat but has an order ID, check Midtrans
        if ((payment.status === 'PENDING' || payment.status === 'WAITING_PAYMENT') && payment.midtransOrderId) {
            try {
                // Check status from Midtrans
                const status = await midtransService.getTransactionStatus(payment.midtransOrderId);

                // If Midtrans says it's success but our DB says pending -> UPDATE IT
                if (status.isPaid) {
                    console.log('🔄 Proactive Sync: Midtrans Paid, updating DB...', { id });

                    // We need to mimic the webhook payload structure slightly for handleMidtransSuccess
                    // Or just call the success handler with minimal needed data
                    await paymentService.handleMidtransSuccess(payment.midtransOrderId, {
                        transaction_id: status.transactionId,
                        transaction_time: new Date().toISOString() // Approximate
                    });

                    // Refresh payment data after update
                    payment = await paymentService.getPaymentDetails(id, country);
                }
            } catch (err: any) {
                console.warn('⚠️ Proactive Sync failed:', err.message);
                // Don't fail the request, just ignore sync error
            }
        }
        // -----------------------------------------------------------

        return NextResponse.json({ success: true, data: payment });
    } catch (error: any) {
        console.error('API Error /payments/[id]:', error.message);
        return NextResponse.json(
            { error: error.message || 'Payment not found' },
            { status: 404 }
        );
    }
}
