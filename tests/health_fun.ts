import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import nacl from "tweetnacl";

import { HealthFun } from "../target/types/health_fun";

const INSTRUCTIONS_SYSVAR = new web3.PublicKey(
  "Sysvar1nstructions1111111111111111111111111"
);
const ED25519_PROGRAM_ID = new web3.PublicKey(
  "Ed25519SigVerify111111111111111111111111111"
);

const INIT_CONFIG = {
  maxStake: new anchor.BN(1_000_000_000),
  maxFreezeTime: new anchor.BN(4_102_444_800),
  minFreezeTime: new anchor.BN(0),
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
  treasuryConfigPda: web3.PublicKey;
  treasuryAuthorityPda: web3.PublicKey;
  treasuryVault: web3.PublicKey;
};

function toU64(n: anchor.BN): bigint {
  return BigInt(n.toString());
}

function currentEpochDay(): number {
  return Math.floor(Date.now() / 1000 / 86400);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function findStakeConfigPda(programId: web3.PublicKey): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

function findUserPdas(programId: web3.PublicKey, user: web3.PublicKey) {
  const stakePda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), user.toBuffer()],
    programId
  )[0];
  const vaultPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.toBuffer()],
    programId
  )[0];
  const healthPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("health"), user.toBuffer()],
    programId
  )[0];
  return { stakePda, vaultPda, healthPda };
}

function findTreasuryPdas(programId: web3.PublicKey, mint: web3.PublicKey) {
  const treasuryConfigPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_config"), mint.toBuffer()],
    programId
  )[0];
  const treasuryAuthorityPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_authority"), mint.toBuffer()],
    programId
  )[0];
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

  await ctx.provider.connection.requestAirdrop(user, USER_FUNDING - bal);
  await sleep(300);
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
        INIT_CONFIG.maxFreezeTime,
        INIT_CONFIG.minFreezeTime,
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

async function transferIntoVaultDirectly(ctx: Ctx, c: Challenge, amount: anchor.BN) {
  const ix = createTransferCheckedInstruction(
    c.userAta,
    c.mint,
    c.vaultPda,
    c.user.publicKey,
    Number(amount.toString()),
    TEST_DECIMALS,
    [],
    TOKEN_PROGRAM_ID
  );

  const tx = new web3.Transaction().add(ix);

  await withBlockhashRetry(() =>
    ctx.provider.sendAndConfirm(tx, [c.user], {
      commitment: "confirmed",
    })
  );
}

function buildAttestationMessage(params: {
  challengeId: anchor.BN;
  user: web3.PublicKey;
  steps: number;
  sleepHours: number;
  gym: boolean;
  epochDay: number;
  nonce: anchor.BN;
  expiresAt: anchor.BN;
}): Buffer {
  const buf = Buffer.alloc(9 + 32 + 8 + 2 + 4 + 1 + 1 + 8 + 8);
  let o = 0;

  buf.write("HEALTH_V1", o, "ascii");
  o += 9;
  params.user.toBuffer().copy(buf, o);
  o += 32;
  buf.writeBigUInt64LE(toU64(params.challengeId), o);
  o += 8;
  buf.writeUInt16LE(params.epochDay, o);
  o += 2;
  buf.writeUInt32LE(params.steps, o);
  o += 4;
  buf.writeUInt8(params.sleepHours, o);
  o += 1;
  buf.writeUInt8(params.gym ? 1 : 0, o);
  o += 1;
  buf.writeBigUInt64LE(toU64(params.nonce), o);
  o += 8;
  buf.writeBigInt64LE(BigInt(params.expiresAt.toString()), o);

  return buf;
}

function buildEd25519IxData(signature: Uint8Array, publicKey: Uint8Array, message: Buffer): Buffer {
  const SIG_OFF = 16;
  const PK_OFF = SIG_OFF + 64;
  const MSG_OFF = PK_OFF + 32;

  const buf = Buffer.alloc(MSG_OFF + message.length);

  buf.writeUInt8(1, 0);
  buf.writeUInt8(0, 1);
  buf.writeUInt16LE(SIG_OFF, 2);
  buf.writeUInt16LE(0xffff, 4);
  buf.writeUInt16LE(PK_OFF, 6);
  buf.writeUInt16LE(0xffff, 8);
  buf.writeUInt16LE(MSG_OFF, 10);
  buf.writeUInt16LE(message.length, 12);
  buf.writeUInt16LE(0xffff, 14);

  Buffer.from(signature).copy(buf, SIG_OFF);
  Buffer.from(publicKey).copy(buf, PK_OFF);
  message.copy(buf, MSG_OFF);

  return buf;
}

function makeEd25519VerifyIx(oracle: web3.Keypair, message: Buffer): web3.TransactionInstruction {
  const sig = nacl.sign.detached(message, oracle.secretKey);
  const data = buildEd25519IxData(sig, oracle.publicKey.toBytes(), message);
  return new web3.TransactionInstruction({
    programId: ED25519_PROGRAM_ID,
    keys: [],
    data,
  });
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
            INIT_CONFIG.maxFreezeTime,
            INIT_CONFIG.minFreezeTime,
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
      expect(cfg.minFreezeTime.toString()).to.equal(INIT_CONFIG.minFreezeTime.toString());
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

    it("complete reward flow: stake -> update goal met -> claim to user", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 300_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 0);
      await transferIntoVaultDirectly(ctx, c, STAKE_AMOUNT);

      await sleep(1100);
      await sendUpdateWithEd25519(ctx, c, ctx.admin, {
        challengeId: new anchor.BN(1),
        user: c.user.publicKey,
        steps: 7_500,
        sleepHours: 8,
        gym: true,
        epochDay: currentEpochDay() + 1,
        nonce: new anchor.BN(1),
        expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) + 120),
      });

      const beforeUser = await getAccount(ctx.provider.connection, c.userAta, "confirmed", TOKEN_PROGRAM_ID);
      const beforeTreasury = await getAccount(
        ctx.provider.connection,
        c.treasuryVault,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      await withBlockhashRetry(() =>
        ctx.program.methods
          .claim()
          .accountsStrict({
            user: c.user.publicKey,
            stakeAccount: c.stakePda,
            stakeConfig: ctx.stakeConfigPda,
            treasuryConfig: c.treasuryConfigPda,
            vault: c.vaultPda,
            treasuryAuthority: c.treasuryAuthorityPda,
            treasuryVault: c.treasuryVault,
            userAta: c.userAta,
            mint: c.mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([c.user])
          .rpc({ commitment: "confirmed" })
      );

      const afterUser = await getAccount(ctx.provider.connection, c.userAta, "confirmed", TOKEN_PROGRAM_ID);
      const afterTreasury = await getAccount(
        ctx.provider.connection,
        c.treasuryVault,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      expect(afterUser.amount).to.equal(beforeUser.amount + toU64(STAKE_AMOUNT));
      expect(afterTreasury.amount).to.equal(beforeTreasury.amount);
    });

    
    it("rejects claim while still locked", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 250_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 1);
      await transferIntoVaultDirectly(ctx, c, STAKE_AMOUNT);

      await expectErrorContains(
        withBlockhashRetry(() =>
          ctx.program.methods
            .claim()
            .accountsStrict({
              user: c.user.publicKey,
              stakeAccount: c.stakePda,
              stakeConfig: ctx.stakeConfigPda,
              treasuryConfig: c.treasuryConfigPda,
              vault: c.vaultPda,
              treasuryAuthority: c.treasuryAuthorityPda,
              treasuryVault: c.treasuryVault,
              userAta: c.userAta,
              mint: c.mint,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([c.user])
            .rpc({ commitment: "confirmed" })
        ),
        "The challenge has not completed"
      );
    });

    it("rejects replayed nonce", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 220_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 0);
      await transferIntoVaultDirectly(ctx, c, STAKE_AMOUNT);

      const base = {
        challengeId: new anchor.BN(3),
        user: c.user.publicKey,
        steps: 7_000,
        sleepHours: 8,
        gym: true,
        epochDay: currentEpochDay() + 1,
        nonce: new anchor.BN(9),
        expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) + 180),
      };

      await sleep(1100);
      await sendUpdateWithEd25519(ctx, c, ctx.admin, base);

      await sleep(1100);
      await expectErrorContains(
        sendUpdateWithEd25519(ctx, c, ctx.admin, {
          ...base,
          epochDay: currentEpochDay() + 2,
        }),
        "Replay update of health data"
      );
    });

    it("rejects wrong oracle signature", async () => {
      await initializeConfigIfNeeded(ctx);
      const c = await createChallenge(ctx, 220_000);
      await initializeTreasury(ctx, c);
      await initializeHealth(ctx, c);
      await initializeStake(ctx, c, 0);
      await transferIntoVaultDirectly(ctx, c, STAKE_AMOUNT);

      const badOracle = web3.Keypair.generate();
      await sleep(1100);
      await expectErrorContains(
        sendUpdateWithEd25519(ctx, c, badOracle, {
          challengeId: new anchor.BN(4),
          user: c.user.publicKey,
          steps: 9_000,
          sleepHours: 7,
          gym: true,
          epochDay: currentEpochDay() + 1,
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
      await initializeStake(ctx, c, 0);
      await transferIntoVaultDirectly(ctx, c, STAKE_AMOUNT);

      await sleep(1100);
      await expectErrorContains(
        sendUpdateWithEd25519(ctx, c, ctx.admin, {
          challengeId: new anchor.BN(5),
          user: c.user.publicKey,
          steps: 9_000,
          sleepHours: 7,
          gym: true,
          epochDay: currentEpochDay() + 1,
          nonce: new anchor.BN(1),
          expiresAt: new anchor.BN(Math.floor(Date.now() / 1000) - 10),
        }),
        "Attestation data expired"
      );
    });
  });

