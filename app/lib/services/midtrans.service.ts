import axios from 'axios';
import crypto from 'crypto';

interface QRISParams {
    orderId: string;
    amount: number;
    customerDetails?: {
        firstName?: string;
        email?: string;
        phone?: string;
    };
}

class MidtransService {
    private serverKey: string;
    private clientKey: string;
    private isProduction: boolean;
    private baseUrl: string;
    private snapUrl: string;
    private authHeader: string;

    constructor() {
        this.serverKey = process.env.MIDTRANS_SERVER_KEY || '';
        this.clientKey = process.env.MIDTRANS_CLIENT_KEY || '';
        this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

        this.baseUrl = this.isProduction
            ? 'https://api.midtrans.com'
            : 'https://api.sandbox.midtrans.com';

        this.snapUrl = this.isProduction
            ? 'https://app.midtrans.com'
            : 'https://app.sandbox.midtrans.com';

        this.authHeader = Buffer.from(this.serverKey + ':').toString('base64');
    }

    async createQRIS({ orderId, amount, customerDetails = {} }: QRISParams) {
        try {
            if (!this.serverKey) {
                throw new Error('MIDTRANS_SERVER_KEY is missing');
            }

            const payload = {
                payment_type: 'qris',
                transaction_details: {
                    order_id: orderId,
                    gross_amount: Math.round(amount)
                },
                qris: {
                    acquirer: 'gopay'
                },
                customer_details: {
                    first_name: customerDetails.firstName || 'Customer',
                    email: customerDetails.email || '[email protected]',
                    phone: customerDetails.phone || '+62123456789'
                }
            };

            console.log('Creating Midtrans QRIS', { orderId, amount });

            const response = await axios.post(
                `${this.baseUrl}/v2/charge`,
                payload,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${this.authHeader}`
                    },
                    timeout: 30000
                }
            );

            const data = response.data;
            const qrAction = data.actions?.find((action: any) => action.name === 'generate-qr-code');

            // Check for QR code in multiple places
            let qrCodeUrl = qrAction?.url;

            // If no QR URL in actions, check qr_string (raw data)
            if (!qrCodeUrl && data.qr_string) {
                console.log('QR code URL not in actions, using qr_string', { orderId });
                qrCodeUrl = data.qr_string;
            }

            if (!qrCodeUrl && !data.qr_string) {
                console.warn('QR code data not found in Midtrans response', {
                    orderId,
                    hasActions: !!data.actions,
                    actionsCount: data.actions?.length || 0
                });
            }

            console.log('Midtrans QRIS created successfully', {
                orderId,
                transactionId: data.transaction_id,
                status: data.transaction_status
            });

            return {
                transactionId: data.transaction_id,
                orderId: data.order_id,
                qrCodeUrl: qrCodeUrl || null,
                qrCodeString: data.qr_string || null,
                status: data.transaction_status,
                expiryTime: data.expiry_time,
                grossAmount: data.gross_amount
            };
        } catch (error: any) {
            console.error('Failed to create Midtrans QRIS', error.response?.data || error.message);

            if (error.response?.status === 401) {
                throw new Error('Midtrans authentication failed - check server key');
            }
            if (error.response?.status === 400) {
                // If order_id duplicate, try to fetch status instead of failing
                if (error.response.data?.status_message?.includes('Order ID is already used')) {
                    console.log('♻️ Order ID exists, attempting to fetch status...');
                    return await this.getTransactionStatus(orderId);
                }
                throw new Error(`Midtrans validation error: ${error.response.data.status_message}`);
            }

            throw new Error(`Midtrans QRIS creation failed: ${error.message}`);
        }
    }

    async getTransactionStatus(orderId: string) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/v2/${orderId}/status`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Basic ${this.authHeader}`
                    }
                }
            );

            const data = response.data;

            // Map status response to similar format as create response
            // Note: Status API usually doesn't return QR string again, so we might miss that
            // but it's useful for checking if paid.
            return {
                transactionId: data.transaction_id,
                orderId: data.order_id,
                status: data.transaction_status,
                grossAmount: data.gross_amount,
                // Helper flags
                isPaid: data.transaction_status === 'settlement' || data.transaction_status === 'capture',
                isExpired: data.transaction_status === 'expire',
                isExisting: true
            };
        } catch (error: any) {
            console.error('Failed to get transaction status', error.message);
            throw error;
        }
    }

    isTransactionSuccessful(transactionStatus: string, fraudStatus = 'accept') {
        const successStatuses = ['capture', 'settlement'];
        return successStatuses.includes(transactionStatus) && fraudStatus === 'accept';
    }

    isTransactionFailed(transactionStatus: string) {
        const failedStatuses = ['deny', 'cancel', 'expire', 'failure'];
        return failedStatuses.includes(transactionStatus);
    }

    verifySignature(notification: any) {
        const {
            order_id,
            status_code,
            gross_amount,
            signature_key
        } = notification;

        const signatureString = order_id + status_code + gross_amount + this.serverKey;
        const hash = crypto
            .createHash('sha512')
            .update(signatureString)
            .digest('hex');

        return hash === signature_key;
    }
}

export default new MidtransService();
