import { generateStealthMetaAddress, generateStealthAddress } from '@/src/privacy/StealthAddress';
import { commitReveal } from '@/src/privacy/CommitReveal';

export async function POST(request: Request) {
  const payment = request.headers.get('x-payment');

  if (!payment) {
    return Response.json(
      {
        error: 'Payment Required',
        amount: '0.001',
        currency: 'USDC',
        network: 'ARC-TESTNET',
        payTo: process.env.OWNER_ADDRESS,
        description: 'Pay 0.001 USDC to get a fresh ERC-5564 stealth address and commit hash posted to Arc',
      },
      { status: 402 },
    );
  }

  try {
    const meta = generateStealthMetaAddress();
    const stealth = generateStealthAddress(meta);
    const commit = commitReveal.commit({ stealthAddress: stealth.address, timestamp: Date.now() });

    return Response.json({
      stealthAddress: stealth.address,
      ephemeralPubKey: stealth.ephemeralPubKey,
      commitHash: commit.hash,
      message: 'Use this address for your private transaction. It is unlinked from any other address.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
