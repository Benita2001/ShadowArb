import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { ArbOpportunity } from './scanner.js';
dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface AgentDecision {
  shouldTrade: boolean;
  confidence: number;
  reasoning: string;
  isSameEvent: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedSize: number;
}

export async function evaluateOpportunity(opp: ArbOpportunity): Promise<AgentDecision> {
  const prompt = `You are ShadowArb, an autonomous arbitrage agent for prediction markets.

You have found a potential arbitrage opportunity between two prediction markets.
Your job is to decide if this is a REAL arbitrage opportunity worth trading.

OPPORTUNITY DETAILS:
- Question A (${opp.marketA.source}): "${opp.marketA.question}"
- Price A: ${(opp.buyPrice * 100).toFixed(1)}%
- Question B (${opp.marketB.source}): "${opp.marketB.question}"  
- Price B: ${(opp.sellPrice * 100).toFixed(1)}%
- Gap: ${opp.gapPercent.toFixed(1)}%
- Estimated profit per $1: $${opp.estimatedProfit.toFixed(4)}

EVALUATION CRITERIA:
1. Are these the SAME event/outcome? (most important)
2. Is the gap large enough to be real and not just a data error?
3. What is the risk that these resolve differently?
4. Is this worth executing?

Respond ONLY with a JSON object in this exact format, no other text:
{
  "shouldTrade": true or false,
  "confidence": number between 0 and 100,
  "isSameEvent": true or false,
  "riskLevel": "low" or "medium" or "high",
  "recommendedSize": number between 1 and 50 (in USDC),
  "reasoning": "one sentence explanation"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const decision = JSON.parse(clean) as AgentDecision;
    return decision;
  } catch (err) {
    return {
      shouldTrade: false,
      confidence: 0,
      reasoning: 'Failed to evaluate opportunity',
      isSameEvent: false,
      riskLevel: 'high',
      recommendedSize: 0,
    };
  }
}

export async function runAgentLoop(opportunities: ArbOpportunity[]): Promise<void> {
  console.log('\n ShadowArb Agent — Claude LLM Evaluation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Only evaluate top 10 to save API calls
  const candidates = opportunities.slice(0, 10);
  console.log(`\n  Evaluating top ${candidates.length} candidates...\n`);

  const verified: Array<{ opp: ArbOpportunity; decision: AgentDecision }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const opp = candidates[i];
    process.stdout.write(`  [${i + 1}/${candidates.length}] Evaluating "${opp.question.slice(0, 50)}..."  `);

    const decision = await evaluateOpportunity(opp);

    if (decision.isSameEvent && decision.shouldTrade) {
      console.log(`✅ TRADE | Confidence: ${decision.confidence}% | Size: $${decision.recommendedSize}`);
      console.log(`         Risk: ${decision.riskLevel} | ${decision.reasoning}`);
      verified.push({ opp, decision });
    } else if (decision.isSameEvent && !decision.shouldTrade) {
      console.log(`⚠️  SAME EVENT but skip | ${decision.reasoning}`);
    } else {
      console.log(`❌ DIFFERENT EVENT | ${decision.reasoning}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n  Results:`);
  console.log(`  Evaluated:  ${candidates.length}`);
  console.log(`  Real arbs:  ${verified.length}`);
  console.log(`  Rejected:   ${candidates.length - verified.length}`);

  if (verified.length > 0) {
    console.log(`\n  Best opportunity:`);
    const best = verified[0];
    console.log(`  "${best.opp.question.slice(0, 65)}"`);
    console.log(`  Buy  ${best.opp.buyOn} @ ${(best.opp.buyPrice * 100).toFixed(1)}%`);
    console.log(`  Sell ${best.opp.sellOn} @ ${(best.opp.sellPrice * 100).toFixed(1)}%`);
    console.log(`  Gap: ${best.opp.gapPercent.toFixed(1)}% | Confidence: ${best.decision.confidence}%`);
    console.log(`  Reasoning: ${best.decision.reasoning}`);
  } else {
    console.log(`\n  No verified arb opportunities this scan.`);
  }
}
```

Now update `src/scanner.ts` — find the `findOpportunities` function and change this one line:

Find:
```typescript
  const MIN_SCORE = 0.2;
```

Change to:
```typescript
  const MIN_SCORE = 0.2;
  // Only arb between real money markets
  if (a.source === 'manifold' || b.source === 'manifold') continue;
```

Wait — that won't work syntactically. Instead find this block:

```typescript
      if (matchScore(a, b) < MIN_SCORE) continue;
```

Replace with:
```typescript
      if (a.source === 'manifold' || b.source === 'manifold') continue;
      if (matchScore(a, b) < MIN_SCORE) continue;
```

Save both files. Now install the Anthropic SDK:

```bash
npm install @anthropic-ai/sdk