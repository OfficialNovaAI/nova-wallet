'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, DollarSign } from 'lucide-react';

interface CreatePaymentFormProps {
    onSubmit: (data: any) => Promise<void>;
    defaultValues?: Partial<{
        amount: number;
        symbol: string;
        network: string;
        description: string;
    }>;
}

export function CreatePaymentForm({ onSubmit, defaultValues = {} }: CreatePaymentFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        amount: defaultValues.amount?.toString() || '',
        token: defaultValues.symbol || 'ETH',
        network: defaultValues.network || 'ethereum',
        receiverWallet: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit({
                amount: parseFloat(formData.amount),
                token: formData.token,
                network: formData.network,
                receiverWallet: formData.receiverWallet
            });
        } catch (error) {
            console.error('Form submission failed', error);
            // Ideally show error in UI
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">Buat Payment Link</h3>
                    <p className="text-xs text-gray-400">Isi detail pembayaran</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Amount & Token Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Jumlah Amount</label>
                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            placeholder="0.00"
                            step="0.000001"
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-white placeholder:text-gray-600"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400">Token</label>
                        <select
                            name="token"
                            value={formData.token}
                            onChange={handleChange}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-white"
                        >
                            <option value="ETH">ETH</option>
                            <option value="USDC">USDC</option>
                            <option value="MNT">MNT</option>
                        </select>
                    </div>
                </div>

                {/* Receiver Wallet */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400">Wallet Penerima</label>
                    <input
                        type="text"
                        name="receiverWallet"
                        value={formData.receiverWallet}
                        onChange={handleChange}
                        placeholder="0x..."
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none text-white font-mono placeholder:text-gray-600"
                        required
                    />
                </div>

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 mt-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Generate Payment Link
                </Button>
            </form>
        </div>
    );
}
