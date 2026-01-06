"use client";

import { Fuel, ArrowRightLeft, CalendarClock, Gauge } from "lucide-react";

interface TransactionStats {
    totalTransactions: number;
    totalGasSpentUSD: number;
    averageGasPerTxUSD: number;
    transactionsSent: number;
    transactionsReceived: number;
    accountAgeDays: number;
    activityFrequency: string;
}

interface TransactionStatsCardProps {
    stats: TransactionStats;
    chainName: string;
}

export const TransactionStatsCard = ({
    stats,
    chainName,
}: TransactionStatsCardProps) => {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 max-w-sm mt-3 shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm">
                    <Fuel className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Wallet Usage Stats</h3>
                    <p className="text-xs text-gray-500">{chainName}</p>
                </div>
            </div>

            {/* Gas Fees Highlight */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 text-white mb-5 shadow-lg shadow-gray-200">
                <div className="flex items-center gap-2 mb-2 opacity-80">
                    <Fuel className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wider">Total Gas Fees</span>
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">${stats.totalGasSpentUSD.toFixed(2)}</h2>
                        <p className="text-[10px] text-gray-400 mt-1">Avg per tx: ${stats.averageGasPerTxUSD.toFixed(4)}</p>
                    </div>
                    {stats.totalGasSpentUSD > 100 && (
                        <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/90">High Usage</span>
                    )}
                </div>
            </div>

            {/* Transaction Breakdown */}
            <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="border border-gray-100 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">Sent</div>
                    <div className="text-lg font-bold text-gray-900">{stats.transactionsSent}</div>
                    <div className="h-1 w-full bg-orange-100 mt-2 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${(stats.transactionsSent / stats.totalTransactions) * 100}%` }}></div>
                    </div>
                </div>
                <div className="border border-gray-100 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">Received</div>
                    <div className="text-lg font-bold text-gray-900">{stats.transactionsReceived}</div>
                    <div className="h-1 w-full bg-green-100 mt-2 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(stats.transactionsReceived / stats.totalTransactions) * 100}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Activity Info */}
            <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                            <CalendarClock className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Account Age</p>
                            <p className="text-sm font-semibold text-gray-900">{stats.accountAgeDays} Days</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                            <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Activity Level</p>
                            <p className="text-sm font-semibold text-gray-900 capitalize">{stats.activityFrequency}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                    <ArrowRightLeft className="w-3 h-3" />
                    Total {stats.totalTransactions} interactions
                </div>
            </div>
        </div>
    );
};
