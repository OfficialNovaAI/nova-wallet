// src/aggregators/counterparty.ts - OPTIMIZED VERSION

import { Transaction, BlockchainClient } from '@/lib/blockchain/clients/base';
import { CounterpartyInteraction, CounterpartyAnalysis } from './types';

const KNOWN_ADDRESSES: Map<string, string> = new Map([
  // Exchanges
  ['0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', 'Binance'],
  ['0xd551234ae421e3bcba99a0da6d736074f22192ff', 'Binance'],
  ['0x564286362092d8e7936f0549571a803b203aaced', 'Binance'],
  ['0x0681d8db095565fe8a346fa0277bffde9c0edbbf', 'Binance'],
  ['0xfe9e8709d3215310075d67e3ed32a380ccf451c8', 'Binance'],
  ['0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67', 'Binance'],
  ['0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', 'Binance'],
  ['0xf977814e90da44bfa03b6295a0616a897441acec', 'Binance'],
  ['0x28c6c06298d514db089934071355e5743bf21d60', 'Binance'],
  ['0x21a31ee1afc51d94c2efccaa2092ad1028285549', 'Binance'],
  ['0xdfd5293d8e347dfe59e90efd55b2956a1343963d', 'Binance'],
  ['0x56eddb7aa87536c09ccc2793473599fd21a8b17f', 'Binance'],
  ['0x9696f59e4d72e237be84ffd425dcad154bf96976', 'Binance'],
  ['0x4d9ff50ef4da947364bb9650892b2554e7be5e2b', 'Binance'],
  ['0xd88b55467f58af508dbfdc597e8ebd2ad2de49b3', 'Binance'],
  ['0x7dfe9a368b6cf0c0309b763bb8d16da326e8f46e', 'Binance'],
  ['0x345d8e3a1f62ee6b1d483890976fd66168e390f2', 'Binance'],
  ['0xc3c8e0a39769e2308869f7461364ca48155d1d9e', 'Binance'],
  ['0x2f7e209e0f5f645c7612d7610193fe268f118b28', 'Coinbase'],
  ['0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43', 'Coinbase'],
  ['0x77696bb39917c91a0c3908d577d5e322095425ca', 'Coinbase'],
  ['0x7c195d981abfdc3ddecd2ca0fed0958430488e34', 'Coinbase'],
  ['0x95a9bd206ae52c4ba8eecfc93d18eacdd41c88cc', 'Coinbase'],
  ['0xb739d0895772dbb71a89a3754a160269068f0d45', 'Coinbase'],
  ['0x503828976d22510aad0201ac7ec88293211d23da', 'Coinbase'],
  ['0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740', 'Coinbase'],
  ['0x3cd751e6b0078be393132286c442345e5dc49699', 'Coinbase'],
  ['0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511', 'Coinbase'],
  ['0xeb2629a2734e272bcc07bda959863f316f4bd4cf', 'Coinbase'],
  ['0x71660c4005ba85c37ccec55d0c4493e66fe775d3', 'Coinbase'],
  ['0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0', 'Kraken'],
  ['0xfa52274dd61e1643d2205169732f29114bc240b3', 'Kraken'],
  ['0x53d284357ec70ce289d6d64134dfac8e511c8a3d', 'Kraken'],
  ['0x89e51fa8ca5d66cd220baed62ed01e8951aa7c40', 'Kraken'],
  ['0xe853c56864a2ebe4576a807d26fdc4a0ada51919', 'Kraken'],
  ['0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13', 'Kraken'],
  ['0xe92d1a43df510f82c66382592a047d288f85226f', 'Kraken'],
  ['0x2910543af39aba0cd09dbb2d50200b3e800a63d2', 'Kraken'],
  ['0x0d0707963952f2fba59dd06f2b425ace40b492fe', 'Gate.io'],
  ['0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c', 'Gate.io'],
  ['0xd793281182a0e3e023116004778f45c29fc14f19', 'Gate.io'],
  // DeFi Protocols
  ['0x7a250d5630b4cf539739df2c5dacb4c659f2488d', 'Uniswap V2 Router'],
  ['0xe592427a0aece92de3edee1f18e0157c05861564', 'Uniswap V3 Router'],
  ['0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', 'Uniswap Universal Router'],
  ['0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', 'SushiSwap Router'],
  ['0x881d40237659c251811cec9c364ef91dc08d300c', 'Metamask Swap Router'],
  ['0x1111111254fb6c44bac0bed2854e76f90643097d', '1inch Router'],
  ['0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', 'Aave Lending Pool'],
  ['0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2', 'Aave V3 Pool'],
  ['0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff', 'Curve Finance'],
]);

/**
 * OPTIMIZED: Pre-fetch all unique token prices before processing
 */
export class CounterpartyAggregator {
  private readonly WEI_TO_ETH = 1_000_000_000_000_000_000;
  private priceCache: Map<string, number> = new Map(); // Local cache for this analysis

  constructor(private client: BlockchainClient) {}

  async analyzeCounterparties(
    address: string,
    transactions: Transaction[],
    timeframeStart?: number,
    timeframeEnd?: number
  ): Promise<CounterpartyAnalysis> {
    const lowerAddress = address.toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    console.log('Analyzing counterparty interactions...');

    // OPTIMIZATION: Pre-fetch all unique token prices
    await this.prefetchTokenPrices(transactions, timeframeStart, timeframeEnd);

    const counterpartyMap = new Map<string, {
      sent: Transaction[];
      received: Transaction[];
    }>();

    for (const tx of transactions) {
      const timestamp = parseInt(tx.timeStamp);

      if (timeframeStart && timestamp < timeframeStart) continue;
      if (timeframeEnd && timestamp > timeframeEnd) continue;

      let counterpartyAddr: string | null = null;
      let direction: 'sent' | 'received' | null = null;

      if (tx.from.toLowerCase() === lowerAddress && tx.to) {
        counterpartyAddr = tx.to.toLowerCase();
        direction = 'sent';
      } else if (tx.to.toLowerCase() === lowerAddress && tx.from) {
        counterpartyAddr = tx.from.toLowerCase();
        direction = 'received';
      }

      if (!counterpartyAddr || counterpartyAddr === lowerAddress) continue;

      const existing = counterpartyMap.get(counterpartyAddr) || { sent: [], received: [] };

      if (direction === 'sent') {
        existing.sent.push(tx);
      } else {
        existing.received.push(tx);
      }

      counterpartyMap.set(counterpartyAddr, existing);
    }

    const interactions: CounterpartyInteraction[] = [];

    for (const [counterpartyAddr, { sent, received }] of counterpartyMap.entries()) {
      const interaction = await this.calculateCounterpartyInteraction(
        counterpartyAddr,
        sent,
        received
      );
      interactions.push(interaction);
    }

    interactions.sort((a, b) => b.numTransactions - a.numTransactions);

    const knownExchanges = interactions.filter(i =>
      i.label && ['Binance', 'Coinbase', 'Kraken', 'Gate.io'].some(ex => i.label?.includes(ex))
    );

    const knownDeFiProtocols = interactions.filter(i =>
      i.label && ['Uniswap', 'Sushiswap', 'Aave', 'Curve', '1inch', 'Metamask'].some(defi => i.label?.includes(defi))
    );

    const unknownAddresses = interactions.filter(i => !i.label);

    return {
      address,
      timeframeStart: timeframeStart || (transactions[0] ? parseInt(transactions[0].timeStamp) : now),
      timeframeEnd: timeframeEnd || now,
      topCounterparties: interactions.slice(0, 20),
      totalUniqueCounterparties: interactions.length,
      knownExchanges,
      knownDeFiProtocols,
      unknownAddresses: unknownAddresses.slice(0, 10)
    };
  }

  /**
   * OPTIMIZATION: Pre-fetch all unique token prices in one batch
   */
  private async prefetchTokenPrices(
    transactions: Transaction[],
    timeframeStart?: number,
    timeframeEnd?: number
  ): Promise<void> {
    // Collect unique token-month combinations
    const uniquePrices = new Map<string, Set<number>>();

    for (const tx of transactions) {
      const timestamp = parseInt(tx.timeStamp);
      
      if (timeframeStart && timestamp < timeframeStart) continue;
      if (timeframeEnd && timestamp > timeframeEnd) continue;

      if (tx.txType === 'ERC20' && tx.contractAddress) {
        const months = uniquePrices.get(tx.contractAddress) || new Set();
        
        // Get first day of month timestamp
        const date = new Date(timestamp * 1000);
        const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthTs = Math.floor(monthlyDate.getTime() / 1000);
        
        months.add(monthTs);
        uniquePrices.set(tx.contractAddress, months);
      }
    }

    // Pre-fetch all unique prices
    console.log(`   -> Pre-fetching prices for ${uniquePrices.size} unique tokens...`);
    
    let fetched = 0;
    for (const [tokenAddr, timestamps] of uniquePrices.entries()) {
      for (const ts of timestamps) {
        const cacheKey = `${tokenAddr}_${ts}`;
        
        // Skip if already in local cache
        if (this.priceCache.has(cacheKey)) continue;
        
        try {
          const tokenInfo = await this.client.getTokenMetadata(tokenAddr);
          const price = await this.client.getHistoricalPrice(tokenAddr, ts);
          
          // Store in local cache with monthly timestamp
          this.priceCache.set(cacheKey, price.priceUSD);
          fetched++;
        } catch (error) {
          // Store 0 to avoid retrying
          this.priceCache.set(cacheKey, 0);
        }
      }
    }
    
    console.log(`   -> ✅ Pre-fetched ${fetched} unique price points`);
  }

  private async calculateCounterpartyInteraction(
    counterpartyAddress: string,
    sentTransactions: Transaction[],
    receivedTransactions: Transaction[]
  ): Promise<CounterpartyInteraction> {
    const label = KNOWN_ADDRESSES.get(counterpartyAddress);

    let totalValueSentUSD = 0;
    let totalValueReceivedUSD = 0;

    // Process sent transactions
    for (const tx of sentTransactions) {
      const value = await this.calculateTransactionValueUSD(tx);
      totalValueSentUSD += value;
    }

    // Process received transactions
    for (const tx of receivedTransactions) {
      const value = await this.calculateTransactionValueUSD(tx);
      totalValueReceivedUSD += value;
    }

    let interactionType: 'mostly_sent' | 'mostly_received' | 'balanced';
    const ratio = totalValueSentUSD / (totalValueReceivedUSD || 1);

    if (ratio > 2) {
      interactionType = 'mostly_sent';
    } else if (ratio < 0.5) {
      interactionType = 'mostly_received';
    } else {
      interactionType = 'balanced';
    }

    const allTxs = [...sentTransactions, ...receivedTransactions];
    const timestamps = allTxs.map(tx => parseInt(tx.timeStamp));

    return {
      address: counterpartyAddress,
      label,
      numTransactions: sentTransactions.length + receivedTransactions.length,
      totalValueSentUSD,
      totalValueReceivedUSD,
      firstInteractionTimestamp: Math.min(...timestamps),
      lastInteractionTimestamp: Math.max(...timestamps),
      interactionType
    };
  }

  /**
   * OPTIMIZED: Use pre-fetched prices from local cache
   */
  private async calculateTransactionValueUSD(tx: Transaction): Promise<number> {
    const timestamp = parseInt(tx.timeStamp);

    if (tx.txType === 'ETH') {
      const ethAmount = parseFloat(tx.value || '0') / this.WEI_TO_ETH;
      const ethPrice = await this.client.getNativeTokenPrice(timestamp);
      return ethAmount * ethPrice;
    } else if (tx.txType === 'ERC20' && tx.contractAddress) {
      try {
        // Get month timestamp for caching
        const date = new Date(timestamp * 1000);
        const monthlyDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthTs = Math.floor(monthlyDate.getTime() / 1000);
        
        const cacheKey = `${tx.contractAddress}_${monthTs}`;
        
        // Use local cache (already pre-fetched)
        let priceUSD = this.priceCache.get(cacheKey);
        
        if (priceUSD === undefined) {
          // Fallback: fetch if somehow missed
          const tokenInfo = await this.client.getTokenMetadata(tx.contractAddress);
          const price = await this.client.getHistoricalPrice(tx.contractAddress, timestamp);
          priceUSD = price.priceUSD;
          this.priceCache.set(cacheKey, priceUSD);
        }
        
        if (priceUSD === 0) return 0;
        
        const tokenInfo = await this.client.getTokenMetadata(tx.contractAddress);
        const tokenAmount = parseFloat(tx.value || '0') / Math.pow(10, tokenInfo.decimals);
        
        return tokenAmount * priceUSD;
      } catch (error) {
        return 0;
      }
    }

    return 0;
  }
}