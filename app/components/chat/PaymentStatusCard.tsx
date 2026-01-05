'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Copy, ExternalLink, RefreshCw, Check, Share2, CreditCard, QrCode } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";

interface PaymentStatusCardProps {
    paymentId: string;
    initialData?: any;
}

export function PaymentStatusCard({ paymentId, initialData }: PaymentStatusCardProps) {
    const [payment, setPayment] = useState<any>(initialData || null);
    const [isPaid, setIsPaid] = useState(false);
    const [copied, setCopied] = useState(false);
    const { appendMessage } = useCopilotChat();
    const [baseUrl, setBaseUrl] = useState<string>('');

    const [timeLeft, setTimeLeft] = useState<string>("--:--:--");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setBaseUrl(window.location.origin);
        }
    }, []);

    useEffect(() => {
        if (!initialData) fetchPaymentDetails();

        const interval = setInterval(() => {
            if (!isPaid) fetchPaymentDetails();
        }, 4000);

        return () => clearInterval(interval);
    }, [paymentId, isPaid]);

    // Countdown Logic
    useEffect(() => {
        if (!payment?.expiresAt) return;
        if (isPaid) {
            setTimeLeft("PAID");
            return;
        }

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const expires = new Date(payment.expiresAt).getTime();
            const distance = expires - now;

            if (distance < 0) {
                setTimeLeft("EXPIRED");
                clearInterval(timer);
            } else {
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [payment?.expiresAt, isPaid]);

    useEffect(() => {
        if (payment && ['COMPLETED', 'PAID_FIAT', 'PROCESSING_CRYPTO'].includes(payment.status)) {
            setIsPaid(true);
        }
    }, [payment]);

    const fetchPaymentDetails = async () => {
        try {
            const res = await axios.get(`/api/payments/${paymentId}`);
            setPayment(res.data.data);
        } catch (e) {
            console.error("Fetch details error", e);
        }
    };

    const handleCopyLink = () => {
        const url = `${baseUrl}/pay/${paymentId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!payment) return <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>;

    // Fix: If status is undefined (initial load), treat as PENDING
    const isPending = !payment.status || payment.status === 'PENDING' || payment.status === 'WAITING_PAYMENT';

    // FORCE the link to be the internal Landing Page
    const paymentLink = baseUrl ? `${baseUrl}/pay/${paymentId}` : '';

    return (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden w-full max-w-[380px] mx-auto font-sans">
            <div className="p-6 flex flex-col items-center text-center space-y-6">

                {/* Header */}
                <h2 className="text-xl font-bold text-gray-900">Your Paylink is Ready!</h2>

                {/* QR Code Area - Always points to Landing Page */}
                <div className="bg-white p-2">
                    {isPending ? (
                        paymentLink ? (
                            <QRCodeSVG value={paymentLink} size={180} level="M" />
                        ) : (
                            <div className="w-[180px] h-[180px] bg-gray-50 rounded-xl flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                            </div>
                        )
                    ) : (
                        <div className="w-[180px] h-[180px] bg-green-50 rounded-xl flex items-center justify-center mb-2 animate-in zoom-in duration-300">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <Check className="w-8 h-8 text-green-600" />
                                </div>
                                <span className="text-sm font-medium text-green-600">Payment Received</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Link Input */}
                <div className="flex items-center gap-2 w-full bg-gray-50 rounded-lg p-1 pr-2 border border-gray-100">
                    <div className="flex-1 px-3 py-2 text-sm text-gray-500 truncate text-left select-all font-mono">
                        {paymentLink}
                    </div>
                    <button onClick={handleCopyLink} className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                </div>

                {/* Metadata Rows */}
                <div className="w-full space-y-3 pt-2">
                    {!isPaid && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Duration</span>
                            <span className={`font-medium font-mono ${timeLeft === 'EXPIRED' ? 'text-red-500' : 'text-gray-900'}`}>
                                {timeLeft}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Received fee</span>
                        <span className="text-gray-900 font-medium font-mono">0.0020 ETH</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Amount</span>
                        <span className="text-gray-900 font-medium">{payment.cryptoAmount} {payment.cryptoCurrency}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 w-full pt-2">
                    {isPending ? (
                        <>
                            <Button
                                variant="secondary"
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium text-xs flex items-center gap-2"
                                onClick={() => window.open(paymentLink, '_blank')}
                            >
                                <CreditCard className="w-4 h-4" />
                                Pay with Transak
                            </Button>
                            <Button
                                className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-medium text-xs flex items-center gap-2"
                                onClick={() => {
                                    window.open(`${paymentLink}?country=ID`, '_blank');
                                }}
                            >
                                <QrCode className="w-4 h-4" />
                                Pay with QRIS
                            </Button>
                        </>
                    ) : (
                        <Button
                            className="w-full bg-gray-900 text-white rounded-xl font-medium text-xs py-5"
                            onClick={() => window.open(paymentLink, '_blank')}
                        >
                            View Receipt <ExternalLink className="w-3 h-3 ml-2" />
                        </Button>
                    )}
                </div>

            </div>
        </div>
    );
}
