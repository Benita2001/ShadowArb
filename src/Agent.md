# ShadowArb — Agent Context

## What this project is
ShadowArb is an autonomous AI agent that finds arbitrage opportunities between prediction markets (Polymarket, Kalshi, Manifold), executes trades privately using commit-reveal on Arc testnet, and settles in USDC via Circle Developer-Controlled Wallets.

Built for the Agora x Arc x Circle Hackathon 2025.

## Privacy mechanism
Commit-reveal pattern: agent hashes trade details and posts to Arc BEFORE executing. After settlement, full details are revealed and verifiable. Nobody can front-run or copy the trade while it is live.

## Stack
- Runtime: Node.js v24, TypeScript
- Blockchain: Arc testnet (Chain ID: 5042002) via viem
- Wallets: Circle Developer-Controlled Wallets SDK
- Agent identity: ERC-8004 (IdentityRegistry, ReputationRegistry)
- Job contracts: ERC-8183 (AgenticCommerce)
- Price data: Polymarket API, Kalshi API, Manifold API
- LLM decisions: Claude (Anthropic) via API
- Frontend: Next.js 15 + Tailwind
- Database: Supabase
- Deploy: Railway

## Contract addresses (Arc testnet)
- IdentityRegistry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
- ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713
- ValidationRegistry: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272
- AgenticCommerce (ERC-8183): 0x0747EEf0706327138c69792bF28Cd525089e4583
- USDC on Arc: 0x3600000000000000000000000000000000000000

## Wallet roles
- Owner wallet: registers agent identity, creates job contracts, executes trades
- Validator wallet: records reputation scores after each trade

## File structure


src/ identity.ts — ERC-8004 agent registration + reputation scanner.ts — scans Polymarket, Kalshi, Manifold for arb opportunities agent.ts — Claude LLM decides whether to execute each opportunity jobs.ts — ERC-8183 job lifecycle (create, fund, submit, complete) commit.ts — commit-reveal privacy mechanic on Arc


## Agent loop
1. Scanner finds price gap across markets
2. Claude evaluates: is this profitable after fees?
3. Commit: hash trade details, post to Arc
4. Execute: place trade via market API
5. Reveal: publish full trade details
6. Job: submit deliverable, complete, USDC settles
7. Reputation: validator records score on ERC-8004
8. Loop back to step 1

## Environment variables needed
- CIRCLE_API_KEY
- CIRCLE_ENTITY_SECRET
- ARC_RPC_URL
- ANTHROPIC_API_KEY
- WALLET_SET_ID
- OWNER_WALLET_ID
- OWNER_ADDRESS
- VALIDATOR_WALLET_ID
- VALIDATOR_ADDRESS
- AGENT_ID (set after registration)

## Build rules
- Prototype hardest part first
- Validate foundation before building on it
- One fix at a time
- Commit before moving on
- Loading states on all async operations


