"use client";

import { TrendingUp, TrendingDown, Activity, Award, AlertCircle } from "lucide-react";

interface TokenPerformance {
    tokenSymbol: string;
    pnl: number;
    pnlPercentage: number;
}

interface ActivitySummary {
    totalInvestedUSD: number;
    currentPortfolioValueUSD: number;
    totalPnL: number;
    totalPnLPercentage: number;
    numTokensBought: number;
    numTokensSold: number;
    mostProfitableToken?: TokenPerformance;
    biggestLoserToken?: TokenPerformance;
}

interface TokenActivityCardProps {
    summary: ActivitySummary;
    chainName: string;
}

export const TokenActivityCard = ({
    summary,
    chainName,
}: TokenActivityCardProps) => {
    const isProfitable = summary.totalPnL >= 0;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 max-w-sm mt-3 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shadow-sm">
                    <Activity className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Trading Performance</h3>
                    <p className="text-xs text-gray-500">{chainName}</p>
                </div>
            </div>

            {/* PnL Main Display */}
            <div className={`rounded-xl p-4 mb-5 border ${isProfitable ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">Net Realized P&L</p>
                <div className="flex items-baseline gap-2">
                    <h2 className={`text-2xl font-bold ${isProfitable ? 'text-green-700' : 'text-red-700'}`}>
                        {isProfitable ? '+' : ''}{formatCurrency(summary.totalPnL)}
                    </h2>
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${isProfitable ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {isProfitable ? '+' : ''}{summary.totalPnLPercentage.toFixed(2)}%
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Vol / Invested</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(summary.totalInvestedUSD)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tokens Traded</p>
                    <p className="font-semibold text-gray-900">{summary.numTokensBought + summary.numTokensSold}</p>
                </div>
            </div>

            {/* Winners & Losers */}
            <div className="space-y-3">
                {summary.mostProfitableToken && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                <Award className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500">Best Performer</p>
                                <p className="font-bold text-gray-900 text-sm">{summary.mostProfitableToken.tokenSymbol}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-green-600 text-sm">+{summary.mostProfitableToken.pnlPercentage.toFixed(1)}%</p>
                            <p className="text-xs text-green-700/70">+{formatCurrency(summary.mostProfitableToken.pnl)}</p>
                        </div>
                    </div>
                )}

                {summary.biggestLoserToken && summary.biggestLoserToken.pnl < 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500">Biggest Loss</p>
                                <p className="font-bold text-gray-900 text-sm">{summary.biggestLoserToken.tokenSymbol}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-red-600 text-sm">{summary.biggestLoserToken.pnlPercentage.toFixed(1)}%</p>
                            <p className="text-xs text-red-700/70">{formatCurrency(summary.biggestLoserToken.pnl)}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
