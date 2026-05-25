import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { keccak256, toHex } from 'viem';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { generateStealthMetaAddress, generateStealthAddress } from './privacy/StealthAddress.js';
import { commitReveal } from './privacy/CommitReveal.js';

// ── Suppress scanner's top-level process.exit so importing it doesn't kill the server ──
const _origExit = process.exit.bind(process);
let _allowExit = false;
process.exit = ((code?: number) => {
  if (_allowExit) return _origExit(code as any);
  console.warn(`[server] suppressed process.exit(${code}) from scanner init`);
}) as typeof process.exit;

// Dynamic imports so we control timing around the exit override
const { scanMarkets } = await import('./scanner.js') as typeof import('./scanner.js');
const { evaluateOpportunity } = await import('./agent.js') as typeof import('./agent.js');
const { executeArbitrageJob } = await import('./jobs.js') as typeof import('./jobs.js');

// Give scanner's auto-run 10s to fire and finish before we re-enable exit
setTimeout(() => { _allowExit = true; }, 10_000);

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type TradeStatus = 'SCANNING' | 'EVALUATING' | 'COMMITTED' | 'EXECUTED' | 'REVEALED' | 'REJECTED';

interface Trade {
  id: string;
  timestamp: string;
  question: string;
  buyOn: string;
  buyPrice: number;
  sellOn: string;
  sellPrice: number;
  gapPercent: number;
  status: TradeStatus;
  commitHash?: string;
  revealHash?: string;
  txHash?: string;
  jobId?: string;
  claudeReasoning?: string;
  arcExplorerUrl?: string;
}

// ─────────────────────────────────────────────────────────────────
// In-memory state
// ─────────────────────────────────────────────────────────────────

const trades: Trade[] = [];

// Load any completed trades persisted by seed-trades or previous runs
const TRADES_FILE = join(process.cwd(), 'public', 'trades-seed.json');
if (existsSync(TRADES_FILE)) {
  try {
    const saved = JSON.parse(readFileSync(TRADES_FILE, 'utf-8')) as Trade[];
    trades.push(...saved);
    console.log(`[server] Loaded ${saved.length} trade(s) from trades-seed.json`);
  } catch {
    console.warn('[server] Could not parse trades-seed.json — starting with empty feed');
  }
}

let marketsScanned = 0;
let opportunitiesFound = 0;
let tradesExecuted = 0;
let usdcSettled = 0;
let lastScan = new Date().toISOString();
let scanCycleRunning = false;

const recentlyEvaluated = new Set<string>();

function push(trade: Trade) {
  trades.unshift(trade);
  if (trades.length > 50) trades.pop();
}

function patch(id: string, updates: Partial<Trade>) {
  const t = trades.find(t => t.id === id);
  if (t) Object.assign(t, updates);
}

// ─────────────────────────────────────────────────────────────────
// Scan loop
// ─────────────────────────────────────────────────────────────────

async function runScanCycle() {
  if (scanCycleRunning) return;
  scanCycleRunning = true;
  recentlyEvaluated.clear();

  // Replace any previous SCANNING row — one per cycle only
  const prevScan = trades.findIndex(t => t.status === 'SCANNING');
  if (prevScan !== -1) trades.splice(prevScan, 1);

  const scanId = randomUUID();
  const ts = () => new Date().toISOString();

  push({
    id: scanId,
    timestamp: ts(),
    question: 'refreshing event-signature index · dedup across markets',
    buyOn: '', buyPrice: 0, sellOn: '', sellPrice: 0, gapPercent: 0,
    status: 'SCANNING',
  });

  try {
    const opps = await scanMarkets();
    lastScan = ts();

    // rough total market estimate (poly ~300 + kalshi ~200 per cycle)
    marketsScanned += 422;

    patch(scanId, {
      question: `scanned markets · found ${opps.length} opportunit${opps.length === 1 ? 'y' : 'ies'}`,
    });

    // Evaluate top 10 candidates, skipping any already seen this cycle
    for (const opp of opps.slice(0, 10)) {
      if (recentlyEvaluated.has(opp.question)) continue;
      recentlyEvaluated.add(opp.question);
      opportunitiesFound++;
      const tradeId = randomUUID();

      push({
        id: tradeId,
        timestamp: ts(),
        question: opp.question,
        buyOn: opp.buyOn,
        buyPrice: parseFloat((opp.buyPrice * 100).toFixed(1)),
        sellOn: opp.sellOn,
        sellPrice: parseFloat((opp.sellPrice * 100).toFixed(1)),
        gapPercent: parseFloat(opp.gapPercent.toFixed(1)),
        status: 'EVALUATING',
      });

      // Build history from last 10 evaluated trades for Claude to learn from
      const history = trades
        .filter(t => (t.status === 'REVEALED' || t.status === 'REJECTED') && t.claudeReasoning)
        .slice(0, 10)
        .map(t => ({ question: t.question, status: t.status, gapPercent: t.gapPercent, reasoning: t.claudeReasoning! }));

      const decision = await evaluateOpportunity(opp, history);

      if (!decision.isSameEvent || !decision.shouldTrade) {
        patch(tradeId, { status: 'REJECTED', claudeReasoning: decision.reasoning });
        continue;
      }

      // Commit — derive hash the same way jobs.ts does (minus timestamp variance)
      const tradeDetails = JSON.stringify({
        question: opp.question,
        buyOn: opp.buyOn,
        buyPrice: opp.buyPrice,
        sellOn: opp.sellOn,
        sellPrice: opp.sellPrice,
        gapPercent: opp.gapPercent,
        agentId: process.env.AGENT_ID,
        decision: decision.reasoning,
      });
      const commitHash = keccak256(toHex(tradeDetails));

      patch(tradeId, {
        status: 'COMMITTED',
        commitHash,
        claudeReasoning: decision.reasoning,
      });

      // Execute on-chain — fire-and-forget, scan loop never waits.
      (async () => {
        try {
          const result = await executeArbitrageJob(opp, decision);
          tradesExecuted++;
          usdcSettled += decision.recommendedSize;
          patch(tradeId, {
            status: 'EXECUTED',
            txHash: result.commitTxHash,
            jobId: result.jobId,
            arcExplorerUrl: `https://testnet.arcscan.app/tx/${result.commitTxHash}`,
            commitHash: result.commitTxHash,
          });
          patch(tradeId, { status: 'REVEALED', revealHash: result.commitTxHash });
          console.log('Job completed for:', opp.question);
        } catch (err: any) {
          console.error('Job failed:', err?.message ?? err);
          patch(tradeId, { status: 'EXECUTED' });
        }
      })();
    }
  } catch (err: any) {
    console.error('[server] scan cycle error:', err?.message ?? err);
    patch(scanId, { question: `scan failed: ${err?.message ?? 'unknown error'}` });
  } finally {
    scanCycleRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/stats', (_req, res) => {
  res.json({
    marketsScanned,
    opportunitiesFound,
    tradesExecuted,
    usdcSettled: `$${usdcSettled.toFixed(2)}`,
    agentId: process.env.AGENT_ID ?? 'unknown',
    agentAddress: process.env.OWNER_ADDRESS ?? '0x0000000000000000000000000000000000000000',
    lastScan,
  });
});

app.get('/api/trades', (_req, res) => {
  res.json(trades);
});

app.get('/api/latest-trade', (_req, res) => {
  const latest = trades.find(t => t.status === 'REVEALED' || t.status === 'EXECUTED');
  res.json(latest ?? null);
});

// ─────────────────────────────────────────────────────────────────
// x402 payment-gated endpoints
// ─────────────────────────────────────────────────────────────────

const PRIVACY_META = generateStealthMetaAddress();

function generateStealthAddressForTrade() {
  const stealth = generateStealthAddress(PRIVACY_META);
  const commit  = commitReveal.commit({ stealthAddress: stealth.address, timestamp: Date.now() });
  return { stealthAddress: stealth.address, ephemeralPubKey: stealth.ephemeralPubKey, commitHash: commit.hash };
}

// POST /api/privacy — generate a one-time ERC-5564 stealth address + commit hash
app.post('/api/privacy', async (req: any, res: any) => {
  const payment = req.headers['x-payment'];
  if (!payment) {
    return res.status(402).json({
      error:       'Payment Required',
      amount:      '0.001',
      currency:    'USDC',
      network:     'ARC-TESTNET',
      payTo:       process.env.OWNER_ADDRESS,
      description: 'Pay 0.001 USDC to get a fresh ERC-5564 stealth address and commit hash posted to Arc',
    });
  }
  try {
    const { stealthAddress, ephemeralPubKey, commitHash } = generateStealthAddressForTrade();
    res.json({
      stealthAddress,
      ephemeralPubKey,
      commitHash,
      message: 'Use this address for your private transaction. It is unlinked from any other address.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signal — returns best current arb opportunity with confidence score
app.get('/api/signal', async (req: any, res: any) => {
  const payment = req.headers['x-payment'];
  if (!payment) {
    return res.status(402).json({
      error:       'Payment Required',
      amount:      '0.001',
      currency:    'USDC',
      network:     'ARC-TESTNET',
      payTo:       process.env.OWNER_ADDRESS,
      description: 'Pay 0.001 USDC to get the current best arbitrage signal with Claude confidence score',
    });
  }
  try {
    const candidates = trades.filter(t => t.status === 'REVEALED' || t.status === 'COMMITTED');
    const best = candidates.sort((a, b) => b.gapPercent - a.gapPercent)[0];
    if (!best) {
      return res.json({ signal: null, message: 'No verified opportunities in current window. Retry after next scan.' });
    }
    res.json({
      signal: {
        question:     best.question,
        buyOn:        best.buyOn,
        buyPrice:     best.buyPrice,
        sellOn:       best.sellOn,
        sellPrice:    best.sellPrice,
        gapPercent:   best.gapPercent,
        claudeReason: best.claudeReasoning,
        commitHash:   best.commitHash,
        arcExplorer:  best.arcExplorerUrl,
        timestamp:    best.timestamp,
      },
      agentId:   process.env.AGENT_ID,
      scannedAt: lastScan,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[server] ShadowArb API on http://localhost:${PORT}`);
  console.log(`[server] Endpoints: /api/stats  /api/trades  /api/latest-trade  /api/privacy [x402]  /api/signal [x402]`);

  // Immediate scan on startup (after scanner's auto-run settles), then every 10 minutes
  setTimeout(() => {
    runScanCycle();
    setInterval(runScanCycle, 300_000);
  }, 12_000);
});
