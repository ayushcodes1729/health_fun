import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { config as chaiConfig, expect } from "chai";

// Show full error text on assertion failures; the default 40-char truncation
// hides the on-chain program logs that explain why a transaction failed.
chaiConfig.truncateThreshold = 0;
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

import { HealthFun } from "../target/types/health_fun";
import {
  INSTRUCTIONS_SYSVAR,
  buildAttestationMessage,
  findStakeConfigPda,
  findTreasuryAuthorityPda,
  findTreasuryConfigPda,
  findProfilePda,
  findUserPdas,
  makeEd25519VerifyIx,
} from "./helpers/attestation";


// Lock bounds are DURATIONS in seconds, not timestamps.
const INIT_CONFIG = {
  maxStake: new anchor.BN(1_000_000_000),
  maxLockDuration: new anchor.BN(365 * 86400),
  minLockDuration: new anchor.BN(86400),
};

const TEST_DECIMALS = 6;
const STAKE_AMOUNT = new anchor.BN(100_000);
const USER_FUNDING = 2 * web3.LAMPORTS_PER_SOL;
const CONFIRMED_OPTS: web3.ConfirmOptions = {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
};

const GOAL_STEPS = { steps: {} } as any;

type Ctx = {
  provider: anchor.AnchorProvider;
  program: Program<HealthFun>;
  admin: web3.Keypair;
  stakeConfigPda: web3.PublicKey;
};

type Challenge = {
  user: web3.Keypair;
  mint: web3.PublicKey;
  userAta: web3.PublicKey;
  stakePda: web3.PublicKey;
  vaultPda: web3.PublicKey;
  healthPda: web3.PublicKey;
  profilePda: web3.PublicKey;
  treasuryConfigPda: web3.PublicKey;
  treasuryAuthorityPda: web3.PublicKey;
  treasuryVault: web3.PublicKey;
};

function currentEpochDay(): number {
  return Math.floor(Date.now() / 1000 / 86400);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reads the validator's own clock. `update_health_data` requires
// `now > health_data.last_sync_timestamp`, and the cluster clock drifts from
// wall-clock time, so sleeping a fixed number of milliseconds between updates
// races it and intermittently throws StaleUpdateError.
async function getChainUnixTimestamp(ctx: Ctx): Promise<number> {
  const clockAccount = await ctx.provider.connection.getAccountInfo(
    web3.SYSVAR_CLOCK_PUBKEY,
    "confirmed"
  );

  if (!clockAccount) {
    throw new Error("Clock sysvar account not found");
  }

  // Clock layout: slot(u64) epoch_start_timestamp(i64) epoch(u64)
  // leader_schedule_epoch(u64) unix_timestamp(i64)
  return Number(clockAccount.data.readBigInt64LE(32));
}

async function waitForChainTimeAfter(ctx: Ctx, timestamp: number) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await getChainUnixTimestamp(ctx)) > timestamp) return;
    await sleep(500);
  }

  throw new Error(`Cluster clock did not advance past ${timestamp}`);
}

async function withBlockhashRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (String(e).toLowerCase().includes("blockhash not found")) {
      await sleep(200);
      return fn();
    }
    throw e;
  }
}

async function expectErrorContains(p: Promise<unknown>, msg: string) {
  try {
    await p;
    expect.fail(`Expected error containing: ${msg}`);
  } catch (e: any) {
    expect(String(e).toLowerCase()).to.include(msg.toLowerCase());
  }
}


function findTreasuryPdas(programId: web3.PublicKey, mint: web3.PublicKey) {
  const treasuryConfigPda = findTreasuryConfigPda(programId, mint);
  const treasuryAuthorityPda = findTreasuryAuthorityPda(programId, mint);
  const treasuryVault = getAssociatedTokenAddressSync(
    mint,
    treasuryAuthorityPda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { treasuryConfigPda, treasuryAuthorityPda, treasuryVault };
}

async function fundUser(ctx: Ctx, user: web3.PublicKey) {
  const bal = await ctx.provider.connection.getBalance(user, "confirmed");
  if (bal >= USER_FUNDING) return;

  const signature = await ctx.provider.connection.requestAirdrop(
    user,
    USER_FUNDING - bal
  );

  // Wait for the airdrop to actually land. A bare sleep races the validator and
  // leaves the account at 0 lamports, which surfaces as a confusing
  // "insufficient lamports" failure inside whatever instruction runs next.
  const latestBlockhash = await ctx.provider.connection.getLatestBlockhash(
    "confirmed"
  );
  await ctx.provider.connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );
}

async function initializeConfigIfNeeded(ctx: Ctx) {
  try {
    await ctx.program.account.stakeConfig.fetch(ctx.stakeConfigPda);
    return;
  } catch {
    // continue
  }

  await withBlockhashRetry(() =>
    ctx.program.methods
      .initializeConfig(
        INIT_CONFIG.maxStake,
        INIT_CONFIG.maxLockDuration,
        INIT_CONFIG.minLockDuration,
        ctx.admin.publicKey
      )
      .accountsStrict({
        admin: ctx.admin.publicKey,
        stakeConfig: ctx.stakeConfigPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc({ commitment: "confirmed" })
  );
}

async function createChallenge(ctx: Ctx, mintAmount: number): Promise<Challenge> {
  const user = web3.Keypair.generate();
  await fundUser(ctx, user.publicKey);

  const mint = await withBlockhashRetry(() =>
    createMint(
      ctx.provider.connection,
      ctx.admin,
      ctx.admin.publicKey,
      null,
      TEST_DECIMALS,
      undefined,
      CONFIRMED_OPTS,
      TOKEN_PROGRAM_ID
    )
  );

  const userAtaAcc = await withBlockhashRetry(() =>
    getOrCreateAssociatedTokenAccount(
      ctx.provider.connection,
      ctx.admin,
      mint,
      user.publicKey,
      undefined,
      "confirmed",
      CONFIRMED_OPTS,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await withBlockhashRetry(() =>
    mintTo(
      ctx.provider.connection,
      ctx.admin,
      mint,
      userAtaAcc.address,
      ctx.admin,
      mintAmount,
      [],
      CONFIRMED_OPTS,
      TOKEN_PROGRAM_ID
    )
  );

  const { stakePda, vaultPda, healthPda } = findUserPdas(ctx.program.programId, user.publicKey);
  const { treasuryConfigPda, treasuryAuthorityPda, treasuryVault } = findTreasuryPdas(
    ctx.program.programId,
    mint
  );

  return {
    user,
    mint,
    userAta: userAtaAcc.address,
    stakePda,
    vaultPda,
    healthPda,
    profilePda: findProfilePda(ctx.program.programId, user.publicKey),
    treasuryConfigPda,
    treasuryAuthorityPda,
    treasuryVault,
  };
}

async function initializeTreasury(ctx: Ctx, c: Challenge) {
  await withBlockhashRetry(() =>
    ctx.program.methods
      .initializeTreasuryForMint()
      .accountsStrict({
        admin: ctx.admin.publicKey,
        stakeConfig: ctx.stakeConfigPda,
        treasuryConfig: c.treasuryConfigPda,
        treasuryAuthority: c.treasuryAuthorityPda,
        treasuryVault: c.treasuryVault,
        mint: c.mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([ctx.admin])
      .rpc({ commitment: "confirmed" })
  );
}

async function initializeHealth(ctx: Ctx, c: Challenge) {
  await withBlockhashRetry(() =>
    ctx.program.methods
      .initializeHealthData(ctx.admin.publicKey)
      .accountsStrict({
        user: c.user.publicKey,
        healthData: c.healthPda,
        stakeConfig: ctx.stakeConfigPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([c.user])
      .rpc({ commitment: "confirmed" })
  );
}

async function initializeStake(ctx: Ctx, c: Challenge, totalDays: number) {
  await withBlockhashRetry(() =>
    ctx.program.methods
      .stake(STAKE_AMOUNT, totalDays, GOAL_STEPS, 5_000)
      .accountsStrict({
        user: c.user.publicKey,
        stakeAccount: c.stakePda,
        stakeConfig: ctx.stakeConfigPda,
        userProfile: c.profilePda,
        mint: c.mint,
        vault: c.vaultPda,
        userAta: c.userAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([c.user])
      .rpc({ commitment: "confirmed" })
  );
}



async function sendUpdateWithEd25519(
  ctx: Ctx,
  c: Challenge,
  oracle: web3.Keypair,
  attestation: {
    challengeId: anchor.BN;
    user: web3.PublicKey;
    steps: number;
    sleepHours: number;
    gym: boolean;
    epochDay: number;
    nonce: anchor.BN;
    expiresAt: anchor.BN;
  }
) {
  const msg = buildAttestationMessage(attestation);
  const ed25519Ix = makeEd25519VerifyIx(oracle, msg);

  const updateIx = await ctx.program.methods
    .updateHealthData(attestation)
    .accountsStrict({
      user: c.user.publicKey,
      healthData: c.healthPda,
      stakeConfig: ctx.stakeConfigPda,
      stakeAccount: c.stakePda,
      instructions: INSTRUCTIONS_SYSVAR,
      systemProgram: web3.SystemProgram.programId,
    })
    .instruction();

  const tx = new web3.Transaction().add(ed25519Ix).add(updateIx);

  await withBlockhashRetry(() =>
    ctx.provider.sendAndConfirm(tx, [c.user], {
      commitment: "confirmed",
    })
  );
}

async function warpToUnlock(ctx: Ctx, unlockAt: anchor.BN) {
  const now = Math.floor(Date.now() / 1000);
  if (now >= Number(unlockAt.toString())) return;

  const slot = await ctx.provider.connection.getSlot("processed");
  const target = slot + 500_000;

  const resSnake = await (ctx.provider.connection as any)._rpcRequest("warp_slot", [target]);
  if (!resSnake?.error) return;

  const resCamel = await (ctx.provider.connection as any)._rpcRequest("warpSlot", [target]);
  if (!resCamel?.error) return;

  throw new Error(
    `warp RPC not supported by validator: ${JSON.stringify({
      warp_slot: resSnake?.error,
      warpSlot: resCamel?.error,
    })}`
  );
}

describe("health_fun - web3.js only tests", () => {
  let ctx: Ctx;

  before(async () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider() as anchor.AnchorProvider;
    const program = anchor.workspace.HealthFun as Program<HealthFun>;
    const admin = (provider.wallet as anchor.Wallet & { payer: web3.Keypair }).payer;

    ctx = {
      provider,
      program,
      admin,
      stakeConfigPda: findStakeConfigPda(program.programId),
    };
  });

    it("rejects initialize_config for non-admin", async () => {
      const badAdmin = web3.Keypair.generate();
      await fundUser(ctx, badAdmin.publicKey);

      await expectErrorContains(
        ctx.program.methods
          .initializeConfig(
            INIT_CONFIG.maxStake,
            INIT_CONFIG.maxLockDuration,
            INIT_CONFIG.minLockDuration,
            ctx.admin.publicKey
          )
          .accountsStrict({
            admin: badAdmin.publicKey,
            stakeConfig: ctx.stakeConfigPda,
            systemProgram: web3.SystemProgram.programId,
          })
          .signers([badAdmin])
          .rpc({ commitment: "confirmed" }),
        "Invalid admin pubkey"
      );
    });

    it("initializes stake config", async () => {
      await initializeConfigIfNeeded(ctx);
      const cfg = await ctx.program.account.stakeConfig.fetch(ctx.stakeConfigPda);
      expect(cfg.maxStake.toString()).to.equal(INIT_CONFIG.maxStake.toString());
      expect(cfg.minLockDuration.toString()).to.equal(INIT_CONFIG.minLockDuration.toString());
    });

    it("rejects initialize_health_data with wrong verification key", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 50_000);

      await expectErrorContains(
        ctx.program.methods
          .initializeHealthData(web3.Keypair.generate().publicKey)
          .accountsStrict({
            user: c.user.publicKey,
            healthData: c.healthPda,
            stakeConfig: ctx.stakeConfigPda,
            systemProgram: web3.SystemProgram.programId,
          })
          .signers([c.user])
          .rpc({ commitment: "confirmed" }),
        "verification key"
      );
    });

    // Only a single attested day is reachable here: the attested day may not be
    // in the future, and it must exceed the day already stored, so the validator
    // (whose clock cannot be moved) allows exactly one per real day. Multi-day
    // accumulation is covered in claim_paths.ts, which controls the clock.
    it("persists attested health data on-chain", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 300_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 3);

      const health = await ctx.program.account.healthData.fetch(c.healthPda);
      await waitForChainTimeAfter(ctx, health.lastSyncTimestamp.toNumber());

      await sendUpdateWithEd25519(ctx, c, ctx.admin, {
        challengeId: new anchor.BN(101),
        user: c.user.publicKey,
        steps: 7_500,
        sleepHours: 8,
        gym: true,
        epochDay: currentEpochDay(),
        nonce: new anchor.BN(1),
        expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) + 120),
      });

      const after = await ctx.program.account.healthData.fetch(c.healthPda);

      // The oracle's attested values must actually be written to the account.
      expect(after.steps).to.equal(7_500);
      expect(after.sleepHours).to.equal(8);
      expect(after.gym).to.equal(true);
      expect(after.lastNonce.toString()).to.equal("1");
      expect(after.epochDay).to.equal(currentEpochDay());
    });

    // The winning claim path moved to claim_paths.ts: `total_days` must now be
    // at least 1, so `unlock_at` is always a day away and no claim can succeed
    // against a validator whose clock cannot be advanced.

    
    it("rejects claim while still locked", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 250_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 1);

      await expectErrorContains(
        withBlockhashRetry(() =>
          ctx.program.methods
            .claim()
            .accountsStrict({
              user: c.user.publicKey,
              stakeAccount: c.stakePda,
              userProfile: c.profilePda,
              stakeConfig: ctx.stakeConfigPda,
              treasuryConfig: c.treasuryConfigPda,
              vault: c.vaultPda,
              treasuryAuthority: c.treasuryAuthorityPda,
              treasuryVault: c.treasuryVault,
              userAta: c.userAta,
              mint: c.mint,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: web3.SystemProgram.programId,
            })
            .signers([c.user])
            .rpc({ commitment: "confirmed" })
        ),
        "The challenge has not completed"
      );
    });


    it("rejects wrong oracle signature", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 220_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 1);

      const badOracle = web3.Keypair.generate();
      await sleep(1100);
      await expectErrorContains(
        sendUpdateWithEd25519(ctx, c, badOracle, {
          challengeId: new anchor.BN(4),
          user: c.user.publicKey,
          steps: 9_000,
          sleepHours: 7,
          gym: true,
          epochDay: currentEpochDay(),
          nonce: new anchor.BN(1),
          expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) + 120),
        }),
        "Invalid signature for the payload data"
      );
    });

    it("rejects expired attestation", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 220_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 1);

      await sleep(1100);
      await expectErrorContains(
        sendUpdateWithEd25519(ctx, c, ctx.admin, {
          challengeId: new anchor.BN(5),
          user: c.user.publicKey,
          steps: 9_000,
          sleepHours: 7,
          gym: true,
          epochDay: currentEpochDay(),
          nonce: new anchor.BN(1),
          expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) - 10),
        }),
        "Attestation data expired"
      );
    });
  });

