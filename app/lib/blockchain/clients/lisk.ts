// src/clients/lisk.ts

import {
  BlockchainClient,
  Transaction,
  TokenInfo,
  TokenPrice,
  FetchOptions,
  APIError,
  InvalidAddressError
} from './base';
import { httpClient } from '@/lib/blockchain/utils/http';
import { tokenInfoCache, priceCache, CACHE_TTL } from '@/lib/blockchain/utils/cache';

/**
 * Blockscout API response format (Etherscan-compatible)
 */
interface BlockscoutResponse<T> {
  status: string;
  message: string;
  result: T;
}

/**
 * Moralis token metadata response
 */
interface MoralisTokenMetadata {
  symbol: string;
  decimals: string;
  name?: string;
}

/**
 * CryptoCompare price response
 */
interface CryptoCompareResponse {
  [symbol: string]: {
    [currency: string]: number;
  };
}

/**
 * DeFiLlama price response
 */
interface DefiLlamaResponse {
  coins: {
    [key: string]: {
      price: number;
      symbol?: string;
      timestamp?: number;
    };
  };
}

/**
 * Moralis price response
 */
interface MoralisPrice {
  usdPrice: number;
  nativePrice?: {
    value: string;
    decimals: number;
  };
}

/**
 * Configuration for Lisk client
 */
interface LiskClientConfig {
  moralisApiKey?: string; // Optional
  cryptocompareApiKey: string;
  maxTransactionsPerAddress?: number;
  blockscoutMaxRecords?: number;
}

/**
 * Full Lisk L2 blockchain client implementation
 * Uses Blockscout API (Etherscan-compatible but with page-based pagination)
 * 
 * Network Info:
 * - Native Token: ETH (because it's an Ethereum L2)
 * - Block Time: 2 seconds
 * - Chain ID: 1135
 * - Explorer: https://blockscout.lisk.com
 */
export class LiskClient implements BlockchainClient {
  readonly chainName = 'Lisk';
  readonly nativeToken = 'ETH'; // Lisk L2 uses ETH as native token
  readonly apiUrl = 'https://blockscout.lisk.com/api';
  readonly blockTimeSeconds = 2; // Lisk L2 has 2-second blocks

  private readonly moralisMetadataUrl = 'https://deep-index.moralis.io/api/v2.2/erc20/metadata';
  private readonly moralisPriceUrl = 'https://deep-index.moralis.io/api/v2.2/erc20';
  private readonly cryptocompareUrl = 'https://min-api.cryptocompare.com/data/pricehistorical';
  private readonly defillamaUrl = 'https://coins.llama.fi/prices/historical';

  private readonly config: LiskClientConfig & {
    maxTransactionsPerAddress: number;
    cryptocompareApiKey: string;
  };

  // Known Lisk L2 tokens
  private readonly KNOWN_TOKENS: Map<string, TokenInfo> = new Map([
    ['0x05d032ac25d322df992303dca074ee7392c117b9', { symbol: 'USDT', decimals: 6, address: '0x05d032ac25d322df992303dca074ee7392c117b9' }],
    ['0xac485391eb2d7d88253a7f1ef18c37f4242d1a24', { symbol: 'LSK', decimals: 18, address: '0xac485391eb2d7d88253a7f1ef18c37f4242d1a24' }],
  ]);

  constructor(config: LiskClientConfig) {
    this.config = {
      ...config,
      maxTransactionsPerAddress: config.maxTransactionsPerAddress ?? 50000
    };
  }

  /**
   * Validate Ethereum-compatible address format
   */
  private validateAddress(address: string): void {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new InvalidAddressError(this.chainName, address);
    }
  }

  /**
   * Get all transactions for an address (native ETH + ERC-20)
   * Uses page-based pagination (Blockscout doesn't support block ranges)
   */
  async getTransactions(address: string, options?: FetchOptions): Promise<Transaction[]> {
    this.validateAddress(address);
    const lowerAddress = address.toLowerCase();

    console.log(`Fetching ${this.nativeToken} transactions for ${lowerAddress}...`);
    console.log(`⚠️  Note: Lisk uses page-based pagination (block ranges not supported)`);

    const nativeTxs = await this.fetchAllPages('txlist', lowerAddress, options);
    console.log(`Found ${nativeTxs.length} ${this.nativeToken} transactions.`);

    console.log(`Fetching ERC-20 transactions for ${lowerAddress}...`);
    const erc20Txs = await this.fetchAllPages('tokentx', lowerAddress, options);
    console.log(`Found ${erc20Txs.length} ERC-20 transactions.`);

    // Merge transactions (same logic as Ethereum/Mantle)
    const nativeTxMap = new Map<string, Transaction>();
    for (const tx of nativeTxs) {
      nativeTxMap.set(tx.hash, tx);
    }

    const allTxs: Transaction[] = [];
    const erc20ParentHashes = new Set<string>();

    // Process ERC-20 transactions
    for (const tx of erc20Txs) {
      tx.txType = 'ERC20';
      erc20ParentHashes.add(tx.hash);

      // Merge gas data from parent transaction
      const parentTx = nativeTxMap.get(tx.hash);
      if (parentTx) {
        tx.gasUsed = parentTx.gasUsed;
        tx.gasPrice = parentTx.gasPrice;
      }

      allTxs.push(tx);
    }

    // Add native transactions that aren't parent transactions
    for (const tx of nativeTxs) {
      if (!erc20ParentHashes.has(tx.hash)) {
        // Keep 'ETH' for backward compatibility with aggregators
        tx.txType = 'ETH';
        allTxs.push(tx);
      }
    }

    // Sort by timestamp
    allTxs.sort((a, b) => {
      const timeA = parseInt(a.timeStamp) || 0;
      const timeB = parseInt(b.timeStamp) || 0;
      return timeA - timeB;
    });

    // Apply transaction limit
    if (allTxs.length > this.config.maxTransactionsPerAddress) {
      console.warn(
        `⚠️ Limiting to ${this.config.maxTransactionsPerAddress} transactions (found ${allTxs.length}).`
      );
      return allTxs.slice(0, this.config.maxTransactionsPerAddress);
    }

    return allTxs;
  }

  /**
   * Fetch all pages from Blockscout API with page-based pagination
   * NOTE: Blockscout has a hard limit: page × offset ≤ 10,000
   * So we use offset=1000 to allow up to 10 pages (10,000 records max)
   */
  private async fetchAllPages(
    action: 'txlist' | 'tokentx',
    address: string,
    options?: FetchOptions
  ): Promise<Transaction[]> {
    const allResults: Transaction[] = [];
    let page = 1;
    const SAFE_OFFSET = 1000; // Use 1000 per page to stay under 10k limit

    while (true) {
      // Check if next page would exceed Blockscout's limit (page × offset ≤ 10,000)
      if (page * SAFE_OFFSET > 10000) {
        console.warn(`   -> ⚠️  Reached Blockscout API limit (10,000 records max)`);
        break;
      }

      console.log(`   Fetching ${action} page ${page}...`);

      const pageResults = await this.fetchPage(action, address, page, SAFE_OFFSET);

      if (pageResults.length === 0) {
        break;
      }

      const pageLen = pageResults.length;
      allResults.push(...pageResults);

      // Stop if we hit the max or got less than requested (last page)
      if (
        allResults.length >= this.config.maxTransactionsPerAddress ||
        pageLen < SAFE_OFFSET
      ) {
        break;
      }

      page++;
    }

    // Apply timeframe filtering AFTER fetching (Blockscout limitation)
    if (options?.timeframe) {
      console.log(`   -> Filtering by timeframe: ${options.timeframe.start} to ${options.timeframe.end}`);
      return allResults.filter(tx => {
        const timestamp = parseInt(tx.timeStamp) || 0;
        return timestamp >= options.timeframe!.start && timestamp <= options.timeframe!.end;
      });
    }

    return allResults;
  }

  /**
   * Fetch a single page from Blockscout API
   */
  private async fetchPage(
    action: 'txlist' | 'tokentx',
    address: string,
    page: number,
    offset: number = 1000
  ): Promise<Transaction[]> {
    // Blockscout API is Etherscan-compatible but doesn't need API key
    const url = `${this.apiUrl}?module=account&action=${action}&address=${address}&page=${page}&offset=${offset}&sort=asc`;

    try {
      const response = await httpClient.get<BlockscoutResponse<Transaction[]>>(url);

      if (response.status === '1') {
        return response.result || [];
      } else if (
        response.message.includes('No transactions found') ||
        response.message.includes('No token transfers found')
      ) {
        // This is normal - just means no transactions of this type
        return [];
      } else {
        throw new APIError(
          this.chainName,
          `Blockscout API error: ${response.message}`
        );
      }
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(
        this.chainName,
        error instanceof Error ? error.message : 'Unknown error fetching transactions'
      );
    }
  }

  /**
   * Get token metadata (symbol, decimals)
   * Uses Moralis with chain=lisk parameter (if Moralis supports it)
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenInfo> {
    const lowerAddress = tokenAddress.toLowerCase();

    // Check cache first
    const cached = tokenInfoCache.get<TokenInfo>(`token_info_${this.chainName}_${lowerAddress}`);
    if (cached) {
      return cached;
    }

    // Check known tokens
    const known = this.KNOWN_TOKENS.get(lowerAddress);
    if (known) {
      tokenInfoCache.set(`token_info_${this.chainName}_${lowerAddress}`, known, CACHE_TTL.TOKEN_INFO);
      return known;
    }

    // Fetch from Moralis (if API key provided)
    // Note: Moralis may not support Lisk L2 yet, so this might fail
    if (this.config.moralisApiKey) {
      console.log(`   -> Discovering token info for ${lowerAddress} on ${this.chainName}...`);

      try {
        // Try with chain=lisk first
        const url = `${this.moralisMetadataUrl}?chain=lisk&addresses=${lowerAddress}`;
        const response = await httpClient.get<MoralisTokenMetadata[]>(url, {
          headers: {
            'accept': 'application/json',
            'X-API-Key': this.config.moralisApiKey
          }
        });

        if (response && response.length > 0) {
          const metadata = response[0];
          const decimals = parseInt(metadata.decimals) || 18;
          const symbol = metadata.symbol.toUpperCase();

          console.log(`   -> ✅ Discovered Symbol: ${symbol}, Decimals: ${decimals}`);

          const tokenInfo: TokenInfo = {
            symbol,
            decimals,
            name: metadata.name,
            address: lowerAddress
          };

          tokenInfoCache.set(`token_info_${this.chainName}_${lowerAddress}`, tokenInfo, CACHE_TTL.TOKEN_INFO);
          return tokenInfo;
        }
      } catch (error) {
        console.warn(`   -> ⚠️  Moralis metadata failed (using fallback): ${error instanceof Error ? error.message : error}`);
      }
    }

    // Fallback to unknown token
    const fallback: TokenInfo = {
      symbol: 'UNKNOWN',
      decimals: 18,
      address: lowerAddress
    };

    tokenInfoCache.set(`token_info_${this.chainName}_${lowerAddress}`, fallback, CACHE_TTL.TOKEN_INFO);
    return fallback;
  }

  /**
   * Get historical price for a token at a specific timestamp
   */
  async getHistoricalPrice(tokenAddress: string, timestamp: number): Promise<TokenPrice> {
    const tokenInfo = await this.getTokenMetadata(tokenAddress);
    const tokenSymbol = tokenInfo.symbol;

    // LSK token on Lisk L2
    if (tokenSymbol === 'LSK') {
      const lskUSD = await this.getLSKPrice(timestamp);
      const ethUSD = await this.getNativeTokenPrice(timestamp);
      return {
        priceUSD: lskUSD,
        priceNative: ethUSD > 0 ? lskUSD / ethUSD : 0,
        timestamp
      };
    }

    // Create monthly cache key
    const date = new Date(timestamp * 1000);
    const monthlyKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const cacheKey = `${this.chainName}_${tokenSymbol}_${monthlyKey}_${tokenAddress}`;

    // Check cache
    const cached = priceCache.get<TokenPrice>(cacheKey);
    if (cached) {
      return cached;
    }

    // Stablecoins
    if (['USDT', 'USDC', 'DAI'].includes(tokenSymbol)) {
      const ethUSD = await this.getNativeTokenPrice(timestamp);
      const stablecoinETH = ethUSD > 0 ? 1.0 / ethUSD : 0;

      const price: TokenPrice = {
        priceUSD: 1.0,
        priceNative: stablecoinETH,
        timestamp
      };

      priceCache.set(cacheKey, price, CACHE_TTL.PRICE_MONTHLY);
      return price;
    }

    // Fetch from APIs with multi-layer fallback
    console.log(`   -> API FETCH: Price for ${tokenSymbol} (${tokenAddress}) on ${this.chainName}`);
    const priceETH = await this.fetchTokenPriceFromAPIs(tokenSymbol, tokenAddress, timestamp);

    if (priceETH > 0) {
      const ethUSD = await this.getNativeTokenPrice(timestamp);
      const priceUSD = priceETH * ethUSD;

      const price: TokenPrice = {
        priceUSD,
        priceNative: priceETH,
        timestamp
      };

      priceCache.set(cacheKey, price, CACHE_TTL.PRICE_MONTHLY);
      return price;
    }

    // No price found
    return {
      priceUSD: 0,
      priceNative: 0,
      timestamp
    };
  }

  /**
   * Get ETH/USD price at a specific timestamp (Lisk L2 uses ETH as native token)
   */
  async getNativeTokenPrice(timestamp: number): Promise<number> {
    const date = new Date(timestamp * 1000);
    const monthlyKey = `${this.nativeToken}_USD_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

    // Check cache
    const cached = priceCache.get<number>(monthlyKey);
    if (cached) {
      return cached;
    }

    console.log(`-> Fetching ${this.nativeToken}/USD price for ${monthlyKey} from API...`);

    // Get first day of month timestamp
    const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthlyTs = Math.floor(monthlyDate.getTime() / 1000);

    // Try CryptoCompare
    try {
      const url = `${this.cryptocompareUrl}?fsym=${this.nativeToken}&tsyms=USD&ts=${monthlyTs}&api_key=${this.config.cryptocompareApiKey}`;
      const response = await httpClient.get<CryptoCompareResponse>(url);

      const price = response?.[this.nativeToken]?.USD || 0;

      if (price > 0) {
        console.log(`   -> ✅ Got ${this.nativeToken}/USD price: ${price.toFixed(4)}`);
        priceCache.set(monthlyKey, price, CACHE_TTL.PRICE_MONTHLY);
        return price;
      }
    } catch (error) {
      console.warn(`   -> CryptoCompare failed for ${this.nativeToken}: ${error instanceof Error ? error.message : error}`);
    }

    // Fallback to rough ETH price
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let fallback = 2000; // Current rough ETH price

    if (year === 2023) fallback = 1800;
    else if (year === 2024 && month <= 6) fallback = 2200;
    else if (year === 2024 && month > 6) fallback = 2500;

    console.warn(`   -> Warning: Using fallback ${this.nativeToken}/USD price: ${fallback}`);
    priceCache.set(monthlyKey, fallback, CACHE_TTL.PRICE_MONTHLY);
    return fallback;
  }

  /**
   * Get LSK token price (native Lisk token, now ERC-20 on Lisk L2)
   */
  private async getLSKPrice(timestamp: number): Promise<number> {
    const date = new Date(timestamp * 1000);
    const monthlyKey = `LSK_USD_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

    const cached = priceCache.get<number>(monthlyKey);
    if (cached) {
      return cached;
    }

    const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthlyTs = Math.floor(monthlyDate.getTime() / 1000);

    try {
      const url = `${this.cryptocompareUrl}?fsym=LSK&tsyms=USD&ts=${monthlyTs}&api_key=${this.config.cryptocompareApiKey}`;
      const response = await httpClient.get<CryptoCompareResponse>(url);

      const price = response?.LSK?.USD || 0;

      if (price > 0) {
        priceCache.set(monthlyKey, price, CACHE_TTL.PRICE_MONTHLY);
        return price;
      }
    } catch (error) {
      // Fallback
    }

    // Rough LSK price fallback
    const fallback = 1.0;
    priceCache.set(monthlyKey, fallback, CACHE_TTL.PRICE_MONTHLY);
    return fallback;
  }

  /**
   * Fetch token price from multiple APIs with fallback
   */
  private async fetchTokenPriceFromAPIs(
    tokenSymbol: string,
    tokenAddress: string,
    timestamp: number
  ): Promise<number> {
    // Layer 1: CryptoCompare (if symbol is known)
    if (tokenSymbol !== 'UNKNOWN') {
      console.log('      -> [Layer 1] Trying CryptoCompare...');

      const date = new Date(timestamp * 1000);
      const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthlyTs = Math.floor(monthlyDate.getTime() / 1000);

      try {
        const url = `${this.cryptocompareUrl}?fsym=${tokenSymbol}&tsyms=${this.nativeToken}&ts=${monthlyTs}&api_key=${this.config.cryptocompareApiKey}`;
        const response = await httpClient.get<CryptoCompareResponse>(url);

        const price = response?.[tokenSymbol]?.[this.nativeToken] || 0;
        if (price > 0) {
          console.log(`      -> ✅ CryptoCompare SUCCESS: ${price} ${this.nativeToken}`);
          return price;
        }
      } catch (error) {
        console.warn(`      -> CryptoCompare failed: ${error}`);
      }
    }

    // Layer 2: DeFiLlama
    console.log('      -> [Layer 2] Trying DeFiLlama...');
    try {
      const price = await this.fetchFromDeFiLlama(tokenAddress, timestamp);
      if (price > 0) {
        console.log(`      -> ✅ DeFiLlama SUCCESS: ${price} ${this.nativeToken}`);
        return price;
      }
    } catch (error) {
      console.warn(`      -> DeFiLlama failed: ${error}`);
    }

    // Layer 3: Moralis
    if (this.config.moralisApiKey) {
      console.log('      -> [Layer 3] Trying Moralis...');
      try {
        const price = await this.fetchFromMoralis(tokenAddress, timestamp);
        if (price > 0) {
          console.log(`      -> ✅ Moralis PRICE SUCCESS: ${price} ${this.nativeToken}`);
          return price;
        }
      } catch (error) {
        console.warn(`      -> Moralis failed: ${error}`);
      }
    }

    console.log(`      -> ❌ ALL APIs FAILED for ${tokenSymbol}. Ignoring value.`);
    return 0;
  }

  /**
   * Fetch price from DeFiLlama
   */
  private async fetchFromDeFiLlama(tokenAddress: string, timestamp: number): Promise<number> {
    const llamaAddress = `lisk:${tokenAddress}`;
    const url = `${this.defillamaUrl}/${timestamp}/${llamaAddress}`;

    try {
      const response = await httpClient.get<DefiLlamaResponse>(url);

      const coinData = response?.coins?.[llamaAddress];
      if (coinData?.price) {
        const tokenUSD = coinData.price;
        const ethUSD = await this.getNativeTokenPrice(timestamp);

        if (ethUSD > 0) {
          return tokenUSD / ethUSD; // Convert USD to ETH
        }
      }
    } catch (error) {
      // Expected to fail for many tokens
    }

    return 0;
  }

  /**
   * Fetch price from Moralis
   */
  private async fetchFromMoralis(tokenAddress: string, timestamp: number): Promise<number> {
    if (!this.config.moralisApiKey) return 0;

    const date = new Date(timestamp * 1000);
    const toDate = date.toISOString();
    const url = `${this.moralisPriceUrl}/${tokenAddress}/price?chain=lisk&to_date=${toDate}`;

    try {
      const response = await httpClient.get<MoralisPrice>(url, {
        headers: {
          'accept': 'application/json',
          'X-API-Key': this.config.moralisApiKey
        }
      });

      if (response?.usdPrice) {
        const tokenUSD = response.usdPrice;
        const ethUSD = await this.getNativeTokenPrice(timestamp);

        if (ethUSD > 0) {
          return tokenUSD / ethUSD; // Convert USD to ETH
        }
      }
    } catch (error) {
      // Expected to fail for many tokens
    }

    return 0;
  }
}