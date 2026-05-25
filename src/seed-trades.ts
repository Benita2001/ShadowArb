import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { executeArbitrageJob } from './jobs.js';
import type { ArbOpportunity, Market } from './scanner.js';
import type { AgentDecision } from './agent.js';

const TRADES_FILE = join(process.cwd(), 'public', 'trades-seed.json');

const decision: AgentDecision = {
  shouldTrade: true,
  confidence: 88,
  isSameEvent: true,
  riskLevel: 'low',
  recommendedSize: 2,
  reasoning: 'Same sporting event confirmed across both platforms with significant price gap warranting arbitrage execution.',
};

const opportunities: ArbOpportunity[] = [
  {
    question: 'houston astros vs. texas rangers',
    buyOn: 'kalshi',
    buyPrice: 0.184,
    sellOn: 'polymarket',
    sellPrice: 0.450,
    gapPercent: 26.6,
    estimatedProfit: 0.262,
    marketA: { id: 'kalshi-astros-1', question: 'houston astros vs. texas rangers', yesPrice: 0.184, volume: 0, source: 'kalshi', url: 'https://kalshi.com', category: 'sports' } as Market,
    marketB: { id: 'poly-astros-1', question: 'houston astros vs. texas rangers', yesPrice: 0.450, volume: 0, source: 'polymarket', url: 'https://polymarket.com', category: 'sports' } as Market,
  },
  {
    question: 'will joey bosa play for las vegas raiders in 2026-27?',
    buyOn: 'polymarket',
    buyPrice: 0.439,
    sellOn: 'kalshi',
    sellPrice: 0.782,
    gapPercent: 34.3,
    estimatedProfit: 0.339,
    marketA: { id: 'poly-bosa-1', question: 'will joey bosa play for las vegas raiders in 2026-27?', yesPrice: 0.439, volume: 0, source: 'polymarket', url: 'https://polymarket.com', category: 'sports' } as Market,
    marketB: { id: 'kalshi-bosa-1', question: 'will joey bosa play for las vegas raiders in 2026-27?', yesPrice: 0.782, volume: 0, source: 'kalshi', url: 'https://kalshi.com', category: 'sports' } as Market,
  },
  {
    question: 'will west ham be relegated from the english premier league?',
    buyOn: 'kalshi',
    buyPrice: 0.075,
    sellOn: 'polymarket',
    sellPrice: 0.345,
    gapPercent: 27.0,
    estimatedProfit: 0.266,
    marketA: { id: 'kalshi-westham-1', question: 'will west ham be relegated from the english premier league?', yesPrice: 0.075, volume: 0, source: 'kalshi', url: 'https://kalshi.com', category: 'sports' } as Market,
    marketB: { id: 'poly-westham-1', question: 'will west ham be relegated from the english premier league?', yesPrice: 0.345, volume: 0, source: 'polymarket', url: 'https://polymarket.com', category: 'sports' } as Market,
  },
];

async function main() {
  const existing = existsSync(TRADES_FILE)
    ? JSON.parse(readFileSync(TRADES_FILE, 'utf-8'))
    : [];

  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    console.log(`\n${'━'.repeat(50)}`);
    console.log(`[${i + 1}/3] "${opp.question}"`);
    console.log(`${'━'.repeat(50)}`);

    const result = await executeArbitrageJob(opp, decision);

    console.log(`\n✓ Trade ${i + 1} complete`);
    console.log(`  Commit TX: ${result.commitTxHash}`);
    console.log(`  Job ID:    ${result.jobId}`);
    console.log(`  Explorer:  https://testnet.arcscan.app/tx/${result.commitTxHash}`);

    const trade = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      question: opp.question,
      buyOn: opp.buyOn,
      buyPrice: parseFloat((opp.buyPrice * 100).toFixed(1)),
      sellOn: opp.sellOn,
      sellPrice: parseFloat((opp.sellPrice * 100).toFixed(1)),
      gapPercent: parseFloat(opp.gapPercent.toFixed(1)),
      status: 'REVEALED',
      commitHash: result.commitTxHash,
      revealHash: result.commitTxHash,
      txHash: result.commitTxHash,
      jobId: result.jobId,
      claudeReasoning: decision.reasoning,
      arcExplorerUrl: `https://testnet.arcscan.app/tx/${result.commitTxHash}`,
    };

    existing.unshift(trade);
    writeFileSync(TRADES_FILE, JSON.stringify(existing, null, 2));
    console.log(`  Saved to trades.json`);
  }

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`✓ All 3 seed trades complete. trades.json updated.`);
  console.log(`${'━'.repeat(50)}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
