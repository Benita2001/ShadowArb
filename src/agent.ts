import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { ArbOpportunity } from './scanner.js';
dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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

Evaluate if this is a REAL arbitrage opportunity:

- Question A (${opp.marketA.source}): "${opp.marketA.question}"
- Price A: ${(opp.buyPrice * 100).toFixed(1)}%
- Question B (${opp.marketB.source}): "${opp.marketB.question}"
- Price B: ${(opp.sellPrice * 100).toFixed(1)}%
- Gap: ${opp.gapPercent.toFixed(1)}%

Respond ONLY with valid JSON, no other text:
{
  "shouldTrade": true or false,
  "confidence": number 0-100,
  "isSameEvent": true or false,
  "riskLevel": "low" or "medium" or "high",
  "recommendedSize": number 1-50,
  "reasoning": "one sentence"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as AgentDecision;
  } catch {
    return { shouldTrade: false, confidence: 0, reasoning: 'Evaluation failed', isSameEvent: false, riskLevel: 'high', recommendedSize: 0 };
  }
}

export async function runAgentLoop(opportunities: ArbOpportunity[]): Promise<void> {
  console.log('\n ShadowArb Agent — Claude LLM Evaluation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const candidates = opportunities.slice(0, 10);
  console.log(`\n  Evaluating top ${candidates.length} candidates...\n`);

  const verified: Array<{ opp: ArbOpportunity; decision: AgentDecision }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const opp = candidates[i];
    process.stdout.write(`  [${i + 1}/${candidates.length}] "${opp.question.slice(0, 45)}..."  `);
    const decision = await evaluateOpportunity(opp);

    if (decision.isSameEvent && decision.shouldTrade) {
      console.log(`✅ TRADE | Confidence: ${decision.confidence}% | $${decision.recommendedSize} USDC`);
      console.log(`         ${decision.reasoning}`);
      verified.push({ opp, decision });
    } else if (decision.isSameEvent) {
      console.log(`⚠️  SAME EVENT — skip | ${decision.reasoning}`);
    } else {
      console.log(`❌ DIFFERENT EVENT | ${decision.reasoning}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Evaluated: ${candidates.length} | Real arbs: ${verified.length} | Rejected: ${candidates.length - verified.length}`);

  if (verified.length > 0) {
    const best = verified[0];
    console.log(`\n  Best opportunity:`);
    console.log(`  "${best.opp.question.slice(0, 65)}"`);
    console.log(`  Buy  ${best.opp.buyOn} @ ${(best.opp.buyPrice * 100).toFixed(1)}%`);
    console.log(`  Sell ${best.opp.sellOn} @ ${(best.opp.sellPrice * 100).toFixed(1)}%`);
    console.log(`  Gap: ${best.opp.gapPercent.toFixed(1)}% | Confidence: ${best.decision.confidence}%`);
    console.log(`  Reasoning: ${best.decision.reasoning}`);
  } else {
    console.log(`\n  No verified arb opportunities this scan.`);
  }
}
