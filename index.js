#!/usr/bin/env node

/**
 * Solana DEX Arbitrage Bot - Railway Deployment
 * Monitors volatile tokens for arbitrage opportunities
 */

require('dotenv').config();
const { Connection } = require('@solana/web3.js');
const { createJupiterApiClient } = require('@jup-ag/api');

// Configuration
const CONFIG = {
  RPC_URL: process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=d2822933-6756-4658-9dd2-9351af0300d3',
  MIN_SPREAD_PCT: parseFloat(process.env.MIN_SPREAD_PCT || '0.6'),
  TRADE_AMOUNT_USDC: parseInt(process.env.TRADE_AMOUNT_USDC || '100000000'), // 100 USDC
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '10000'), // 10 seconds
};

// Token Mints
const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: 'So11111111111111111111111111111111111111112',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
};

const MONITORED_TOKENS = [
  {
    symbol: 'SOL',
    mint: TOKENS.SOL,
    decimals: 9,
    name: 'Solana',
  },
  {
    symbol: 'JUP',
    mint: TOKENS.JUP,
    decimals: 6,
    name: 'Jupiter',
  },
  {
    symbol: 'RAY',
    mint: TOKENS.RAY,
    decimals: 6,
    name: 'Raydium',
  },
];

// Statistics
const stats = {
  totalChecks: 0,
  opportunitiesFound: 0,
  errors: 0,
  lastOpportunity: null,
  startTime: Date.now(),
};

console.log('🚀 Solana DEX Arbitrage Bot - LIVE');
console.log('==================================================\n');
console.log('Configuration:');
console.log(`  Min Spread: ${CONFIG.MIN_SPREAD_PCT}%`);
console.log(`  Trade Amount: ${CONFIG.TRADE_AMOUNT_USDC / 1e6} USDC`);
console.log(`  Poll Interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`);
console.log(`  Monitoring ${MONITORED_TOKENS.length} tokens\n`);
console.log('API: Jupiter v6');
console.log('==================================================\n');

// Initialize Solana connection
const connection = new Connection(CONFIG.RPC_URL, 'confirmed');

// Initialize Jupiter API client
const jupiterQuoteApi = createJupiterApiClient();

/**
 * Get price from Jupiter Aggregator
 */
async function getJupiterPrice(inputMint, outputMint, amount) {
  try {
    const quote = await jupiterQuoteApi.quoteGet({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amount,
      slippageBps: 50
    });

    if (quote && quote.outAmount) {
      const outAmount = parseInt(quote.outAmount);
      const price = outAmount / amount;
      return {
        price,
        outAmount,
        priceImpact: parseFloat(quote.priceImpactPct || 0),
        route: quote.routePlan?.[0]?.swapInfo?.label || 'Unknown',
      };
    }
    return null;
  } catch (error) {
    if (error.message?.includes('No routes')) {
      console.log('  ⚠️  No route found');
    } else if (error.response?.status) {
      console.log(`  ⚠️  Jupiter Error: HTTP ${error.response.status}`);
    } else {
      console.log(`  ⚠️  Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Check arbitrage opportunity
 */
async function checkArbitrage(token) {
  const startTime = Date.now();
  
  console.log(`\n📊 Checking ${token.symbol}...`);
  
  try {
    // Buy with USDC
    const buyQuote = await getJupiterPrice(
      TOKENS.USDC,
      token.mint,
      CONFIG.TRADE_AMOUNT_USDC
    );

    if (!buyQuote) {
      console.log(`  ❌ No buy quote`);
      stats.errors++;
      return;
    }

    // Sell for USDC
    const sellQuote = await getJupiterPrice(
      token.mint,
      TOKENS.USDC,
      buyQuote.outAmount
    );

    if (!sellQuote) {
      console.log(`  ❌ No sell quote`);
      stats.errors++;
      return;
    }

    // Calculate
    const buyPrice = CONFIG.TRADE_AMOUNT_USDC / buyQuote.outAmount;
    const sellPrice = sellQuote.outAmount / buyQuote.outAmount;
    const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
    const netProfit = (sellQuote.outAmount - CONFIG.TRADE_AMOUNT_USDC) / 1e6;

    console.log(`  Buy: ${buyQuote.route}`);
    console.log(`  Sell: ${sellQuote.route}`);
    console.log(`  Spread: ${spread.toFixed(3)}%`);
    console.log(`  Profit: $${netProfit.toFixed(4)}`);
    console.log(`  Time: ${Date.now() - startTime}ms`);

    stats.totalChecks++;

    if (spread >= CONFIG.MIN_SPREAD_PCT && netProfit > 0) {
      stats.opportunitiesFound++;
      stats.lastOpportunity = {
        token: token.symbol,
        spread,
        profit: netProfit,
        time: new Date().toISOString(),
      };

      console.log(`\n🔥 ARBITRAGE OPPORTUNITY!`);
      console.log(`  Token: ${token.symbol}`);
      console.log(`  Spread: ${spread.toFixed(3)}%`);
      console.log(`  PROFIT: $${netProfit.toFixed(2)}\n`);
    } else {
      console.log(`  ℹ️  No opportunity`);
    }

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Print statistics
 */
function printStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;

  console.log('\n==================================================');
  console.log('📊 STATS');
  console.log('==================================================');
  console.log(`Runtime: ${minutes}m ${seconds}s`);
  console.log(`Checks: ${stats.totalChecks}`);
  console.log(`Opportunities: ${stats.opportunitiesFound}`);
  console.log(`Errors: ${stats.errors}`);

  if (stats.lastOpportunity) {
    console.log('\nLast Opportunity:');
    console.log(`  ${stats.lastOpportunity.token}: ${stats.lastOpportunity.spread.toFixed(2)}% ($${stats.lastOpportunity.profit.toFixed(2)})`);
  }

  console.log('==================================================\n');
}

/**
 * Main loop
 */
async function monitor() {
  console.log('🔍 Starting...\n');

  try {
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana v${version['solana-core']}\n`);
  } catch (error) {
    console.log(`⚠️  RPC issue: ${error.message}\n`);
  }

  while (true) {
    for (const token of MONITORED_TOKENS) {
      await checkArbitrage(token);
    }

    if (stats.totalChecks % 10 === 0 && stats.totalChecks > 0) {
      printStats();
    }

    await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL_MS));
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...\n');
  printStats();
  process.exit(0);
});

// Start
monitor().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
