/**
 * Commit-Reveal scheme (Privacy Layer 2).
 *
 * commit()  → keccak256 hash of strategy data, never reveals intent early
 * postToArc()  → caller posts the hash on-chain via jobs.ts (not duplicated here)
 * verify()  → proves commit === reveal after settlement
 * reveal()  → verifies on the client side; on-chain reveal is jobs.ts submit step
 */
import { keccak256, toHex } from 'viem';

export interface CommitResult {
  hash: string;       // 0x-prefixed keccak256
  timestamp: number;
  payload: string;    // JSON string committed
}

export class CommitReveal {
  commit(strategyData: object): CommitResult {
    const timestamp = Date.now();
    const payload   = JSON.stringify(strategyData);
    const hash      = keccak256(toHex(payload));
    return { hash, timestamp, payload };
  }

  verify(commitHash: string, revealData: object): boolean {
    const revealHash = keccak256(toHex(JSON.stringify(revealData)));
    const match      = revealHash === commitHash;
    if (match) {
      console.log(`  [CommitReveal] ✓ MATCH — ${commitHash.slice(0, 14)}… = ${revealHash.slice(0, 14)}…`);
    } else {
      console.warn(`  [CommitReveal] ✗ MISMATCH — commit=${commitHash.slice(0, 14)} reveal=${revealHash.slice(0, 14)}`);
    }
    return match;
  }

  async reveal(strategyData: object, commitHash: string): Promise<boolean> {
    return this.verify(commitHash, strategyData);
  }
}

export const commitReveal = new CommitReveal();
