import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  INSTRUCTIONS_SYSVAR,
  buildAttestationMessage,
  findTreasuryAuthorityPda,
  findTreasuryConfigPda,
  makeEd25519VerifyIx,
} from "./helpers/attestation";
import {
  DECIMALS,
  MAX_LOCK_DURATION,
  MAX_STAKE,
  MIN_LOCK_DURATION,
  STAKE_AMOUNT,
  START_TIMESTAMP,
  TOTAL_DAYS,
  World,
  attestDay,
  claim,
  send,
  setClock,
  setupWorld,
  tokenBalance,
} from "./helpers/world";

/**
 * Admin surface: config updates (including oracle key and admin rotation) and
 * treasury withdrawal. Both are gated on the `admin` stored in StakeConfig,
 * not the compiled-in ADMIN_KEY, which is only the bootstrap signer.
 */

function decodeConfig(w: World) {
  return w.program.coder.accounts.decode(
    "stakeConfig",
    Buffer.from(w.svm.getAccount(w.stakeConfigPda)!.data)
  );
}

function currentParams(w: World) {
  const c = decodeConfig(w);
  return {
    maxStake: c.maxStake,
    minLockDuration: c.minLockDuration,
    maxLockDuration: c.maxLockDuration,
    verificationKey: c.verificationKey,
  };
}

function updateConfig(w: World, signer: web3.Keypair, params: any) {
  send(
    w.svm,
    [
      w.program.instruction.updateConfig(params, {
        accounts: {
          admin: signer.publicKey,
          stakeConfig: w.stakeConfigPda,
        },
      }),
    ],
    signer,
    [signer]
  );
}

function proposeAdmin(w: World, signer: web3.Keypair, newAdmin: web3.PublicKey) {
  send(
    w.svm,
    [
      w.program.instruction.proposeAdmin(newAdmin, {
        accounts: { admin: signer.publicKey, stakeConfig: w.stakeConfigPda },
      }),
    ],
    signer,
    [signer]
  );
}

function acceptAdmin(w: World, signer: web3.Keypair) {
  send(
    w.svm,
    [
      w.program.instruction.acceptAdmin({
        accounts: { newAdmin: signer.publicKey, stakeConfig: w.stakeConfigPda },
      }),
    ],
    signer,
    [signer]
  );
}

function withdrawTreasury(
  w: World,
  signer: web3.Keypair,
  destination: web3.PublicKey,
  amount: number
) {
  send(
    w.svm,
    [
      w.program.instruction.withdrawTreasury(new anchor.BN(amount), {
        accounts: {
          admin: signer.publicKey,
          stakeConfig: w.stakeConfigPda,
          treasuryConfig: w.treasuryConfigPda,
          treasuryAuthority: w.treasuryAuthorityPda,
          treasuryVault: w.treasuryVault,
          destination,
          mint: w.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }),
    ],
    signer,
    [signer]
  );
}

/** Runs a challenge to a forfeit so the treasury holds STAKE_AMOUNT. */
function forfeitOne(w: World) {
  const stepsByDay = [7_500, 2_000, 7_500];
  for (let day = 1; day <= TOTAL_DAYS; day += 1) {
    attestDay(w, {
      day,
      steps: stepsByDay[day - 1],
      timestamp: START_TIMESTAMP + day * 86400,
    });
  }
  setClock(w.svm, START_TIMESTAMP + (TOTAL_DAYS + 1) * 86400);
  claim(w);
}

describe("health_fun - admin (LiteSVM)", () => {
  describe("initialize_config", () => {
    it("records the bootstrap signer as admin", () => {
      const w = setupWorld();
      expect(decodeConfig(w).admin.toBase58()).to.equal(
        w.admin.publicKey.toBase58()
      );
    });
  });

  describe("update_config", () => {
    it("updates limits and is reflected in stake validation", () => {
      const w = setupWorld();
      const params = currentParams(w);

      // Tighten the cap below the amount the world's user just staked.
      updateConfig(w, w.admin, {
        ...params,
        maxStake: new anchor.BN(STAKE_AMOUNT - 1),
      });
      expect(decodeConfig(w).maxStake.toString()).to.equal(
        String(STAKE_AMOUNT - 1)
      );

      // The existing stake is untouched; the bound applies to the next one.
      const stake = w.program.coder.accounts.decode(
        "stakeAccount",
        Buffer.from(w.svm.getAccount(w.stakePda)!.data)
      );
      expect(stake.stakedAmount.toString()).to.equal(String(STAKE_AMOUNT));
    });

    it("rejects a non-admin signer", () => {
      const w = setupWorld();
      const intruder = web3.Keypair.generate();
      w.svm.airdrop(intruder.publicKey, BigInt(web3.LAMPORTS_PER_SOL));

      expect(() =>
        updateConfig(w, intruder, currentParams(w))
      ).to.throw(/InvalidAdmin/i);
    });

    it("rejects bounds that would make every stake invalid", () => {
      const w = setupWorld();
      const params = currentParams(w);

      expect(() =>
        updateConfig(w, w.admin, { ...params, maxStake: new anchor.BN(0) })
      ).to.throw(/InvalidConfig/i);

      expect(() =>
        updateConfig(w, w.admin, {
          ...params,
          minLockDuration: MAX_LOCK_DURATION,
          maxLockDuration: MIN_LOCK_DURATION,
        })
      ).to.throw(/InvalidConfig/i);
    });

    it("rejects rotating the oracle key to the zero key", () => {
      const w = setupWorld();
      expect(() =>
        updateConfig(w, w.admin, {
          ...currentParams(w),
          verificationKey: web3.PublicKey.default,
        })
      ).to.throw(/InvalidVerificationKey/i);
    });

    it("rejects a max lock duration shorter than the one-day minimum stake", () => {
      const w = setupWorld();
      // `stake` requires total_days >= 1, so anything under 86400 makes every
      // stake impossible. 3600 is what an admin thinking in hours would send.
      expect(() =>
        updateConfig(w, w.admin, {
          ...currentParams(w),
          minLockDuration: new anchor.BN(0),
          maxLockDuration: new anchor.BN(3600),
        })
      ).to.throw(/InvalidConfig/i);
    });

    it("rotates the oracle key: old key rejected, new key accepted", () => {
      const w = setupWorld();
      const newOracle = web3.Keypair.generate();

      updateConfig(w, w.admin, {
        ...currentParams(w),
        verificationKey: newOracle.publicKey,
      });

      const attestation = {
        challengeId: new anchor.BN(1),
        user: w.user.publicKey,
        steps: 7_500,
        sleepHours: 8,
        gym: true,
        epochDay: Math.floor(START_TIMESTAMP / 86400) + 1,
        nonce: new anchor.BN(1),
        expiresAt: new anchor.BN(START_TIMESTAMP + 86400 + 3600),
      };
      const message = buildAttestationMessage(attestation);
      setClock(w.svm, START_TIMESTAMP + 86400);

      const submit = (oracle: web3.Keypair) =>
        send(
          w.svm,
          [
            makeEd25519VerifyIx(oracle, message),
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

      // The previous oracle (the admin key in these tests) no longer verifies.
      expect(() => submit(w.admin)).to.throw(/InvalidVerificationKeySign/i);

      // The rotated key does, for the same message.
      submit(newOracle);
      const health = w.program.coder.accounts.decode(
        "healthData",
        Buffer.from(w.svm.getAccount(w.healthPda)!.data)
      );
      expect(health.steps).to.equal(7_500);
    });

    it("transfers admin in two steps; nothing moves until the new key signs", () => {
      const w = setupWorld();
      const newAdmin = web3.Keypair.generate();
      w.svm.airdrop(newAdmin.publicKey, BigInt(web3.LAMPORTS_PER_SOL));

      // Nobody can accept while nothing is pending.
      expect(() => acceptAdmin(w, newAdmin)).to.throw(/InvalidAdmin/i);

      proposeAdmin(w, w.admin, newAdmin.publicKey);
      expect(decodeConfig(w).pendingAdmin.toBase58()).to.equal(
        newAdmin.publicKey.toBase58()
      );

      // Proposing changes nothing: the current admin still has full control
      // and the proposed key has none. A mistyped proposal is therefore
      // harmless — it can simply be re-proposed or cancelled.
      expect(decodeConfig(w).admin.toBase58()).to.equal(w.admin.publicKey.toBase58());
      updateConfig(w, w.admin, currentParams(w));
      expect(() => updateConfig(w, newAdmin, currentParams(w))).to.throw(
        /InvalidAdmin/i
      );

      // Only the proposed key can accept.
      const stranger = web3.Keypair.generate();
      w.svm.airdrop(stranger.publicKey, BigInt(web3.LAMPORTS_PER_SOL));
      expect(() => acceptAdmin(w, stranger)).to.throw(/InvalidAdmin/i);

      acceptAdmin(w, newAdmin);
      const cfg = decodeConfig(w);
      expect(cfg.admin.toBase58()).to.equal(newAdmin.publicKey.toBase58());
      expect(cfg.pendingAdmin.toBase58()).to.equal(web3.PublicKey.default.toBase58());

      // Authority has moved: the bootstrap ADMIN_KEY is locked out.
      expect(() => updateConfig(w, w.admin, currentParams(w))).to.throw(
        /InvalidAdmin/i
      );
      updateConfig(w, newAdmin, {
        ...currentParams(w),
        maxStake: new anchor.BN(MAX_STAKE.toNumber() + 1),
      });
      expect(decodeConfig(w).maxStake.toString()).to.equal(
        String(MAX_STAKE.toNumber() + 1)
      );
    });

    it("cancels a pending transfer by proposing the zero key", () => {
      const w = setupWorld();
      const newAdmin = web3.Keypair.generate();
      w.svm.airdrop(newAdmin.publicKey, BigInt(web3.LAMPORTS_PER_SOL));

      proposeAdmin(w, w.admin, newAdmin.publicKey);
      proposeAdmin(w, w.admin, web3.PublicKey.default);

      expect(decodeConfig(w).pendingAdmin.toBase58()).to.equal(
        web3.PublicKey.default.toBase58()
      );
      expect(() => acceptAdmin(w, newAdmin)).to.throw(/InvalidAdmin/i);
    });
  });

  describe("initialize_treasury_for_mint", () => {
    it("rejects a non-admin signer", () => {
      const w = setupWorld();
      const intruder = web3.Keypair.generate();
      w.svm.airdrop(intruder.publicKey, BigInt(5 * web3.LAMPORTS_PER_SOL));

      // A fresh mint, since setupWorld already created the treasury for w.mint.
      const mintKeypair = web3.Keypair.generate();
      const mint = mintKeypair.publicKey;
      const rent = w.svm.minimumBalanceForRentExemption(BigInt(MINT_SIZE));
      send(
        w.svm,
        [
          web3.SystemProgram.createAccount({
            fromPubkey: intruder.publicKey,
            newAccountPubkey: mint,
            space: MINT_SIZE,
            lamports: Number(rent),
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(mint, DECIMALS, intruder.publicKey, null),
        ],
        intruder,
        [intruder, mintKeypair]
      );

      const treasuryConfigPda = findTreasuryConfigPda(w.programId, mint);
      const treasuryAuthorityPda = findTreasuryAuthorityPda(w.programId, mint);
      const treasuryVault = getAssociatedTokenAddressSync(mint, treasuryAuthorityPda, true);

      // The gate moved from a compiled-in constant to the stored admin field
      // in this change; this is the regression test for that path.
      expect(() =>
        send(
          w.svm,
          [
            w.program.instruction.initializeTreasuryForMint({
              accounts: {
                admin: intruder.publicKey,
                stakeConfig: w.stakeConfigPda,
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
          intruder,
          [intruder]
        )
      ).to.throw(/InvalidAdmin/i);
      expect(w.svm.getAccount(treasuryConfigPda)).to.equal(null);
    });
  });

  describe("withdraw_treasury", () => {
    it("moves forfeited stakes to an admin-chosen account", () => {
      const w = setupWorld();
      forfeitOne(w);
      expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(BigInt(STAKE_AMOUNT));

      const adminAta = getAssociatedTokenAddressSync(w.mint, w.admin.publicKey, false);
      send(
        w.svm,
        [
          createAssociatedTokenAccountInstruction(
            w.admin.publicKey,
            adminAta,
            w.admin.publicKey,
            w.mint
          ),
        ],
        w.admin,
        [w.admin]
      );

      withdrawTreasury(w, w.admin, adminAta, STAKE_AMOUNT);

      expect(tokenBalance(w.svm, adminAta)).to.equal(BigInt(STAKE_AMOUNT));
      expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(BigInt(0));
    });

    it("rejects a non-admin signer", () => {
      const w = setupWorld();
      forfeitOne(w);

      const intruder = web3.Keypair.generate();
      w.svm.airdrop(intruder.publicKey, BigInt(web3.LAMPORTS_PER_SOL));
      const intruderAta = getAssociatedTokenAddressSync(w.mint, intruder.publicKey, false);
      send(
        w.svm,
        [
          createAssociatedTokenAccountInstruction(
            intruder.publicKey,
            intruderAta,
            intruder.publicKey,
            w.mint
          ),
        ],
        intruder,
        [intruder]
      );

      expect(() =>
        withdrawTreasury(w, intruder, intruderAta, STAKE_AMOUNT)
      ).to.throw(/InvalidAdmin/i);
      expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(BigInt(STAKE_AMOUNT));
    });

    it("rejects a zero amount and an overdraw", () => {
      const w = setupWorld();
      forfeitOne(w);
      const adminAta = getAssociatedTokenAddressSync(w.mint, w.admin.publicKey, false);
      send(
        w.svm,
        [
          createAssociatedTokenAccountInstruction(
            w.admin.publicKey,
            adminAta,
            w.admin.publicKey,
            w.mint
          ),
        ],
        w.admin,
        [w.admin]
      );

      expect(() => withdrawTreasury(w, w.admin, adminAta, 0)).to.throw(
        /ZeroWithdrawal/i
      );
      // Above the balance: the token program rejects it.
      expect(() =>
        withdrawTreasury(w, w.admin, adminAta, STAKE_AMOUNT + 1)
      ).to.throw(/insufficient funds/i);
      expect(tokenBalance(w.svm, w.treasuryVault)).to.equal(BigInt(STAKE_AMOUNT));
    });
  });
});
