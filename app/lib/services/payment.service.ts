import { PrismaClient } from '@prisma/client';
import transakService from './transak.service';

const prisma = new PrismaClient();

interface CreatePaymentParams {
    cryptoAmount: number;
    cryptoCurrency: string;
    receiverWallet: string;
    network?: string;
}

class PaymentService {
    async createPaymentRequest(data: CreatePaymentParams) {
        const { cryptoAmount, cryptoCurrency, receiverWallet, network = 'ethereum' } = data;

        try {
            const quote = await transakService.getQuote({
                cryptoAmount,
                cryptoCurrency,
                fiatCurrency: 'USD',
                network,
                isBuyOrSell: 'BUY'
            });

            const paymentRequest = await prisma.paymentRequest.create({
                data: {
                    cryptoAmount: parseFloat(cryptoAmount.toString()),
                    cryptoCurrency,
                    fiatAmount: quote.fiatAmount,
                    fiatCurrency: 'USD',
                    receiverWallet,
                    network,
                    status: 'PENDING',
                    quoteId: quote.quoteId,
                    conversionRate: quote.conversionPrice,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
                }
            });

            const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentRequest.id}`;

            console.log('Payment request created', {
                id: paymentRequest.id,
                amount: cryptoAmount,
                currency: cryptoCurrency
            });

            return {
                id: paymentRequest.id,
                paymentUrl,
                expiresAt: paymentRequest.expiresAt,
                quote: {
                    cryptoAmount: quote.cryptoAmount,
                    fiatAmount: quote.fiatAmount,
                    fiatCurrency: 'USD'
                }
            };
        } catch (error: any) {
            console.error('Failed to create payment request', error);
            throw new Error('Failed to create payment request: ' + error.message);
        }
    }

    async getPaymentDetails(paymentId: string, userCountry = 'US') {
        const payment = await prisma.paymentRequest.findUnique({
            where: { id: paymentId }
        });

        if (!payment) {
            throw new Error('Payment request not found');
        }

        if (new Date() > payment.expiresAt && payment.status === 'PENDING') {
            await this.updatePaymentStatus(paymentId, 'EXPIRED');
            // We return object with expired status, simpler for frontend to handle than throwing
            return { ...payment, status: 'EXPIRED' };
        }

        const isIndonesian = userCountry === 'ID' || userCountry === 'INDONESIA';

        return {
            ...payment,
            paymentMethod: isIndonesian ? 'QRIS' : 'TRANSAK',
            userCountry
        };
    }

    async updatePaymentStatus(paymentId: string, status: string, metadata: any = {}) {
        try {
            console.log(`Updating payment ${paymentId} to ${status}`);
            return await prisma.paymentRequest.update({
                where: { id: paymentId },
                data: {
                    status: status as any,
                    ...metadata,
                    updatedAt: new Date()
                }
            });
        } catch (error: any) {
            console.error('Failed to update payment status', { paymentId, status, error: error.message });
            throw error;
        }
    }

    async handleMidtransSuccess(orderId: string, transactionData: any) {
        const payment = await prisma.paymentRequest.findUnique({
            where: { midtransOrderId: orderId }
        });

        if (!payment) {
            console.error('Payment not found for Midtrans order', orderId);
            throw new Error('Payment not found for Midtrans order');
        }

        console.log('💰 Midtrans payment successful', { paymentId: payment.id });

        // Update to PROCESSING_CRYPTO first
        await this.updatePaymentStatus(payment.id, 'PROCESSING_CRYPTO', {
            midtransTransactionId: transactionData.transaction_id,
            midtransPaidAt: new Date(transactionData.transaction_time),
            errorMessage: null
        });

        try {
            // Trigger Transak Order
            console.log('🚀 Triggering Transak order for payment', { paymentId: payment.id });

            const transakOrder = await transakService.createOrder({
                fiatAmount: payment.fiatAmount,
                fiatCurrency: payment.fiatCurrency,
                cryptoCurrency: payment.cryptoCurrency,
                walletAddress: payment.receiverWallet,
                network: payment.network,
                partnerOrderId: payment.id
            });

            console.log('✅ Transak order created', { transakOrderId: transakOrder.id });

            // Update with Transak Order ID
            await this.updatePaymentStatus(payment.id, 'PROCESSING_CRYPTO', {
                transakOrderId: transakOrder.id
            });

        } catch (error: any) {
            console.error('Failed to create Transak order', { error: error.message });

            // Don't fail the whole process, log error
            await this.updatePaymentStatus(payment.id, 'PROCESSING_CRYPTO', {
                errorMessage: `Transak creation failed: ${error.message}`
            });
        }
    }

    async handleTransakSuccess(orderId: string, transactionData: any) {
        const payment = await prisma.paymentRequest.findFirst({
            where: {
                OR: [
                    { transakOrderId: orderId },
                    { id: transactionData.partnerOrderId }
                ]
            }
        });

        if (!payment) {
            throw new Error('Payment not found for Transak order');
        }

        await this.updatePaymentStatus(payment.id, 'COMPLETED', {
            cryptoSent: transactionData.cryptoAmount,
            transakCompletedAt: new Date(),
            txHash: transactionData.transactionHash
        });

        console.log('Payment completed', { paymentId: payment.id });
    }
}

export default new PaymentService();
