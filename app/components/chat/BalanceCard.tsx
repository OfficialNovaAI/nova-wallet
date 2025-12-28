"use client";

import { Wallet, TrendingUp, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface BalanceCardProps {
    balance: string;
    tokenSymbol: string;
    chainName: string;
    address: string;
    usdValue?: string;
}

export const BalanceCard = ({
    balance,
    tokenSymbol,
    chainName,
    address,
    usdValue,
}: BalanceCardProps) => {
    const [copied, setCopied] = useState(false);

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

    // Format balance to show max 6 decimal places
    const formatBalance = (bal: string) => {
        const num = parseFloat(bal);
        if (isNaN(num)) return bal;
        if (num === 0) return "0";
        if (num < 0.000001) return "< 0.000001";
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        });
    };

    return (
        <div className="bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-transparent 
                    rounded-2xl border border-purple-200/50 p-5 max-w-sm mt-3 
                    shadow-lg shadow-purple-500/10">
            {/* Header with chain badge */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 
                          flex items-center justify-center shadow-md">
                        <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Wallet Balance</h3>
                        <p className="text-xs text-gray-500">{chainName}</p>
                    </div>
                </div>
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full
                        flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    Connected
                </span>
            </div>

            {/* Balance display */}
            <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
                <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-gray-900">
                        {formatBalance(balance)}
                    </span>
                    <span className="text-lg font-semibold text-purple-600">
                        {tokenSymbol}
                    </span>
                </div>
                {usdValue && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>≈ ${usdValue} USD</span>
                    </div>
                )}
            </div>

            {/* Address with copy */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Your Address</p>
                <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-700">
                        {address.slice(0, 10)}...{address.slice(-8)}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 hover:bg-purple-100 hover:text-purple-700 
                       transition-all duration-200"
                        onClick={handleCopy}
                    >
                        {copied ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50 
                     hover:border-purple-300 transition-all duration-200"
                    onClick={() => {
                        window.open(`https://explorer.mantle.xyz/address/${address}`, '_blank');
                    }}
                >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Explorer
                </Button>
                <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white
                     hover:from-purple-600 hover:to-violet-700 hover:shadow-md 
                     hover:shadow-purple-500/20 transition-all duration-200"
                    onClick={handleCopy}
                >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Address
                </Button>
            </div>
        </div>
    );
};
