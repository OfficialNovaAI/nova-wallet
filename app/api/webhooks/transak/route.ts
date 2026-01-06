import { NextRequest, NextResponse } from 'next/server';
import transakService from '@/lib/services/transak.service';
import paymentService from '@/lib/services/payment.service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Transak sends logic in `data` field, sometimes encrypted
        // For staging/hackathon with basic setup, it might be plain JSON payload directly.
        // We check both structure.

        let eventData = body;
        let orderId = body.webhookData?.id || body.data?.id;

        // If using the secure implementation with encrypted payload (as in original code)
        if (typeof body.data === 'string' && body.data.includes(':')) {
            try {
                const decrypted = transakService.decryptWebhook(body.data);
                eventData = decrypted;
                orderId = decrypted.webhookData?.id;
            } catch (e) {
                console.error('Decryption failed, assuming plain text or invalid', e);
            }
        }

        console.log('Webhook Transak Event:', eventData.eventID);

        if (eventData.eventID === 'ORDER_COMPLETED' || eventData.eventID === 'ORDER_SUCCESSFUL') {
            const transactionData = eventData.webhookData;
            await paymentService.handleTransakSuccess(transactionData.id, transactionData);
        } else if (eventData.eventID === 'ORDER_FAILED') {
            // Handle failure
        }

        return NextResponse.json({ status: 'OK' });
    } catch (error: any) {
        console.error('Webhook Error Transak:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
