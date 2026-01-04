// src/clients/ethereum.ts - OPTIMIZED VERSION

import {
    BlockchainClient,
    Transaction,
    TokenInfo,
    TokenPrice,
    FetchOptions,
    APIError,
    InvalidAddressError
} from '@/lib/blockchain/clients/base';
import { httpClient } from '@/lib/blockchain/utils/http';
import { tokenInfoCache, priceCache, failedTokenCache, CACHE_TTL } from '@/lib/blockchain/utils/cache';

interface EtherscanResponse<T> {
    status: string;
    message: string;
    result: T;
}

interface MoralisTokenMetadata {
    symbol: string;
    decimals: string;
    name?: string;
}

interface CryptoCompareResponse {
    [symbol: string]: {
        [currency: string]: number;
    };
}

interface DefiLlamaResponse {
    coins: {
        [key: string]: {
            price: number;
            symbol?: string;
            timestamp?: number;
        };
    };
}

interface MoralisPrice {
    usdPrice: number;
    nativePrice?: {
        value: string;
        decimals: number;
    };
}

interface EthereumClientConfig {
    etherscanApiKey: string;
    moralisApiKey?: string;
    cryptocompareApiKey: string;
    maxTransactionsPerAddress?: number;
    etherscanMaxRecords?: number;
}

export class EthereumClient implements BlockchainClient {
    readonly chainName = 'Ethereum';
    readonly nativeToken = 'ETH';
    readonly apiUrl = 'https://api.etherscan.io/v2/api';
    readonly blockTimeSeconds = 12; // Ethereum has 12-second block time

    private readonly moralisMetadataUrl = 'https://deep-index.moralis.io/api/v2.2/erc20/metadata';
    private readonly moralisPriceUrl = 'https://deep-index.moralis.io/api/v2.2/erc20';
    private readonly cryptocompareUrl = 'https://min-api.cryptocompare.com/data/pricehistorical';
    private readonly defillamaUrl = 'https://coins.llama.fi/prices/historical';

    private readonly config: EthereumClientConfig & {
        maxTransactionsPerAddress: number;
        etherscanMaxRecords: number;
    };

    private readonly WEI_TO_ETH = 1_000_000_000_000_000_000;

    private readonly KNOWN_TOKENS: Map<string, TokenInfo> = new Map([
        ['0xdac17f958d2ee523a2206206994597c13d831ec7', { symbol: 'USDT', decimals: 6, address: '0xdac17f958d2ee523a2206206994597c13d831ec7' }],
        ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', { symbol: 'USDC', decimals: 6, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }],
        ['0x6b175474e89094c44da98b954eedeac495271d0f', { symbol: 'DAI', decimals: 18, address: '0x6b175474e89094c44da98b954eedeac495271d0f' }],
        ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', { symbol: 'WETH', decimals: 18, address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' }],
        ['0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', { symbol: 'WBTC', decimals: 8, address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' }],
    ]);

    constructor(config: EthereumClientConfig) {
        this.config = {
            ...config,
            maxTransactionsPerAddress: config.maxTransactionsPerAddress ?? 50000,
            etherscanMaxRecords: config.etherscanMaxRecords ?? 10000
        };
    }

    private validateAddress(address: string): void {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            throw new InvalidAddressError(this.chainName, address);
        }
    }

    async getTransactions(address: string, options?: FetchOptions): Promise<Transaction[]> {
        this.validateAddress(address);
        const lowerAddress = address.toLowerCase();

        console.log(`Fetching ETH transactions for ${lowerAddress}...`);
        console.log(`⚠️  Note: Large addresses may take several minutes to process`);

        const ethTxs = await this.fetchAllPages('txlist', lowerAddress, options);
        console.log(`Found ${ethTxs.length} ETH transactions.`);

        console.log(`Fetching ERC-20 transactions for ${lowerAddress}...`);
        const erc20Txs = await this.fetchAllPages('tokentx', lowerAddress, options);
        console.log(`Found ${erc20Txs.length} ERC-20 transactions.`);

        const ethTxMap = new Map<string, Transaction>();
        for (const tx of ethTxs) {
            ethTxMap.set(tx.hash, tx);
        }

        const allTxs: Transaction[] = [];
        const erc20ParentHashes = new Set<string>();

        for (const tx of erc20Txs) {
            tx.txType = 'ERC20';
            erc20ParentHashes.add(tx.hash);

            const parentTx = ethTxMap.get(tx.hash);
            if (parentTx) {
                tx.gasUsed = parentTx.gasUsed;
                tx.gasPrice = parentTx.gasPrice;
            }

            allTxs.push(tx);
        }

        for (const tx of ethTxs) {
            if (!erc20ParentHashes.has(tx.hash)) {
                tx.txType = 'ETH';
                allTxs.push(tx);
            }
        }

        allTxs.sort((a, b) => {
            const timeA = parseInt(a.timeStamp) || 0;
            const timeB = parseInt(b.timeStamp) || 0;
            return timeA - timeB;
        });

        if (allTxs.length > this.config.maxTransactionsPerAddress) {
            console.warn(
                `⚠️ Limiting to ${this.config.maxTransactionsPerAddress} transactions (found ${allTxs.length}).`
            );
            return allTxs.slice(0, this.config.maxTransactionsPerAddress);
        }

        return allTxs;
    }

    private async getCurrentBlockNumber(): Promise<number> {
        try {
            const url = `${this.apiUrl}?chainid=1&module=proxy&action=eth_blockNumber&apikey=${this.config.etherscanApiKey}`;
            const response = await httpClient.get<EtherscanResponse<string>>(url);

            // For /v2/api endpoint, response.result might be directly available
            if (response.result) {
                const blockNum = parseInt(response.result, 16);

                // Sanity check
                if (blockNum > 15000000 && blockNum < 30000000) {
                    console.log(`   -> ✅ Current block from API: ${blockNum}`);
                    return blockNum;
                }
            }

            console.warn(`   -> ⚠️ Unexpected response format:`, response);
        } catch (error) {
            console.warn(`   -> ❌ API call failed:`, error);
        }

        // Fallback: Use a known recent block and extrapolate
        // Reference: Block 21,000,000 was approximately at timestamp 1730000000 (Oct 27, 2024)
        const REFERENCE_BLOCK = 21000000;
        const REFERENCE_TIMESTAMP = 1730000000;
        const AVERAGE_BLOCK_TIME = 12.05; // More accurate average

        const now = Math.floor(Date.now() / 1000);
        const secondsSinceReference = now - REFERENCE_TIMESTAMP;
        const blocksSinceReference = Math.floor(secondsSinceReference / AVERAGE_BLOCK_TIME);
        const estimatedBlock = REFERENCE_BLOCK + blocksSinceReference;

        console.log(`   -> Using estimated current block: ${estimatedBlock} (fallback calculation)`);
        return estimatedBlock;
    }

    private async fetchAllPages(
        action: 'txlist' | 'tokentx',
        address: string,
        options?: FetchOptions
    ): Promise<Transaction[]> {
        const allResults: Transaction[] = [];

        let startBlock = options?.startBlock ?? 0;
        if (options?.timeframe?.start && !options.startBlock) {
            const now = Math.floor(Date.now() / 1000);
            const blocksSinceStart = Math.floor((now - options.timeframe.start) / this.blockTimeSeconds);
            const currentBlock = await this.getCurrentBlockNumber(); // ✅ FETCH DYNAMICALLY
            startBlock = Math.max(0, currentBlock - blocksSinceStart);
            console.log(`   -> Estimated start block for timeframe: ${startBlock} (current: ${currentBlock})`);
        }

        const endBlock = options?.endBlock ?? 99999999;

        while (true) {
            console.log(`   Fetching ${action} page from block ${startBlock}...`);

            const pageResults = await this.fetchPage(action, address, startBlock, endBlock);

            if (pageResults.length === 0) {
                break;
            }

            const pageLen = pageResults.length;
            allResults.push(...pageResults);

            if (
                allResults.length >= this.config.maxTransactionsPerAddress ||
                pageLen < this.config.etherscanMaxRecords
            ) {
                break;
            }

            const lastTx = allResults[allResults.length - 1];
            const lastBlock = parseInt(lastTx.blockNumber) || 0;
            startBlock = lastBlock + 1;

            if (startBlock > endBlock) {
                break;
            }
        }

        if (options?.timeframe) {
            return allResults.filter(tx => {
                const timestamp = parseInt(tx.timeStamp) || 0;
                return timestamp >= options.timeframe!.start && timestamp <= options.timeframe!.end;
            });
        }

        return allResults;
    }

    private async fetchPage(
        action: 'txlist' | 'tokentx',
        address: string,
        startBlock: number,
        endBlock: number
    ): Promise<Transaction[]> {
        const url = `${this.apiUrl}?chainid=1&module=account&action=${action}&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=${this.config.etherscanApiKey}`;

        try {
            const response = await httpClient.get<EtherscanResponse<Transaction[]>>(url);

            if (response.status === '1') {
                return response.result || [];
            } else if (response.message.includes('No transactions found')) {
                return [];
            } else {
                throw new APIError(
                    this.chainName,
                    `Etherscan API error: ${response.message}`
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

    async getTokenMetadata(tokenAddress: string): Promise<TokenInfo> {
        const lowerAddress = tokenAddress.toLowerCase();

        const cached = tokenInfoCache.get<TokenInfo>(`token_info_${lowerAddress}`);
        if (cached) {
            return cached;
        }

        const known = this.KNOWN_TOKENS.get(lowerAddress);
        if (known) {
            tokenInfoCache.set(`token_info_${lowerAddress}`, known, CACHE_TTL.TOKEN_INFO);
            return known;
        }

        if (this.config.moralisApiKey) {
            console.log(`   -> Discovering token info for ${lowerAddress}...`);

            try {
                const url = `${this.moralisMetadataUrl}?chain=eth&addresses=${lowerAddress}`;
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

                    tokenInfoCache.set(`token_info_${lowerAddress}`, tokenInfo, CACHE_TTL.TOKEN_INFO);
                    return tokenInfo;
                }
            } catch (error) {
                console.warn(`   -> ⚠️  Moralis metadata failed (using fallback): ${error instanceof Error ? error.message : error}`);
            }
        }

        const fallback: TokenInfo = {
            symbol: 'UNKNOWN',
            decimals: 18,
            address: lowerAddress
        };

        tokenInfoCache.set(`token_info_${lowerAddress}`, fallback, CACHE_TTL.TOKEN_INFO);
        return fallback;
    }

    async getHistoricalPrice(tokenAddress: string, timestamp: number): Promise<TokenPrice> {
        const tokenInfo = await this.getTokenMetadata(tokenAddress);
        const tokenSymbol = tokenInfo.symbol;

        // Check if token previously failed
        const failKey = `failed_${tokenAddress}`;
        if (failedTokenCache.has(failKey)) {
            return { priceUSD: 0, priceNative: 0, timestamp };
        }

        if (tokenSymbol === 'WETH') {
            const ethUSD = await this.getNativeTokenPrice(timestamp);
            return {
                priceUSD: ethUSD,
                priceNative: 1.0,
                timestamp
            };
        }

        const date = new Date(timestamp * 1000);
        const monthlyKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        const cacheKey = `${tokenSymbol}_${monthlyKey}_${tokenAddress}`;

        const cachedPrice = priceCache.get<number>(cacheKey);
        if (cachedPrice !== null && cachedPrice !== undefined) {
            return { priceUSD: cachedPrice, priceNative: 0, timestamp };  // Reconstruct TokenPrice
        }

        if (['USDT', 'USDC', 'DAI'].includes(tokenSymbol)) {
            const ethUSD = await this.getNativeTokenPrice(timestamp);
            const stablecoinETH = ethUSD > 0 ? 1.0 / ethUSD : 0;

            const price: TokenPrice = {
                priceUSD: 1.0,
                priceNative: stablecoinETH,
                timestamp
            };

            priceCache.set(cacheKey, 1.0, CACHE_TTL.PRICE_MONTHLY);  // ✅ Store number only
            return price;
        }

        console.log(`   -> API FETCH: Price for ${tokenSymbol} (${tokenAddress})`);
        const priceETH = await this.fetchTokenPriceFromAPIs(tokenSymbol, tokenAddress, timestamp);

        if (priceETH > 0) {
            const ethUSD = await this.getNativeTokenPrice(timestamp);
            const priceUSD = priceETH * ethUSD;

            const price: TokenPrice = {
                priceUSD,
                priceNative: priceETH,
                timestamp
            };

            priceCache.set(cacheKey, priceUSD, CACHE_TTL.PRICE_MONTHLY);  // ✅ Store number only
            return price;
        }

        // Mark as failed to avoid retrying
        failedTokenCache.set(failKey, true, CACHE_TTL.FAILED_TOKEN);

        return {
            priceUSD: 0,
            priceNative: 0,
            timestamp
        };
    }

    async getNativeTokenPrice(timestamp: number): Promise<number> {
        const date = new Date(timestamp * 1000);
        const monthlyKey = `ETH_USD_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

        const cached = priceCache.get<number>(monthlyKey);
        if (cached !== null && cached !== undefined) {
            return cached;
        }

        console.log(`-> Fetching ETH/USD price for ${monthlyKey} from API...`);

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
            console.warn(`   -> Failed to fetch ETH/USD from CryptoCompare: ${error}`);
        }

        // Cache the failure (0) to avoid repeated API calls
        console.warn(`   -> Warning: Could not fetch ETH/USD price, returning 0`);
        priceCache.set(monthlyKey, 0, CACHE_TTL.PRICE_MONTHLY);
        return 0;
    }

    private async fetchTokenPriceFromAPIs(
        tokenSymbol: string,
        tokenAddress: string,
        timestamp: number
    ): Promise<number> {
        if (tokenSymbol !== 'UNKNOWN') {
            console.log('      -> [Layer 1] Trying CryptoCompare...');

            const date = new Date(timestamp * 1000);
            const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthlyTs = Math.floor(monthlyDate.getTime() / 1000);

            try {
                const url = `${this.cryptocompareUrl}?fsym=${tokenSymbol}&tsyms=ETH&ts=${monthlyTs}&api_key=${this.config.cryptocompareApiKey}`;
                const response = await httpClient.get<CryptoCompareResponse>(url);

                const price = response?.[tokenSymbol]?.ETH || 0;
                if (price > 0) {
                    console.log(`      -> ✅ CryptoCompare SUCCESS: ${price} ETH`);
                    return price;
                }
            } catch (error) {
                console.warn(`      -> CryptoCompare failed: ${error}`);
            }
        }

        console.log('      -> [Layer 2] Trying DeFiLlama...');
        try {
            const price = await this.fetchFromDeFiLlama(tokenAddress, timestamp);
            if (price > 0) {
                console.log(`      -> ✅ DeFiLlama SUCCESS: ${price} ETH`);
                return price;
            }
        } catch (error) {
            console.warn(`      -> DeFiLlama failed: ${error}`);
        }

        console.log('      -> [Layer 3] Trying Moralis...');
        try {
            const price = await this.fetchFromMoralis(tokenAddress, timestamp);
            if (price > 0) {
                console.log(`      -> ✅ Moralis PRICE SUCCESS: ${price} ETH`);
                return price;
            }
        } catch (error) {
            console.warn(`      -> Moralis failed: ${error}`);
        }

        console.log(`      -> ❌ ALL APIs FAILED for ${tokenSymbol}. Ignoring value.`);
        return 0;
    }

    private async fetchFromDeFiLlama(tokenAddress: string, timestamp: number): Promise<number> {
        const llamaAddress = `ethereum:${tokenAddress}`;
        const url = `${this.defillamaUrl}/${timestamp}/${llamaAddress}`;

        try {
            const response = await httpClient.get<DefiLlamaResponse>(url);

            const coinData = response?.coins?.[llamaAddress];
            if (coinData?.price) {
                const tokenUSD = coinData.price;
                const ethUSD = await this.getNativeTokenPrice(timestamp);

                if (ethUSD > 0) {
                    return tokenUSD / ethUSD;
                }
            }
        } catch (error) {
            // Expected to fail for many tokens
        }

        return 0;
    }

    private async fetchFromMoralis(tokenAddress: string, timestamp: number): Promise<number> {
        const date = new Date(timestamp * 1000);
        const toDate = date.toISOString();
        const url = `${this.moralisPriceUrl}/${tokenAddress}/price?chain=eth&to_date=${toDate}`;

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
                    return tokenUSD / ethUSD;
                }
            }
        } catch (error) {
            // Expected to fail for many tokens
        }

        return 0;
    }
}