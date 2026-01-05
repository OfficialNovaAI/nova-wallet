// nova-wallet/test-blockchain-integration.ts
// Quick test to verify blockchain agent is working

import { 
    getPortfolioAnalysis, 
    getTokenActivity, 
    getTransactionStats 
} from './app/lib/blockchainAgentWrapper';

async function testBlockchainIntegration() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  TESTING BLOCKCHAIN AGENT INTEGRATION               ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    // Test address (Vitalik on Sepolia for example)
    const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const testChainId = 11155111; // Ethereum Sepolia

    console.log('Test Parameters:');
    console.log(`  Address: ${testAddress}`);
    console.log(`  Chain: Ethereum Sepolia (${testChainId})`);
    console.log('');

    // Test 1: Transaction Stats (fastest)
    console.log('━━━ Test 1: Transaction Stats ━━━');
    try {
        console.log('Fetching transaction stats...');
        const stats = await getTransactionStats(testAddress, testChainId);
        
        console.log('✅ SUCCESS!');
        console.log(`   Chain: ${stats.chain}`);
        console.log(`   Transactions: ${stats.transactionsAnalyzed}`);
        console.log(`   Processing time: ${stats.processingTimeMs}ms`);
        
        if (stats.data.type === 'transaction_stats') {
            const s = stats.data.stats;
            console.log(`   Total transactions: ${s.totalTransactions}`);
            console.log(`   Gas spent: $${s.totalGasSpentUSD.toFixed(2)}`);
            console.log(`   Account age: ${s.accountAgeDays} days`);
        }
    } catch (error) {
        console.error('❌ FAILED:', error instanceof Error ? error.message : error);
    }

    console.log('\n━━━ Test 2: Portfolio Analysis ━━━');
    try {
        console.log('Fetching portfolio...');
        const portfolio = await getPortfolioAnalysis(testAddress, testChainId);
        
        console.log('✅ SUCCESS!');
        console.log(`   Chain: ${portfolio.chain}`);
        console.log(`   Processing time: ${portfolio.processingTimeMs}ms`);
        
        if (portfolio.data.type === 'portfolio') {
            const p = portfolio.data.analysis;
            console.log(`   Native balance: ${p.nativeBalance.toFixed(4)} ETH`);
            console.log(`   Token holdings: ${p.numTokens} tokens`);
            console.log(`   Total portfolio value: $${p.totalPortfolioValueUSD.toFixed(2)}`);
        }
    } catch (error) {
        console.error('❌ FAILED:', error instanceof Error ? error.message : error);
    }

    console.log('\n━━━ Test 3: Token Activity ━━━');
    try {
        console.log('Fetching token activity (last 30 days)...');
        const activity = await getTokenActivity(testAddress, testChainId, 30);
        
        console.log('✅ SUCCESS!');
        console.log(`   Chain: ${activity.chain}`);
        console.log(`   Processing time: ${activity.processingTimeMs}ms`);
        
        if (activity.data.type === 'token_activity') {
            const a = activity.data.analysis;
            console.log(`   Tokens bought: ${a.summary.numTokensBought}`);
            console.log(`   Tokens sold: ${a.summary.numTokensSold}`);
            console.log(`   Total invested: $${a.summary.totalInvestedUSD.toFixed(2)}`);
            console.log(`   Current value: $${a.summary.currentPortfolioValueUSD.toFixed(2)}`);
            console.log(`   P&L: ${a.summary.totalPnLPercentage.toFixed(2)}%`);
        }
    } catch (error) {
        console.error('❌ FAILED:', error instanceof Error ? error.message : error);
    }

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  TEST COMPLETE!                                      ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    console.log('📝 Next Steps:');
    console.log('   1. If all tests passed: Integration is working! ✅');
    console.log('   2. Start the dev server: npm run dev');
    console.log('   3. Test in the UI by connecting wallet and asking:');
    console.log('      - "Portfolio aku apa aja?"');
    console.log('      - "Token apa yang paling untung?"');
    console.log('');
}

// Run the test
testBlockchainIntegration().catch(console.error);