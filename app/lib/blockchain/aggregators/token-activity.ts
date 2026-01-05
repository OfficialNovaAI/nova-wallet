// src/aggregators/token-activity.ts - FIXED WITH DECIMAL SANITY CHECK

import { Transaction, TokenInfo, BlockchainClient } from '@/lib/blockchain/clients/base';
import {
  TokenPurchaseSummary,
  TokenSaleSummary,
  TokenActivitySummary,
  TokenActivityAnalysis
} from './types';

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
    // e.g., if decimals=9 but value has 18+ digits, likely using 18 decimals
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
    // Handle empty or invalid values
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
 * OPTIMIZED: Batch price fetching for token activity analysis
 */
export class TokenActivityAggregator {
  private priceCache: Map<string, number> = new Map();
  private decimalOverrides: Map<string, number> = new Map();

  constructor(private client: BlockchainClient) { }

  async analyzeTokenActivity(
    address: string,
    transactions: Transaction[],
    timeframeStart?: number,
    timeframeEnd?: number
  ): Promise<TokenActivityAnalysis> {
    const lowerAddress = address.toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    const purchases = transactions.filter(
      tx => tx.txType === 'ERC20' && tx.to.toLowerCase() === lowerAddress
    );

    const sales = transactions.filter(
      tx => tx.txType === 'ERC20' && tx.from.toLowerCase() === lowerAddress
    );

    console.log(`Analyzing ${purchases.length} token purchases and ${sales.length} sales...`);

    // OPTIMIZATION: Pre-fetch all prices before processing
    await this.prefetchTokenPrices([...purchases, ...sales]);

    const tokensBought = await this.aggregateTokenPurchases(purchases, now);
    const tokensSold = await this.aggregateTokenSales(sales);
    const summary = this.calculateActivitySummary(tokensBought, tokensSold);

    return {
      address,
      timeframeStart: timeframeStart || (transactions[0] ? parseInt(transactions[0].timeStamp) : now),
      timeframeEnd: timeframeEnd || now,
      tokensBought,
      tokensSold,
      summary
    };
  }

  /**
   * Get corrected decimals for a token
   */
  private async getActualDecimals(tokenAddress: string, sampleValue: string): Promise<number> {
    // Check if we already have an override
    if (this.decimalOverrides.has(tokenAddress)) {
      return this.decimalOverrides.get(tokenAddress)!;
    }

    const tokenInfo = await this.client.getTokenMetadata(tokenAddress);
    const actualDecimals = detectActualDecimals(sampleValue, tokenInfo.decimals);

    if (actualDecimals !== tokenInfo.decimals) {
      console.warn(`   -> ⚠️  Decimal mismatch detected for ${tokenInfo.symbol}:`);
      console.warn(`      Reported: ${tokenInfo.decimals}, Using: ${actualDecimals}`);
      this.decimalOverrides.set(tokenAddress, actualDecimals);
    }

    return actualDecimals;
  }

  /**
   * OPTIMIZATION: Pre-fetch all token prices in batch
   */
  private async prefetchTokenPrices(transactions: Transaction[]): Promise<void> {
    const uniquePrices = new Map<string, Set<number>>();

    for (const tx of transactions) {
      if (!tx.contractAddress) continue;

      const timestamp = parseInt(tx.timeStamp);
      const months = uniquePrices.get(tx.contractAddress) || new Set();

      const date = new Date(timestamp * 1000);
      const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthTs = Math.floor(monthlyDate.getTime() / 1000);

      months.add(monthTs);
      uniquePrices.set(tx.contractAddress, months);
    }

    console.log(`   -> Pre-fetching prices for ${uniquePrices.size} unique tokens...`);

    let fetched = 0;
    for (const [tokenAddr, timestamps] of uniquePrices.entries()) {
      // Fetch token metadata once per token
      await this.client.getTokenMetadata(tokenAddr);

      for (const ts of timestamps) {
        const cacheKey = `${tokenAddr}_${ts}`;

        if (this.priceCache.has(cacheKey)) continue;

        try {
          const price = await this.client.getHistoricalPrice(tokenAddr, ts);
          this.priceCache.set(cacheKey, price.priceUSD);
          fetched++;
        } catch (error) {
          this.priceCache.set(cacheKey, 0);
        }
      }
    }

    console.log(`   -> ✅ Pre-fetched ${fetched} price points`);
  }

  private async aggregateTokenPurchases(
    purchases: Transaction[],
    currentTimestamp: number
  ): Promise<TokenPurchaseSummary[]> {
    const tokenMap = new Map<string, Transaction[]>();

    for (const tx of purchases) {
      if (!tx.contractAddress) continue;

      const existing = tokenMap.get(tx.contractAddress) || [];
      existing.push(tx);
      tokenMap.set(tx.contractAddress, existing);
    }

    const summaries: TokenPurchaseSummary[] = [];

    for (const [tokenAddr, txs] of tokenMap.entries()) {
      try {
        const summary = await this.calculateTokenPurchaseSummary(
          tokenAddr,
          txs,
          currentTimestamp
        );
        summaries.push(summary);
      } catch (error) {
        console.warn(`Failed to process token ${tokenAddr}:`, error);
      }
    }

    summaries.sort((a, b) => b.currentValueUSD - a.currentValueUSD);

    return summaries;
  }

  /**
   * FIXED: Get current price separately from historical prices
   */
  private async calculateTokenPurchaseSummary(
    tokenAddress: string,
    purchases: Transaction[],
    currentTimestamp: number
  ): Promise<TokenPurchaseSummary> {
    const tokenInfo = await this.client.getTokenMetadata(tokenAddress);

    // Detect actual decimals from first transaction
    const sampleValue = purchases[0]?.value || '0';
    const actualDecimals = await this.getActualDecimals(tokenAddress, sampleValue);

    // Calculate total amount using corrected decimals
    const totalAmount = purchases.reduce((sum, tx) => {
      const amount = rawToDecimal(tx.value || '0', actualDecimals);
      return sum + amount;
    }, 0);

    let totalSpentUSD = 0;

    // Calculate total spent using HISTORICAL prices at time of purchase
    for (const tx of purchases) {
      const timestamp = parseInt(tx.timeStamp);
      const amount = rawToDecimal(tx.value || '0', actualDecimals);

      const date = new Date(timestamp * 1000);
      const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthTs = Math.floor(monthlyDate.getTime() / 1000);

      const cacheKey = `${tokenAddress}_${monthTs}`;
      let priceUSD = this.priceCache.get(cacheKey);

      if (priceUSD === undefined) {
        const price = await this.client.getHistoricalPrice(tokenAddress, timestamp);
        priceUSD = price.priceUSD;
        this.priceCache.set(cacheKey, priceUSD);
      }

      totalSpentUSD += amount * priceUSD;
    }

    // Get CURRENT price - use a special cache key for "now" prices
    // to avoid collision with historical monthly prices
    const currentCacheKey = `${tokenAddress}_CURRENT_${Math.floor(Date.now() / (1000 * 60 * 60))}`; // Hourly cache
    let currentPriceUSD = this.priceCache.get(currentCacheKey);

    if (currentPriceUSD === undefined) {
      // Try to get the most recent price available
      const price = await this.client.getHistoricalPrice(tokenAddress, currentTimestamp);
      currentPriceUSD = price.priceUSD;

      // If the API returns 0 (failed), try to get last known good price from cache
      if (currentPriceUSD === 0) {
        // Look for any cached price for this token
        for (const [key, value] of this.priceCache.entries()) {
          if (key.startsWith(`${tokenAddress}_`) && value > 0) {
            console.warn(`   -> ⚠️ Using last known price for ${tokenInfo.symbol}: $${value}`);
            currentPriceUSD = value;
            break;
          }
        }
      }

      this.priceCache.set(currentCacheKey, currentPriceUSD);
    }

    const currentValueUSD = totalAmount * currentPriceUSD;
    const pnl = currentValueUSD - totalSpentUSD;
    const pnlPercentage = totalSpentUSD > 0 ? (pnl / totalSpentUSD) * 100 : 0;

    const timestamps = purchases.map(tx => parseInt(tx.timeStamp));

    // Debug logging for verification
    if (actualDecimals !== tokenInfo.decimals) {
      console.log(`   -> ✅ Corrected ${tokenInfo.symbol}: ${totalAmount.toFixed(2)} tokens (was using wrong decimals)`);
    }

    // Additional debug logging for P&L
    if (totalSpentUSD > 0 && Math.abs(pnl) > 0.01) {
      console.log(`   -> 💰 ${tokenInfo.symbol} P&L: $${pnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%)`);
    }

    return {
      tokenSymbol: tokenInfo.symbol,
      tokenAddress,
      tokenName: tokenInfo.name,
      totalAmount,
      totalSpentUSD,
      currentValueUSD,
      pnl,
      pnlPercentage,
      firstPurchaseTimestamp: Math.min(...timestamps),
      lastPurchaseTimestamp: Math.max(...timestamps),
      numPurchases: purchases.length,
      averagePriceUSD: totalAmount > 0 ? totalSpentUSD / totalAmount : 0,
      currentPriceUSD
    };
  }

  private async aggregateTokenSales(sales: Transaction[]): Promise<TokenSaleSummary[]> {
    const tokenMap = new Map<string, Transaction[]>();

    for (const tx of sales) {
      if (!tx.contractAddress) continue;

      const existing = tokenMap.get(tx.contractAddress) || [];
      existing.push(tx);
      tokenMap.set(tx.contractAddress, existing);
    }

    const summaries: TokenSaleSummary[] = [];

    for (const [tokenAddr, txs] of tokenMap.entries()) {
      try {
        const summary = await this.calculateTokenSaleSummary(tokenAddr, txs);
        summaries.push(summary);
      } catch (error) {
        console.warn(`Failed to process token sale ${tokenAddr}:`, error);
      }
    }

    summaries.sort((a, b) => b.totalReceivedUSD - a.totalReceivedUSD);

    return summaries;
  }

  /**
   * FIXED: Detect and correct decimal mismatches for sales
   */
  private async calculateTokenSaleSummary(
    tokenAddress: string,
    sales: Transaction[]
  ): Promise<TokenSaleSummary> {
    const tokenInfo = await this.client.getTokenMetadata(tokenAddress);

    // Detect actual decimals from first transaction
    const sampleValue = sales[0]?.value || '0';
    const actualDecimals = await this.getActualDecimals(tokenAddress, sampleValue);

    // Calculate total amount using corrected decimals
    const totalAmount = sales.reduce((sum, tx) => {
      const amount = rawToDecimal(tx.value || '0', actualDecimals);
      return sum + amount;
    }, 0);

    let totalReceivedUSD = 0;

    for (const tx of sales) {
      const timestamp = parseInt(tx.timeStamp);
      const amount = rawToDecimal(tx.value || '0', actualDecimals);

      const date = new Date(timestamp * 1000);
      const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthTs = Math.floor(monthlyDate.getTime() / 1000);

      const cacheKey = `${tokenAddress}_${monthTs}`;
      let priceUSD = this.priceCache.get(cacheKey);

      if (priceUSD === undefined) {
        const price = await this.client.getHistoricalPrice(tokenAddress, timestamp);
        priceUSD = price.priceUSD;
        this.priceCache.set(cacheKey, priceUSD);
      }

      totalReceivedUSD += amount * priceUSD;
    }

    const timestamps = sales.map(tx => parseInt(tx.timeStamp));

    return {
      tokenSymbol: tokenInfo.symbol,
      tokenAddress,
      tokenName: tokenInfo.name,
      totalAmount,
      totalReceivedUSD,
      numSales: sales.length,
      averagePriceUSD: totalAmount > 0 ? totalReceivedUSD / totalAmount : 0,
      firstSaleTimestamp: Math.min(...timestamps),
      lastSaleTimestamp: Math.max(...timestamps)
    };
  }

  private calculateActivitySummary(
    purchases: TokenPurchaseSummary[],
    sales: TokenSaleSummary[]
  ): TokenActivitySummary {
    const totalInvestedUSD = purchases.reduce((sum, p) => sum + p.totalSpentUSD, 0);
    const currentPortfolioValueUSD = purchases.reduce((sum, p) => sum + p.currentValueUSD, 0);
    const totalPnL = currentPortfolioValueUSD - totalInvestedUSD;
    const totalPnLPercentage = totalInvestedUSD > 0 ? (totalPnL / totalInvestedUSD) * 100 : 0;

    const sortedByPnL = [...purchases].sort((a, b) => b.pnl - a.pnl);
    const mostProfitableToken = sortedByPnL[0];
    const biggestLoserToken = sortedByPnL[sortedByPnL.length - 1];

    const uniqueTokenAddresses = new Set([
      ...purchases.map(p => p.tokenAddress),
      ...sales.map(s => s.tokenAddress)
    ]);

    return {
      totalInvestedUSD,
      currentPortfolioValueUSD,
      totalPnL,
      totalPnLPercentage,
      numTokensBought: purchases.length,
      numTokensSold: sales.length,
      numUniqueTokens: uniqueTokenAddresses.size,
      mostProfitableToken: mostProfitableToken?.pnl > 0 ? mostProfitableToken : undefined,
      biggestLoserToken: biggestLoserToken?.pnl < 0 ? biggestLoserToken : undefined
    };
  }
}