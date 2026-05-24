import { scanMarkets } from './scanner.js';
import { runAgentLoop } from './agent.js';

async function main() {
  const opportunities = await scanMarkets();
  await runAgentLoop(opportunities);
}

main().catch(console.error);
