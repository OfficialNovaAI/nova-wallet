// src/aggregators/transaction-stats.ts - FIXED for L2 gas calculations

import { Transaction, BlockchainClient } from '@/lib/blockchain/clients/base';
import { TransactionStats } from './types';

/**
 * Calculate basic transaction statistics
 */
export class TransactionStatsAggregator {
  private readonly WEI_TO_ETH = 1_000_000_000_000_000_000;
  private readonly SECONDS_PER_DAY = 86400;

  constructor(private client: BlockchainClient) {}

  /**
   * Calculate transaction statistics for an address
   */
  async calculateTransactionStats(
    address: string,
    transactions: Transaction[],
    timeframeStart?: number,
    timeframeEnd?: number
  ): Promise<TransactionStats> {
    const lowerAddress = address.toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    // Get chain-specific block time (default to 12 seconds if not specified)
    const blockTime = this.client.blockTimeSeconds || 12;

    console.log('Calculating transaction statistics...');

    // Filter by timeframe if specified
    let filteredTxs = transactions;
    if (timeframeStart || timeframeEnd) {
      filteredTxs = transactions.filter(tx => {
        const timestamp = parseInt(tx.timeStamp);
        if (timeframeStart && timestamp < timeframeStart) return false;
        if (timeframeEnd && timestamp > timeframeEnd) return false;
        return true;
      });
    }

    // Basic counts
    const totalTransactions = filteredTxs.length;
    const ethTransactions = filteredTxs.filter(tx => tx.txType === 'ETH').length;
    const erc20Transactions = filteredTxs.filter(tx => tx.txType === 'ERC20').length;

    const transactionsSent = filteredTxs.filter(
      tx => tx.from.toLowerCase() === lowerAddress
    ).length;

    const transactionsReceived = filteredTxs.filter(
      tx => tx.to.toLowerCase() === lowerAddress
    ).length;

    // Calculate total gas spent - batch price lookups to avoid repeated calls
    let totalGasSpentUSD = 0;

    // Group transactions by month to minimize price API calls
    const txsByMonth = new Map<string, Transaction[]>();

    for (const tx of filteredTxs) {
      if (tx.from.toLowerCase() === lowerAddress) {
        const timestamp = parseInt(tx.timeStamp);
        const date = new Date(timestamp * 1000);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!txsByMonth.has(monthKey)) {
          txsByMonth.set(monthKey, []);
        }
        txsByMonth.get(monthKey)!.push(tx);
      }
    }

    // Fetch prices once per month and calculate gas
    for (const [monthKey, monthTxs] of txsByMonth.entries()) {
      // Use the first transaction's timestamp from this month
      const timestamp = parseInt(monthTxs[0].timeStamp);

      try {
        const nativeTokenPrice = await this.client.getNativeTokenPrice(timestamp);

        // If price is 0 or missing, skip this month's gas calculation
        if (nativeTokenPrice === 0) {
          console.warn(`   -> Skipping gas calculation for ${monthKey} (price unavailable)`);
          continue;
        }

        // Calculate gas for all transactions in this month
        for (const tx of monthTxs) {
          // ✅ FIXED: Use BigInt for precise gas calculations (important for L2 chains with tiny gas)
          try {
            const gasUsedStr = tx.gasUsed || '0';
            const gasPriceStr = tx.gasPrice || '0';

            // Skip if either is empty or invalid
            if (!gasUsedStr || !gasPriceStr || gasUsedStr === '0' || gasPriceStr === '0') {
              continue;
            }

            // Use BigInt for precise calculations
            const gasUsed = BigInt(gasUsedStr);
            const gasPrice = BigInt(gasPriceStr);
            const gasCostWei = gasUsed * gasPrice;

            // Convert to ETH (divide by 1e18) using floating point for the final result
            const gasFeeNative = Number(gasCostWei) / this.WEI_TO_ETH;

            totalGasSpentUSD += gasFeeNative * nativeTokenPrice;
          } catch (error) {
            // If BigInt conversion fails, skip this transaction
            console.warn(`   -> Warning: Failed to parse gas values for tx ${tx.hash}`);
            continue;
          }
        }
      } catch (error) {
        console.warn(`   -> Error fetching price for ${monthKey}, skipping gas calculation`);
      }
    }

    const averageGasPerTxUSD = transactionsSent > 0
      ? totalGasSpentUSD / transactionsSent
      : 0;

    // Get first and last transaction timestamps
    let firstTransactionTimestamp = now;
    let lastTransactionTimestamp = 0;
    let accountAgeDays = 0;

    if (filteredTxs.length > 0) {
      const timestamps = filteredTxs.map(tx => parseInt(tx.timeStamp));
      firstTransactionTimestamp = Math.min(...timestamps);
      lastTransactionTimestamp = Math.max(...timestamps);

      // Calculate account age
      accountAgeDays = (lastTransactionTimestamp - firstTransactionTimestamp) / this.SECONDS_PER_DAY;
    }

    // Estimate account age in blocks using chain-specific block time
    const accountAgeBlocks = Math.floor(accountAgeDays * this.SECONDS_PER_DAY / blockTime);

    // Determine activity frequency
    const txPerDay = accountAgeDays > 0 ? totalTransactions / accountAgeDays : 0;
    let activityFrequency: 'very_active' | 'active' | 'moderate' | 'low';

    if (txPerDay > 10) {
      activityFrequency = 'very_active';
    } else if (txPerDay > 3) {
      activityFrequency = 'active';
    } else if (txPerDay > 0.5) {
      activityFrequency = 'moderate';
    } else {
      activityFrequency = 'low';
    }

    return {
      address,
      timeframeStart: timeframeStart || firstTransactionTimestamp,
      timeframeEnd: timeframeEnd || now,
      totalTransactions,
      ethTransactions,
      erc20Transactions,
      transactionsSent,
      transactionsReceived,
      totalGasSpentUSD,
      averageGasPerTxUSD,
      firstTransactionTimestamp,
      lastTransactionTimestamp,
      accountAgeBlocks,
      accountAgeDays: Math.floor(accountAgeDays),
      activityFrequency
    };
  }
}