"use client";

import { useAccount } from "wagmi";
import { TrendingUp, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supportedChains } from "@/config/chains";
import Image from "next/image";

// Chain Logo Mapping (By Chain ID)
// This fixes the issue where multiple chains use "ETH" symbol
const chainLogos: Record<number, string> = {
  1: '/eth.svg',           // Mainnet
  11155111: '/eth.svg',    // Sepolia
  5000: '/mantle.svg',     // Mantle
  5003: '/mantle.svg',     // Mantle Sepolia
  4202: '/lisk.svg',       // Lisk Sepolia
  137: '/polygon.svg',     // Polygon
  80002: '/polygon.svg',   // Polygon Amoy
  10: '/optimism.svg',     // Optimism
  11155420: '/optimism.svg', // OP Sepolia
  42161: '/arbitrum.png',  // Arbitrum
  421614: '/arbitrum.png', // Arb Sepolia
  8453: '/base.png',       // Base
  84532: '/base.png',      // Base Sepolia
};

// Fallback Token logo mapping (By Symbol)
const tokenLogos: Record<string, string> = {
  'ETH': '/eth.svg',
  'MNT': '/mantle.svg',
  'LSK': '/lisk.svg',
  'MATIC': '/polygon.svg',
  'POL': '/polygon.svg',
  'USDC': '/usdc.svg',
};

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  chainId: number;
}

interface PriceData {
  price: number;
  change: number;
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
  const [tokenPrices, setTokenPrices] = useState<Record<string, PriceData>>({});
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
        // Use ALL supported chains
        const balancePromises = supportedChains.map(async (chain) => {
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
              const data = priceData.prices[token.symbol];
              const price = data?.price || 0;
              return sum + (balance * price);
            }, 0);
            setTotalUsdValue(usdTotal);
          }
        } catch (error) {
          console.error("Error fetching prices:", error);
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

  // Calculate weighted average 24h change for the total card
  useEffect(() => {
    if (totalUsdValue > 0 && tokens.length > 0) {
      const weightedChange = tokens.reduce((acc, token) => {
        const balance = parseFloat(token.balance);
        const data = tokenPrices[token.symbol];
        if (!data || !data.price) return acc;

        const value = balance * data.price;
        const weight = value / totalUsdValue;
        return acc + (data.change * weight);
      }, 0);
      setPercentageChange(weightedChange);
    }
  }, [totalUsdValue, tokens, tokenPrices]);


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
            <span className="text-sm opacity-90">Total Asset Value</span>
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
          Your Assets
        </span>
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm">Loading balances...</p>
            </div>
          ) : isConnected && tokens.length > 0 ? (
            tokens.map((token) => {
              const balance = parseFloat(token.balance);
              const priceData = tokenPrices[token.symbol];
              const usdValue = balance * (priceData?.price || 0);
              const percent = totalUsdValue > 0 ? (usdValue / totalUsdValue) * 100 : 0;
              const change = priceData?.change || 0;

              // Determine Logo: Prefer chain-specific logo, fallback to symbol-based
              const logoSrc = chainLogos[token.chainId] || tokenLogos[token.symbol];

              // Determine Display Name
              let displayName = token.name;
              // Specific overrides for clearer naming if 'token.name' is generic
              if (token.symbol === 'ETH' && token.name === 'Ethereum' && token.chainId === 10) displayName = 'Optimism';
              if (token.symbol === 'ETH' && token.name === 'Ethereum' && token.chainId === 8453) displayName = 'Base';
              if (token.symbol === 'ETH' && token.name === 'Ethereum' && token.chainId === 42161) displayName = 'Arbitrum';


              return (
                <div
                  key={`${token.chainId}-${token.symbol}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  {/* Left: Icon + Name/Percent + Balance/Symbol */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 overflow-hidden shrink-0">
                      {logoSrc ? (
                        <Image
                          src={logoSrc}
                          alt={displayName}
                          width={40}
                          height={40}
                          className="object-contain h-8 w-8"
                        />
                      ) : (
                        <span className="text-sm font-bold text-gray-600">
                          {token.symbol.substring(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{displayName}</span>
                        {/* Percent Badge */}
                        <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                          {percent < 0.1 && percent > 0 ? "<0.1%" : `${percent.toFixed(1)}%`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {showBalance ? `${balance.toFixed(4)} ${token.symbol}` : "••••"}
                      </span>
                    </div>
                  </div>

                  {/* Right: USD Value + Change */}
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      {showBalance ? `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "••••"}
                    </div>
                    <div className={cn(
                      "text-xs font-medium",
                      change >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })
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
