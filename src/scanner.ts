import * as dotenv from 'dotenv';
dotenv.config();

export interface Market {
  id: string;
  question: string;
  yesPrice: number;
  volume: number;
  source: 'polymarket' | 'kalshi' | 'manifold';
  url: string;
  category: string;
}

export interface ArbOpportunity {
  question: string;
  buyOn: string;
  buyPrice: number;
  sellOn: string;
  sellPrice: number;
  gapPercent: number;
  estimatedProfit: number;
  marketA: Market;
  marketB: Market;
}

function detectCategory(question: string): string {
  const q = question.toLowerCase();
  if (/bitcoin|btc|ethereum|eth|crypto|solana|sol|xrp|bnb|doge/.test(q)) return 'crypto';
  if (/fed|federal reserve|interest rate|inflation|gdp|unemployment|recession|cpi|fomc|powell/.test(q)) return 'macro';
  if (/trump|biden|harris|election|president|congress|senate|republican|democrat|vote|governor|supreme court/.test(q)) return 'politics';
  if (/temperature|weather|rain|snow|hurricane|tornado/.test(q)) return 'weather';
  if (/gemini|openai|gpt|claude|llm|artificial intelligence|chatgpt/.test(q)) return 'tech';
  if (/nba|nfl|nhl|mlb|soccer|football|basketball|baseball|hockey|tennis|golf|ufc|mma|championship|playoff|finals|super bowl|world cup|premier league|champions league|bundesliga|serie|ligue|mls|epl|relegated|promotion/.test(q)) return 'sports';
  return 'other';
}

function isParlay(question: string): boolean {
  const q = question.toLowerCase();
  const vsCount = (q.match(/\bvs\.?\b/g) || []).length;
  return (
    vsCount > 1 ||
    /\bparlay\b/.test(q) ||
    /run line|puck line/.test(q) ||
    /player prop/.test(q) ||
    q.startsWith('spread:') ||
    q.includes('o/u') ||
    q.includes('over/under') ||
    q.includes('(-') ||
    q.includes('+/-') ||
    q.includes('both teams') ||
    q.includes('moneyline') ||
    q.includes('1st half') ||
    q.includes('1st quarter')
  );
}

async function fetchPolymarkets(): Promise<Market[]> {
  try {
    const [r1, r2, r3] = await Promise.all([
      fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false'),
      fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false&offset=100'),
      fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false&offset=200'),
    ]);
    const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
    const all = [
      ...(Array.isArray(d1) ? d1 : []),
      ...(Array.isArray(d2) ? d2 : []),
      ...(Array.isArray(d3) ? d3 : []),
    ];
    return all
      .filter((m: any) => m.outcomePrices && m.question)
      .map((m: any) => {
        const prices = JSON.parse(m.outcomePrices);
        const question = m.question.toLowerCase().trim();
        return {
          id: m.id,
          question,
          yesPrice: parseFloat(prices[0]),
          volume: parseFloat(m.volume || '0'),
          source: 'polymarket' as const,
          url: `https://polymarket.com/event/${m.slug}`,
          category: detectCategory(question),
        };
      })
      .filter((m: Market) =>
        m.yesPrice > 0.01 &&
        m.yesPrice < 0.99 &&
        !isParlay(m.question)
      );
  } catch (err) {
    console.error('  Polymarket error:', err);
    return [];
  }
}

async function fetchKalshiMarkets(): Promise<Market[]> {
  try {
    const res = await fetch(
      'https://external-api.kalshi.com/trade-api/v2/markets?limit=200&status=open',
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await res.json();
    const list = Array.isArray(data.markets) ? data.markets : [];
    return list
      .filter((m: any) =>
        m.title &&
        m.yes_ask_dollars &&
        m.status === 'active' &&
        !isParlay(m.title)
      )
      .map((m: any) => {
        const question = m.title.toLowerCase().trim();
        return {
          id: m.ticker,
          question,
          yesPrice: parseFloat(m.yes_ask_dollars),
          volume: parseFloat(m.volume_fp || '0'),
          source: 'kalshi' as const,
          url: `https://kalshi.com/markets/${m.ticker}`,
          category: detectCategory(question),
        };
      })
      .filter((m: Market) => m.yesPrice > 0.01 && m.yesPrice < 0.99);
  } catch (err) {
    console.error('  Kalshi error:', err);
    return [];
  }
}

// Normalize common aliases so "btc" and "bitcoin" share a keyword, etc.
const ALIASES: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple',
  bnb: 'binance', doge: 'dogecoin', ada: 'cardano',
  fed: 'fedreserve', fomc: 'fedreserve',
  gop: 'republican', dem: 'democrat',
  usa: 'america', usd: 'dollar',
};

function extractKeywords(question: string): string[] {
  const stopwords = new Set([
    'will', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of',
    'and', 'or', 'by', 'be', 'is', 'are', 'was', 'were', 'have',
    'has', 'had', 'this', 'that', 'with', 'from', '2024', '2025', '2026',
    'win', 'wins', 'beat', 'over', 'under', 'more', 'less',
    'who', 'what', 'when', 'how', 'which', 'their', 'they',
  ]);
  return question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .map(w => ALIASES[w] ?? w);
}

function matchScore(a: Market, b: Market): number {
  if (a.source === b.source) return 0;
  if (a.category !== b.category) return 0;
  if (a.category === 'weather') return 0;
  const kA = new Set(extractKeywords(a.question));
  const kB = new Set(extractKeywords(b.question));
  const shared = [...kA].filter(k => kB.has(k));
  if (shared.length < 2) return 0;
  return shared.length / Math.max(kA.size, kB.size);
}

function findOpportunities(markets: Market[]): ArbOpportunity[] {
  const opportunities: ArbOpportunity[] = [];
  const seen = new Set<string>();
  const MIN_SCORE = 0.25;
  const MIN_GAP = 0.02;
  const FEE = 0.002;

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const a = markets[i];
      const b = markets[j];
      if (a.source === 'manifold' || b.source === 'manifold') continue;
      const score = matchScore(a, b);
      if (score < MIN_SCORE) continue;
      const gap = Math.abs(a.yesPrice - b.yesPrice);
      if (gap < MIN_GAP) continue;
      const cheaper = a.yesPrice < b.yesPrice ? a : b;
      const pricier = a.yesPrice < b.yesPrice ? b : a;
      const profit = gap - FEE * 2;
      if (profit <= 0) continue;
      const key = [cheaper.id, pricier.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      opportunities.push({
        question: a.question,
        buyOn: cheaper.source,
        buyPrice: cheaper.yesPrice,
        sellOn: pricier.source,
        sellPrice: pricier.yesPrice,
        gapPercent: gap * 100,
        estimatedProfit: profit,
        marketA: cheaper,
        marketB: pricier,
      });
    }
  }

  return opportunities.sort((a, b) => b.gapPercent - a.gapPercent);
}

export async function scanMarkets(): Promise<ArbOpportunity[]> {
  console.log('\n ShadowArb Scanner — Multi-Market Arbitrage Scanner');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const [poly, kalshi] = await Promise.all([
    fetchPolymarkets(),
    fetchKalshiMarkets(),
  ]);

  const breakdown = (markets: Market[]) => {
    const b: Record<string, number> = {};
    markets.forEach(m => { b[m.category] = (b[m.category] || 0) + 1; });
    return Object.entries(b).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ');
  };

  console.log(`\n  Polymarket: ${poly.length} markets  [${breakdown(poly)}]`);
  console.log(`  Kalshi:     ${kalshi.length} markets  [${breakdown(kalshi)}]`);

  const allBreakdown: Record<string, number> = {};
  [...poly, ...kalshi].forEach(m => { allBreakdown[m.category] = (allBreakdown[m.category] || 0) + 1; });
  const summaryParts = Object.entries(allBreakdown).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ');
  console.log(`  Scan complete: ${summaryParts}`);

  const all = [...poly, ...kalshi];
  const opps = findOpportunities(all);

  if (opps.length === 0) {
    console.log('\n  No opportunities found this scan.');
    console.log('\n  Sample Kalshi markets:');
    kalshi.slice(0, 5).forEach(m =>
      console.log(`    [${m.category}] "${m.question.slice(0, 55)}" @ ${(m.yesPrice * 100).toFixed(1)}%`)
    );
  } else {
    console.log(`\n  Found ${opps.length} opportunities:\n`);
    opps.slice(0, 10).forEach((o, i) => {
      console.log(`  [${i + 1}] [${o.marketA.category}] "${o.question.slice(0, 60)}"`);
      console.log(`       Buy  ${o.buyOn} @ ${(o.buyPrice * 100).toFixed(1)}%`);
      console.log(`       Sell ${o.sellOn} @ ${(o.sellPrice * 100).toFixed(1)}%`);
      console.log(`       Gap: ${o.gapPercent.toFixed(1)}% | Profit: $${o.estimatedProfit.toFixed(4)}`);
      console.log();
    });
  }

  return opps;
}

scanMarkets().catch((err) => {
  console.error('\nError:', err.message ?? err);
  process.exit(1);
});
