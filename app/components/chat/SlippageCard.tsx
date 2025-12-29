"use client";

import { motion } from "framer-motion";
import { TrendingUp, AlertCircle } from "lucide-react";
import { useState } from "react";

interface Quote {
    exchange: string;
    quote_price: number;
    predicted_slippage_pct: number;
    total_cost: number;
    fees: {
        trading_fee: number;
        slippage_cost: number;
    };
}

interface SlippageCardProps {
    symbol: string;
    amount: number;
    side: "buy" | "sell";
    bestVenue: string;
    quotes: Quote[];
}

export function SlippageCard({ symbol, amount, side, bestVenue, quotes }: SlippageCardProps) {
    const [expandedExchange, setExpandedExchange] = useState<string | null>(null);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const formatPercent = (val: number) =>
        `${(val * 100).toFixed(3)}%`;

    // Sort quotes by total cost (ascending) to verify "Best Venue" logic dynamically
    const sortedQuotes = [...quotes].sort((a, b) => a.total_cost - b.total_cost);
    const bestQuote = sortedQuotes[0]; // The actual best quote based on data

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-xl"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-5 w-5" />
                    <h3 className="font-bold text-lg">AI Trade Predictor</h3>
                </div>
                <div className="text-blue-100 text-sm flex items-center gap-1">
                    <span className={`font-bold uppercase ${side === 'buy' ? 'text-green-300' : 'text-red-300'}`}>
                        {side}
                    </span>
                    <span>{amount} {symbol}</span>
                </div>
            </div>

            <div className="p-4 bg-gray-50 border-b border-gray-100">
                <div className="flex gap-2 items-start text-xs text-blue-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                        AI memprediksi slippage real-time berdasarkan likuiditas market. Data diurutkan dari biaya termurah.
                    </p>
                </div>
            </div>

            {/* Comparison List */}
            <div className="divide-y divide-gray-100">
                {sortedQuotes.map((quote, idx) => {
                    const isBest = idx === 0;
                    const isExpanded = expandedExchange === quote.exchange;

                    return (
                        <div key={quote.exchange} className={`transition-colors ${isBest ? 'bg-blue-50/50' : 'bg-white'}`}>
                            <div
                                onClick={() => setExpandedExchange(isExpanded ? null : quote.exchange)}
                                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold uppercase text-xs border-2 shadow-sm
                                        ${isBest ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                                    >
                                        {quote.exchange.substring(0, 2)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900 capitalize">{quote.exchange}</span>
                                            {isBest && (
                                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase border border-green-200">
                                                    Best Price
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Slippage: <span className={quote.predicted_slippage_pct > 0.01 ? 'text-orange-600' : 'text-green-600'}>
                                                {formatPercent(quote.predicted_slippage_pct)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${isBest ? 'text-blue-700 text-lg' : 'text-gray-900'}`}>
                                        {formatCurrency(quote.total_cost)}
                                    </div>
                                    {!isBest && (
                                        <div className="text-xs text-red-500 font-medium">
                                            +{formatCurrency(quote.total_cost - bestQuote.total_cost)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pl-16 text-sm space-y-2">
                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Quote Price</span>
                                            <span className="font-medium">{formatCurrency(quote.quote_price)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Trading Fee</span>
                                            <span className="font-medium text-red-500">+{formatCurrency(quote.fees.trading_fee)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Slippage Impact</span>
                                            <span className="font-medium text-red-500">+{formatCurrency(quote.fees.slippage_cost)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
