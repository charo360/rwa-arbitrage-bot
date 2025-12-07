#!/usr/bin/env node

/**
 * RWA DEX Arbitrage Bot - Railway Deployment
 * Monitors RWA tokens for arbitrage opportunities on Solana
 */

require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

// Configuration
const CONFIG = {
  RPC_URL: process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=d2822933-6756-4658-9dd2-9351af0300d3',
  MIN_SPREAD_PCT: parseFloat(process.env.MIN_SPREAD_PCT || '0.6'),
  TRADE_AMOUNT_USDC: parseInt(process.env.TRADE_AMOUNT_USDC || '100000000'), // 100 USDC
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '10000'), // 10 seconds
};

// RWA Token Mints
const TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  OUSG: 'i7u4r16TcsJTgq1kAG8opmVZyVnAKBwLKu6ZPMwzxNc', // Ondo US Treasuries
  USYC: 'BxJGT2EQxJhFNpJZqKQjqGdqXXnRqECHPqLhNvLgqvQF', // Hashnote USYC
};

const RWA_TOKENS = [
  { 
    symbol: 'OUSG', 
    mint: TOKENS.OUSG, 
    decimals: 6, 
    name: 'Ondo US Treasuries',
  },
  { 
    symbol: 'USYC', 
    mint: TOKENS.USYC, 
    decimals: 6, 
    name: 'Hashnote USYC',
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

console.log('🚀 RWA DEX Arbitrage Bot - Railway Deployment');
console.log('==================================================\n');
console.log('Configuration:');
console.log(`  Min Spread: ${CONFIG.MIN_SPREAD_PCT}%`);
console.log(`  Trade Amount: ${CONFIG.TRADE_AMOUNT_USDC / 1e6} USDC`);
console.log(`  Poll Interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`);
console.log(`  Monitoring ${RWA_TOKENS.length} RWA tokens\n`);
console.log('API: Jupiter v6 (Solana flash loans)');
console.log('==================================================\n');

// Initialize Solana connection
const connection = new Connection(CONFIG.RPC_URL, 'confirmed');

/**
 * Get price from Jupiter Aggregator
 */
async function getJupiterPrice(inputMint, outputMint, amount) {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (RWA-Bot/1.0)'
      }
    });

    if (response.data && response.data.outAmount) {
      const outAmount = parseInt(response.data.outAmount);
      const price = outAmount / amount;
      return {
        price,
        outAmount,
        priceImpact: parseFloat(response.data.priceImpactPct || 0),
        route: response.data.routePlan?.[0]?.swapInfo?.label || 'Unknown',
      };
    }
    return null;
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.log('  ⚠️  DNS Error - Jupiter API unreachable');
    } else if (error.response?.status === 404) {
      console.log('  ⚠️  No route found (low liquidity)');
    } else {
      console.log(`  ⚠️  Jupiter Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Check arbitrage opportunity
 */
async function checkArbitrage(token) {
  const startTime = Date.now();
  
  console.log(`\n📊 Checking ${token.symbol} arbitrage...`);
  
  try {
    // Get quote: Buy RWA with USDC
    const buyQuote = await getJupiterPrice(
      TOKENS.USDC,
      token.mint,
      CONFIG.TRADE_AMOUNT_USDC
    );

    if (!buyQuote) {
      console.log(`  ❌ Could not get buy quote for ${token.symbol}`);
      stats.errors++;
      return;
    }

    // Get quote: Sell RWA for USDC
    const sellQuote = await getJupiterPrice(
      token.mint,
      TOKENS.USDC,
      buyQuote.outAmount
    );

    if (!sellQuote) {
      console.log(`  ❌ Could not get sell quote for ${token.symbol}`);
      stats.errors++;
      return;
    }

    // Calculate prices and spread
    const buyPrice = CONFIG.TRADE_AMOUNT_USDC / buyQuote.outAmount;
    const sellPrice = sellQuote.outAmount / buyQuote.outAmount;
    const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
    const netProfit = (sellQuote.outAmount - CONFIG.TRADE_AMOUNT_USDC) / 1e6;

    console.log(`  Buy Route: ${buyQuote.route}`);
    console.log(`  Sell Route: ${sellQuote.route}`);
    console.log(`  Buy Price: $${buyPrice.toFixed(4)}`);
    console.log(`  Sell Price: $${sellPrice.toFixed(4)}`);
    console.log(`  Spread: ${spread.toFixed(3)}%`);
    console.log(`  Net Profit: $${netProfit.toFixed(4)}`);
    console.log(`  Check Time: ${Date.now() - startTime}ms`);

    stats.totalChecks++;

    // Check if profitable
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
      console.log(`  Strategy: Buy ${buyQuote.route} → Sell ${sellQuote.route}`);
      console.log(`  Spread: ${spread.toFixed(3)}%`);
      console.log(`  NET PROFIT: $${netProfit.toFixed(2)}`);
      console.log(`  ⚠️  SIMULATION MODE\n`);
    } else {
      console.log(`  ℹ️  No opportunity (spread < ${CONFIG.MIN_SPREAD_PCT}%)`);
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
  console.log('📊 SESSION STATISTICS');
  console.log('==================================================');
  console.log(`Runtime: ${minutes}m ${seconds}s`);
  console.log(`Total Checks: ${stats.totalChecks}`);
  console.log(`Opportunities: ${stats.opportunitiesFound}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Success Rate: ${stats.totalChecks > 0 ? ((stats.opportunitiesFound / stats.totalChecks) * 100).toFixed(1) : 0}%`);

  if (stats.lastOpportunity) {
    console.log('\nLast Opportunity:');
    console.log(`  Token: ${stats.lastOpportunity.token}`);
    console.log(`  Spread: ${stats.lastOpportunity.spread.toFixed(2)}%`);
    console.log(`  Profit: $${stats.lastOpportunity.profit.toFixed(4)}`);
    console.log(`  Time: ${stats.lastOpportunity.time}`);
  }

  if (stats.opportunitiesFound > 0 && runtime > 0) {
    const opportunitiesPerHour = (stats.opportunitiesFound / runtime) * 3600;
    const avgProfit = stats.lastOpportunity ? stats.lastOpportunity.profit : 0;
    const dailyProfit = opportunitiesPerHour * 24 * avgProfit;
    console.log(`\n💰 Projected Daily: $${dailyProfit.toFixed(2)}`);
  }

  console.log('==================================================\n');
}

/**
 * Main monitoring loop
 */
async function monitor() {
  console.log('🔍 Starting monitoring loop...\n');

  // Check Solana connection
  try {
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana (v${version['solana-core']})\n`);
  } catch (error) {
    console.log(`⚠️  RPC connection issue: ${error.message}\n`);
  }

  // Main loop
  while (true) {
    for (const token of RWA_TOKENS) {
      await checkArbitrage(token);
    }

    // Print stats every 10 checks
    if (stats.totalChecks % 10 === 0 && stats.totalChecks > 0) {
      printStats();
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL_MS));
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...\n');
  printStats();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down...\n');
  printStats();
  process.exit(0);
});

// Start monitoring
monitor().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
