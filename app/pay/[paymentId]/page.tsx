'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, CheckCircle2, AlertCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';

interface Payment {
    id: string;
    cryptoAmount: number;
    cryptoCurrency: string;
    fiatAmount: number;
    fiatCurrency: string;
    receiverWallet: string;
    network: string;
    status: string;
    paymentMethod: 'QRIS' | 'TRANSAK';
    userCountry: string;
    expiresAt: string;
    createdAt: string;
    cryptoSent?: number;
    txHash?: string;
    midtransOrderId?: string | null;
    midtransTransactionId?: string | null;
}

export default function PaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
    const { paymentId } = use(params);
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [qrData, setQrData] = useState<string | null>(null); // QR code URL or data
    const [qrString, setQrString] = useState<string | null>(null); // QR string for rendering
    const [initializingGateway, setInitializingGateway] = useState(false);

    const hasLoadedRef = useRef(false);
    const qrInitializedRef = useRef(false);

    // 1. Load Payment
    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        loadPaymentDetails();
    }, [paymentId]);

    // 2. Poll Status
    useEffect(() => {
        if (payment && !['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(payment.status)) {
            const interval = setInterval(() => {
                checkPaymentStatus();
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [payment]);

    const loadPaymentDetails = async () => {
        try {
            const response = await axios.get(`/api/payments/${paymentId}`);
            const paymentData = response.data.data;
            setPayment(paymentData);

            if (['PAID_FIAT', 'PROCESSING_CRYPTO', 'COMPLETED'].includes(paymentData.status)) {
                setLoading(false);
                return;
            }

            // Initialize Payment Gateway
            if (paymentData.paymentMethod === 'QRIS') {
                if (!qrInitializedRef.current) {
                    qrInitializedRef.current = true;
                    setInitializingGateway(true);
                    await initializeQRIS(paymentData);
                    setInitializingGateway(false);
                }
            } else {
                await initializeTransak(paymentData);
            }

            setLoading(false);
        } catch (err: any) {
            console.error('Error loading payment:', err);
            setError(err.response?.data?.error || 'Failed to load payment details');
            setLoading(false);
        }
    };

    const initializeQRIS = async (paymentData: Payment) => {
        try {
            // 15000 is hardcoded rate for demo, real implementations should fetch rate or use stored conversion
            const idrAmount = Math.round(paymentData.fiatAmount * 15500);

            // Check if we already have ordered it (idempotency handled by API too)
            const response = await axios.post('/api/midtrans/create-qris', {
                paymentId: paymentData.id,
                amount: idrAmount
            });

            const qrResponse = response.data.data;

            if (qrResponse) {
                if (qrResponse.isPaid || ['settlement', 'capture', 'success'].includes(qrResponse.status)) {
                    // Already paid
                    setPayment(prev => prev ? { ...prev, status: 'PAID_FIAT' } : null);
                    return;
                }

                if (qrResponse.qrCodeUrl) {
                    setQrData(qrResponse.qrCodeUrl);
                    setQrString(null);
                } else if (qrResponse.qrCodeString) {
                    setQrString(qrResponse.qrCodeString);
                    setQrData(null);
                }
            }
        } catch (err: any) {
            console.error('Error creating QRIS:', err);
            setError('Failed to generate QRIS code');
        }
    };

    const initializeTransak = async (paymentData: Payment) => {
        try {
            const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY || '00f0b025-1bda-4986-a1ea-49f33e1722a1';

            const transakParams = new URLSearchParams({
                apiKey: apiKey,
                environment: 'STAGING',
                defaultCryptoCurrency: paymentData.cryptoCurrency,
                defaultFiatCurrency: paymentData.fiatCurrency,
                fiatCurrency: paymentData.fiatCurrency,
                defaultNetwork: paymentData.network,
                networks: 'ethereum,polygon,bsc,arbitrum,optimism',
                walletAddress: paymentData.receiverWallet,
                themeColor: '3b82f6', // blue-500
                hideMenu: 'true',
                productsAvailed: 'BUY',
                cryptoAmount: paymentData.cryptoAmount.toString(),
                fiatAmount: paymentData.fiatAmount.toString()
            });

            const transakUrl = `https://global-stg.transak.com?${transakParams.toString()}`;
            setQrData(transakUrl); // Reusing qrData state for iframe URL for cleaner code
        } catch (err) {
            console.error('Error init Transak:', err);
        }
    };

    const checkPaymentStatus = async () => {
        try {
            const response = await axios.get(`/api/payments/${paymentId}`);
            const newData = response.data.data;

            setPayment(prev => {
                if (!prev) return newData;
                if (prev.status !== newData.status) return newData;
                return prev;
            });
        } catch (err) {
            // Silent fail for polling
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-gray-400 animate-pulse">Loading secure payment...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // SUCCESS STATE
    if (payment?.status === 'COMPLETED') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-gray-900/50 backdrop-blur border border-green-500/20 rounded-3xl p-10 max-w-md w-full text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-400"></div>

                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                    <p className="text-gray-400 mb-8">
                        Your {payment.cryptoAmount} {payment.cryptoCurrency} has been sent.
                    </p>

                    {payment.txHash && (
                        <a
                            href={`https://etherscan.io/tx/${payment.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all font-medium"
                        >
                            View on Explorer
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // PROCESSING STATE
    if (['PAID_FIAT', 'PROCESSING_CRYPTO'].includes(payment?.status || '')) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-gray-900/50 backdrop-blur border border-blue-500/20 rounded-3xl p-10 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-pulse" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Processing Payment</h2>
                    <p className="text-gray-400 mb-2">
                        We received your payment!
                    </p>
                    <p className="text-sm text-gray-500">
                        Converting and sending {payment?.cryptoCurrency} to your wallet...
                    </p>
                </div>
            </div>
        );
    }

    // DEFAULT: PAYMENT UI
    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 font-sans">
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left: Details */}
                <div className="space-y-6">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8">
                        <h2 className="text-xl font-bold mb-6 text-gray-200">Payment Details</h2>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-gray-800">
                                <span className="text-gray-500">Amount</span>
                                <span className="text-xl font-bold text-white">{payment?.cryptoAmount} <span className="text-blue-400">{payment?.cryptoCurrency}</span></span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-gray-800">
                                <span className="text-gray-500">Fiat Equivalent</span>
                                <span className="text-gray-300 font-mono">${payment?.fiatAmount.toFixed(2)} USD</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-gray-800">
                                <span className="text-gray-500">Network</span>
                                <span className="text-gray-300 capitalize">{payment?.network}</span>
                            </div>
                            <div className="pt-2">
                                <span className="text-gray-500 text-sm block mb-1">Receiver</span>
                                <div className="flex items-center gap-2 bg-gray-950 p-3 rounded-lg border border-gray-800">
                                    <span className="text-xs font-mono text-gray-400 truncate">{payment?.receiverWallet}</span>
                                    <Copy className="w-4 h-4 text-gray-600 cursor-pointer hover:text-white transition-colors" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/10 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <div>
                                <h4 className="font-semibold text-blue-400 mb-1">{payment?.paymentMethod === 'QRIS' ? 'QRIS Payment' : 'Global Payment'}</h4>
                                <p className="text-sm text-gray-400">
                                    {payment?.paymentMethod === 'QRIS'
                                        ? 'Scan the QR code with any supported Indonesian e-wallet (GoPay, OVO, Dana).'
                                        : 'Complete the payment using your Credit/Debit card via Transak.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Action/QR */}
                <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden h-[600px]">
                    {/* Background Mesh (Visual) */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                    {initializingGateway ? (
                        <div className="flex flex-col items-center">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                            <p className="text-gray-500 text-sm">Generating secure gateway...</p>
                        </div>
                    ) : payment?.paymentMethod === 'QRIS' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <h3 className="text-gray-900 font-bold text-xl mb-6">Scan to Pay</h3>

                            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 mb-6">
                                {qrString ? (
                                    <QRCodeSVG value={qrString} size={240} level="H" />
                                ) : qrData ? (
                                    <img src={qrData} alt="QRIS" className="w-60 h-60 object-contain" />
                                ) : (
                                    <div className="w-60 h-60 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">No QR Data</div>
                                )}
                            </div>

                            <div className="flex items-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg" alt="GoPay" className="h-6" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg" alt="OVO" className="h-6" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Logo_DANA.png/640px-Logo_DANA.png" alt="Dana" className="h-6" />
                            </div>
                        </div>
                    ) : payment?.paymentMethod === 'TRANSAK' && qrData ? (
                        <iframe
                            src={qrData}
                            className="w-full h-full border-0"
                            allow="camera;microphone;payment;clipboard-write"
                        />
                    ) : (
                        <p className="text-red-500">Unsupported Method</p>
                    )}
                </div>

            </div>
        </div>
    );
}
