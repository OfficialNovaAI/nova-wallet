"use client";

import { Wallet, PieChart, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TokenHolding {
    tokenSymbol: string;
    balance: number;
    currentValueUSD: number;
    pnlPercentage: number;
}

interface PortfolioCardProps {
    totalValueUSD: number;
    totalPnLPercentage: number;
    nativeBalance: number;
    nativeToken: string;
    nativeValueUSD: number;
    tokens: TokenHolding[];
    chainName: string;
}

export const PortfolioCard = ({
    totalValueUSD,
    totalPnLPercentage,
    nativeBalance,
    nativeToken,
    nativeValueUSD,
    tokens,
    chainName,
}: PortfolioCardProps) => {
    const isProfitable = totalPnLPercentage >= 0;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 max-w-sm mt-3 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <PieChart className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Portfolio Analysis</h3>
                        <p className="text-xs text-gray-500">{chainName}</p>
                    </div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1
                    ${isProfitable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(totalPnLPercentage).toFixed(2)}%
                </div>
            </div>

            {/* Total Value */}
            <div className="mb-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Total Net Worth</p>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                    {formatCurrency(totalValueUSD)}
                </h2>
            </div>

            {/* Assets List */}
            <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assets Distribution</div>

                {/* Native Token */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{nativeToken.slice(0, 3)}</span>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900 text-sm">{nativeToken}</div>
                            <div className="text-xs text-gray-500">{nativeBalance.toFixed(4)} {nativeToken}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-semibold text-gray-900 text-sm">{formatCurrency(nativeValueUSD)}</div>
                        <div className="text-xs text-gray-500">Native</div>
                    </div>
                </div>

                {/* Tokens Scroll Area */}
                {tokens.length > 0 && (
                    <ScrollArea className="h-[200px] pr-4">
                        <div className="space-y-2">
                            {tokens.map((token, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white">
                                            {token.tokenSymbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900 text-sm">{token.tokenSymbol}</div>
                                            <div className="text-xs text-gray-500">{token.balance.toFixed(4)}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium text-gray-900 text-sm">{formatCurrency(token.currentValueUSD)}</div>
                                        <div className={`text-xs flex items-center justify-end gap-0.5 
                                            ${token.pnlPercentage >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {token.pnlPercentage >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                            {Math.abs(token.pnlPercentage).toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
};
