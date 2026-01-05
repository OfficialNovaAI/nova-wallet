import { NextRequest, NextResponse } from 'next/server';
import paymentService from '@/lib/services/payment.service';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }

    try {
        // 💡 Hackathon Tip: Better geolocation for country detection
        // Vercel sets 'x-vercel-ip-country' header automatically
        let country = req.headers.get('x-vercel-ip-country') || 'US';

        // Fallback for local dev or when header missing
        if (country === 'US' || !country) {
            // Check if using a test param ?country=ID for demo
            const url = new URL(req.url);
            if (url.searchParams.get('country') === 'ID') {
                country = 'ID';
            }
        }

        const payment = await paymentService.getPaymentDetails(id, country);

        return NextResponse.json({ success: true, data: payment });
    } catch (error: any) {
        console.error('API Error /payments/[id]:', error.message);
        return NextResponse.json(
            { error: error.message || 'Payment not found' },
            { status: 404 }
        );
    }
}
