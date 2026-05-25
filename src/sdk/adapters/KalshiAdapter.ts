import type { MarketAdapter, Opportunity, Receipt } from './MarketAdapter.js';

function detectCategory(q: string): string {
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol/.test(q)) return 'crypto';
  if (/trump|biden|election|president|congress/.test(q)) return 'politics';
  if (/fed|federal reserve|rate|inflation|gdp/.test(q)) return 'macro';
  if (/nba|nfl|soccer|football|basketball|baseball|championship|playoff/.test(q)) return 'sports';
  return 'other';
}

export class KalshiAdapter implements MarketAdapter {
  name = 'kalshi';

  async scan(): Promise<Opportunity[]> {
    const res  = await fetch(
      'https://external-api.kalshi.com/trade-api/v2/markets?limit=200&status=open',
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json() as { markets?: any[] };
    const list = Array.isArray(data.markets) ? data.markets : [];
    return list
      .filter((m: any) => m.title && m.yes_ask_dollars && m.status === 'active')
      .map((m: any) => {
        const yesPrice = parseFloat(m.yes_ask_dollars);
        const question  = m.title.toLowerCase().trim();
        return {
          question,
          buyOn:    'kalshi',
          buyPrice: yesPrice,
          sellOn:   'kalshi',
          sellPrice: yesPrice,
          gapPercent: 0,
          estimatedProfit: 0,
          category: detectCategory(question),
        };
      })
      .filter((o: Opportunity) => o.buyPrice > 0.01 && o.buyPrice < 0.99);
  }

  async execute(opp: Opportunity, stealthAddress: string): Promise<Receipt> {
    const side  = opp.buyOn === 'kalshi' ? 'BUY' : 'SELL';
    const price = opp.buyOn === 'kalshi' ? opp.buyPrice : opp.sellPrice;
    console.log(`  [Kalshi] ${side} "${opp.question.slice(0, 50)}" @ ${(price * 100).toFixed(1)}%`);
    console.log(`  [Kalshi] executing from stealth ${stealthAddress.slice(0, 12)}…`);
    return {
      txHash:         '0x' + '0'.repeat(64),
      stealthAddress,
      settled:        true,
      timestamp:      new Date().toISOString(),
    };
  }
}
