'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, CheckCircle2, AlertCircle, Copy, CreditCard, QrCode } from 'lucide-react';
import Image from 'next/image';

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

type ViewMode = 'LANDING' | 'QRIS' | 'TRANSAK' | 'SUCCESS' | 'PROCESSING';

export default function PaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
    const { paymentId } = use(params);
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('LANDING');
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [pageUrl, setPageUrl] = useState<string>('');

    // Gateway State
    const [qrData, setQrData] = useState<string | null>(null); // QR code URL or data (or Transak URL)
    const [qrString, setQrString] = useState<string | null>(null); // QR string for rendering
    const [initializingGateway, setInitializingGateway] = useState(false);

    const hasLoadedRef = useRef(false);

    // 1. Initial Setup
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPageUrl(window.location.href);
        }
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

    // 3. Timer
    useEffect(() => {
        if (!payment?.expiresAt) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const expire = new Date(payment.expiresAt).getTime();
            const dist = expire - now;

            if (dist < 0) {
                setTimeLeft('Expired');
            } else {
                const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((dist % (1000 * 60)) / 1000);
                setTimeLeft(`${h}h ${m}m ${s}s`);
            }
        };

        const timer = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(timer);
    }, [payment?.expiresAt]);

    const loadPaymentDetails = async () => {
        try {
            const response = await axios.get(`/api/payments/${paymentId}`);
            const paymentData = response.data.data;
            setPayment(paymentData);

            if (['PAID_FIAT', 'PROCESSING_CRYPTO'].includes(paymentData.status)) {
                setViewMode('PROCESSING');
            } else if (paymentData.status === 'COMPLETED') {
                setViewMode('SUCCESS');
            } else {
                setViewMode('LANDING'); // Default to Landing View
            }

            setLoading(false);
        } catch (err: any) {
            console.error('Error loading payment:', err);
            setError(err.response?.data?.error || 'Failed to load payment details');
            setLoading(false);
        }
    };

    const handleSelectQRIS = async () => {
        if (!payment) return;
        setViewMode('QRIS');
        setInitializingGateway(true);
        await initializeQRIS(payment);
        setInitializingGateway(false);
    };

    const handleSelectTransak = async () => {
        if (!payment) return;
        setViewMode('TRANSAK');
        await initializeTransak(payment);
    };

    const initializeQRIS = async (paymentData: Payment) => {
        try {
            // 15500 is hardcoded rate for demo
            const idrAmount = Math.round(paymentData.fiatAmount * 15500);

            const response = await axios.post('/api/midtrans/create-qris', {
                paymentId: paymentData.id,
                amount: idrAmount
            });

            const qrResponse = response.data.data;

            if (qrResponse) {
                if (qrResponse.isPaid || ['settlement', 'capture', 'success'].includes(qrResponse.status)) {
                    setPayment(prev => prev ? { ...prev, status: 'PAID_FIAT' } : null);
                    setViewMode('PROCESSING');
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
                themeColor: '6C5DD3', // Matching design purple
                hideMenu: 'true',
                productsAvailed: 'BUY',
                cryptoAmount: paymentData.cryptoAmount.toString(),
                fiatAmount: paymentData.fiatAmount.toString()
            });

            const transakUrl = `https://global-stg.transak.com?${transakParams.toString()}`;
            setQrData(transakUrl);
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
                if (prev.status !== newData.status) {
                    if (newData.status === 'COMPLETED') setViewMode('SUCCESS');
                    else if (['PAID_FIAT', 'PROCESSING_CRYPTO'].includes(newData.status)) setViewMode('PROCESSING');
                    return newData;
                }
                return prev;
            });
        } catch (err) { }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#6C5DD3] animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white shadow-xl rounded-2xl p-8 max-w-md w-full text-center border border-red-100">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // LANDING VIEW (Refined Sizing)
    if (viewMode === 'LANDING') {
        return (
            <div className="min-h-screen relative font-sans text-gray-900 selection:bg-purple-100 selection:text-purple-900 flex items-center justify-center">
                {/* Background Image */}
                <div className="fixed inset-0 z-0">
                    <Image
                        src="/paylink/bg-paylink.webp"
                        alt="Background"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>

                {/* Logo top left - Increased Size */}
                <div className="fixed top-8 left-8 z-20">
                    <Image
                        src="/paylink/logo-paylink.webp"
                        alt="Nova Paylink"
                        width={200}
                        height={60}
                        className="h-12 w-auto object-contain"
                    />
                </div>

                {/* Main Card - Tightened max-width */}
                <div className="relative z-10 w-full max-w-[400px] px-4">
                    <div className="bg-white rounded-[40px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] animate-in fade-in zoom-in duration-500 text-center">

                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Pay Request for ${payment?.fiatAmount.toFixed(2)}
                        </h1>
                        <p className="text-gray-500 text-sm mb-8">
                            Review the details and proceed with your payment
                        </p>

                        {/* QR Container - Adjusted internal spacing */}
                        <div className="bg-[#F8F9FA] rounded-[32px] p-8 mb-6 border border-gray-100/50">
                            <div className="flex flex-col items-center">
                                <p className="text-sm text-gray-500 font-medium mb-1">Time left</p>
                                <p className="text-xl font-bold text-gray-900 font-mono mb-6 tracking-tight">{timeLeft}</p>

                                <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm mb-4">
                                    {pageUrl && <QRCodeSVG value={pageUrl} size={160} level="M" />}
                                </div>

                                <p className="text-xs text-gray-400 font-medium">
                                    Scan to pay on mobile
                                </p>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-col gap-3 w-full">
                            <button
                                onClick={handleSelectQRIS}
                                className="w-full py-3.5 bg-[#6C5DD3] hover:bg-[#5b4ec2] active:scale-[0.98] text-white rounded-2xl font-semibold transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                            >
                                <QrCode className="w-5 h-5" />
                                Pay with QRIS
                            </button>

                            <button
                                onClick={handleSelectTransak}
                                className="w-full py-3.5 bg-white border border-gray-200 hover:bg-gray-50 active:scale-[0.98] text-gray-700 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <CreditCard className="w-5 h-5" />
                                Pay with Transak
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    // QRIS VIEW
    if (viewMode === 'QRIS') {
        return (
            <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col min-h-[600px]">
                    <div className="p-6 bg-[#6C5DD3] text-white flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewMode('LANDING')}>
                            <span className="text-sm font-medium">&larr; Back</span>
                        </div>
                        <h2 className="font-bold">Scan QRIS</h2>
                        <div className="w-8"></div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white relative">
                        {initializingGateway ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-10 h-10 text-[#6C5DD3] animate-spin mb-4" />
                                <p className="text-gray-500">Generating QR Code...</p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold mb-2">Rp {Math.round((payment?.fiatAmount || 0) * 15500).toLocaleString('id-ID')}</h3>
                                <p className="text-gray-400 text-sm mb-8">Scan with GoPay, OVO, Dana, or BCA</p>

                                <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-8">
                                    {qrString ? (
                                        <QRCodeSVG value={qrString} size={220} level="H" />
                                    ) : qrData ? (
                                        <img src={qrData} alt="QRIS" className="w-56 h-56 object-contain" />
                                    ) : (
                                        <div className="w-56 h-56 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Error Loading QR</div>
                                    )}
                                </div>

                                {/* Simulator Helper */}
                                {(qrString || qrData) && (
                                    <div className="w-full bg-gray-50 rounded-lg p-3 border border-gray-200 mb-6">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] uppercase font-bold text-gray-400">Simulator Code</span>
                                            <a href="https://simulator.sandbox.midtrans.com/v2/qris/index" target="_blank" className="text-[10px] text-[#6C5DD3] hover:underline">Open Simulator</a>
                                        </div>
                                        <code className="block text-[10px] text-left text-gray-500 break-all font-mono bg-white p-2 rounded border border-gray-100">
                                            {qrString || qrData}
                                        </code>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // TRANSAK VIEW
    if (viewMode === 'TRANSAK') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden h-[700px] flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                        <button onClick={() => setViewMode('LANDING')} className="text-sm text-gray-500 hover:text-[#6C5DD3] transition-colors">
                            &larr; Cancel
                        </button>
                        <span className="font-semibold text-gray-900">Pay with Card</span>
                        <div className="w-10"></div>
                    </div>
                    {qrData ? (
                        <iframe
                            src={qrData}
                            className="w-full flex-1 border-0"
                            allow="camera;microphone;payment;clipboard-write"
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-[#6C5DD3] animate-spin" />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // SUCCESS / PROCESSING VIEW
    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
            <div className="bg-white shadow-2xl rounded-3xl p-10 max-w-md w-full text-center border border-gray-100">
                {viewMode === 'SUCCESS' ? (
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                ) : (
                    <div className="w-20 h-20 bg-[#6C5DD3]/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <Loader2 className="w-10 h-10 text-[#6C5DD3] animate-spin" />
                    </div>
                )}

                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {viewMode === 'SUCCESS' ? 'Payment Successful!' : 'Processing Payment'}
                </h2>
                <p className="text-gray-500 mb-8 leading-relaxed">
                    {viewMode === 'SUCCESS'
                        ? `We have successfully received your payment of $${payment?.fiatAmount}.`
                        : 'We are verifying your transaction. This may take a few moments.'}
                </p>

                {payment?.txHash && (
                    <a
                        href={`https://etherscan.io/tx/${payment.txHash}`}
                        target="_blank"
                        className="block w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
                    >
                        View Transaction
                    </a>
                )}
            </div>
        </div>
    );
}
