/**
 * One-time Bags agent-auth bootstrap.
 *
 * Reads a Solana keypair (file path or base58 secret env), runs the
 * init→sign→callback flow against the Bags public API, and prints the
 * issued API key so it can be pasted into `.env.local` as BAGS_API_KEY.
 *
 * Usage:
 *   BAGS_AUTH_KEYPAIR=/abs/path/to/keypair.json \
 *   BAGS_AUTH_KEY_NAME="bags-radar-spike" \
 *   pnpm tsx scripts/bags-auth.ts
 *
 * Or pass the secret directly:
 *   BAGS_AUTH_SECRET_BS58=<base58 64-byte secret> pnpm tsx scripts/bags-auth.ts
 *
 * MFA: if the first callback returns mfaRequired, set BAGS_AUTH_MFA_CODE
 * and re-run. The script will reuse an existing nonce file at
 * `~/.config/bags/last-nonce.json` if present.
 *
 * Deps (add if not already present):
 *   pnpm add tweetnacl
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const BAGS_API = "https://public-api-v2.bags.fm/api/v1";
const NONCE_CACHE = join(homedir(), ".config", "bags", "last-nonce.json");

function loadKeypair(): Keypair {
  const secretB58 = process.env.BAGS_AUTH_SECRET_BS58;
  if (secretB58) {
    return Keypair.fromSecretKey(bs58.decode(secretB58));
  }
  const path = process.env.BAGS_AUTH_KEYPAIR;
  if (!path) {
    throw new Error("Set BAGS_AUTH_KEYPAIR=/path/to/keypair.json or BAGS_AUTH_SECRET_BS58");
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BAGS_API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = (await res.json()) as { success?: boolean; response?: T; error?: string } & Record<string, unknown>;
  if (!res.ok || (json.success === false && !json.response)) {
    throw new Error(`${path} failed: ${res.status} ${json.error ?? JSON.stringify(json)}`);
  }
  return (json.response ?? (json as unknown)) as T;
}

function persistNonce(payload: { nonce: string; address: string; messageB58: string }) {
  mkdirSync(dirname(NONCE_CACHE), { recursive: true });
  writeFileSync(NONCE_CACHE, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

function readCachedNonce(): { nonce: string; address: string; messageB58: string } | null {
  if (!existsSync(NONCE_CACHE)) return null;
  return JSON.parse(readFileSync(NONCE_CACHE, "utf8"));
}

async function main() {
  const kp = loadKeypair();
  const address = kp.publicKey.toBase58();
  const keyName = process.env.BAGS_AUTH_KEY_NAME ?? "bags-radar-spike";
  const mfaCode = process.env.BAGS_AUTH_MFA_CODE;

  let messageB58: string;
  let nonce: string;

  if (mfaCode) {
    const cached = readCachedNonce();
    if (!cached || cached.address !== address) {
      throw new Error("MFA flow needs a cached nonce from a prior init call (same address).");
    }
    messageB58 = cached.messageB58;
    nonce = cached.nonce;
  } else {
    const init = await postJson<{ message: string; nonce: string }>("/agent/v2/auth/init", { address });
    messageB58 = init.message;
    nonce = init.nonce;
    persistNonce({ nonce, address, messageB58 });
    console.error(`[init] nonce=${nonce} (cached for MFA retry)`);
  }

  const messageBytes = bs58.decode(messageB58);
  const sig = nacl.sign.detached(messageBytes, kp.secretKey);
  const signature = bs58.encode(sig);

  const callbackBody: Record<string, string> = { signature, address, nonce, keyName };
  if (mfaCode) callbackBody.mfaCode = mfaCode;

  const cb = await postJson<{ apiKey?: string; keyId?: string; mfaRequired?: boolean; authCode?: string }>(
    "/agent/v2/auth/callback",
    callbackBody
  );

  if (cb.mfaRequired) {
    console.error("MFA required. Re-run with BAGS_AUTH_MFA_CODE=<code> in env.");
    console.error(JSON.stringify(cb, null, 2));
    process.exit(2);
  }

  if (!cb.apiKey) {
    throw new Error(`callback returned no apiKey: ${JSON.stringify(cb)}`);
  }

  console.log(JSON.stringify({ apiKey: cb.apiKey, keyId: cb.keyId, address, keyName }, null, 2));
  console.error(`\n→ paste into .env.local:\nBAGS_API_KEY=${cb.apiKey}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
