"use client";

import { useState } from "react";
import { BrainCircuit, ArrowRight, ArrowLeftRight } from "lucide-react";

interface SlippageFormProps {
    onSubmit: (data: { symbol: string; amount: string; side: "buy" | "sell" }) => void;
    defaultValues?: {
        symbol?: string;
        amount?: string;
        side?: "buy" | "sell";
    };
}

export const SlippageForm = ({ onSubmit, defaultValues }: SlippageFormProps) => {
    const [symbol, setSymbol] = useState(defaultValues?.symbol || "MNT/USDT");
    const [amount, setAmount] = useState(defaultValues?.amount || "");
    const [side, setSide] = useState<"buy" | "sell">(defaultValues?.side || "buy");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (symbol && amount) {
            onSubmit({ symbol, amount, side });
        }
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800">Predict Slippage</h3>
                    <p className="text-xs text-slate-500">Analyze trade impact & fees</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                {/* Toggle Buy/Sell */}
                <div className="bg-slate-100 p-1 rounded-xl flex">
                    <button
                        type="button"
                        onClick={() => setSide("buy")}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${side === "buy" ? "bg-white text-green-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Buy
                    </button>
                    <button
                        type="button"
                        onClick={() => setSide("sell")}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${side === "sell" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Sell
                    </button>
                </div>

                {/* Symbol Input */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 ml-1">Token Pair</label>
                    <div className="relative">
                        <ArrowLeftRight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            placeholder="ETH/USDT"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase placeholder:normal-case"
                            required
                        />
                    </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 ml-1">Amount</label>
                    <input
                        type="number"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        required
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    className="w-full mt-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    Analyze Trade
                    <ArrowRight className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
};
