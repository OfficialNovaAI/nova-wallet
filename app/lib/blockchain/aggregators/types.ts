// src/aggregators/types.ts

/**
 * Summary of token purchases for a specific token
 */
export interface TokenPurchaseSummary {
  tokenSymbol: string;
  tokenAddress: string;
  tokenName?: string;
  totalAmount: number;
  totalSpentUSD: number;
  currentValueUSD: number;
  pnl: number;
  pnlPercentage: number;
  firstPurchaseTimestamp: number;
  lastPurchaseTimestamp: number;
  numPurchases: number;
  averagePriceUSD: number;
  currentPriceUSD: number;
}

/**
 * Summary of token sales for a specific token
 */
export interface TokenSaleSummary {
  tokenSymbol: string;
  tokenAddress: string;
  tokenName?: string;
  totalAmount: number;
  totalReceivedUSD: number;
  numSales: number;
  averagePriceUSD: number;
  firstSaleTimestamp: number;
  lastSaleTimestamp: number;
}

/**
 * Overall activity summary for token trading
 */
export interface TokenActivitySummary {
  totalInvestedUSD: number;
  currentPortfolioValueUSD: number;
  totalPnL: number;
  totalPnLPercentage: number;
  numTokensBought: number;
  numTokensSold: number;
  numUniqueTokens: number;
  mostProfitableToken?: TokenPurchaseSummary;
  biggestLoserToken?: TokenPurchaseSummary;
}

/**
 * Complete token activity analysis
 */
export interface TokenActivityAnalysis {
  address: string;
  timeframeStart: number;
  timeframeEnd: number;
  tokensBought: TokenPurchaseSummary[];
  tokensSold: TokenSaleSummary[];
  summary: TokenActivitySummary;
}

/**
 * Portfolio holding information
 */
export interface PortfolioHolding {
  tokenSymbol: string;
  tokenAddress: string;
  tokenName?: string;
  balance: number;
  currentValueUSD: number;
  averageBuyPriceUSD: number;
  currentPriceUSD: number;
  pnl: number;
  pnlPercentage: number;
  percentOfPortfolio: number;
  totalInvestedUSD: number;
}

/**
 * Complete portfolio analysis
 */
export interface PortfolioAnalysis {
  address: string;
  nativeBalance: number; // ETH balance
  nativeValueUSD: number;
  tokenHoldings: PortfolioHolding[];
  totalPortfolioValueUSD: number;
  totalInvestedUSD: number;
  totalPnL: number;
  totalPnLPercentage: number;
  numTokens: number;
  topHoldingByValue?: PortfolioHolding;
  mostProfitableHolding?: PortfolioHolding;
}

/**
 * Address interaction summary
 */
export interface CounterpartyInteraction {
  address: string;
  label?: string; // e.g., "Binance", "Uniswap Router"
  numTransactions: number;
  totalValueSentUSD: number;
  totalValueReceivedUSD: number;
  firstInteractionTimestamp: number;
  lastInteractionTimestamp: number;
  interactionType: 'mostly_sent' | 'mostly_received' | 'balanced';
}

/**
 * Counterparty analysis
 */
export interface CounterpartyAnalysis {
  address: string;
  timeframeStart: number;
  timeframeEnd: number;
  topCounterparties: CounterpartyInteraction[];
  totalUniqueCounterparties: number;
  knownExchanges: CounterpartyInteraction[];
  knownDeFiProtocols: CounterpartyInteraction[];
  unknownAddresses: CounterpartyInteraction[];
}

/**
 * Large transaction (whale activity)
 */
export interface WhaleTransaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  valueUSD: number;
  valueNative: number; // ETH amount
  tokenSymbol?: string;
  tokenAddress?: string;
  type: 'ETH' | 'ERC20';
  direction: 'sent' | 'received';
  destinationLabel?: string; // "Binance", "Unknown", etc.
}

/**
 * Whale activity analysis
 */
export interface WhaleAnalysis {
  address: string;
  timeframeStart: number;
  timeframeEnd: number;
  whaleTransactions: WhaleTransaction[];
  totalWhaleValueUSD: number;
  largestTransaction: WhaleTransaction;
  numWhaleTransactions: number;
  averageWhaleTransactionUSD: number;
  exchangeFlows: {
    sentToExchanges: number;
    receivedFromExchanges: number;
    netExchangeFlow: number;
  };
}

/**
 * Basic transaction statistics
 */
export interface TransactionStats {
  address: string;
  timeframeStart: number;
  timeframeEnd: number;
  totalTransactions: number;
  ethTransactions: number;
  erc20Transactions: number;
  transactionsSent: number;
  transactionsReceived: number;
  totalGasSpentUSD: number;
  averageGasPerTxUSD: number;
  firstTransactionTimestamp: number;
  lastTransactionTimestamp: number;
  accountAgeBlocks: number;
  accountAgeDays: number;
  activityFrequency: 'very_active' | 'active' | 'moderate' | 'low';
}