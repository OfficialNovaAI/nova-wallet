// src/clients/base.ts

/**
 * Time range for filtering transactions
 */
export interface TimeRange {
  start: number; // Unix timestamp
  end: number;   // Unix timestamp
}

/**
 * Options for fetching transactions
 */
export interface FetchOptions {
  timeframe?: TimeRange;
  startBlock?: number;
  endBlock?: number;
  maxTransactions?: number;
}

/**
 * Raw transaction data from blockchain explorers
 */
export interface Transaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress?: string;
  gasUsed: string;
  gasPrice: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  txType: 'ETH' | 'ERC20';
}

/**
 * Token metadata information
 */
export interface TokenInfo {
  symbol: string;
  decimals: number;
  name?: string;
  address: string;
}

/**
 * Price information for a token
 */
export interface TokenPrice {
  priceUSD: number;
  priceNative: number; // Price in chain's native token (e.g., ETH)
  timestamp: number;
}

/**
 * Abstract blockchain client interface
 * All chain-specific implementations must follow this
 */
export interface BlockchainClient {
  /** Chain identifier */
  readonly chainName: string;
  
  /** Native token symbol (ETH, LISK, MNT, etc.) */
  readonly nativeToken: string;
  
  /** Base API URL */
  readonly apiUrl: string;
  
  /** Average block time in seconds for this chain (default: 12) */
  readonly blockTimeSeconds?: number;
  
  /**
   * Fetch all transactions for an address (native + token transfers)
   * @param address - The wallet address to query
   * @param options - Optional filtering parameters
   * @returns Array of transactions
   */
  getTransactions(address: string, options?: FetchOptions): Promise<Transaction[]>;
  
  /**
   * Get token metadata (symbol, decimals, name)
   * @param tokenAddress - The token contract address
   * @returns Token information
   */
  getTokenMetadata(tokenAddress: string): Promise<TokenInfo>;
  
  /**
   * Get historical price for a token at a specific timestamp
   * @param tokenAddress - The token contract address
   * @param timestamp - Unix timestamp
   * @returns Price in USD and native token
   */
  getHistoricalPrice(tokenAddress: string, timestamp: number): Promise<TokenPrice>;
  
  /**
   * Get native token (e.g., ETH) to USD ratio at a specific timestamp
   * @param timestamp - Unix timestamp
   * @returns Native token price in USD
   */
  getNativeTokenPrice(timestamp: number): Promise<number>;
  
  /**
   * Optional: Get NFT transfers (if chain supports it)
   * To be implemented in Phase 2
   */
  getNFTTransfers?(address: string, options?: FetchOptions): Promise<any[]>;
  
  /**
   * Optional: Decode DEX trades (if chain supports it)
   * To be implemented in Phase 3
   */
  getDexTrades?(address: string, options?: FetchOptions): Promise<any[]>;
}

/**
 * Error types for better error handling
 */
export class BlockchainClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly chain: string
  ) {
    super(message);
    this.name = 'BlockchainClientError';
  }
}

export class APIRateLimitError extends BlockchainClientError {
  constructor(chain: string, retryAfter?: number) {
    super(
      `API rate limit exceeded for ${chain}${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT',
      chain
    );
  }
}

export class InvalidAddressError extends BlockchainClientError {
  constructor(chain: string, address: string) {
    super(
      `Invalid address format for ${chain}: ${address}`,
      'INVALID_ADDRESS',
      chain
    );
  }
}

export class APIError extends BlockchainClientError {
  constructor(chain: string, message: string, public statusCode?: number) {
    super(message, 'API_ERROR', chain);
  }
}