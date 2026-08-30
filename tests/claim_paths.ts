import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { expect } from "chai";
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

import { HealthFun } from "../target/types/health_fun";
import {
  INSTRUCTIONS_SYSVAR,
  buildAttestationMessage,
  findStakeConfigPda,
  findTreasuryAuthorityPda,
  findTreasuryConfigPda,
  findUserPdas,
  makeEd25519VerifyIx,
} from "./helpers/attestation";

const idl = require("../target/idl/health_fun.json");

/**
 * The claim branches cannot be exercised against solana-test-validator: a stake
 * unlocks `total_days * 86400` seconds after it is created, and the validator
 * offers no way to move its clock (the `warp_slot` RPC does not exist there).
 * LiteSVM lets us set the clock directly, so these are the only tests that can
 * prove a challenge that is genuinely won or genuinely lost.
 */

const DECIMALS = 6;
const STAKE_AMOUNT = 100_000;
const MINT_AMOUNT = 300_000;
const TOTAL_DAYS = 3;
const GOAL_STEPS_PER_DAY = 5_000;

// A fixed, arbitrary point in time so every run is deterministic.
const START_TIMESTAMP = 1_800_000_000;

const MAX_STAKE = new anchor.BN(1_000_000_000);
// Lock bounds are DURATIONS in seconds, not timestamps.
const MIN_LOCK_DURATION = new anchor.BN(86400);
const MAX_LOCK_DURATION = new anchor.BN(365 * 86400);

// initialize_config is gated on this constant, compiled into the program.
const ADMIN_KEY = "3CPvFJ3RDJH9RjpzY3WYxn1vcrL7J63hZQc9YboMaCg9";

const GOAL_STEPS = { steps: {} } as any;

function loadAdminKeypair(): web3.Keypair {
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

type World = {
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
  stakeConfigPda: web3.PublicKey;
  treasuryConfigPda: web3.PublicKey;
  treasuryAuthorityPda: web3.PublicKey;
  treasuryVault: web3.PublicKey;
};

function send(
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

function setClock(svm: LiteSVM, unixTimestamp: number) {
  const clock = svm.getClock();
  clock.unixTimestamp = BigInt(unixTimestamp);
  svm.setClock(clock);
}

/** Claim closes the vault, so the account should be gone (or zeroed) after. */
function expectVaultClosed(svm: LiteSVM, vault: web3.PublicKey) {
  const raw = svm.getAccount(vault);
  if (raw !== null && raw.lamports !== 0) {
    throw new Error(
      `Vault ${vault.toBase58()} still open with ${raw.lamports} lamports`
    );
  }
}

function tokenBalance(svm: LiteSVM, account: web3.PublicKey): bigint {
  const raw = svm.getAccount(account);
  if (!raw) throw new Error(`Token account ${account.toBase58()} not found`);
  // SPL token account layout: mint(32) owner(32) amount(u64)
  return Buffer.from(raw.data).readBigUInt64LE(64);
}

/**
 * Builds a fully set-up challenge: config, treasury, mint, funded user, an
 * initialized health account, and a funded stake (stake transfers atomically).
 */
function setupWorld(): World {
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
function attestDay(
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

function claim(w: World) {
  send(
    w.svm,
    [
      w.program.instruction.claim({
        accounts: {
          user: w.user.publicKey,
          stakeAccount: w.stakePda,
          stakeConfig: w.stakeConfigPda,
          treasuryConfig: w.treasuryConfigPda,
          vault: w.vaultPda,
          treasuryAuthority: w.treasuryAuthorityPda,
          treasuryVault: w.treasuryVault,
          userAta: w.userAta,
          mint: w.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }),
    ],
    w.user,
    [w.user]
  );
}

describe("health_fun - claim paths (LiteSVM, controlled clock)", () => {
  it("records the stake amount on-chain and funds the vault atomically", () => {
    const w = setupWorld();
    const stake = w.svm.getAccount(w.stakePda);
    expect(stake).to.not.equal(null);

    // StakeAccount layout: discriminator(8) owner(32) mint(32) staked_amount(u64)
    const stakedAmount = Buffer.from(stake!.data).readBigUInt64LE(72);
    expect(stakedAmount).to.equal(BigInt(STAKE_AMOUNT));
    expect(tokenBalance(w.svm, w.vaultPda)).to.equal(BigInt(STAKE_AMOUNT));
  });

  it("returns the stake when every day's goal is met", () => {
    const w = setupWorld();

    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: 7_500,
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }

    const stakeAccount = w.svm.getAccount(w.stakePda)!;
    // days_goal_met sits after unlock-relevant fields; assert via program state
    // fetched through the coder for clarity.
    const decoded = w.program.coder.accounts.decode(
      "stakeAccount",
      Buffer.from(stakeAccount.data)
    );
    expect(decoded.daysGoalMet).to.equal(TOTAL_DAYS);

    const userBefore = tokenBalance(w.svm, w.userAta);
    const treasuryBefore = tokenBalance(w.svm, w.treasuryVault);
    const vaultRent = w.svm.getAccount(w.vaultPda)!.lamports;
    const lamportsBefore = w.svm.getBalance(w.user.publicKey)!;

    // Move past unlock_at.
    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);
    claim(w);

    expect(tokenBalance(w.svm, w.userAta)).to.equal(
      userBefore + BigInt(STAKE_AMOUNT)
    );
    expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(treasuryBefore);
    expectVaultClosed(w.svm, w.vaultPda);

    // Closing the vault must return its rent to the user rather than stranding
    // it. Compare net of the transaction fee.
    expect(
      w.svm.getBalance(w.user.publicKey)! > lamportsBefore + BigInt(vaultRent) / BigInt(2)
    ).to.equal(true);
  });

  it("forfeits the stake to the treasury when a day is missed", () => {
    const w = setupWorld();

    // Day 2 falls short of the 5000-step goal.
    const stepsByDay = [7_500, 2_000, 7_500];

    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: stepsByDay[day - 1],
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }

    const decoded = w.program.coder.accounts.decode(
      "stakeAccount",
      Buffer.from(w.svm.getAccount(w.stakePda)!.data)
    );
    expect(decoded.daysGoalMet).to.equal(TOTAL_DAYS - 1);

    const userBefore = tokenBalance(w.svm, w.userAta);
    const treasuryBefore = tokenBalance(w.svm, w.treasuryVault);

    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);
    claim(w);

    expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(
      treasuryBefore + BigInt(STAKE_AMOUNT)
    );
    expect(tokenBalance(w.svm, w.userAta)).to.equal(userBefore);
    expectVaultClosed(w.svm, w.vaultPda);
  });

  it("sweeps tokens transferred into the vault outside the program", () => {
    const w = setupWorld();
    const smuggled = 150_000;

    // Anyone can transfer into an SPL token account without the owner's
    // consent, so this bypasses stake and its max_stake check entirely.
    send(
      w.svm,
      [
        createTransferCheckedInstruction(
          w.userAta,
          w.mint,
          w.vaultPda,
          w.user.publicKey,
          smuggled,
          DECIMALS
        ),
      ],
      w.user,
      [w.user]
    );
    expect(tokenBalance(w.svm, w.vaultPda)).to.equal(
      BigInt(STAKE_AMOUNT + smuggled)
    );

    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: 7_500,
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }

    const userBefore = tokenBalance(w.svm, w.userAta);
    const treasuryBefore = tokenBalance(w.svm, w.treasuryVault);

    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);
    claim(w);

    // The winner gets back only what the program recorded, never the smuggled
    // excess; the remainder goes to the treasury rather than out to the user.
    expect(tokenBalance(w.svm, w.userAta)).to.equal(
      userBefore + BigInt(STAKE_AMOUNT)
    );
    expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(
      treasuryBefore + BigInt(smuggled)
    );
    expectVaultClosed(w.svm, w.vaultPda);
  });

  it("rejects a replayed nonce", () => {
    const w = setupWorld();

    attestDay(w, { day: 1, steps: 7_000, timestamp: START_TIMESTAMP + 86400 });

    // Day 2 is a valid next day, but reuses day 1's nonce.
    setClock(w.svm, START_TIMESTAMP + 2 * 86400);
    const attestation = {
      challengeId: new anchor.BN(2),
      user: w.user.publicKey,
      steps: 7_000,
      sleepHours: 8,
      gym: true,
      epochDay: Math.floor(START_TIMESTAMP / 86400) + 2,
      nonce: new anchor.BN(1),
      expiresAt: new anchor.BN(START_TIMESTAMP + 2 * 86400 + 3600),
    };

    expect(() =>
      send(
        w.svm,
        [
          makeEd25519VerifyIx(w.admin, buildAttestationMessage(attestation)),
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
      )
    ).to.throw(/ReplayUpdate/i);
  });

  it("rejects an attested day in the future", () => {
    const w = setupWorld();

    // u16::MAX would otherwise be stored and make every later attestation
    // impossible, permanently freezing the account.
    expect(() =>
      attestDay(w, {
        day: 65_535 - Math.floor(START_TIMESTAMP / 86400),
        steps: 7_500,
        timestamp: START_TIMESTAMP + 86400,
      })
    ).to.throw(/FutureEpoch/i);
  });

  // `stake` builds a challenge for a fresh user; both zero-value guards run
  // before any account is written, so the whole transaction is rejected.
  function expectStakeRejected(
    w: World,
    amount: number,
    totalDays: number
  ): () => void {
    const other = web3.Keypair.generate();
    w.svm.airdrop(other.publicKey, BigInt(10 * web3.LAMPORTS_PER_SOL));

    const { stakePda, vaultPda } = findUserPdas(w.programId, other.publicKey);
    const otherAta = getAssociatedTokenAddressSync(w.mint, other.publicKey, false);

    return () =>
      send(
        w.svm,
        [
          createAssociatedTokenAccountInstruction(
            other.publicKey,
            otherAta,
            other.publicKey,
            w.mint
          ),
          w.program.instruction.stake(
            new anchor.BN(amount),
            totalDays,
            GOAL_STEPS,
            GOAL_STEPS_PER_DAY,
            {
              accounts: {
                user: other.publicKey,
                stakeAccount: stakePda,
                stakeConfig: w.stakeConfigPda,
                mint: w.mint,
                vault: vaultPda,
                userAta: otherAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
              },
            }
          ),
        ],
        other,
        [other]
      );
  }

  it("rejects a stake of zero tokens", () => {
    const w = setupWorld();
    expect(expectStakeRejected(w, 0, TOTAL_DAYS)).to.throw(/ZeroStake/i);
  });

  it("rejects a zero-day challenge", () => {
    const w = setupWorld();
    const other = web3.Keypair.generate();
    w.svm.airdrop(other.publicKey, BigInt(10 * web3.LAMPORTS_PER_SOL));

    const { stakePda, vaultPda } = findUserPdas(w.programId, other.publicKey);
    const otherAta = getAssociatedTokenAddressSync(w.mint, other.publicKey, false);

    expect(() =>
      send(
        w.svm,
        [
          createAssociatedTokenAccountInstruction(
            other.publicKey,
            otherAta,
            other.publicKey,
            w.mint
          ),
          w.program.instruction.stake(
            new anchor.BN(STAKE_AMOUNT),
            0,
            GOAL_STEPS,
            GOAL_STEPS_PER_DAY,
            {
              accounts: {
                user: other.publicKey,
                stakeAccount: stakePda,
                stakeConfig: w.stakeConfigPda,
                mint: w.mint,
                vault: vaultPda,
                userAta: otherAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: web3.SystemProgram.programId,
              },
            }
          ),
        ],
        other,
        [other]
      )
    ).to.throw(/DurationOutOfRange/i);
  });

  it("rejects a second claim", () => {
    const w = setupWorld();

    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: 7_500,
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }

    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);
    claim(w);

    // Claim closes the vault, so a second attempt is now rejected during
    // account validation rather than by the `claimed` flag, which stays set as
    // defence in depth.
    expect(() => claim(w)).to.throw(/AccountNotInitialized/i);

    const decoded = w.program.coder.accounts.decode(
      "stakeAccount",
      Buffer.from(w.svm.getAccount(w.stakePda)!.data)
    );
    expect(decoded.claimed).to.equal(true);
  });
});
