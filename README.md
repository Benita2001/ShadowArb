# ShadowArb

**Privacy-native autonomous trading agent**

*Your strategy stays dark until after it wins.*

[![npm](https://img.shields.io/badge/@shadowarb/sdk-privacy--native-00ff88?style=flat-square)](https://github.com/Benita2001/ShadowArb)
[![License: MIT](https://img.shields.io/badge/license-MIT-white?style=flat-square)](LICENSE)
[![Built for Agora Agents 2026](https://img.shields.io/badge/built%20for-Agora%20Agents%202026-cyan?style=flat-square)](https://thecanteenapp.com)
[![Settlement: Arc](https://img.shields.io/badge/settles%20on-Arc-blue?style=flat-square)](https://docs.arc.network)
[![Privacy: ERC-5564](https://img.shields.io/badge/privacy-ERC--5564-green?style=flat-square)](https://eips.ethereum.org/EIPS/eip-5564)

---

## The pitch in one paragraph

Every AI trading agent today has a fatal flaw — the moment it acts, its strategy is visible to everyone. Competitors see the move, copy it, or front-run it before the trade lands. ShadowArb fixes this with three independent privacy layers: **ERC-5564 stealth addresses** so no trade is linked to another, **commit-reveal on Arc** so the strategy is sealed before execution and proven after, and **ArcaneVM** which auto-activates when Arc's native confidential transfers launch. One SDK call wraps any trading agent with all three layers. Pay per trade with x402 if you only need privacy once.

```typescript
import { ShadowAgent, PolymarketAdapter, KalshiAdapter } from '@shadowarb/sdk'

const agent = new ShadowAgent({
  circleApiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  arcRpcUrl:    process.env.ARC_RPC_URL,
})

agent.addMarket(new PolymarketAdapter())
agent.addMarket(new KalshiAdapter())
agent.start()
// every trade now executes from a fresh stealth address
// strategy sealed on Arc before execution
// proven verifiable after settlement
```

---

## Why this matters

| Without ShadowArb | With ShadowArb |
|---|---|
| Trade from same wallet — full history visible | Fresh ERC-5564 stealth address every trade — zero linkage |
| Strategy visible the moment you act | keccak256 commit sealed on Arc BEFORE execution |
| Competitors front-run or copy your edge | By the time anyone knows your strategy, the trade is settled |
| No proof you weren't using insider info | On-chain timestamp proves decision pre-dated execution |
| No compliance trail | Auditors verify proofs independently — no trust required |
| Idle USDC between trades earns 0% | USYC integration on roadmap — capital works while agent waits |

---

## Privacy architecture

ShadowArb implements three independent privacy layers. Each solves a different problem. Together they form a complete privacy stack.

### Layer 1 — ERC-5564 Stealth Addresses

Each trade executes from a fresh one-time wallet derived via ECDH on the agent's viewing key. On-chain, every trade appears to come from a different, unrelated address. No persistent identity. No pattern recognition possible. No wallet clustering.

```
Master agent key
      ↓ ECDH with ephemeral key
Fresh stealth address (0x0fb7af1a4edc...)
      ↓ funded with exact USDC needed
Trade executes from stealth address
      ↓ remaining USDC sweeps back
Stealth address discarded — never used again
```

Announcement posted on-chain so the agent can scan and recover its own stealth transactions using the viewing key. Nobody else can.

### Layer 2 — Commit-Reveal on Arc

Strategy sealed as `keccak256(tradeDetails)` BEFORE execution. The hash is timestamped on Arc. Nobody knows what it means until the reveal.

```
T=0:00  COMMIT posted to Arc
        hash: 0xdf27723ec012...
        meaningless to anyone watching

T=0:05  TRADE executes from stealth address
        visible on-chain — but nobody knows why

T=0:10  REVEAL published
        keccak256(tradeDetails) === commitHash ✓
        proof: strategy existed before execution
```

This solves compliance. A regulator can independently verify using nothing but a hash function that the AI made its decision before the outcome was known.

### Layer 3 — ArcaneVM (Forward Compatible)

```typescript
// src/privacy/ArcaneVM.ts
// When Arc's native confidential transfers launch,
// this module auto-activates.
// Amounts hidden. State hidden.
// Combined with ERC-5564 + commit-reveal = full privacy stack.
```

ShadowArb is architected to upgrade automatically no migration needed.

---

## Why not just use ArcaneVM?

| Privacy problem | Solution |
|---|---|
| Hide trade amounts | ArcaneVM (confidential transfers) |
| Hide on-chain identity | ERC-5564 stealth addresses |
| Prove decision timing | Commit-reveal on Arc |

These are three different cryptographic problems. None replaces the others. When ArcaneVM launches, ShadowArb uses all three simultaneously.

---

## The agent

ShadowArb Agent is a fully autonomous AI agent 

```
PERCEPTION      COGNITION           ACTION
──────────      ──────────          ──────
Polymarket  →   Claude AI       →   Generate stealth address
Kalshi          evaluates           Post commit hash to Arc
420+ markets    opportunity         Execute from stealth wallet
cross-indexed   Learns from         Reveal after settlement
by event        last 10 outcomes    Update ERC-8004 reputation
signature       Decides when        Loop
                NOT to trade
```

The agent maintains a verified on-chain track record via ERC-8004. Every correct pre-committed decision raises the reputation score. Nobody can fake it. It is on-chain forever.

---

## SDK

Any trading agent gets all three privacy layers in a single installation.

```bash
npm install @shadowarb/sdk
```

```typescript
import { ShadowAgent } from '@shadowarb/sdk'
import { PolymarketAdapter } from '@shadowarb/sdk/adapters'

const agent = new ShadowAgent({
  circleApiKey:      '...',
  entitySecret:      '...',
  arcRpcUrl:         '...',
  anthropicApiKey:   '...',
  ownerWalletId:     '...',
  validatorWalletId: '...',
  agentId:           '...',
})

agent.addMarket(new PolymarketAdapter())

agent.onCommit(({ commitHash, stealthAddress }) => {
  console.log('Strategy sealed:', commitHash)
  console.log('Trade will execute from:', stealthAddress)
})

agent.onReveal(({ verified }) => {
  console.log('Proof verified:', verified) // true always
})

agent.start()
```

### MarketAdapter interface

Build adapters for any market:

```typescript
interface MarketAdapter {
  name: string
  scan(): Promise<Opportunity[]>
  execute(opp: Opportunity, stealthAddress: string): Promise<Receipt>
}

// implemented: PolymarketAdapter, KalshiAdapter
// coming: HyperliquidAdapter, UniswapAdapter
```

---

## x402 Privacy-as-a-Service

Pay per transaction. No SDK install required.

```bash
# Get a fresh ERC-5564 stealth address for one trade
curl -X POST https://shadowarb.vercel.app/api/privacy \
  -H "x-payment: <0.001 USDC on Arc>"

# Response
{
  "stealthAddress": "0x4039953297a5b4f1f08116eea4f51da10839b997",
  "ephemeralPubKey": "033669b8c4a8b06b79991ffaef53fa9a3fd15423e93ca6ee73b487f3e77bd64750",
  "commitHash": "0x4e656ccdb706ac9126cf0cc5a38dc56b3ea1faccd0379b1aad7f494cd0c6743f",
  "message": "Use this address for your private transaction. It is unlinked from any other address."
}
```

---

## Live on Arc Testnet

Agent: [0x253b...d72e](https://testnet.arcscan.app/address/0x253b793cd09f756e7fa33f07b50cf664a532d72e) · Agent ID: 20235 (ERC-8004)

| Event | Transaction |
|---|---|
| Agent identity registered (ERC-8004) | [0xec8c76c1...](https://testnet.arcscan.app/tx/0xec8c76c1868ada76790f78b0fbc9760aaa712abf5c4ce71f23e4bfb7d306d57a) |
| Reputation recorded | [0xe18d32f4...](https://testnet.arcscan.app/tx/0xe18d32f4cc19416c1e4debf48f8b3614f31e481b3bdce9bbb8f466dc3505b883) |
| Commit hash sealed on Arc | [0xdc078015...](https://testnet.arcscan.app/tx/0xdc07801538a7ac51df147b68e9ed5dfa51a70b2a1a627f9522ca1ffcfeea15f5) |
| ERC-8183 job created | [0x691bdaba...](https://testnet.arcscan.app/tx/0x691bdaba9d6ff93144f9ce0576928b1c1bb79f9c109b624dfc8453eeec582d74) |
| USDC escrow funded | [0x5e1814fb...](https://testnet.arcscan.app/tx/0x5e1814fbfd2963fdc0befa4f416f5c4d415155a9cd9bf5dc36e8a2d5ca5d2b57) |
| Deliverable submitted | [0xd232bede...](https://testnet.arcscan.app/tx/0xd232bedeeff90ddd737249fcefc4346650b57d48dfc1c7de003532549c278ef5) |
| Job completed and USDC settled | [0x35e239bf...](https://testnet.arcscan.app/tx/0x35e239bfd458eb1aa3d92a71f2ecad69db82192c0fdc96122d4df884f1043eb0) |
| ERC-5564 stealth trade | [0x70fcb33e...](https://testnet.arcscan.app/tx/0x70fcb33e09844fcb1db7381639132bb81d1b2deea137973509bc8358f5b87c03) |
| ERC-8183 job #48965 | [0x8ba35f91...](https://testnet.arcscan.app/tx/0x8ba35f91002d433f0c9b6c1210689205ba518d9325489916d0c1f80d3001b731) |

**Commit hash:** `0xdf27723ec0122016aa25ca4292014d640f95550da3387b282a807cd8011c2392`
**Reveal hash:** `0xdf27723ec0122016aa25ca4292014d640f95550da3387b282a807cd8011c2392`
**Match: ✓** strategy was sealed before execution.

---

## How Circle and Arc tools are used

| Tool | Why |
|---|---|
| Circle Developer-Controlled Wallets | Agent holds and moves USDC without human approval. Genuinely autonomous. |
| USDC on Arc | Native settlement. Every commit, job, and fee in USDC. No volatile gas token. |
| ERC-8004 IdentityRegistry | Agent has on-chain identity and verifiable reputation. Score updates after every trade. |
| ERC-8183 AgenticCommerce | Full job lifecycle per trade — create, fund escrow, submit, complete, settle. All autonomous. |
| Arc testnet via Canteen RPC | Commit hashes and reputation updates posted here. Privacy proof lives on-chain. |

---

## A note on privacy

Arc's native confidential transfers (ArcaneVM) are on the roadmap and not yet live. ShadowArb is designed to run on that system the moment it launches. Today we implement the same privacy guarantees using ERC-5564 stealth addresses and commit-reveal.

The architectures are complementary:
- ArcaneVM hides **amounts**
- ERC-5564 hides **identity**
- Commit-reveal proves **timing**

When ArcaneVM launches, ShadowArb upgrades by activating the ArcaneVM module automatically. The rest of the stack is unchanged.

---

## Roadmap

- USYC integration — idle USDC between trades earns yield in Circle's tokenized money market fund
- ArcaneVM activation — auto-activates when Arc confidential transfers go live
- HyperliquidAdapter — extend privacy to perp markets
- UniswapAdapter — DEX arbitrage with full privacy stack
- Full ERC-5564 on-chain announcements — scan registry contract

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHADOWARB                                │
│                                                                 │
│  MARKETS              INTELLIGENCE          PRIVACY             │
│  ────────             ───────────          ─────────            │
│  Polymarket   →       Claude AI        →   ERC-5564 stealth     │
│  Kalshi               evaluates            Commit hash → Arc    │
│  [any market]         learns from          ArcaneVM (ready)     │
│                       last 10 trades                            │
│                                            SETTLEMENT           │
│                                            ───────────          │
│                                            Circle Wallets       │
│                                            ERC-8183 jobs        │
│                                            ERC-8004 reputation  │
│                                                                 │
│  SDK                  x402                                      │
│  ───                  ────                                      │
│  @shadowarb/sdk       POST /api/privacy                         │
│  any agent installs   0.001 USDC per tx                         │
│  gets all 3 layers    GET /api/signal                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository layout

```
ShadowArb/
├── README.md
├── src/
│   ├── privacy/
│   │   ├── StealthAddress.ts     ← ERC-5564 implementation
│   │   ├── CommitReveal.ts       ← commit-reveal primitive
│   │   └── ArcaneVM.ts           ← forward-compatible stub
│   ├── sdk/
│   │   ├── ShadowAgent.ts        ← main SDK entry point
│   │   └── adapters/
│   │       ├── MarketAdapter.ts  ← interface
│   │       ├── PolymarketAdapter.ts
│   │       └── KalshiAdapter.ts
│   ├── agent.ts                  ← Claude AI evaluation
│   ├── scanner.ts                ← market price scanner
│   ├── jobs.ts                   ← ERC-8183 job lifecycle
│   ├── identity.ts               ← ERC-8004 registration
│   ├── server.ts                 ← Express API + x402 endpoints
│   └── main.ts                   ← full autonomous pipeline
├── app/                          ← Next.js 15 frontend
│   ├── page.tsx                  ← landing page
│   └── terminal/
│       └── page.tsx              ← live agent dashboard
└── public/                       ← static assets + mascot
```

---

## Quick start

Prerequisites: Node.js v22+, Arc CLI, Circle developer account

```bash
git clone https://github.com/Benita2001/ShadowArb
cd ShadowArb
npm install
```

Create `.env`:

```
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=0x...
ARC_RPC_URL=https://rpc.testnet.arc-node.thecanteenapp.com/v1/...
ANTHROPIC_API_KEY=sk-ant-...
OWNER_WALLET_ID=...
OWNER_ADDRESS=0x...
VALIDATOR_WALLET_ID=...
VALIDATOR_ADDRESS=0x...
AGENT_ID=20235
```

Register agent identity:

```bash
npx tsx --env-file=.env src/identity.ts
```

Run full autonomous pipeline:

```bash
npx tsx --env-file=.env src/main.ts
```

Run API server:

```bash
npm run server
```

Run Next.js frontend:

```bash
npm run dev
```

---

## Hackathon judging criteria

| Criterion (weight) | ShadowArb |
|---|---|
| Agentic sophistication 30% | Claude AI decides every trade by learning from history. ERC-8183 full job lifecycle autonomous. Two-wallet ERC-8004 with live reputation. Decides when NOT to trade. |
| Traction 30% | Real Arc transactions verifiable on explorer. Real prices from live APIs. @shadowarb/sdk lets any agent install privacy in minutes. x402 pay-per-transaction. |
| Circle tool usage 20% | Developer-Controlled Wallets, USDC, ERC-8004, ERC-8183 — all genuine, not forced. |
| Innovation 20% | First trading agent with ERC-5564 stealth addresses + commit-reveal + ArcaneVM readiness. Proof-of-intelligence on-chain. |

---

## Status

| Component | State |
|---|---|
| ERC-5564 stealth addresses | Live — fresh address per trade |
| Commit-reveal on Arc | Live — real TX hashes verifiable |
| ERC-8004 agent identity | Live — Agent ID 20235 |
| ERC-8183 job lifecycle | Live — Job #48965 settled |
| Claude AI evaluation | Live — learns from last 10 trades |
| @shadowarb/sdk | Shipped — PolymarketAdapter, KalshiAdapter |
| x402 privacy endpoint | Live — POST /api/privacy |
| x402 signal endpoint | Live — GET /api/signal |
| Next.js frontend | Live — wagmi wallet connection |
| ArcaneVM | Roadmap — auto-activates when Arc ships |
| USYC yield | Roadmap |

---

Built for the **Agora × Arc × Circle Hackathon 2026** by [@0xbeni](https://x.com/0xbeni)
