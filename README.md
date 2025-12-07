# RWA DEX Arbitrage Bot - Railway Deployment

Monitors RWA tokens (OUSG, USYC) for arbitrage opportunities on Solana DEXs.

## Quick Deploy to Railway

### Option 1: Deploy via GitHub (Recommended)

1. **Create GitHub Repository**
   - Go to https://github.com/new
   - Name it: `rwa-arbitrage-bot`
   - Make it Private
   - Don't initialize with README
   - Click "Create repository"

2. **Push this code to GitHub**
   ```bash
   cd railway-deploy
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/rwa-arbitrage-bot.git
   git push -u origin main
   ```

3. **Deploy on Railway**
   - Go to https://railway.app
   - Click "Start a New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `rwa-arbitrage-bot` repository
   - Railway will auto-detect Node.js and deploy
   - Add environment variables in Railway dashboard:
     - `HELIUS_RPC_URL` = your Helius RPC URL
     - `MIN_SPREAD_PCT` = 0.6
     - `TRADE_AMOUNT_USDC` = 100000000
     - `POLL_INTERVAL_MS` = 10000

### Option 2: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Deploy**
   ```bash
   cd railway-deploy
   railway init
   railway up
   ```

4. **Set environment variables**
   ```bash
   railway variables set HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
   railway variables set MIN_SPREAD_PCT=0.6
   railway variables set TRADE_AMOUNT_USDC=100000000
   railway variables set POLL_INTERVAL_MS=10000
   ```

### Option 3: One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

## Environment Variables

- `HELIUS_RPC_URL` - Your Helius RPC endpoint
- `MIN_SPREAD_PCT` - Minimum spread % to trigger (default: 0.6)
- `TRADE_AMOUNT_USDC` - Trade size in lamports (default: 100 USDC)
- `POLL_INTERVAL_MS` - Check interval in ms (default: 10000)

## Monitoring

View logs in Railway dashboard:
- Click on your deployment
- Go to "Deployments" tab
- Click "View Logs"

## Cost

- **FREE**: $5 credit (no card needed)
- **Paid**: $5/month after credit runs out
- Runs 24/7 with no DNS blocks

## What It Does

1. Monitors OUSG and USYC tokens
2. Checks Jupiter for arbitrage opportunities
3. Logs profitable spreads > 0.6%
4. Calculates projected daily profit
5. Runs continuously in the cloud

## Next Steps

Once you see profitable opportunities:
1. Deploy the Anchor executor program
2. Add wallet private key
3. Enable real trading mode
