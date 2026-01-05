// src/aggregators/whale.ts

import { Transaction, BlockchainClient } from '@/lib/blockchain/clients/base';
import { WhaleTransaction, WhaleAnalysis } from './types';

/**
 * Known exchange addresses for tracking exchange flows
 */
const EXCHANGE_ADDRESSES = new Set([
  // Binance
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
  '0xd551234ae421e3bcba99a0da6d736074f22192ff',
  '0x564286362092d8e7936f0549571a803b203aaced',
  '0x0681d8db095565fe8a346fa0277bffde9c0edbbf',
  '0xfe9e8709d3215310075d67e3ed32a380ccf451c8',
  '0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67',
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8',
  '0xf977814e90da44bfa03b6295a0616a897441acec',
  '0x28c6c06298d514db089934071355e5743bf21d60',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f',
  '0x9696f59e4d72e237be84ffd425dcad154bf96976',
  '0x4d9ff50ef4da947364bb9650892b2554e7be5e2b',
  '0xd88b55467f58af508dbfdc597e8ebd2ad2de49b3',
  '0x7dfe9a368b6cf0c0309b763bb8d16da326e8f46e',
  '0x345d8e3a1f62ee6b1d483890976fd66168e390f2',
  '0xc3c8e0a39769e2308869f7461364ca48155d1d9e',
  // Coinbase
  '0x2f7e209e0f5f645c7612d7610193fe268f118b28',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43',
  '0x77696bb39917c91a0c3908d577d5e322095425ca',
  '0x7c195d981abfdc3ddecd2ca0fed0958430488e34',
  '0x95a9bd206ae52c4ba8eecfc93d18eacdd41c88cc',
  '0xb739d0895772dbb71a89a3754a160269068f0d45',
  '0x503828976d22510aad0201ac7ec88293211d23da',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740',
  '0x3cd751e6b0078be393132286c442345e5dc49699',
  '0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511',
  '0xeb2629a2734e272bcc07bda959863f316f4bd4cf',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
  // Kraken
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0',
  '0xfa52274dd61e1643d2205169732f29114bc240b3',
  '0x53d284357ec70ce289d6d64134dfac8e511c8a3d',
  '0x89e51fa8ca5d66cd220baed62ed01e8951aa7c40',
  '0xe853c56864a2ebe4576a807d26fdc4a0ada51919',
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13',
  '0xe92d1a43df510f82c66382592a047d288f85226f',
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
  // Gate.io
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
  '0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c',
  '0xd793281182a0e3e023116004778f45c29fc14f19',
]);

/**
 * Analyze whale activity (large transactions)
 */
export class WhaleAggregator {
  private readonly WEI_TO_ETH = 1_000_000_000_000_000_000;
  
  constructor(
    private client: BlockchainClient,
    private whaleThresholdUSD: number = 100000 // $100k default
  ) {}

  /**
   * Analyze whale transactions for an address
   */
  async analyzeWhaleActivity(
    address: string,
    transactions: Transaction[],
    timeframeStart?: number,
    timeframeEnd?: number
  ): Promise<WhaleAnalysis> {
    const lowerAddress = address.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    
    console.log(`Detecting whale transactions (threshold: $${this.whaleThresholdUSD})...`);
    
    // Identify whale transactions
    const whaleTransactions: WhaleTransaction[] = [];
    
    for (const tx of transactions) {
      const timestamp = parseInt(tx.timeStamp);
      
      // Skip if outside timeframe
      if (timeframeStart && timestamp < timeframeStart) continue;
      if (timeframeEnd && timestamp > timeframeEnd) continue;
      
      const valueUSD = await this.calculateTransactionValueUSD(tx);
      
      if (valueUSD >= this.whaleThresholdUSD) {
        const direction = tx.from.toLowerCase() === lowerAddress ? 'sent' : 'received';
        const destinationLabel = this.getAddressLabel(tx.to);
        
        let valueNative = 0;
        let tokenSymbol: string | undefined;
        let tokenAddress: string | undefined;
        
        if (tx.txType === 'ETH') {
          valueNative = parseFloat(tx.value || '0') / this.WEI_TO_ETH;
        } else if (tx.txType === 'ERC20' && tx.contractAddress) {
          const tokenInfo = await this.client.getTokenMetadata(tx.contractAddress);
          valueNative = parseFloat(tx.value || '0') / Math.pow(10, tokenInfo.decimals);
          tokenSymbol = tokenInfo.symbol;
          tokenAddress = tx.contractAddress;
        }
        
        whaleTransactions.push({
          hash: tx.hash,
          timestamp,
          from: tx.from,
          to: tx.to,
          valueUSD,
          valueNative,
          tokenSymbol,
          tokenAddress,
          type: tx.txType,
          direction,
          destinationLabel
        });
      }
    }
    
    // Sort by value (descending)
    whaleTransactions.sort((a, b) => b.valueUSD - a.valueUSD);
    
    // Calculate metrics
    const totalWhaleValueUSD = whaleTransactions.reduce((sum, tx) => sum + tx.valueUSD, 0);
    const largestTransaction = whaleTransactions[0];
    const numWhaleTransactions = whaleTransactions.length;
    const averageWhaleTransactionUSD = numWhaleTransactions > 0
      ? totalWhaleValueUSD / numWhaleTransactions
      : 0;
    
    // Calculate exchange flows
    const exchangeFlows = this.calculateExchangeFlows(whaleTransactions);
    
    return {
      address,
      timeframeStart: timeframeStart || (transactions[0] ? parseInt(transactions[0].timeStamp) : now),
      timeframeEnd: timeframeEnd || now,
      whaleTransactions,
      totalWhaleValueUSD,
      largestTransaction,
      numWhaleTransactions,
      averageWhaleTransactionUSD,
      exchangeFlows
    };
  }

  /**
   * Calculate USD value of a transaction
   */
  private async calculateTransactionValueUSD(tx: Transaction): Promise<number> {
    const timestamp = parseInt(tx.timeStamp);
    
    if (tx.txType === 'ETH') {
      const ethAmount = parseFloat(tx.value || '0') / this.WEI_TO_ETH;
      const ethPrice = await this.client.getNativeTokenPrice(timestamp);
      return ethAmount * ethPrice;
    } else if (tx.txType === 'ERC20' && tx.contractAddress) {
      try {
        const tokenInfo = await this.client.getTokenMetadata(tx.contractAddress);
        const tokenAmount = parseFloat(tx.value || '0') / Math.pow(10, tokenInfo.decimals);
        const price = await this.client.getHistoricalPrice(tx.contractAddress, timestamp);
        return tokenAmount * price.priceUSD;
      } catch (error) {
        return 0;
      }
    }
    
    return 0;
  }

  /**
   * Get label for known addresses
   */
  private getAddressLabel(address: string): string | undefined {
    const lowerAddr = address.toLowerCase();
    
    if (EXCHANGE_ADDRESSES.has(lowerAddr)) {
      // Determine which exchange
      if (lowerAddr.startsWith('0x3f5c') || lowerAddr.startsWith('0xd551') ||
          lowerAddr.startsWith('0x5642') || lowerAddr.startsWith('0x0681') ||
          lowerAddr.startsWith('0xfe9e') || lowerAddr.startsWith('0x4e9c') ||
          lowerAddr.startsWith('0xbe0e') || lowerAddr.startsWith('0xf977') ||
          lowerAddr.startsWith('0x28c6') || lowerAddr.startsWith('0x21a3') ||
          lowerAddr.startsWith('0xdfd5') || lowerAddr.startsWith('0x56ed') ||
          lowerAddr.startsWith('0x9696') || lowerAddr.startsWith('0x4d9f') ||
          lowerAddr.startsWith('0xd88b') || lowerAddr.startsWith('0x7dfe') ||
          lowerAddr.startsWith('0x345d') || lowerAddr.startsWith('0xc3c8')) {
        return 'Binance';
      } else if (lowerAddr.startsWith('0x2f7e') || lowerAddr.startsWith('0xa9d1') ||
                 lowerAddr.startsWith('0x7769') || lowerAddr.startsWith('0x7c19') ||
                 lowerAddr.startsWith('0x95a9') || lowerAddr.startsWith('0xb739') ||
                 lowerAddr.startsWith('0x5038') || lowerAddr.startsWith('0xddfa') ||
                 lowerAddr.startsWith('0x3cd7') || lowerAddr.startsWith('0xb5d8') ||
                 lowerAddr.startsWith('0xeb26') || lowerAddr.startsWith('0x7166')) {
        return 'Coinbase';
      } else if (lowerAddr.startsWith('0x267b') || lowerAddr.startsWith('0xfa52') ||
                 lowerAddr.startsWith('0x53d2') || lowerAddr.startsWith('0x89e5') ||
                 lowerAddr.startsWith('0xe853') || lowerAddr.startsWith('0x0a86') ||
                 lowerAddr.startsWith('0xe92d') || lowerAddr.startsWith('0x2910')) {
        return 'Kraken';
      } else if (lowerAddr.startsWith('0x0d07') || lowerAddr.startsWith('0x1c4b') ||
                 lowerAddr.startsWith('0xd793')) {
        return 'Gate.io';
      }
    }
    
    return undefined;
  }

  /**
   * Calculate exchange flow metrics
   */
  private calculateExchangeFlows(whaleTransactions: WhaleTransaction[]): {
    sentToExchanges: number;
    receivedFromExchanges: number;
    netExchangeFlow: number;
  } {
    let sentToExchanges = 0;
    let receivedFromExchanges = 0;
    
    for (const tx of whaleTransactions) {
      const isExchange = tx.destinationLabel && 
        ['Binance', 'Coinbase', 'Kraken', 'Gate.io'].includes(tx.destinationLabel);
      
      if (isExchange) {
        if (tx.direction === 'sent') {
          sentToExchanges += tx.valueUSD;
        } else if (tx.direction === 'received') {
          receivedFromExchanges += tx.valueUSD;
        }
      }
    }
    
    return {
      sentToExchanges,
      receivedFromExchanges,
      netExchangeFlow: sentToExchanges - receivedFromExchanges
    };
  }
}