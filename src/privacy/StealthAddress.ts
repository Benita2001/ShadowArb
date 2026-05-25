/**
 * ERC-5564 Stealth Address implementation using @noble/secp256k1.
 *
 * Each trade gets a fresh one-time stealth address so on-chain observers
 * cannot link multiple trades back to the same agent.
 *
 * Protocol (ERC-5564):
 *   Recipient publishes:  (VK = vk*G,  SK = sk*G)  — their meta-address
 *   Sender computes:      ephemeral (ek, EK=ek*G)
 *                         shared = keccak(ek * VK)
 *                         stealth = eth_addr(SK + shared*G)
 *   Announcement:         (EK, stealth) posted publicly
 *   Scan (viewing key):   shared = keccak(vk * EK) → derive P, compare address
 */
import * as secp from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { fileURLToPath } from 'url';

const CURVE_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function fromHex(hex: string): Uint8Array {
  return Buffer.from(hex.replace('0x', ''), 'hex');
}

function pubKeyToEthAddress(uncompressed: Uint8Array): string {
  // Standard Ethereum address derivation: keccak256(x||y), take last 20 bytes
  const hash = keccak_256(uncompressed.slice(1));
  return '0x' + toHex(hash.slice(12));
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface StealthMetaAddress {
  spendingPrivKey: string;  // hex — keep secret
  viewingPrivKey: string;   // hex — keep secret
  spendingPubKey: string;   // compressed hex (33 bytes)
  viewingPubKey: string;    // compressed hex (33 bytes)
  metaAddress: string;      // shareable st:eth:0x... identifier
}

export interface StealthAddressResult {
  address: string;         // Ethereum address (for funding + execution)
  ephemeralPubKey: string; // compressed hex — post in announcement
  stealthPrivKey: string;  // hex — to sign from this address later
}

export interface StealthAnnouncement {
  ephemeralPubKey: string;
  stealthAddress: string;
}

// ─────────────────────────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────────────────────────

export function generateStealthMetaAddress(): StealthMetaAddress {
  const spendingPrivKey = secp.utils.randomSecretKey();
  const viewingPrivKey  = secp.utils.randomSecretKey();
  const spendingPubKey  = secp.getPublicKey(spendingPrivKey, true);
  const viewingPubKey   = secp.getPublicKey(viewingPrivKey, true);

  return {
    spendingPrivKey: toHex(spendingPrivKey),
    viewingPrivKey:  toHex(viewingPrivKey),
    spendingPubKey:  toHex(spendingPubKey),
    viewingPubKey:   toHex(viewingPubKey),
    metaAddress:     `st:eth:0x${toHex(spendingPubKey)}${toHex(viewingPubKey)}`,
  };
}

export function generateStealthAddress(meta: StealthMetaAddress): StealthAddressResult {
  // 1. Fresh ephemeral key pair
  const ephemeralPrivKey = secp.utils.randomSecretKey();
  const ephemeralPubKey  = secp.getPublicKey(ephemeralPrivKey, true);

  // 2. ECDH: sharedPoint = ephemeralPrivKey * viewingPubKey
  //    getSharedSecret returns 33-byte compressed point; hash x-coordinate (bytes 1–33)
  const sharedPoint = secp.getSharedSecret(ephemeralPrivKey, fromHex(meta.viewingPubKey));
  const sharedHash  = keccak_256(sharedPoint.slice(1));
  const s           = BigInt('0x' + toHex(sharedHash)) % CURVE_N;

  // 3. Stealth public key: P = SK + s*G
  const SK           = (secp.Point as any).fromHex(meta.spendingPubKey);
  const sG           = (secp.Point as any).BASE.multiply(s);
  const stealthPoint = SK.add(sG);
  const stealthPubUC = stealthPoint.toBytes(false); // uncompressed 65 bytes

  // 4. Stealth private key: p = sk + s  (mod n)
  const skBig         = BigInt('0x' + meta.spendingPrivKey);
  const stealthPrivKey = ((skBig + s) % CURVE_N).toString(16).padStart(64, '0');

  return {
    address:         pubKeyToEthAddress(stealthPubUC),
    ephemeralPubKey: toHex(ephemeralPubKey),
    stealthPrivKey,
  };
}

export function scanForStealthTransactions(
  meta: StealthMetaAddress,
  announcements: StealthAnnouncement[],
): Array<StealthAnnouncement & { stealthPrivKey: string }> {
  const found: Array<StealthAnnouncement & { stealthPrivKey: string }> = [];

  for (const ann of announcements) {
    try {
      // Recipient reconstructs shared secret using their viewing key
      const sharedPoint = secp.getSharedSecret(fromHex(meta.viewingPrivKey), fromHex(ann.ephemeralPubKey));
      const sharedHash  = keccak_256(sharedPoint.slice(1));
      const s           = BigInt('0x' + toHex(sharedHash)) % CURVE_N;

      const SK           = (secp.Point as any).fromHex(meta.spendingPubKey);
      const sG           = (secp.Point as any).BASE.multiply(s);
      const expectedAddr = pubKeyToEthAddress(SK.add(sG).toBytes(false));

      if (expectedAddr.toLowerCase() === ann.stealthAddress.toLowerCase()) {
        const skBig        = BigInt('0x' + meta.spendingPrivKey);
        const stealthPrivKey = ((skBig + s) % CURVE_N).toString(16).padStart(64, '0');
        found.push({ ...ann, stealthPrivKey });
      }
    } catch { continue; }
  }

  return found;
}

export function announceStealthAddress(
  ephemeralPubKey: string,
  stealthAddress: string,
): StealthAnnouncement {
  return { ephemeralPubKey, stealthAddress };
}

// ─────────────────────────────────────────────────────────────────
// Self-test (only runs when executed directly)
// ─────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('\n ShadowArb — ERC-5564 Stealth Address Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n[1] Generating agent stealth meta-address...');
  const meta = generateStealthMetaAddress();
  console.log(`  Spending pubkey : ${meta.spendingPubKey.slice(0, 22)}…`);
  console.log(`  Viewing  pubkey : ${meta.viewingPubKey.slice(0, 22)}…`);
  console.log(`  Meta-address    : ${meta.metaAddress.slice(0, 50)}…`);

  console.log('\n[2] Generating stealth address for Trade #1…');
  const stealth1 = generateStealthAddress(meta);
  console.log(`  Stealth address  : ${stealth1.address}`);
  console.log(`  Ephemeral pubkey : ${stealth1.ephemeralPubKey.slice(0, 22)}…`);

  console.log('\n[3] Generating stealth address for Trade #2 (must differ)…');
  const stealth2 = generateStealthAddress(meta);
  console.log(`  Stealth address  : ${stealth2.address}`);
  const unlinked = stealth1.address !== stealth2.address;
  console.log(`  Unlinked from #1 : ${unlinked ? '✓' : '✗ FAIL'}`);

  console.log('\n[4] Posting announcements (3 total — one is fake)…');
  const ann1  = announceStealthAddress(stealth1.ephemeralPubKey, stealth1.address);
  const ann2  = announceStealthAddress(stealth2.ephemeralPubKey, stealth2.address);
  const fake  = announceStealthAddress(stealth2.ephemeralPubKey, '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');

  console.log('\n[5] Scanning with viewing key (should find exactly 2)…');
  const found = scanForStealthTransactions(meta, [ann1, ann2, fake]);
  console.log(`  Found ${found.length}/3 → ${found.length === 2 ? '✓ correct' : '✗ FAIL'}`);

  console.log('\n[6] Verifying stealth private keys produce correct addresses…');
  let allValid = true;
  for (const f of found) {
    const derivedPub  = secp.getPublicKey(fromHex(f.stealthPrivKey), false);
    const derivedAddr = pubKeyToEthAddress(derivedPub);
    const match       = derivedAddr.toLowerCase() === f.stealthAddress.toLowerCase();
    if (!match) allValid = false;
    console.log(`  ${f.stealthAddress}  key valid: ${match ? '✓' : '✗ FAIL'}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (unlinked && found.length === 2 && allValid) {
    console.log('  ✓ All checks passed — ERC-5564 stealth addresses working.');
    console.log('  Each trade gets a fresh address. On-chain, trades are unlinked.');
  } else {
    console.log('  ✗ One or more checks FAILED.');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
