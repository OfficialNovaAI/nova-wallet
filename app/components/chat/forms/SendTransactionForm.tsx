"use client";

import { useState } from "react";
import { Send, ArrowRight } from "lucide-react";

interface SendTransactionFormProps {
    onSubmit: (data: { recipient: string; amount: string; token: string }) => void;
    defaultValues?: {
        recipient?: string;
        amount?: string;
        token?: string;
    };
}

export const SendTransactionForm = ({ onSubmit, defaultValues }: SendTransactionFormProps) => {
    const [recipient, setRecipient] = useState(defaultValues?.recipient || "");
    const [amount, setAmount] = useState(defaultValues?.amount || "");
    const [token, setToken] = useState(defaultValues?.token || "ETH");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (recipient && amount) {
            onSubmit({ recipient, amount, token });
        }
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Send className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800">Send Crypto</h3>
                    <p className="text-xs text-slate-500">Fill details to prepare transaction</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                {/* Recipient Input */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 ml-1">Recipient Address</label>
                    <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-mono"
                        required
                    />
                </div>

                {/* Amount and Token Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 ml-1">Amount</label>
                        <input
                            type="number"
                            step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 ml-1">Token</label>
                        <select
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        >
                            <option value="ETH">ETH</option>
                            <option value="MNT">MNT</option>
                            <option value="USDC">USDC</option>
                            <option value="USDT">USDT</option>
                        </select>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-2.5 rounded-xl text-sm font-medium shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    Review Transaction
                    <ArrowRight className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
};
