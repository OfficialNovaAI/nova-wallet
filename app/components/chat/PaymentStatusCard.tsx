'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Copy, ExternalLink, RefreshCw, Check, Share2 } from 'lucide-react';
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
    const [qrData, setQrData] = useState<string | null>(null);
    const [isPaid, setIsPaid] = useState(false);
    const [copied, setCopied] = useState(false);
    const { appendMessage } = useCopilotChat();

    const [timeLeft, setTimeLeft] = useState<string>("--:--:--");

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
    }, [payment?.expiresAt]);

    useEffect(() => {
        if (payment && payment.status === 'PENDING' && !qrData) {
            initializeGateway();
        }
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

    const initializeGateway = async () => {
        try {
            if (payment?.paymentMethod === 'QRIS') {
                const idrAmount = Math.round(payment.fiatAmount * 15500);
                const res = await axios.post('/api/midtrans/create-qris', { paymentId: paymentId, amount: idrAmount });
                const data = res.data.data;
                if (data?.qrCodeString) setQrData(data.qrCodeString);
                if (data?.qrCodeUrl) setQrData(data.qrCodeUrl);
            } else if (payment?.paymentMethod === 'TRANSAK') {
                setQrData(payment.id);
            }
        } catch (e) { console.error(e); }
    };

    const handleCopyLink = () => {
        const url = payment?.transakUrl || `${window.location.origin}/pay/${paymentId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!payment) return <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center"><Loader2 className="animate-spin text-purple-600" /></div>;

    const isPending = payment.status === 'PENDING' || payment.status === 'WAITING_PAYMENT';
    const paymentLink = payment.transakUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${paymentId}`;

    return (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden w-full max-w-[380px] mx-auto font-sans">
            <div className="p-6 flex flex-col items-center text-center space-y-6">

                {/* Header */}
                <h2 className="text-xl font-bold text-gray-900">Your Paylink is Ready!</h2>

                {/* QR Code Area */}
                <div className="bg-white p-2">
                    {isPending ? (
                        qrData ? (
                            <QRCodeSVG value={qrData} size={180} level="M" />
                        ) : (
                            <div className="w-[180px] h-[180px] bg-gray-50 rounded-xl flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                            </div>
                        )
                    ) : (
                        <div className="w-[180px] h-[180px] bg-green-50 rounded-xl flex items-center justify-center mb-2">
                            <Check className="w-16 h-16 text-green-500" />
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
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Duration</span>
                        <span className={`font-medium font-mono ${timeLeft === 'EXPIRED' ? 'text-red-500' : 'text-gray-900'}`}>
                            {timeLeft}
                        </span>
                    </div>
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
                    <Button
                        variant="secondary"
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-medium"
                        onClick={() => window.open(paymentLink, '_blank')}
                    >
                        Open link
                    </Button>
                    <Button
                        className="flex-1 bg-[#6C5DD3] hover:bg-[#5b4ebf] text-white rounded-xl font-medium"
                        onClick={() => appendMessage(
                            new TextMessage({
                                role: MessageRole.User,
                                content: "Create new paylink"
                            })
                        )}
                    >
                        Create new paylink
                    </Button>
                </div>

            </div>
        </div>
    );
}

// Add this to your global stylesheet or verify tailwind config for color #6C5DD3 (Purple from design)
