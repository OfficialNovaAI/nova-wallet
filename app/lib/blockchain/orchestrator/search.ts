// src/orchestrator/search.ts - ENHANCED VERSION with proper metadata tracking

import { BlockchainClient, FetchOptions } from '@/lib/blockchain/clients/base';
import { TokenActivityAggregator } from '@/lib/blockchain/aggregators/token-activity';
import { PortfolioAggregator } from '@/lib/blockchain/aggregators/portfolio';
import { CounterpartyAggregator } from '@/lib/blockchain/aggregators/counterparty';
import { WhaleAggregator } from '@/lib/blockchain/aggregators/whale';
import { TransactionStatsAggregator } from '@/lib/blockchain/aggregators/transaction-stats';
import {
    TokenActivityAnalysis,
    PortfolioAnalysis,
    CounterpartyAnalysis,
    WhaleAnalysis,
    TransactionStats
} from '@/lib/blockchain/aggregators/types';

export type SearchQueryType =
    | 'token_activity'
    | 'portfolio'
    | 'counterparty'
    | 'whale'
    | 'transaction_stats'
    | 'comprehensive';

export interface SearchParams {
    address: string;
    queryType: SearchQueryType;
    timeframeDays?: number;
    whaleThresholdUSD?: number;
}

export interface SearchResult {
    queryType: SearchQueryType;
    address: string;
    chain: string;
    timestamp: number;
    processingTimeMs: number;
    transactionsAnalyzed: number;
    data: SearchResultData;
    metadata: SearchMetadata;
}

export type SearchResultData =
    | { type: 'token_activity'; analysis: TokenActivityAnalysis }
    | { type: 'portfolio'; analysis: PortfolioAnalysis }
    | { type: 'counterparty'; analysis: CounterpartyAnalysis }
    | { type: 'whale'; analysis: WhaleAnalysis }
    | { type: 'transaction_stats'; stats: TransactionStats }
    | {
        type: 'comprehensive';
        tokenActivity: TokenActivityAnalysis;
        portfolio: PortfolioAnalysis;
        counterparty: CounterpartyAnalysis;
        whale: WhaleAnalysis;
        stats: TransactionStats;
    };

export interface SearchMetadata {
    dataSource: string;
    apiCallsMade: number;
    cacheHitRate: number;
    warnings: string[];
    blockTime?: number;
    nativeToken?: string;
}

/**
 * Enhanced search orchestrator with proper metadata tracking
 */
export class SearchOrchestrator {
    private tokenActivityAggregator: TokenActivityAggregator;
    private portfolioAggregator: PortfolioAggregator;
    private counterpartyAggregator: CounterpartyAggregator;
    private whaleAggregator: WhaleAggregator;
    private transactionStatsAggregator: TransactionStatsAggregator;
    
    // Metadata tracking
    private apiCallCounter = 0;
    private cacheHits = 0;
    private cacheMisses = 0;

    constructor(private client: BlockchainClient) {
        this.tokenActivityAggregator = new TokenActivityAggregator(client);
        this.portfolioAggregator = new PortfolioAggregator(client);
        this.counterpartyAggregator = new CounterpartyAggregator(client);
        this.whaleAggregator = new WhaleAggregator(client);
        this.transactionStatsAggregator = new TransactionStatsAggregator(client);
    }

    /**
     * Execute a search query with full metadata tracking
     */
    async search(params: SearchParams): Promise<SearchResult> {
        const startTime = Date.now();
        const now = Math.floor(Date.now() / 1000);
        
        // Reset counters for this search
        this.apiCallCounter = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;

        console.log(`\n=== Starting ${params.queryType} search for ${params.address} ===`);

        // Calculate timeframe
        const timeframeEnd = now;
        const timeframeStart = params.timeframeDays
            ? now - (params.timeframeDays * 24 * 60 * 60)
            : undefined;

        const fetchOptions: FetchOptions | undefined = timeframeStart
            ? { timeframe: { start: timeframeStart, end: timeframeEnd } }
            : undefined;

        // Fetch transactions
        console.log('Fetching transactions...');
        const transactions = await this.client.getTransactions(params.address, fetchOptions);
        this.apiCallCounter++; // Count transaction fetch
        console.log(`✅ Fetched ${transactions.length} transactions\n`);

        // Execute analysis based on query type
        let data: SearchResultData;
        const warnings: string[] = [];

        if (transactions.length === 0) {
            warnings.push('No transactions found for this address in the specified timeframe');
        }

        switch (params.queryType) {
            case 'token_activity':
                data = await this.executeTokenActivitySearch(params.address, transactions, timeframeStart, timeframeEnd);
                break;

            case 'portfolio':
                data = await this.executePortfolioSearch(params.address, transactions);
                break;

            case 'counterparty':
                data = await this.executeCounterpartySearch(params.address, transactions, timeframeStart, timeframeEnd);
                break;

            case 'whale':
                data = await this.executeWhaleSearch(params.address, transactions, timeframeStart, timeframeEnd, params.whaleThresholdUSD);
                break;

            case 'transaction_stats':
                data = await this.executeTransactionStatsSearch(params.address, transactions, timeframeStart, timeframeEnd);
                break;

            case 'comprehensive':
                data = await this.executeComprehensiveSearch(params.address, transactions, timeframeStart, timeframeEnd, params.whaleThresholdUSD);
                break;

            default:
                throw new Error(`Unknown query type: ${params.queryType}`);
        }

        const processingTimeMs = Date.now() - startTime;

        console.log(`\n✅ Search completed in ${processingTimeMs}ms`);

        return {
            queryType: params.queryType,
            address: params.address,
            chain: this.client.chainName,
            timestamp: now,
            processingTimeMs,
            transactionsAnalyzed: transactions.length,
            data,
            metadata: {
                dataSource: `${this.client.chainName} (${this.client.apiUrl})`,
                apiCallsMade: this.apiCallCounter,
                cacheHitRate: this.calculateCacheHitRate(),
                warnings,
                blockTime: this.client.blockTimeSeconds,
                nativeToken: this.client.nativeToken
            }
        };
    }

    /**
     * Calculate cache hit rate
     */
    private calculateCacheHitRate(): number {
        const totalCacheAttempts = this.cacheHits + this.cacheMisses;
        if (totalCacheAttempts === 0) return 0;
        return this.cacheHits / totalCacheAttempts;
    }

    /**
     * Track API call
     */
    private trackAPICall(): void {
        this.apiCallCounter++;
    }

    /**
     * Track cache hit
     */
    private trackCacheHit(): void {
        this.cacheHits++;
    }

    /**
     * Track cache miss
     */
    private trackCacheMiss(): void {
        this.cacheMisses++;
    }

    private async executeTokenActivitySearch(
        address: string,
        transactions: any[],
        timeframeStart?: number,
        timeframeEnd?: number
    ): Promise<SearchResultData> {
        const analysis = await this.tokenActivityAggregator.analyzeTokenActivity(
            address,
            transactions,
            timeframeStart,
            timeframeEnd
        );

        return { type: 'token_activity', analysis };
    }

    private async executePortfolioSearch(
        address: string,
        transactions: any[]
    ): Promise<SearchResultData> {
        const analysis = await this.portfolioAggregator.analyzePortfolio(
            address,
            transactions
        );

        return { type: 'portfolio', analysis };
    }

    private async executeCounterpartySearch(
        address: string,
        transactions: any[],
        timeframeStart?: number,
        timeframeEnd?: number
    ): Promise<SearchResultData> {
        const analysis = await this.counterpartyAggregator.analyzeCounterparties(
            address,
            transactions,
            timeframeStart,
            timeframeEnd
        );

        return { type: 'counterparty', analysis };
    }

    private async executeWhaleSearch(
        address: string,
        transactions: any[],
        timeframeStart?: number,
        timeframeEnd?: number,
        whaleThresholdUSD?: number
    ): Promise<SearchResultData> {
        const aggregator = whaleThresholdUSD
            ? new WhaleAggregator(this.client, whaleThresholdUSD)
            : this.whaleAggregator;

        const analysis = await aggregator.analyzeWhaleActivity(
            address,
            transactions,
            timeframeStart,
            timeframeEnd
        );

        return { type: 'whale', analysis };
    }

    private async executeTransactionStatsSearch(
        address: string,
        transactions: any[],
        timeframeStart?: number,
        timeframeEnd?: number
    ): Promise<SearchResultData> {
        const stats = await this.transactionStatsAggregator.calculateTransactionStats(
            address,
            transactions,
            timeframeStart,
            timeframeEnd
        );

        return { type: 'transaction_stats', stats };
    }

    private async executeComprehensiveSearch(
        address: string,
        transactions: any[],
        timeframeStart?: number,
        timeframeEnd?: number,
        whaleThresholdUSD?: number
    ): Promise<SearchResultData> {
        console.log('Running comprehensive analysis (all aggregators)...\n');

        const [tokenActivity, portfolio, counterparty, whale, stats] = await Promise.all([
            this.tokenActivityAggregator.analyzeTokenActivity(address, transactions, timeframeStart, timeframeEnd),
            this.portfolioAggregator.analyzePortfolio(address, transactions),
            this.counterpartyAggregator.analyzeCounterparties(address, transactions, timeframeStart, timeframeEnd),
            (whaleThresholdUSD
                ? new WhaleAggregator(this.client, whaleThresholdUSD)
                : this.whaleAggregator
            ).analyzeWhaleActivity(address, transactions, timeframeStart, timeframeEnd),
            this.transactionStatsAggregator.calculateTransactionStats(address, transactions, timeframeStart, timeframeEnd)
        ]);

        return {
            type: 'comprehensive',
            tokenActivity,
            portfolio,
            counterparty,
            whale,
            stats
        };
    }
}