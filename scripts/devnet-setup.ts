/**
 * One-time devnet bootstrap. Idempotent: safe to re-run.
 *
 *   ANCHOR_PROVIDER_URL=<rpc> ANCHOR_WALLET=~/.config/solana/id.json \
 *     npx ts-node scripts/devnet-setup.ts
 *
 * Does, in order:
 *   1. Generates oracle and faucet keypairs into ./keys/ (gitignored) if absent.
 *   2. Creates the test stake mint with the faucet key as mint authority.
 *   3. initialize_config with the oracle pubkey as verification_key.
 *   4. initialize_treasury_for_mint for the test mint.
 *   5. Writes frontend/.env.local (secrets are never printed).
 *
 * The wallet must be the program's ADMIN_KEY (initialize_config is gated on
 * it). The admin key never goes into the frontend env; only the oracle and
 * faucet secrets do.
 */
import * as fs from "fs";
import * as path from "path";

import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";

import { HealthFun } from "../target/types/health_fun";

const KEYS_DIR = path.join(__dirname, "..", "keys");
const DECIMALS = 6;

// Production-shaped defaults. All rotatable later via update_config.
const CONFIG = {
  maxStake: new anchor.BN(10_000 * 10 ** DECIMALS), // 10,000 tokens
  minLockDuration: new anchor.BN(1 * 86400), // 1 day
  maxLockDuration: new anchor.BN(90 * 86400), // 90 days
};

function loadOrCreateKeypair(name: string): web3.Keypair {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  const file = path.join(KEYS_DIR, `${name}.json`);
  if (fs.existsSync(file)) {
    return web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8")))
    );
  }
  const kp = web3.Keypair.generate();
  fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  console.log(`created ${file} -> ${kp.publicKey.toBase58()}`);
  return kp;
}

function loadOrCreateMintRecord(): { mint: web3.PublicKey } | null {
  const file = path.join(KEYS_DIR, "devnet-mint.json");
  if (!fs.existsSync(file)) return null;
  return { mint: new web3.PublicKey(JSON.parse(fs.readFileSync(file, "utf8")).mint) };
}

async function main() {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.HealthFun as Program<HealthFun>;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const conn = provider.connection;

  console.log(`cluster: ${conn.rpcEndpoint}`);
  console.log(`program: ${program.programId.toBase58()}`);
  console.log(`admin:   ${admin.publicKey.toBase58()}`);

  const oracle = loadOrCreateKeypair("oracle");
  const faucet = loadOrCreateKeypair("faucet");

  // The faucet key pays for minting to users, so it needs some SOL.
  const faucetBal = await conn.getBalance(faucet.publicKey);
  if (faucetBal < 0.05 * web3.LAMPORTS_PER_SOL) {
    console.log("funding faucet key with 0.2 SOL from admin…");
    const tx = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: faucet.publicKey,
        lamports: 0.2 * web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx, [admin]);
  }

  // 2. Test mint
  let mint: web3.PublicKey;
  const existing = loadOrCreateMintRecord();
  if (existing) {
    mint = existing.mint;
    console.log(`mint (existing): ${mint.toBase58()}`);
  } else {
    mint = await createMint(conn, admin, faucet.publicKey, null, DECIMALS);
    fs.writeFileSync(
      path.join(KEYS_DIR, "devnet-mint.json"),
      JSON.stringify({ mint: mint.toBase58(), decimals: DECIMALS }, null, 2)
    );
    console.log(`mint (created):  ${mint.toBase58()}`);
  }

  // 3. Config
  const [stakeConfigPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const cfg = await program.account.stakeConfig.fetchNullable(stakeConfigPda);
  if (cfg) {
    console.log(`config exists; oracle=${cfg.verificationKey.toBase58()} admin=${cfg.admin.toBase58()}`);
    if (!cfg.verificationKey.equals(oracle.publicKey)) {
      console.warn(
        "WARNING: on-chain verification_key differs from keys/oracle.json. " +
          "Run update_config to rotate, or the oracle route will sign with the wrong key."
      );
    }
  } else {
    await program.methods
      .initializeConfig(
        CONFIG.maxStake,
        CONFIG.maxLockDuration,
        CONFIG.minLockDuration,
        oracle.publicKey
      )
      .accountsStrict({
        admin: admin.publicKey,
        stakeConfig: stakeConfigPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    console.log("config initialized");
  }

  // 4. Treasury for the mint
  const [treasuryConfigPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_config"), mint.toBuffer()],
    program.programId
  );
  const [treasuryAuthorityPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_authority"), mint.toBuffer()],
    program.programId
  );
  const treasuryVault = getAssociatedTokenAddressSync(mint, treasuryAuthorityPda, true);

  const tc = await program.account.treasuryConfig.fetchNullable(treasuryConfigPda);
  if (tc) {
    console.log("treasury exists");
  } else {
    await program.methods
      .initializeTreasuryForMint()
      .accountsStrict({
        admin: admin.publicKey,
        stakeConfig: stakeConfigPda,
        treasuryConfig: treasuryConfigPda,
        treasuryAuthority: treasuryAuthorityPda,
        treasuryVault,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    console.log("treasury initialized");
  }

  // 5. Frontend env. Secrets are written straight into frontend/.env.local
  // rather than printed, so they never pass through a terminal or a log.
  const envFile = path.join(__dirname, "..", "frontend", ".env.local");
  const values: Record<string, string> = {
    NEXT_PUBLIC_RPC_URL: conn.rpcEndpoint,
    NEXT_PUBLIC_PROGRAM_ID: program.programId.toBase58(),
    NEXT_PUBLIC_STAKE_MINT: mint.toBase58(),
    NEXT_PUBLIC_STAKE_MINT_DECIMALS: String(DECIMALS),
    NEXT_PUBLIC_STAKE_MINT_SYMBOL: "HFT",
    NEXT_PUBLIC_CLUSTER: "devnet",
    ORACLE_SECRET_KEY: bs58.encode(oracle.secretKey),
    FAUCET_SECRET_KEY: bs58.encode(faucet.secretKey),
  };

  const existingEnv = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const lines = existingEnv.split("\n").filter((l) => {
    const k = l.split("=")[0];
    return !(k in values);
  });
  for (const [k, v] of Object.entries(values)) lines.push(`${k}=${v}`);
  fs.writeFileSync(envFile, lines.filter((l, i, a) => l || i < a.length - 1).join("\n") + "\n", { mode: 0o600 });

  console.log(`\nwrote ${envFile}`);
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith("NEXT_PUBLIC_")) console.log(`  ${k}=${v}`);
  }
  console.log("  ORACLE_SECRET_KEY=<written>");
  console.log("  FAUCET_SECRET_KEY=<written>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
