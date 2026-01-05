'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Wallet, ArrowRight, Loader2, DollarSign } from 'lucide-react';

export default function CreatePaymentPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        cryptoAmount: '0.002',
        cryptoCurrency: 'ETH',
        receiverWallet: '', // User needs to fill this
        network: 'ethereum',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('/api/payments/create', {
                cryptoAmount: parseFloat(formData.cryptoAmount),
                cryptoCurrency: formData.cryptoCurrency,
                receiverWallet: formData.receiverWallet,
                network: formData.network,
            });

            console.log('Payment created:', response.data);
            router.push(`/pay/${response.data.data.id}`);
        } catch (err: any) {
            console.error('Error creating payment:', err);
            setError(err.response?.data?.error || 'Failed to create payment request');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 font-sans">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-6">
                        <DollarSign className="w-8 h-8 text-blue-400" />
                    </div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400 mb-2">
                        Crypto Payment Gateway
                    </h1>
                    <p className="text-gray-400 text-lg">Accept crypto payments with Indonesian QRIS integration</p>
                </div>

                <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                        <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                        Create Payment Request
                    </h2>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2"></div>
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">Crypto Amount</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="cryptoAmount"
                                        value={formData.cryptoAmount}
                                        onChange={handleChange}
                                        step="0.0001"
                                        min="0.0001"
                                        required
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">Cryptocurrency</label>
                                <div className="relative">
                                    <select
                                        name="cryptoCurrency"
                                        value={formData.cryptoCurrency}
                                        onChange={handleChange}
                                        required
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none transition-all"
                                    >
                                        <option value="ETH">ETH - Ethereum</option>
                                        <option value="BTC">BTC - Bitcoin</option>
                                        <option value="USDT">USDT - Tether</option>
                                        <option value="USDC">USDC - USD Coin</option>
                                        <option value="MATIC">MATIC - Polygon</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Network</label>
                            <select
                                name="network"
                                value={formData.network}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none transition-all"
                            >
                                <option value="ethereum">Ethereum</option>
                                <option value="polygon">Polygon</option>
                                <option value="bsc">Binance Smart Chain</option>
                                <option value="bitcoin">Bitcoin</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Receiver Wallet Address</label>
                            <div className="relative">
                                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    name="receiverWallet"
                                    value={formData.receiverWallet}
                                    onChange={handleChange}
                                    placeholder="0x..."
                                    required
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-600 font-mono text-sm"
                                />
                            </div>
                            <p className="text-xs text-gray-500 ml-1">The wallet that will receive the funds</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating Link...
                                </>
                            ) : (
                                <>
                                    Create Payment Link
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
