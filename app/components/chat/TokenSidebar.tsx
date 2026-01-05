"use client";

import { useAccount } from "wagmi";
import { TrendingUp, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supportedChains } from "@/config/chains";
import Image from "next/image";

// Filter to only show Lisk, Mantle, and ETH Sepolia
const focusedChains = supportedChains.filter(chain =>
  chain.name === 'Lisk Sepolia' ||
  chain.name === 'Mantle Sepolia' ||
  chain.name === 'ETH Sepolia'
);

// Token logo mapping
const tokenLogos: Record<string, string> = {
  'ETH': '/eth.svg',
  'MNT': '/mantle.svg',
  'LSK': '/lisk.svg',
};

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  chainId: number;
}

interface TokenSidebarProps {
  isOpen: boolean;
}

export const TokenSidebar = ({ isOpen }: TokenSidebarProps) => {
  const { isConnected, address } = useAccount();
  const [showBalance, setShowBalance] = useState(true);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [percentageChange, setPercentageChange] = useState<number>(0);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [totalUsdValue, setTotalUsdValue] = useState<number>(0);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !address) {
        setTokens([]);
        setPercentageChange(0);
        return;
      }

      setIsLoading(true);
      try {
        const balancePromises = focusedChains.map(async (chain) => {
          try {
            const response = await fetch("/api/wallet/balance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address, chainId: chain.id }),
            });

            if (response.ok) {
              const data = await response.json();
              return {
                symbol: data.tokenSymbol,
                name: data.formattedChainName,
                balance: data.balanceEth,
                chainId: chain.id,
              };
            }
            return null;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(balancePromises);
        const validBalances = results.filter((b) => b !== null) as TokenBalance[];
        setTokens(validBalances);

        // Fetch token prices
        const uniqueSymbols = [...new Set(validBalances.map(t => t.symbol))];
        try {
          const priceResponse = await fetch("/api/prices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols: uniqueSymbols }),
          });

          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            setTokenPrices(priceData.prices || {});

            // Calculate total USD value
            const usdTotal = validBalances.reduce((sum, token) => {
              const balance = parseFloat(token.balance);
              const price = priceData.prices[token.symbol] || 0;
              return sum + (balance * price);
            }, 0);
            setTotalUsdValue(usdTotal);
          }
        } catch (error) {
          console.error("Error fetching prices:", error);
        }

        // Calculate total balance
        const currentTotal = validBalances.reduce((sum, token) => {
          const balance = parseFloat(token.balance);
          return sum + (isNaN(balance) ? 0 : balance);
        }, 0);

        // Get previous balance from localStorage
        const storageKey = `wallet_balance_${address}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          const { balance: previousBalance, timestamp } = JSON.parse(stored);
          const hoursSinceLastCheck = (Date.now() - timestamp) / (1000 * 60 * 60);

          // Only calculate if we have data from at least 1 hour ago
          if (hoursSinceLastCheck >= 1 && previousBalance > 0) {
            const change = ((currentTotal - previousBalance) / previousBalance) * 100;
            setPercentageChange(change);
          }

          // Update storage if more than 24 hours have passed
          if (hoursSinceLastCheck >= 24) {
            localStorage.setItem(storageKey, JSON.stringify({
              balance: currentTotal,
              timestamp: Date.now()
            }));
          }
        } else {
          // First time, store current balance
          localStorage.setItem(storageKey, JSON.stringify({
            balance: currentTotal,
            timestamp: Date.now()
          }));
          setPercentageChange(0);
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
        setTokens([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [isConnected, address]);


  return (
    <aside
      className={cn(
        "h-full border-r border-border bg-card flex flex-col transition-all duration-300",
        isOpen ? "w-80" : "w-0 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Portfolio Focus</h2>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            {showBalance ? (
              <Eye className="w-5 h-5 text-muted-foreground" />
            ) : (
              <EyeOff className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Total Asset Value Card */}
        <div className="total-asset-value rounded-2xl p-4 text-primary-foreground text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm opacity-90">Total Native Tokens</span>
          </div>
          <p className="text-3xl font-bold">
            {showBalance ? `$${totalUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "••••••"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
              percentageChange >= 0 ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {percentageChange >= 0 ? "📈" : "📉"} {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(2)}%
            </span>
            <span className="text-sm opacity-80">Last 24h</span>
          </div>
        </div>
      </div>

      {/* Token Balance Label */}
      <div className="px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Token Balance
        </span>
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm">Loading balances...</p>
            </div>
          ) : isConnected && tokens.length > 0 ? (
            tokens.map((token) => (
              <div
                key={`${token.chainId}-${token.symbol}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {/* Token Icon */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 overflow-hidden">
                  {tokenLogos[token.symbol] ? (
                    <Image
                      src={tokenLogos[token.symbol]}
                      alt={token.symbol}
                      width={40}
                      height={40}
                      className="object-contain h-8 w-8"
                    />
                  ) : (
                    <span className="text-sm font-bold text-gray-600">
                      {token.symbol}
                    </span>
                  )}
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{token.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {showBalance ? `${parseFloat(token.balance).toFixed(4)} ${token.symbol}` : "••••"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Connect your wallet to view tokens</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
