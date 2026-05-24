import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { createPublicClient, http, keccak256, toHex, parseAbiItem } from 'viem';
import { arcTestnet } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config();

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713';
const METADATA_URI = 'ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei';

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
});

async function waitForTransaction(circleClient: any, txId: string, label: string) {
  process.stdout.write(`  Waiting for ${label}`);
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const tx = await circleClient.getTransaction({ id: txId });
    const state = tx.data?.transaction?.state;
    if (state === 'COMPLETE') {
      const hash = tx.data?.transaction?.txHash;
      console.log(` ✓\n  Explorer: https://testnet.arcscan.app/tx/${hash}`);
      return hash;
    }
    if (state === 'FAILED') throw new Error(`${label} failed`);
    process.stdout.write('.');
  }
  throw new Error(`${label} timed out`);
}

async function registerIdentity() {
  console.log('\n ShadowArb — Registering agent identity on Arc (ERC-8004)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const circleClient = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!.replace('0x', ''),
  });

  const ownerAddress = process.env.OWNER_ADDRESS!;
  const validatorAddress = process.env.VALIDATOR_ADDRESS!;
  const ownerWalletId = process.env.OWNER_WALLET_ID!;
  const validatorWalletId = process.env.VALIDATOR_WALLET_ID!;

  console.log(`\n  Owner:     ${ownerAddress}`);
  console.log(`  Validator: ${validatorAddress}`);

  // Step 1 — Register agent identity
  console.log('\n── Step 1: Register ShadowArb identity ──');
  const registerTx = await circleClient.createContractExecutionTransaction({
    walletId: ownerWalletId,
    contractAddress: IDENTITY_REGISTRY,
    abiFunctionSignature: 'register(string)',
    abiParameters: [METADATA_URI],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  });
  const registerHash = await waitForTransaction(circleClient, registerTx.data?.id!, 'registration');

  // Step 2 — Get agent ID from Transfer event
  console.log('\n── Step 2: Retrieve agent ID ──');
  const receipt = await publicClient.getTransactionReceipt({ hash: registerHash as `0x${string}` });
  const transferLogs = await publicClient.getLogs({
    address: IDENTITY_REGISTRY as `0x${string}`,
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
    args: { to: ownerAddress as `0x${string}` },
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });

  if (transferLogs.length === 0) throw new Error('No Transfer event found');
  const agentId = transferLogs[transferLogs.length - 1].args.tokenId!;
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Explorer: https://testnet.arcscan.app/address/${ownerAddress}`);

  // Step 3 — Record initial reputation
  console.log('\n── Step 3: Record initial reputation ──');
  const tag = 'shadowarb_initialized';
  const feedbackHash = keccak256(toHex(tag));

  const reputationTx = await circleClient.createContractExecutionTransaction({
    walletId: validatorWalletId,
    contractAddress: REPUTATION_REGISTRY,
    abiFunctionSignature: 'giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)',
    abiParameters: [agentId.toString(), '90', '0', tag, '', '', '', feedbackHash],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  });
  await waitForTransaction(circleClient, reputationTx.data?.id!, 'reputation');

  console.log('\n── Complete ──');
  console.log('  ✓ ShadowArb identity registered on Arc');
  console.log('  ✓ Initial reputation recorded');
  console.log(`  ✓ Agent ID: ${agentId}`);
  console.log(`\n  Save this Agent ID — add to .env as AGENT_ID=${agentId}`);
}

registerIdentity().catch((err) => {
  console.error('\nError:', err.message ?? err);
  process.exit(1);
});