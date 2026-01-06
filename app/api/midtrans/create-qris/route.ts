import { NextRequest, NextResponse } from 'next/server';
import midtransService from '@/lib/services/midtrans.service';
import paymentService from '@/lib/services/payment.service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { paymentId, amount } = body; // Amount in IDR

        if (!paymentId || !amount) {
            return NextResponse.json(
                { error: 'Missing paymentId or amount' },
                { status: 400 }
            );
        }

        const payment = await paymentService.getPaymentDetails(paymentId);

        // Safety check: Don't create new Qris if already exists
        if (payment.midtransOrderId) {
            // If it exists, just return existing data if possible, or fetch status
            // For simplicity, we create a specialized response effectively saying "already exists"
            // But better is to just return success if we can retrieve it.
            // Let's assume frontend handles "if midtransOrderId exists, don't call this".
            // But for robustness:
            const status = await midtransService.getTransactionStatus(payment.midtransOrderId);
            return NextResponse.json({
                success: true,
                data: {
                    ...status,
                    isExisting: true
                }
            });
        }

        // Create unique Order ID for Midtrans 
        // Format: PAY-{paymentId}-{timestamp} to allow retires if first fails
        const orderId = `PAY-${paymentId.substring(0, 8)}-${Date.now()}`;

        const result = await midtransService.createQRIS({
            orderId,
            amount: parseFloat(amount),
            customerDetails: {
                firstName: "Guest User",
                email: "[email protected]"
            }
        });

        // Update locally
        await paymentService.updatePaymentStatus(paymentId, 'WAITING_PAYMENT', {
            midtransOrderId: orderId,
            midtransTransactionId: result.transactionId
        });

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('API Error /midtrans/create-qris:', error.message);
        return NextResponse.json(
            { error: error.message || 'Failed to create QRIS' },
            { status: 500 }
        );
    }
}
