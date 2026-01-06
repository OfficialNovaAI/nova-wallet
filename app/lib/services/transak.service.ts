import axios from 'axios';
import crypto from 'crypto';

interface QuoteParams {
    cryptoAmount: number;
    cryptoCurrency: string;
    fiatCurrency?: string;
    network?: string;
    isBuyOrSell?: 'BUY' | 'SELL';
}

interface OrderParams {
    fiatAmount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
    walletAddress: string;
    network?: string;
    partnerOrderId: string;
}

interface WidgetConfig {
    cryptoCurrency: string;
    cryptoAmount?: number;
    fiatCurrency?: string;
    fiatAmount?: number;
    walletAddress: string;
    network?: string;
    email?: string;
    partnerOrderId: string;
}

class TransakService {
    private apiKey: string;
    private apiSecret: string;
    private environment: string;
    private baseUrl: string;
    private widgetUrl: string;

    constructor() {
        this.apiKey = process.env.TRANSAK_API_KEY || '';
        this.apiSecret = process.env.TRANSAK_API_SECRET || '';
        this.environment = process.env.TRANSAK_ENVIRONMENT || 'STAGING';

        this.baseUrl = this.environment === 'PRODUCTION'
            ? 'https://api.transak.com'
            : 'https://api-stg.transak.com';

        this.widgetUrl = this.environment === 'PRODUCTION'
            ? 'https://global.transak.com'
            : 'https://global-stg.transak.com';
    }

    async getQuote({
        cryptoAmount,
        cryptoCurrency,
        fiatCurrency = 'USD',
        network = 'ethereum',
        isBuyOrSell = 'BUY'
    }: QuoteParams) {
        try {
            if (!this.apiKey || this.apiKey.includes('apikey')) {
                console.warn('⚠️ Transak API Key not set. Using MOCK data.');
                return {
                    quoteId: 'mock-quote-' + Date.now(),
                    fiatAmount: parseFloat((cryptoAmount * 3500).toFixed(2)),
                    cryptoAmount: parseFloat(cryptoAmount.toString()),
                    fiatCurrency: fiatCurrency,
                    cryptoCurrency: cryptoCurrency,
                    conversionPrice: 3500,
                    networkFee: 0.5,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
                };
            }

            const params: any = {
                partnerApiKey: this.apiKey,
                fiatCurrency,
                cryptoCurrency,
                isBuyOrSell,
                network,
                paymentMethod: 'credit_debit_card'
            };

            if (isBuyOrSell === 'BUY') {
                params.cryptoAmount = cryptoAmount;
            } else {
                params.fiatAmount = cryptoAmount;
            }

            console.log('Fetching Transak quote', params);

            const response = await axios.get(`${this.baseUrl}/api/v2/currencies/price`, {
                params,
                timeout: 10000
            });

            const quote = response.data.response;

            return {
                quoteId: quote.quoteId || crypto.randomUUID(),
                fiatAmount: parseFloat(quote.fiatAmount),
                cryptoAmount: parseFloat(quote.cryptoAmount),
                fiatCurrency: quote.fiatCurrency,
                cryptoCurrency: quote.cryptoCurrency,
                conversionPrice: parseFloat(quote.conversionPrice),
                networkFee: parseFloat(quote.totalFee || 0),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            };
        } catch (error: any) {
            console.error('Failed to get Transak quote:', error.message);
            // Fallback for demo if API fails/is invalid
            console.warn('⚠️ Transak Quote Failed. Falling back to MOCK data for demo.');
            return {
                quoteId: 'mock-quote-' + Date.now(),
                fiatAmount: parseFloat((cryptoAmount * 3500).toFixed(2)),
                cryptoAmount: parseFloat(cryptoAmount.toString()),
                fiatCurrency: fiatCurrency,
                cryptoCurrency: cryptoCurrency,
                conversionPrice: 3500,
                networkFee: 0.5,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            };
        }
    }

    async createOrder({
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        walletAddress,
        network = 'ethereum',
        partnerOrderId
    }: OrderParams) {
        try {
            const orderData = {
                partnerApiKey: this.apiKey,
                partnerOrderId,
                fiatAmount,
                fiatCurrency,
                cryptoCurrency,
                network,
                walletAddress,
                metadata: {
                    source: 'hybrid_flow',
                    paymentMethod: 'qris_to_crypto' // Custom metadata to track this flow
                }
            };

            console.log('Creating Transak order', { partnerOrderId, fiatAmount, cryptoCurrency });

            const signature = this.signRequest(orderData);

            const response = await axios.post(
                `${this.baseUrl}/api/v2/partner/order`,
                orderData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'api-secret': this.apiSecret,
                        'X-Transak-Signature': signature
                    },
                    timeout: 30000
                }
            );

            const order = response.data.response;

            console.log('Transak order created successfully', {
                orderId: order.id,
                status: order.status
            });

            return {
                id: order.id,
                status: order.status,
                cryptoAmount: order.cryptoAmount,
                walletAddress: order.walletAddress,
                createdAt: order.createdAt
            };
        } catch (error: any) {
            console.error('Failed to create Transak order (Real API)', error.response?.data || error.message);

            // FALLBACK FOR DEMO / HACKATHON
            // If the real API fails (e.g. invalid keys), we proceed with a MOCK order
            // so the user flow doesn't get stuck.
            console.warn('⚠️ Transak Create Order Failed. Using MOCK data for demo flow.');

            return {
                id: 'mock-order-' + Date.now(),
                status: 'AWAITING_PAYMENT_FROM_USER',
                cryptoAmount: 0.0, // Mock amount
                walletAddress: walletAddress,
                createdAt: new Date().toISOString()
            };
        }
    }

    generateWidgetConfig({
        cryptoCurrency,
        cryptoAmount,
        fiatCurrency,
        fiatAmount,
        walletAddress,
        network = 'ethereum',
        email = '',
        partnerOrderId
    }: WidgetConfig) {
        const config: any = {
            apiKey: this.apiKey,
            environment: this.environment,
            defaultCryptoCurrency: cryptoCurrency,
            cryptoCurrencyCode: cryptoCurrency,
            defaultNetwork: network,
            networks: 'ethereum,polygon,bsc,arbitrum,optimism',
            walletAddress,
            email,
            hideMenu: false,
            themeColor: '667eea',
            widgetHeight: '700px',
            widgetWidth: '100%',
            partnerOrderId,
            disableWalletAddressForm: true,
            productsAvailed: 'BUY'
        };

        if (cryptoAmount) config.cryptoAmount = cryptoAmount.toString();
        if (fiatAmount) config.fiatAmount = fiatAmount.toString();
        if (fiatCurrency) config.defaultFiatCurrency = fiatCurrency;

        return config;
    }

    decryptWebhook(encryptedData: string) {
        const accessToken = process.env.TRANSAK_ACCESS_TOKEN;

        if (!accessToken) {
            throw new Error('TRANSAK_ACCESS_TOKEN not configured');
        }

        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.createHash('sha256').update(accessToken).digest();

            const parts = encryptedData.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted data format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = Buffer.from(parts[1], 'hex');

            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return JSON.parse(decrypted.toString());
        } catch (error: any) {
            console.error('Failed to decrypt Transak webhook', error.message);
            throw new Error('Webhook decryption failed');
        }
    }

    getPaymentLink(config: WidgetConfig) {
        const widgetConfig = this.generateWidgetConfig(config);
        const queryParams = new URLSearchParams(widgetConfig).toString();
        return `${this.widgetUrl}?${queryParams}`;
    }

    signRequest(data: any) {
        const payload = JSON.stringify(data);
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(payload)
            .digest('hex');
    }
}

export default new TransakService();
