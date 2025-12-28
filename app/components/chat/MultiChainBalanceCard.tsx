"use client";

import { Wallet, TrendingUp, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface ChainBalance {
    chainName: string;
    balance: string;
    symbol: string;
    chainId?: number;
    explorerUrl?: string;
}

interface MultiChainBalanceCardProps {
    balances: ChainBalance[];
    address: string;
    totalUsdValue?: string;
}

// Chain icon colors
const chainColors: Record<string, string> = {
    "Ethereum": "from-blue-400 to-blue-600",
    "BNB Smart Chain": "from-yellow-400 to-yellow-600",
    "Polygon": "from-purple-400 to-purple-600",
    "Arbitrum One": "from-blue-500 to-cyan-500",
    "Mantle": "from-emerald-400 to-emerald-600",
    "Mantle Sepolia": "from-emerald-400 to-teal-600",
    "Base Sepolia": "from-blue-400 to-indigo-600",
    "Optimism Sepolia": "from-red-400 to-red-600",
    "Lisk Sepolia": "from-cyan-400 to-cyan-600",
    "default": "from-gray-400 to-gray-600",
};

export const MultiChainBalanceCard = ({
    balances,
    address,
    totalUsdValue,
}: MultiChainBalanceCardProps) => {
    const [copied, setCopied] = useState(false);
    const [expandedChain, setExpandedChain] = useState<string | null>(null);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            toast.success("Address copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    const formatBalance = (bal: string) => {
        const num = parseFloat(bal);
        if (isNaN(num)) return bal;
        if (num === 0) return "0";
        if (num < 0.0001) return "< 0.0001";
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4
        });
    };

    const getChainColor = (chainName: string) => {
        return chainColors[chainName] || chainColors["default"];
    };

    // Filter chains with non-zero balance
    const nonZeroBalances = balances.filter(b => parseFloat(b.balance) > 0);
    const zeroBalances = balances.filter(b => parseFloat(b.balance) === 0);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-100/50 
                    max-w-md mt-3 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600 p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm
                            flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Wallet Portfolio</h3>
                            <p className="text-white/80 text-sm">Multi-Chain Balance</p>
                        </div>
                    </div>
                    <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs 
                          font-medium rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Connected
                    </span>
                </div>

                {/* Address */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between">
                    <span className="font-mono text-sm text-white/90">
                        {address.slice(0, 12)}...{address.slice(-10)}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-white hover:bg-white/20"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Balances List */}
            <div className="p-4">
                {/* Non-zero balances */}
                {nonZeroBalances.length > 0 && (
                    <div className="space-y-2 mb-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Active Balances
                        </p>
                        {nonZeroBalances.map((chain, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gradient-to-r 
                          from-gray-50 to-white rounded-xl border border-gray-100
                          hover:border-purple-200 hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getChainColor(chain.chainName)}
                                  flex items-center justify-center shadow-sm`}>
                                        <span className="text-white font-bold text-sm">
                                            {chain.symbol.slice(0, 2)}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{chain.chainName}</p>
                                        <p className="text-xs text-gray-500">{chain.symbol}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">
                                        {formatBalance(chain.balance)}
                                    </p>
                                    <p className="text-xs text-gray-500">{chain.symbol}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Zero balances (collapsed) */}
                {zeroBalances.length > 0 && (
                    <div>
                        <button
                            onClick={() => setExpandedChain(expandedChain === 'zero' ? null : 'zero')}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 
                        rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <span>{zeroBalances.length} chains with zero balance</span>
                            <ChevronRight className={`w-4 h-4 transition-transform ${expandedChain === 'zero' ? 'rotate-90' : ''
                                }`} />
                        </button>

                        {expandedChain === 'zero' && (
                            <div className="mt-2 space-y-1 pl-2">
                                {zeroBalances.map((chain, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between py-2 px-3 
                              text-sm text-gray-500 rounded-lg hover:bg-gray-50"
                                    >
                                        <span>{chain.chainName}</span>
                                        <span>0 {chain.symbol}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* No balances found */}
                {balances.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                        <Wallet className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No balances found</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4">
                <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-purple-500 to-violet-600 text-white
                     hover:from-purple-600 hover:to-violet-700 hover:shadow-lg 
                     hover:shadow-purple-500/20 transition-all duration-200"
                    onClick={handleCopy}
                >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Wallet Address
                </Button>
            </div>
        </div>
    );
};
