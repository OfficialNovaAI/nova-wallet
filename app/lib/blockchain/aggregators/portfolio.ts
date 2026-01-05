// src/aggregators/portfolio.ts - FIXED WITH DECIMAL DETECTION + SPEED OPTIMIZATIONS

import { Transaction, BlockchainClient } from '@/lib/blockchain/clients/base';
import { PortfolioHolding, PortfolioAnalysis } from './types';


/**
 * OPTIMIZATION: Skip price fetching for dust/worthless tokens
 * This dramatically speeds up portfolio analysis
 */
const MINIMUM_BALANCE_TO_PRICE = {
  // Only fetch prices if balance is above these thresholds
  STABLECOIN: 0.01,      // $0.01 for USDT/USDC/DAI
  MAJOR_TOKEN: 0.001,    // Small amount for ETH/WBTC/LINK
  UNKNOWN_TOKEN: 1.0     // Higher threshold for unknown tokens
};

const MAJOR_TOKENS = new Set([
  'ETH', 'WETH', 'WBTC', 'LINK', 'UNI', 'AAVE',
  'USDT', 'USDC', 'DAI', 'USDC.E'
]);

const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'USDC.E', 'BUSD']);
const MAX_TOKENS_TO_PRICE = 20; // Only price top 20 tokens by transaction count
const PRICE_FETCH_TIMEOUT_MS = 3000; // 3 second timeout per token

/**
 * Determine if we should fetch price for this token
 */
function shouldFetchPrice(tokenSymbol: string, balance: number): boolean {
  if (balance === 0) return false;

  if (STABLECOINS.has(tokenSymbol)) {
    return balance >= MINIMUM_BALANCE_TO_PRICE.STABLECOIN;
  }

  if (MAJOR_TOKENS.has(tokenSymbol)) {
    return balance >= MINIMUM_BALANCE_TO_PRICE.MAJOR_TOKEN;
  }

  // For unknown/small tokens, only price if balance is substantial
  return balance >= MINIMUM_BALANCE_TO_PRICE.UNKNOWN_TOKEN;
}

/**
 * Detect if raw value appears to use 18 decimals instead of reported decimals
 */
function detectActualDecimals(rawValue: string, reportedDecimals: number): number {
  try {
    // Count trailing zeros in raw value
    const trimmed = rawValue.replace(/0+$/, '');
    const trailingZeros = rawValue.length - trimmed.length;

    // If we have 18 trailing zeros but token reports 9 decimals, it's likely using 18
    if (reportedDecimals === 9 && trailingZeros >= 18) {
      return 18;
    }

    // Check if the raw value is way too large for the reported decimals
    const raw = BigInt(rawValue);
    const reportedDivisor = BigInt(10) ** BigInt(reportedDecimals);
    const result = raw / reportedDivisor;

    // If result would be > 1 trillion tokens, likely wrong decimals
    if (result > BigInt(1_000_000_000_000)) {
      // Try with 18 decimals
      const standardDivisor = BigInt(10) ** BigInt(18);
      const standardResult = raw / standardDivisor;

      if (standardResult < BigInt(1_000_000_000)) {
        // More reasonable with 18 decimals
        return 18;
      }
    }

    return reportedDecimals;
  } catch (e) {
    return reportedDecimals;
  }
}

/**
 * Safely convert raw token amount to decimal amount
 */
function rawToDecimal(rawValue: string, decimals: number): number {
  try {
    if (!rawValue || rawValue === '0') return 0;

    const raw = BigInt(rawValue);
    const divisor = BigInt(10) ** BigInt(decimals);

    // Integer division
    const integerPart = raw / divisor;
    // Remainder for fractional part
    const remainder = raw % divisor;

    // Convert to number with proper decimal handling
    const integerNum = Number(integerPart);
    const fractionalNum = Number(remainder) / Number(divisor);

    return integerNum + fractionalNum;
  } catch (e) {
    console.warn(`Failed to convert ${rawValue} with ${decimals} decimals:`, e);
    return 0;
  }
}

/**
 * Aggregate portfolio holdings and calculate current value
 */
export class PortfolioAggregator {
  private readonly WEI_TO_ETH = 1_000_000_000_000_000_000;
  private decimalOverrides: Map<string, number> = new Map();

  constructor(private client: BlockchainClient) { }

  /**
   * Analyze current portfolio holdings
   */
  async analyzePortfolio(
    address: string,
    transactions: Transaction[]
  ): Promise<PortfolioAnalysis> {
    const lowerAddress = address.toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    console.log('Calculating portfolio holdings...');

    // Calculate ETH balance
    const nativeBalance = this.calculateNativeBalance(transactions, lowerAddress);
    const ethPrice = await this.client.getNativeTokenPrice(now);
    const nativeValueUSD = nativeBalance * ethPrice;

    // Calculate token holdings
    const tokenHoldings = await this.calculateTokenHoldings(transactions, lowerAddress, now);

    // Calculate totals
    const totalTokenValueUSD = tokenHoldings.reduce((sum, h) => sum + h.currentValueUSD, 0);
    const totalPortfolioValueUSD = nativeValueUSD + totalTokenValueUSD;

    const totalInvestedUSD = tokenHoldings.reduce((sum, h) => sum + h.totalInvestedUSD, 0);
    const totalPnL = totalTokenValueUSD - totalInvestedUSD;
    const totalPnLPercentage = totalInvestedUSD > 0 ? (totalPnL / totalInvestedUSD) * 100 : 0;

    // Find top holdings
    const sortedByValue = [...tokenHoldings].sort((a, b) => b.currentValueUSD - a.currentValueUSD);
    const topHoldingByValue = sortedByValue[0];

    const sortedByPnL = [...tokenHoldings].sort((a, b) => b.pnl - a.pnl);
    const mostProfitableHolding = sortedByPnL[0];

    // Calculate portfolio percentages
    for (const holding of tokenHoldings) {
      holding.percentOfPortfolio = totalPortfolioValueUSD > 0
        ? (holding.currentValueUSD / totalPortfolioValueUSD) * 100
        : 0;
    }

    return {
      address,
      nativeBalance,
      nativeValueUSD,
      tokenHoldings,
      totalPortfolioValueUSD,
      totalInvestedUSD,
      totalPnL,
      totalPnLPercentage,
      numTokens: tokenHoldings.length,
      topHoldingByValue: topHoldingByValue?.currentValueUSD > 0 ? topHoldingByValue : undefined,
      mostProfitableHolding: mostProfitableHolding?.pnl > 0 ? mostProfitableHolding : undefined
    };
  }

  /**
   * Get corrected decimals for a token
   */
  private async getActualDecimals(tokenAddress: string, sampleValue: string): Promise<number> {
    if (this.decimalOverrides.has(tokenAddress)) {
      return this.decimalOverrides.get(tokenAddress)!;
    }

    const tokenInfo = await this.client.getTokenMetadata(tokenAddress);
    const actualDecimals = detectActualDecimals(sampleValue, tokenInfo.decimals);

    if (actualDecimals !== tokenInfo.decimals) {
      console.warn(`   -> ⚠️  Decimal mismatch for ${tokenInfo.symbol}:`);
      console.warn(`      Reported: ${tokenInfo.decimals}, Using: ${actualDecimals}`);
      this.decimalOverrides.set(tokenAddress, actualDecimals);
    }

    return actualDecimals;
  }

  /**
   * Calculate native token (ETH) balance
   */
  private calculateNativeBalance(transactions: Transaction[], address: string): number {
    let balance = 0;

    for (const tx of transactions) {
      if (tx.txType !== 'ETH') continue;

      const value = parseFloat(tx.value || '0') / this.WEI_TO_ETH;
      const gasUsed = parseFloat(tx.gasUsed || '0');
      const gasPrice = parseFloat(tx.gasPrice || '0');
      const gasFee = (gasUsed * gasPrice) / this.WEI_TO_ETH;

      if (tx.to.toLowerCase() === address) {
        balance += value;
      }

      if (tx.from.toLowerCase() === address) {
        balance -= (value + gasFee);
      }
    }

    return Math.max(0, balance);
  }

  /**
   * Calculate token holdings with cost basis and current value
   */
  private async calculateTokenHoldings(
    transactions: Transaction[],
    address: string,
    currentTimestamp: number
  ): Promise<PortfolioHolding[]> {
    const tokenTxMap = new Map<string, Transaction[]>();

    for (const tx of transactions) {
      if (tx.txType !== 'ERC20' || !tx.contractAddress) continue;

      const existing = tokenTxMap.get(tx.contractAddress) || [];
      existing.push(tx);
      tokenTxMap.set(tx.contractAddress, existing);
    }

    // ✅ NEW: Sort tokens by transaction count (most active first)
    const tokenArray = Array.from(tokenTxMap.entries()).map(([addr, txs]) => ({
      address: addr,
      transactions: txs,
      txCount: txs.length
    }));

    tokenArray.sort((a, b) => b.txCount - a.txCount);

    // ✅ NEW: Only price top N tokens
    const tokensToPriceSet = new Set(
      tokenArray.slice(0, MAX_TOKENS_TO_PRICE).map(t => t.address)
    );

    console.log(`📊 Processing ${tokenArray.length} tokens (pricing top ${tokensToPriceSet.size})...`);

    const holdings: PortfolioHolding[] = [];
    let pricedCount = 0;
    let skippedCount = 0;

    for (const { address: tokenAddr, transactions: txs, txCount } of tokenArray) {
      try {
        // Check if we should price this token
        const shouldPrice = tokensToPriceSet.has(tokenAddr);

        if (shouldPrice) {
          console.log(`   💰 [${txCount} txs] Pricing token...`);
          pricedCount++;
        } else {
          console.log(`   ⏭️  [${txCount} txs] Skipping price (rank ${tokenArray.findIndex(t => t.address === tokenAddr) + 1})...`);
          skippedCount++;
        }

        const holding = await this.calculateTokenHolding(
          tokenAddr,
          txs,
          address,
          currentTimestamp,
          shouldPrice // ✅ NEW: Pass flag to skip pricing
        );

        // Only include if there's a non-zero balance AND (has value OR is in top 20)
        if (holding.balance > 0.000001) {
          // ✅ Skip tokens with $0 value that weren't in top 20
          if (!shouldPrice && holding.currentValueUSD === 0) {
            continue; // Skip unpriced dust tokens
          }
          // ✅ Also skip tokens with very small USD value (< $0.01)
          if (holding.currentValueUSD < 0.01 && holding.currentValueUSD > 0) {
            continue; // Skip near-worthless tokens
          }
          holdings.push(holding);
        }
      } catch (error) {
        console.warn(`Failed to calculate holding for token ${tokenAddr}:`, error);
      }
    }

    console.log(`✅ Portfolio complete: Priced ${pricedCount} tokens, skipped ${skippedCount}`);

    holdings.sort((a, b) => b.currentValueUSD - a.currentValueUSD);

    return holdings;
  }

  /**
   * Calculate holding for a specific token - FIXED WITH DECIMAL DETECTION
   */
  private async calculateTokenHolding(
    tokenAddress: string,
    transactions: Transaction[],
    address: string,
    currentTimestamp: number,
    shouldPrice: boolean = true // ✅ NEW: Flag to control pricing
  ): Promise<PortfolioHolding> {
    // ✅ OPTIMIZATION: Get token info from first transaction to avoid metadata call
    const firstTx = transactions[0];
    const tokenSymbolFromTx = firstTx?.tokenSymbol || 'UNKNOWN';
    const tokenDecimalFromTx = firstTx?.tokenDecimal ? parseInt(firstTx.tokenDecimal) : 18;
    
    // Only fetch full metadata if we're pricing this token (top 20)
    let tokenInfo;
    if (shouldPrice) {
      tokenInfo = await this.client.getTokenMetadata(tokenAddress);
    } else {
      // Use transaction data to avoid API call
      tokenInfo = {
        symbol: tokenSymbolFromTx,
        decimals: tokenDecimalFromTx,
        address: tokenAddress
      };
    }

    // Detect actual decimals from first transaction
    const sampleValue = firstTx?.value || '0';
    const actualDecimals = shouldPrice 
      ? await this.getActualDecimals(tokenAddress, sampleValue)
      : tokenDecimalFromTx;

    let balance = 0;
    let totalInvestedUSD = 0;
    let totalPurchasedAmount = 0;

    // Calculate balance and cost basis using CORRECTED decimals
    for (const tx of transactions) {
      const amount = rawToDecimal(tx.value || '0', actualDecimals);
      const timestamp = parseInt(tx.timeStamp);

      if (tx.to.toLowerCase() === address) {
        // Received/bought
        balance += amount;
        totalPurchasedAmount += amount;

        // ✅ MODIFIED: Only fetch historical price if shouldPrice is true
        if (shouldPrice) {
          try {
            // Add timeout protection
            const pricePromise = this.client.getHistoricalPrice(tokenAddress, timestamp);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), PRICE_FETCH_TIMEOUT_MS)
            );

            const historicalPrice = await Promise.race([pricePromise, timeoutPromise]) as any;

            if (historicalPrice.priceUSD > 0) {
              totalInvestedUSD += amount * historicalPrice.priceUSD;
            }
          } catch (error: unknown) {
            // ✅ FIXED: Properly type error
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            if (errorMessage !== 'timeout') {
              console.warn(`   -> Price fetch failed: ${errorMessage}`);
            }
          }
        }
      } else if (tx.from.toLowerCase() === address) {
        // Sent/sold
        balance -= amount;
      }
    }

    // Sanity check: if balance is absurdly high, something is wrong
    if (balance > 1_000_000_000_000) {
      console.warn(`   -> ⚠️ Suspicious balance for ${tokenInfo.symbol}: ${balance.toFixed(2)} (skipping)`);
      balance = 0;
    }

    // ✅ MODIFIED: Only get current price if shouldPrice is true
    let currentPriceUSD = 0;
    if (shouldPrice) {
      try {
        // Add timeout protection
        const pricePromise = this.client.getHistoricalPrice(tokenAddress, currentTimestamp);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), PRICE_FETCH_TIMEOUT_MS)
        );

        const currentPrice = await Promise.race([pricePromise, timeoutPromise]) as any;
        currentPriceUSD = currentPrice.priceUSD;
      } catch (error: unknown) {
        // ✅ FIXED: Properly type error
        const errorMessage = error instanceof Error ? error.message : 'unknown error';
        if (errorMessage !== 'timeout') {
          console.warn(`   -> Could not get current price for ${tokenInfo.symbol}`);
        }
      }
    }

    const currentValueUSD = balance * currentPriceUSD;

    // Calculate weighted average buy price
    const averageBuyPriceUSD = totalPurchasedAmount > 0
      ? totalInvestedUSD / totalPurchasedAmount
      : 0;

    // Calculate P&L based on current holding's cost basis
    const costBasis = balance * averageBuyPriceUSD;
    const pnl = currentValueUSD - costBasis;
    const pnlPercentage = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    // Sanity check on values
    if (currentValueUSD > 1_000_000_000_000) {
      console.warn(`   -> ⚠️ Suspicious value for ${tokenInfo.symbol}: $${currentValueUSD.toFixed(2)} (capping at 0)`);
      return {
        tokenSymbol: tokenInfo.symbol,
        tokenAddress,
        tokenName: tokenInfo.name,
        balance: 0,
        currentValueUSD: 0,
        averageBuyPriceUSD: 0,
        currentPriceUSD: 0,
        pnl: 0,
        pnlPercentage: 0,
        percentOfPortfolio: 0,
        totalInvestedUSD: 0
      };
    }

    // Debug logging
    if (actualDecimals !== tokenInfo.decimals) {
      console.log(`   -> ✅ Corrected ${tokenInfo.symbol}: Balance ${balance.toFixed(4)} (was using wrong decimals)`);
    }

    return {
      tokenSymbol: tokenInfo.symbol,
      tokenAddress,
      tokenName: tokenInfo.name,
      balance,
      currentValueUSD,
      averageBuyPriceUSD,
      currentPriceUSD,
      pnl,
      pnlPercentage,
      percentOfPortfolio: 0, // Will be calculated later
      totalInvestedUSD: costBasis
    };
  }
}