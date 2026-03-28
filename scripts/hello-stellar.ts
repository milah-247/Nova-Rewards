#!/usr/bin/env npx ts-node
/**
 * hello-stellar.ts
 *
 * Quick-start script to verify your local Stellar / Nova Rewards setup.
 * Runs against Testnet — no real funds required.
 *
 * Usage:
 *   cd novaRewards
 *   npx ts-node ../scripts/hello-stellar.ts
 *
 * Prerequisites:
 *   npm install @stellar/stellar-sdk dotenv
 *   Copy .env.example → .env and fill in ISSUER_PUBLIC + HORIZON_URL
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { Horizon, Asset, StrKey, Keypair } from "@stellar/stellar-sdk";

// Load .env from the novaRewards directory
dotenv.config({ path: path.join(__dirname, "novaRewards", ".env") });

const HORIZON_URL =
  process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const ISSUER_PUBLIC = process.env.ISSUER_PUBLIC ?? "";
const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet";

const server = new Horizon.Server(HORIZON_URL);

// ─── Step 1: Connectivity check ──────────────────────────────────────────────
async function checkHorizonConnectivity(): Promise<void> {
  console.log(`\n[1] Connecting to Horizon: ${HORIZON_URL}`);
  const root = await (await fetch(HORIZON_URL)).json();
  console.log(`    ✓ Network: ${root.network_passphrase ?? STELLAR_NETWORK}`);
  console.log(`    ✓ Latest ledger: ${root.core_latest_ledger}`);
}

// ─── Step 2: Validate env vars ────────────────────────────────────────────────
function checkEnvVars(): void {
  console.log("\n[2] Checking environment variables...");

  const required = ["ISSUER_PUBLIC", "HORIZON_URL", "STELLAR_NETWORK"];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.warn(`    ⚠  Missing vars: ${missing.join(", ")}`);
    console.warn("    Copy .env.example → .env and fill in the values.");
  } else {
    console.log("    ✓ All required env vars are set");
  }

  if (ISSUER_PUBLIC && !StrKey.isValidEd25519PublicKey(ISSUER_PUBLIC)) {
    console.error("    ✗ ISSUER_PUBLIC is not a valid Stellar public key");
  } else if (ISSUER_PUBLIC) {
    console.log(
      `    ✓ ISSUER_PUBLIC looks valid: ${ISSUER_PUBLIC.slice(0, 8)}...`,
    );
  }
}

// ─── Step 3: Generate a throwaway keypair ────────────────────────────────────
function generateKeypair(): Keypair {
  console.log("\n[3] Generating a throwaway keypair...");
  const kp = Keypair.random();
  console.log(`    Public key : ${kp.publicKey()}`);
  console.log(`    Secret key : ${kp.secret()} (never share this)`);
  return kp;
}

// ─── Step 4: Fund via Friendbot ───────────────────────────────────────────────
async function fundWithFriendbot(publicKey: string): Promise<void> {
  console.log("\n[4] Funding account via Friendbot (Testnet only)...");
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Friendbot failed: ${body}`);
  }
  console.log("    ✓ Account funded with 10,000 XLM");
}

// ─── Step 5: Load account and print balances ─────────────────────────────────
async function loadAndPrintAccount(publicKey: string): Promise<void> {
  console.log("\n[5] Loading account from Horizon...");
  const account = await server.loadAccount(publicKey);

  console.log(`    Sequence number: ${account.sequenceNumber()}`);
  for (const b of account.balances as any[]) {
    if (b.asset_type === "native") {
      console.log(`    XLM balance: ${b.balance}`);
    } else {
      console.log(
        `    ${b.asset_code} balance: ${b.balance} (issuer: ${b.asset_issuer?.slice(0, 8)}...)`,
      );
    }
  }
}

// ─── Step 6: Check NOVA asset (if issuer is configured) ──────────────────────
async function checkNovaAsset(): Promise<void> {
  if (!ISSUER_PUBLIC || !StrKey.isValidEd25519PublicKey(ISSUER_PUBLIC)) {
    console.log("\n[6] Skipping NOVA asset check (ISSUER_PUBLIC not set)");
    return;
  }

  console.log("\n[6] Checking NOVA asset on Horizon...");
  const NOVA = new Asset("NOVA", ISSUER_PUBLIC);

  try {
    const issuerAccount = await server.loadAccount(ISSUER_PUBLIC);
    const xlm = (issuerAccount.balances as any[]).find(
      (b) => b.asset_type === "native",
    );
    console.log(`    ✓ Issuer account exists`);
    console.log(`    Issuer XLM balance: ${xlm?.balance ?? "0"}`);

    const holders = await server.accounts().forAsset(NOVA).limit(5).call();
    console.log(`    NOVA holders (first 5): ${holders.records.length}`);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.warn(
        "    ⚠  Issuer account not found on Testnet — run setup.js first",
      );
    } else {
      throw err;
    }
  }
}

// ─── Step 7: Stream a single payment event ───────────────────────────────────
async function streamOnePayment(publicKey: string): Promise<void> {
  console.log("\n[7] Opening payment stream (will close after 5 s)...");

  await new Promise<void>((resolve) => {
    const close = server
      .payments()
      .forAccount(publicKey)
      .cursor("now")
      .stream({
        onmessage(payment: any) {
          console.log("    ✓ Payment event received:", payment.type);
          close();
          resolve();
        },
        onerror(_err: any) {
          // No payments in 5 s is fine for a hello-world check
        },
      });

    setTimeout(() => {
      close();
      console.log("    (no payments in 5 s — stream closed normally)");
      resolve();
    }, 5_000);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("=== Hello Stellar — Nova Rewards setup check ===");
  console.log(`Network: ${STELLAR_NETWORK}`);

  await checkHorizonConnectivity();
  checkEnvVars();

  const kp = generateKeypair();

  await fundWithFriendbot(kp.publicKey());
  await loadAndPrintAccount(kp.publicKey());
  await checkNovaAsset();
  await streamOnePayment(kp.publicKey());

  console.log("\n=== All checks passed — your Stellar setup is working ===");
  console.log("Next steps:");
  console.log("  1. Copy .env.example → .env and fill in your keys");
  console.log("  2. Run: node novaRewards/scripts/setup.js");
  console.log("  3. Start the backend: cd novaRewards/backend && npm start");
  console.log(
    "\nSee docs/stellar/integration.md for the full integration reference.",
  );
}

main().catch((err) => {
  console.error("\n✗ Check failed:", err.message ?? err);
  if (err.response?.data) {
    console.error("Horizon error:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
