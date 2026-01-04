// src/clients/mantle.ts

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
 * Configuration for Mantle client
 */
interface MantleClientConfig {
  moralisApiKey?: string; // Optional
  cryptocompareApiKey: string;
  maxTransactionsPerAddress?: number;
  blockscoutMaxRecords?: number;
}

/**
 * Full Mantle blockchain client implementation
 * Uses Blockscout API (Etherscan-compatible but with page-based pagination)
 */
export class MantleClient implements BlockchainClient {
  readonly chainName = 'Mantle';
  readonly nativeToken = 'MNT';
  readonly apiUrl = 'https://explorer.mantle.xyz/api';
  readonly blockTimeSeconds = 2; // Mantle has 2-second blocks
  
  private readonly moralisMetadataUrl = 'https://deep-index.moralis.io/api/v2.2/erc20/metadata';
  private readonly moralisPriceUrl = 'https://deep-index.moralis.io/api/v2.2/erc20';
  private readonly cryptocompareUrl = 'https://min-api.cryptocompare.com/data/pricehistorical';
  private readonly defillamaUrl = 'https://coins.llama.fi/prices/historical';
  
  private readonly config: MantleClientConfig & { 
    maxTransactionsPerAddress: number;
    blockscoutMaxRecords: number;
    cryptocompareApiKey: string;
  };
  private readonly WEI_TO_MNT = 1_000_000_000_000_000_000;
  
  // Known Mantle tokens
  private readonly KNOWN_TOKENS: Map<string, TokenInfo> = new Map([
    ['0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9', { symbol: 'USDC', decimals: 6, address: '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9' }],
    ['0x201eba5cc46d216ce6dc03f6a759e8e766e956ae', { symbol: 'USDT', decimals: 6, address: '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae' }],
    ['0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111', { symbol: 'WETH', decimals: 18, address: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111' }],
  ]);
  
  constructor(config: MantleClientConfig) {
    this.config = {
      ...config,
      maxTransactionsPerAddress: config.maxTransactionsPerAddress ?? 50000,
      blockscoutMaxRecords: config.blockscoutMaxRecords ?? 10000
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
   * Get all transactions for an address (native + ERC-20)
   * Uses page-based pagination (Blockscout doesn't support block ranges)
   */
  async getTransactions(address: string, options?: FetchOptions): Promise<Transaction[]> {
    this.validateAddress(address);
    const lowerAddress = address.toLowerCase();
    
    console.log(`Fetching ${this.nativeToken} transactions for ${lowerAddress}...`);
    console.log(`⚠️  Note: Mantle uses page-based pagination (block ranges not supported)`);
    
    const nativeTxs = await this.fetchAllPages('txlist', lowerAddress, options);
    console.log(`Found ${nativeTxs.length} ${this.nativeToken} transactions.`);
    
    console.log(`Fetching ERC-20 transactions for ${lowerAddress}...`);
    const erc20Txs = await this.fetchAllPages('tokentx', lowerAddress, options);
    console.log(`Found ${erc20Txs.length} ERC-20 transactions.`);
    
    // Merge transactions (same logic as Ethereum)
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
        // Aggregators check for tx.txType === 'ETH' to identify native transactions
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
   * NOTE: Blockscout ignores startblock/endblock - only page/offset work
   */
  private async fetchAllPages(
    action: 'txlist' | 'tokentx',
    address: string,
    options?: FetchOptions
  ): Promise<Transaction[]> {
    const allResults: Transaction[] = [];
    let page = 1;
    
    while (true) {
      console.log(`   Fetching ${action} page ${page}...`);
      
      const pageResults = await this.fetchPage(action, address, page);
      
      if (pageResults.length === 0) {
        break;
      }
      
      const pageLen = pageResults.length;
      allResults.push(...pageResults);
      
      // Stop if we hit the max or got less than max records (last page)
      if (
        allResults.length >= this.config.maxTransactionsPerAddress ||
        pageLen < this.config.blockscoutMaxRecords
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
    page: number
  ): Promise<Transaction[]> {
    // Blockscout API is Etherscan-compatible but doesn't need API key
    const url = `${this.apiUrl}?module=account&action=${action}&address=${address}&page=${page}&offset=${this.config.blockscoutMaxRecords}&sort=asc`;
    
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
   * Uses Moralis with chain=mantle parameter
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
    if (this.config.moralisApiKey) {
      console.log(`   -> Discovering token info for ${lowerAddress} on ${this.chainName}...`);
      
      try {
        const url = `${this.moralisMetadataUrl}?chain=mantle&addresses=${lowerAddress}`;
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
    
    // WETH on Mantle
    if (tokenSymbol === 'WETH') {
      // WETH price = ETH price (not MNT price)
      const ethUSD = await this.getETHPrice(timestamp);
      return {
        priceUSD: ethUSD,
        priceNative: ethUSD / await this.getNativeTokenPrice(timestamp),
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
      const mntUSD = await this.getNativeTokenPrice(timestamp);
      const stablecoinMNT = mntUSD > 0 ? 1.0 / mntUSD : 0;
      
      const price: TokenPrice = {
        priceUSD: 1.0,
        priceNative: stablecoinMNT,
        timestamp
      };
      
      priceCache.set(cacheKey, price, CACHE_TTL.PRICE_MONTHLY);
      return price;
    }
    
    // Fetch from APIs with multi-layer fallback
    console.log(`   -> API FETCH: Price for ${tokenSymbol} (${tokenAddress}) on ${this.chainName}`);
    const priceMNT = await this.fetchTokenPriceFromAPIs(tokenSymbol, tokenAddress, timestamp);
    
    if (priceMNT > 0) {
      const mntUSD = await this.getNativeTokenPrice(timestamp);
      const priceUSD = priceMNT * mntUSD;
      
      const price: TokenPrice = {
        priceUSD,
        priceNative: priceMNT,
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
   * Get MNT/USD price at a specific timestamp
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
    
    // Try CryptoCompare first
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
    
    // Try DeFiLlama as fallback for current price
    try {
      const llamaUrl = `https://coins.llama.fi/prices/current/coingecko:mantle`;
      const response = await httpClient.get<any>(llamaUrl);
      const price = response?.coins?.['coingecko:mantle']?.price || 0;
      
      if (price > 0) {
        console.log(`   -> ✅ Got ${this.nativeToken}/USD from DeFiLlama: ${price.toFixed(4)}`);
        priceCache.set(monthlyKey, price, CACHE_TTL.PRICE_MONTHLY);
        return price;
      }
    } catch (error) {
      console.warn(`   -> DeFiLlama also failed: ${error instanceof Error ? error.message : error}`);
    }
    
    // Use hardcoded fallback based on rough current price
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let fallback = 0.98; // Current MNT price (from Mantlescan)
    
    // Adjust for historical data if needed
    if (year === 2023) fallback = 0.50;
    else if (year === 2024 && month <= 6) fallback = 0.70;
    else if (year === 2024 && month > 6) fallback = 0.85;
    
    console.warn(`   -> Warning: Using fallback ${this.nativeToken}/USD price: ${fallback}`);
    priceCache.set(monthlyKey, fallback, CACHE_TTL.PRICE_MONTHLY);
    return fallback;
  }
  
  /**
   * Get ETH/USD price (for WETH)
   */
  private async getETHPrice(timestamp: number): Promise<number> {
    const date = new Date(timestamp * 1000);
    const monthlyKey = `ETH_USD_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    
    const cached = priceCache.get<number>(monthlyKey);
    if (cached) {
      return cached;
    }
    
    const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthlyTs = Math.floor(monthlyDate.getTime() / 1000);
    
    try {
      const url = `${this.cryptocompareUrl}?fsym=ETH&tsyms=USD&ts=${monthlyTs}&api_key=${this.config.cryptocompareApiKey}`;
      const response = await httpClient.get<CryptoCompareResponse>(url);
      
      const price = response?.ETH?.USD || 0;
      
      if (price > 0) {
        priceCache.set(monthlyKey, price, CACHE_TTL.PRICE_MONTHLY);
        return price;
      }
    } catch (error) {
      // Fallback
    }
    
    return 2000; // Rough ETH price fallback
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
    const llamaAddress = `mantle:${tokenAddress}`;
    const url = `${this.defillamaUrl}/${timestamp}/${llamaAddress}`;
    
    try {
      const response = await httpClient.get<DefiLlamaResponse>(url);
      
      const coinData = response?.coins?.[llamaAddress];
      if (coinData?.price) {
        const tokenUSD = coinData.price;
        const mntUSD = await this.getNativeTokenPrice(timestamp);
        
        if (mntUSD > 0) {
          return tokenUSD / mntUSD; // Convert USD to MNT
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
    const url = `${this.moralisPriceUrl}/${tokenAddress}/price?chain=mantle&to_date=${toDate}`;
    
    try {
      const response = await httpClient.get<MoralisPrice>(url, {
        headers: {
          'accept': 'application/json',
          'X-API-Key': this.config.moralisApiKey
        }
      });
      
      if (response?.usdPrice) {
        const tokenUSD = response.usdPrice;
        const mntUSD = await this.getNativeTokenPrice(timestamp);
        
        if (mntUSD > 0) {
          return tokenUSD / mntUSD; // Convert USD to MNT
        }
      }
    } catch (error) {
      // Expected to fail for many tokens
    }
    
    return 0;
  }
}