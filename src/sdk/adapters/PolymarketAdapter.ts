import type { MarketAdapter, Opportunity, Receipt } from './MarketAdapter.js';

function detectCategory(q: string): string {
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol/.test(q)) return 'crypto';
  if (/trump|biden|election|president|congress/.test(q)) return 'politics';
  if (/fed|federal reserve|rate|inflation|gdp/.test(q)) return 'macro';
  if (/nba|nfl|soccer|football|basketball|baseball|championship|playoff/.test(q)) return 'sports';
  return 'other';
}

export class PolymarketAdapter implements MarketAdapter {
  name = 'polymarket';

  async scan(): Promise<Opportunity[]> {
    const res  = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false'
    );
    const data = await res.json() as any[];
    return (Array.isArray(data) ? data : [])
      .filter((m: any) => m.outcomePrices && m.question)
      .map((m: any) => {
        const prices  = JSON.parse(m.outcomePrices);
        const yesPrice = parseFloat(prices[0]);
        const question = m.question.toLowerCase().trim();
        return {
          question,
          buyOn:    'polymarket',
          buyPrice: yesPrice,
          sellOn:   'polymarket',
          sellPrice: yesPrice,
          gapPercent: 0,
          estimatedProfit: 0,
          category: detectCategory(question),
        };
      })
      .filter((o: Opportunity) => o.buyPrice > 0.01 && o.buyPrice < 0.99);
  }

  async execute(opp: Opportunity, stealthAddress: string): Promise<Receipt> {
    const side = opp.buyOn === 'polymarket' ? 'BUY' : 'SELL';
    const price = opp.buyOn === 'polymarket' ? opp.buyPrice : opp.sellPrice;
    console.log(`  [Polymarket] ${side} "${opp.question.slice(0, 50)}" @ ${(price * 100).toFixed(1)}%`);
    console.log(`  [Polymarket] executing from stealth ${stealthAddress.slice(0, 12)}…`);
    return {
      txHash:         '0x' + '0'.repeat(64),
      stealthAddress,
      settled:        true,
      timestamp:      new Date().toISOString(),
    };
  }
}
