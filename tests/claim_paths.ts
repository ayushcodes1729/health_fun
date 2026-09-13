import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  INSTRUCTIONS_SYSVAR,
  buildAttestationMessage,
  findProfilePda,
  findUserPdas,
  makeEd25519VerifyIx,
} from "./helpers/attestation";
import {
  DECIMALS,
  GOAL_STEPS,
  GOAL_STEPS_PER_DAY,
  STAKE_AMOUNT,
  START_TIMESTAMP,
  TOTAL_DAYS,
  World,
  attestDay,
  claim,
  expectVaultClosed,
  send,
  setClock,
  setupWorld,
  tokenBalance,
} from "./helpers/world";

/**
 * The claim branches cannot be exercised against solana-test-validator: a stake
 * unlocks `total_days * 86400` seconds after it is created, and the validator
 * offers no way to move its clock (the `warp_slot` RPC does not exist there).
 * LiteSVM lets us set the clock directly, so these are the only tests that can
 * prove a challenge that is genuinely won or genuinely lost.
 */

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
                userProfile: findProfilePda(w.programId, other.publicKey),
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
                userProfile: findProfilePda(w.programId, other.publicKey),
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

  it("does not count days attested after the challenge window closed", () => {
    const w = setupWorld();

    // Days 1 and 2 met, day 3 missed -> the challenge is lost on its own terms.
    const stepsByDay = [7_500, 7_500, 2_000];
    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: stepsByDay[day - 1],
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }

    // Day 4 is past unlock_at. Counting it would let a user who missed a day
    // simply keep going until enough good days accumulate, then claim a win.
    attestDay(w, {
      day: TOTAL_DAYS + 1,
      steps: 7_500,
      timestamp: START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400,
    });

    const decoded = w.program.coder.accounts.decode(
      "stakeAccount",
      Buffer.from(w.svm.getAccount(w.stakePda)!.data)
    );
    expect(decoded.daysGoalMet).to.equal(TOTAL_DAYS - 1);

    const userBefore = tokenBalance(w.svm, w.userAta);
    const treasuryBefore = tokenBalance(w.svm, w.treasuryVault);

    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 2) * 86400);
    claim(w);

    expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(
      treasuryBefore + BigInt(STAKE_AMOUNT)
    );
    expect(tokenBalance(w.svm, w.userAta)).to.equal(userBefore);
  });

  it("lets a user start a new challenge after settling the previous one", () => {
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

    // Claim closes the stake account, freeing ["stake", user] for reuse. While
    // it stayed open, `init` on a second stake failed with "account already in
    // use" and a wallet was limited to one challenge ever.
    expect(w.svm.getAccount(w.stakePda)).to.satisfy(
      (a: any) => a === null || a.lamports === 0
    );

    send(
      w.svm,
      [
        w.program.instruction.stake(
          new anchor.BN(STAKE_AMOUNT),
          TOTAL_DAYS,
          GOAL_STEPS,
          GOAL_STEPS_PER_DAY,
          {
            accounts: {
              user: w.user.publicKey,
              stakeAccount: w.stakePda,
              stakeConfig: w.stakeConfigPda,
              userProfile: w.profilePda,
              mint: w.mint,
              vault: w.vaultPda,
              userAta: w.userAta,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: web3.SystemProgram.programId,
            },
          }
        ),
      ],
      w.user,
      [w.user]
    );

    const stake = w.program.coder.accounts.decode(
      "stakeAccount",
      Buffer.from(w.svm.getAccount(w.stakePda)!.data)
    );
    expect(stake.daysGoalMet).to.equal(0);
    expect(stake.claimed).to.equal(false);
    expect(tokenBalance(w.svm, w.vaultPda)).to.equal(BigInt(STAKE_AMOUNT));
  });

  it("accumulates outcomes on the profile and resets the streak on a loss", () => {
    const w = setupWorld();

    const profileAfter = () =>
      w.program.coder.accounts.decode(
        "userProfile",
        Buffer.from(w.svm.getAccount(w.profilePda)!.data)
      );

    // The profile is created by the first stake and survives every claim.
    expect(profileAfter().totalStaked.toString()).to.equal(String(STAKE_AMOUNT));

    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: 7_500,
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }
    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);
    claim(w);

    let profile = profileAfter();
    expect(profile.challengesCompleted).to.equal(1);
    expect(profile.challengesFailed).to.equal(0);
    expect(profile.currentStreak).to.equal(1);
    expect(profile.longestStreak).to.equal(1);

    // Second challenge, deliberately lost.
    const secondStart = START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400;
    send(
      w.svm,
      [
        w.program.instruction.stake(
          new anchor.BN(STAKE_AMOUNT),
          TOTAL_DAYS,
          GOAL_STEPS,
          GOAL_STEPS_PER_DAY,
          {
            accounts: {
              user: w.user.publicKey,
              stakeAccount: w.stakePda,
              stakeConfig: w.stakeConfigPda,
              userProfile: w.profilePda,
              mint: w.mint,
              vault: w.vaultPda,
              userAta: w.userAta,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: web3.SystemProgram.programId,
            },
          }
        ),
      ],
      w.user,
      [w.user]
    );

    expect(profileAfter().totalStaked.toString()).to.equal(
      String(STAKE_AMOUNT * 2)
    );

    setClock(w.svm, secondStart + (TOTAL_DAYS + 1) * 86400);
    claim(w);

    profile = profileAfter();
    expect(profile.challengesCompleted).to.equal(1);
    expect(profile.challengesFailed).to.equal(1);
    expect(profile.currentStreak).to.equal(0);
    // A loss resets the current streak but must not lower the best one.
    expect(profile.longestStreak).to.equal(1);
  });

  it("claims a stake created before UserProfile existed", () => {
    const w = setupWorld();

    // Simulate a challenge that predates this program version: the stake and
    // vault exist, but the profile does not. Removing it after setup is the
    // closest LiteSVM gets to an on-chain account written by the old layout.
    w.svm.setAccount(w.profilePda, {
      lamports: 0,
      data: new Uint8Array(0),
      owner: web3.SystemProgram.programId,
      executable: false,
    });
    expect(w.svm.getAccount(w.profilePda)).to.satisfy(
      (a: any) => a === null || a.lamports === 0
    );

    for (let day = 1; day <= TOTAL_DAYS; day += 1) {
      attestDay(w, {
        day,
        steps: 7_500,
        timestamp: START_TIMESTAMP + day * 86400,
      });
    }

    const userBefore = tokenBalance(w.svm, w.userAta);
    setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);

    // Before the fix this failed with AccountNotInitialized on user_profile,
    // and nothing else could create the profile, so the funds were locked.
    claim(w);

    expect(tokenBalance(w.svm, w.userAta)).to.equal(
      userBefore + BigInt(STAKE_AMOUNT)
    );

    // claim created the profile and back-filled the stake it was settling.
    const profile = w.program.coder.accounts.decode(
      "userProfile",
      Buffer.from(w.svm.getAccount(w.profilePda)!.data)
    );
    expect(profile.user.toBase58()).to.equal(w.user.publicKey.toBase58());
    expect(profile.challengesCompleted).to.equal(1);
    expect(profile.currentStreak).to.equal(1);
    expect(profile.totalStaked.toString()).to.equal(String(STAKE_AMOUNT));
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

    // Claim closes both the vault and the stake account, so a second attempt is
    // rejected during account validation. The `claimed` flag is no longer
    // readable and is kept only as a guard for any future non-closing path.
    expect(() => claim(w)).to.throw(/AccountNotInitialized/i);
    expect(w.svm.getAccount(w.stakePda)).to.satisfy(
      (a: any) => a === null || a.lamports === 0
    );
  });
});
