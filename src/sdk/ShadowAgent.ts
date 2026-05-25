/**
 * ShadowAgent — public SDK entry point.
 *
 * Usage:
 *   const agent = new ShadowAgent({ circleApiKey, entitySecret, ... });
 *   agent.addMarket(new PolymarketAdapter());
 *   agent.addMarket(new KalshiAdapter());
 *   agent.onReveal(trade => console.log('settled:', trade.txHash));
 *   agent.start();
 */
import type { MarketAdapter, Opportunity } from './adapters/MarketAdapter.js';
import { generateStealthMetaAddress, generateStealthAddress } from '../privacy/StealthAddress.js';
import { commitReveal } from '../privacy/CommitReveal.js';
import { ArcaneVM } from '../privacy/ArcaneVM.js';
import { randomUUID } from 'crypto';

export interface AgentConfig {
  circleApiKey:      string;
  entitySecret:      string;
  arcRpcUrl:         string;
  anthropicApiKey:   string;
  ownerWalletId:     string;
  validatorWalletId: string;
  agentId:           string;
}

export interface AgentStats {
  marketsScanned:     number;
  opportunitiesFound: number;
  tradesExecuted:     number;
  usdcSettled:        number;
  startTime:          string;
}

export interface AgentTrade {
  id:              string;
  timestamp:       string;
  question:        string;
  status:          'COMMITTED' | 'EXECUTED' | 'REVEALED' | 'REJECTED';
  gapPercent:      number;
  stealthAddress?: string;
  commitHash?:     string;
  txHash?:         string;
  jobId?:          string;
  reasoning?:      string;
}

type CB<T> = (data: T) => void;

export class ShadowAgent {
  private adapters:  MarketAdapter[] = [];
  private running    = false;
  private trades:    AgentTrade[]    = [];
  private stats:     AgentStats      = {
    marketsScanned: 0, opportunitiesFound: 0,
    tradesExecuted: 0, usdcSettled: 0,
    startTime: new Date().toISOString(),
  };
  private cbs: { onCommit: CB<AgentTrade>[]; onExecute: CB<AgentTrade>[]; onReveal: CB<AgentTrade>[] } = {
    onCommit: [], onExecute: [], onReveal: [],
  };

  // Agent-level stealth meta-address — never changes across sessions
  private readonly meta = generateStealthMetaAddress();

  constructor(private config: AgentConfig) {
    console.log('[ShadowAgent] initialized');
    console.log(`[ShadowAgent] stealth meta-address: ${this.meta.metaAddress.slice(0, 50)}…`);
    ArcaneVM.activate().catch(() => {});
  }

  addMarket(adapter: MarketAdapter): void {
    this.adapters.push(adapter);
    console.log(`[ShadowAgent] registered adapter: ${adapter.name}`);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[ShadowAgent] autonomous loop started');
    this.loop();
  }

  stop(): void {
    this.running = false;
    console.log('[ShadowAgent] stopped');
  }

  onCommit(cb: CB<AgentTrade>): void  { this.cbs.onCommit.push(cb); }
  onExecute(cb: CB<AgentTrade>): void { this.cbs.onExecute.push(cb); }
  onReveal(cb: CB<AgentTrade>): void  { this.cbs.onReveal.push(cb); }

  getStats(): AgentStats         { return { ...this.stats }; }
  getTradeHistory(): AgentTrade[] { return [...this.trades]; }

  // ── Private ───────────────────────────────────────────────────────

  private emit<T>(list: CB<T>[], data: T): void {
    list.forEach(cb => { try { cb(data); } catch {} });
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try { await this.tick(); } catch (err: any) {
        console.error('[ShadowAgent] loop error:', err.message);
      }
      await new Promise(r => setTimeout(r, 300_000));
    }
  }

  private async tick(): Promise<void> {
    if (this.adapters.length === 0) {
      console.warn('[ShadowAgent] no adapters registered');
      return;
    }

    const allMarkets: Opportunity[] = [];
    for (const adapter of this.adapters) {
      try {
        const opps = await adapter.scan();
        this.stats.marketsScanned += opps.length;
        allMarkets.push(...opps);
      } catch (err: any) {
        console.error(`[ShadowAgent] ${adapter.name} scan failed:`, err.message);
      }
    }

    // Find cross-platform pairs with non-trivial gap
    const candidates = this.crossPlatformPairs(allMarkets).filter(o => o.gapPercent > 5);
    this.stats.opportunitiesFound += candidates.length;
    console.log(`[ShadowAgent] ${allMarkets.length} markets → ${candidates.length} candidate(s)`);

    for (const opp of candidates.slice(0, 5)) {
      await this.executeWithPrivacy(opp);
    }
  }

  private crossPlatformPairs(markets: Opportunity[]): Opportunity[] {
    const pairs: Opportunity[] = [];
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const a = markets[i];
        const b = markets[j];
        if (a.buyOn === b.buyOn) continue;
        if (a.category !== b.category) continue;
        // Simple keyword overlap check
        const wordsA = new Set(a.question.split(/\s+/).filter(w => w.length > 3));
        const wordsB = new Set(b.question.split(/\s+/).filter(w => w.length > 3));
        const shared = [...wordsA].filter(w => wordsB.has(w));
        if (shared.length < 2) continue;
        const gap = Math.abs(a.buyPrice - b.buyPrice) * 100;
        if (gap < 2) continue;
        const cheaper = a.buyPrice < b.buyPrice ? a : b;
        const pricier  = a.buyPrice < b.buyPrice ? b : a;
        pairs.push({
          question:        a.question,
          buyOn:           cheaper.buyOn,
          buyPrice:        cheaper.buyPrice,
          sellOn:          pricier.buyOn,
          sellPrice:       pricier.buyPrice,
          gapPercent:      gap,
          estimatedProfit: gap / 100 - 0.004,
          category:        a.category,
        });
      }
    }
    return pairs.sort((a, b) => b.gapPercent - a.gapPercent);
  }

  private async executeWithPrivacy(opp: Opportunity): Promise<void> {
    const id      = randomUUID();
    const stealth = generateStealthAddress(this.meta);
    const commit  = commitReveal.commit({ ...opp, agentId: this.config.agentId, timestamp: Date.now() });

    const trade: AgentTrade = {
      id, question: opp.question, gapPercent: opp.gapPercent,
      timestamp: new Date().toISOString(), status: 'COMMITTED',
      stealthAddress: stealth.address, commitHash: commit.hash,
    };
    this.trades.unshift(trade);
    this.emit(this.cbs.onCommit, trade);

    console.log(`[ShadowAgent] COMMITTED  ${opp.question.slice(0, 50)}  gap=${opp.gapPercent.toFixed(1)}%`);
    console.log(`             stealth     ${stealth.address}`);
    console.log(`             commit      ${commit.hash.slice(0, 18)}…`);

    // Find the right adapter for execution
    const buyAdapter  = this.adapters.find(a => a.name === opp.buyOn);
    const sellAdapter = this.adapters.find(a => a.name === opp.sellOn);

    try {
      if (buyAdapter)  await buyAdapter.execute(opp, stealth.address);
      if (sellAdapter) await sellAdapter.execute(opp, stealth.address);

      trade.status = 'EXECUTED';
      this.emit(this.cbs.onExecute, { ...trade });
      this.stats.tradesExecuted++;

      // Reveal
      const verified = commitReveal.verify(commit.hash, { ...opp, agentId: this.config.agentId });
      trade.status    = 'REVEALED';
      this.emit(this.cbs.onReveal, { ...trade });
      console.log(`[ShadowAgent] REVEALED   commit=reveal: ${verified ? '✓' : '✗'}`);
    } catch (err: any) {
      trade.status = 'REJECTED';
      console.error(`[ShadowAgent] execution failed:`, err.message);
    }
  }
}
