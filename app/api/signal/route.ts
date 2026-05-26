import { readFileSync } from 'fs';
import { join } from 'path';

interface Trade {
  id: string;
  timestamp: string;
  question: string;
  buyOn: string;
  buyPrice: number;
  sellOn: string;
  sellPrice: number;
  gapPercent: number;
  status: string;
  commitHash?: string;
  claudeReasoning?: string;
  arcExplorerUrl?: string;
}

export async function GET(request: Request) {
  const payment = request.headers.get('x-payment');

  if (!payment) {
    return Response.json(
      {
        error: 'Payment Required',
        amount: '0.001',
        currency: 'USDC',
        network: 'ARC-TESTNET',
        payTo: process.env.OWNER_ADDRESS,
        description: 'Pay 0.001 USDC to get the current best arbitrage signal with Claude confidence score',
      },
      { status: 402 },
    );
  }

  try {
    const filePath = join(process.cwd(), 'public', 'trades-seed.json');
    const trades = JSON.parse(readFileSync(filePath, 'utf-8')) as Trade[];

    const candidates = trades.filter(t => t.status === 'REVEALED' || t.status === 'COMMITTED');
    const best = candidates.sort((a, b) => b.gapPercent - a.gapPercent)[0];

    if (!best) {
      return Response.json({
        signal: null,
        message: 'No verified opportunities in current window. Retry after next scan.',
      });
    }

    return Response.json({
      signal: {
        question: best.question,
        buyOn: best.buyOn,
        buyPrice: best.buyPrice,
        sellOn: best.sellOn,
        sellPrice: best.sellPrice,
        gapPercent: best.gapPercent,
        claudeReason: best.claudeReasoning,
        commitHash: best.commitHash,
        arcExplorer: best.arcExplorerUrl,
        timestamp: best.timestamp,
      },
      agentId: process.env.AGENT_ID,
      scannedAt: trades[0]?.timestamp ?? new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
