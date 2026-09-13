import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";

import { HealthFun } from "../../target/types/health_fun";
import {
  INSTRUCTIONS_SYSVAR,
  buildAttestationMessage,
  findStakeConfigPda,
  findTreasuryAuthorityPda,
  findTreasuryConfigPda,
  findProfilePda,
  findUserPdas,
  makeEd25519VerifyIx,
} from "./attestation";

const idl = require("../../target/idl/health_fun.json");

export const DECIMALS = 6;
export const STAKE_AMOUNT = 100_000;
export const MINT_AMOUNT = 300_000;
export const TOTAL_DAYS = 3;
export const GOAL_STEPS_PER_DAY = 5_000;

// A fixed, arbitrary point in time so every run is deterministic.
export const START_TIMESTAMP = 1_800_000_000;

export const MAX_STAKE = new anchor.BN(1_000_000_000);
// Lock bounds are DURATIONS in seconds, not timestamps.
export const MIN_LOCK_DURATION = new anchor.BN(86400);
export const MAX_LOCK_DURATION = new anchor.BN(365 * 86400);

// initialize_config is gated on this constant, compiled into the program.
export const ADMIN_KEY = "3CPvFJ3RDJH9RjpzY3WYxn1vcrL7J63hZQc9YboMaCg9";

export const GOAL_STEPS = { steps: {} } as any;

export function loadAdminKeypair(): web3.Keypair {
  // initialize_config is gated on the ADMIN_KEY constant compiled into the
  // program, so these tests must sign with that exact local wallet.
  const walletPath =
    process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");

  if (!fs.existsSync(walletPath)) {
    throw new Error(
      `No wallet at ${walletPath}. These tests must sign as the program's ` +
        `hardcoded ADMIN_KEY (${ADMIN_KEY}); set ANCHOR_WALLET to a keypair file for it.`
    );
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const keypair = web3.Keypair.fromSecretKey(Uint8Array.from(secret));

  // Without this, a mismatched wallet fails later inside initialize_config with
  // InvalidAdminError, which points at the program rather than the machine.
  if (keypair.publicKey.toBase58() !== ADMIN_KEY) {
    throw new Error(
      `Wallet ${walletPath} is ${keypair.publicKey.toBase58()}, but the program's ` +
        `ADMIN_KEY is ${ADMIN_KEY}. Point ANCHOR_WALLET at the admin keypair.`
    );
  }

  return keypair;
}

export type World = {
  svm: LiteSVM;
  program: Program<HealthFun>;
  programId: web3.PublicKey;
  admin: web3.Keypair;
  user: web3.Keypair;
  mint: web3.PublicKey;
  userAta: web3.PublicKey;
  stakePda: web3.PublicKey;
  vaultPda: web3.PublicKey;
  healthPda: web3.PublicKey;
  profilePda: web3.PublicKey;
  stakeConfigPda: web3.PublicKey;
  treasuryConfigPda: web3.PublicKey;
  treasuryAuthorityPda: web3.PublicKey;
  treasuryVault: web3.PublicKey;
};

export function send(
  svm: LiteSVM,
  instructions: web3.TransactionInstruction[],
  payer: web3.Keypair,
  signers: web3.Keypair[]
) {
  const tx = new web3.Transaction();
  instructions.forEach((ix) => tx.add(ix));
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(...signers);

  const result = svm.sendTransaction(tx);

  if (result instanceof FailedTransactionMetadata) {
    throw new Error(
      `Transaction failed: ${result.err()}\n${result.meta().logs().join("\n")}`
    );
  }

  svm.expireBlockhash();
  return result;
}

export function setClock(svm: LiteSVM, unixTimestamp: number) {
  const clock = svm.getClock();
  clock.unixTimestamp = BigInt(unixTimestamp);
  svm.setClock(clock);
}

/** Claim closes the vault, so the account should be gone (or zeroed) after. */
export function expectVaultClosed(svm: LiteSVM, vault: web3.PublicKey) {
  const raw = svm.getAccount(vault);
  if (raw !== null && raw.lamports !== 0) {
    throw new Error(
      `Vault ${vault.toBase58()} still open with ${raw.lamports} lamports`
    );
  }
}

export function tokenBalance(svm: LiteSVM, account: web3.PublicKey): bigint {
  const raw = svm.getAccount(account);
  if (!raw) throw new Error(`Token account ${account.toBase58()} not found`);
  // SPL token account layout: mint(32) owner(32) amount(u64)
  return Buffer.from(raw.data).readBigUInt64LE(64);
}

/**
 * Builds a fully set-up challenge: config, treasury, mint, funded user, an
 * initialized health account, and a funded stake (stake transfers atomically).
 */
export function setupWorld(): World {
  const svm = new LiteSVM();
  const admin = loadAdminKeypair();
  const user = web3.Keypair.generate();
  const programId = new web3.PublicKey(idl.address);

  svm.addProgramFromFile(programId, "target/deploy/health_fun.so");
  setClock(svm, START_TIMESTAMP);

  svm.airdrop(admin.publicKey, BigInt(100 * web3.LAMPORTS_PER_SOL));
  svm.airdrop(user.publicKey, BigInt(100 * web3.LAMPORTS_PER_SOL));

  // Anchor only needs a provider to build instructions here; LiteSVM executes
  // them, so this connection is never actually used.
  const provider = new anchor.AnchorProvider(
    new web3.Connection("http://127.0.0.1:8899"),
    new anchor.Wallet(admin),
    { commitment: "processed" }
  );
  const program = new Program<HealthFun>(idl, provider);

  const mintKeypair = web3.Keypair.generate();
  const mint = mintKeypair.publicKey;
  const userAta = getAssociatedTokenAddressSync(mint, user.publicKey, false);

  const mintRent = svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
  send(
    svm,
    [
      web3.SystemProgram.createAccount({
        fromPubkey: admin.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports: Number(mintRent),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint, DECIMALS, admin.publicKey, null),
      createAssociatedTokenAccountInstruction(
        admin.publicKey,
        userAta,
        user.publicKey,
        mint
      ),
      createMintToInstruction(mint, userAta, admin.publicKey, MINT_AMOUNT),
    ],
    admin,
    [admin, mintKeypair]
  );

  const stakeConfigPda = findStakeConfigPda(programId);
  const { stakePda, vaultPda, healthPda } = findUserPdas(programId, user.publicKey);
  const profilePda = findProfilePda(programId, user.publicKey);
  const treasuryConfigPda = findTreasuryConfigPda(programId, mint);
  const treasuryAuthorityPda = findTreasuryAuthorityPda(programId, mint);
  const treasuryVault = getAssociatedTokenAddressSync(
    mint,
    treasuryAuthorityPda,
    true
  );

  const world: World = {
    svm,
    program,
    programId,
    admin,
    user,
    mint,
    userAta,
    stakePda,
    vaultPda,
    healthPda,
    profilePda,
    stakeConfigPda,
    treasuryConfigPda,
    treasuryAuthorityPda,
    treasuryVault,
  };

  // The oracle signing key is the admin key for these tests.
  send(
    svm,
    [
      program.instruction.initializeConfig(
        MAX_STAKE,
        MAX_LOCK_DURATION,
        MIN_LOCK_DURATION,
        admin.publicKey,
        {
          accounts: {
            admin: admin.publicKey,
            stakeConfig: stakeConfigPda,
            systemProgram: web3.SystemProgram.programId,
          },
        }
      ),
      program.instruction.initializeTreasuryForMint({
        accounts: {
          admin: admin.publicKey,
          stakeConfig: stakeConfigPda,
          treasuryConfig: treasuryConfigPda,
          treasuryAuthority: treasuryAuthorityPda,
          treasuryVault,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        },
      }),
    ],
    admin,
    [admin]
  );

  send(
    svm,
    [
      program.instruction.initializeHealthData(admin.publicKey, {
        accounts: {
          user: user.publicKey,
          healthData: healthPda,
          stakeConfig: stakeConfigPda,
          systemProgram: web3.SystemProgram.programId,
        },
      }),
      program.instruction.stake(
        new anchor.BN(STAKE_AMOUNT),
        TOTAL_DAYS,
        GOAL_STEPS,
        GOAL_STEPS_PER_DAY,
        {
          accounts: {
            user: user.publicKey,
            stakeAccount: stakePda,
            stakeConfig: stakeConfigPda,
            userProfile: profilePda,
            mint,
            vault: vaultPda,
            userAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
          },
        }
      ),
    ],
    user,
    [user]
  );

  return world;
}


/** Submits one oracle-signed day of health data at the given clock time. */
export function attestDay(
  w: World,
  opts: { day: number; steps: number; timestamp: number }
) {
  setClock(w.svm, opts.timestamp);

  const attestation = {
    challengeId: new anchor.BN(opts.day),
    user: w.user.publicKey,
    steps: opts.steps,
    sleepHours: 8,
    gym: true,
    epochDay: Math.floor(START_TIMESTAMP / 86400) + opts.day,
    nonce: new anchor.BN(opts.day),
    expiresAt: new anchor.BN(opts.timestamp + 3600),
  };

  const message = buildAttestationMessage(attestation);

  send(
    w.svm,
    [
      makeEd25519VerifyIx(w.admin, message),
      w.program.instruction.updateHealthData(attestation as any, {
        accounts: {
          user: w.user.publicKey,
          healthData: w.healthPda,
          stakeConfig: w.stakeConfigPda,
          stakeAccount: w.stakePda,
          instructions: INSTRUCTIONS_SYSVAR,
          systemProgram: web3.SystemProgram.programId,
        },
      }),
    ],
    w.user,
    [w.user]
  );
}

export function claim(w: World) {
  send(
    w.svm,
    [
      w.program.instruction.claim({
        accounts: {
          user: w.user.publicKey,
          stakeAccount: w.stakePda,
          userProfile: w.profilePda,
          stakeConfig: w.stakeConfigPda,
          treasuryConfig: w.treasuryConfigPda,
          vault: w.vaultPda,
          treasuryAuthority: w.treasuryAuthorityPda,
          treasuryVault: w.treasuryVault,
          userAta: w.userAta,
          mint: w.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        },
      }),
    ],
    w.user,
    [w.user]
  );
}
