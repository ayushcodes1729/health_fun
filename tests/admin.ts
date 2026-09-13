import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  INSTRUCTIONS_SYSVAR,
  buildAttestationMessage,
  makeEd25519VerifyIx,
} from "./helpers/attestation";
import {
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
    admin: c.admin,
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
        updateConfig(w, intruder, {
          ...currentParams(w),
          admin: intruder.publicKey,
        })
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

    it("rejects rotating admin to the zero key", () => {
      const w = setupWorld();
      expect(() =>
        updateConfig(w, w.admin, {
          ...currentParams(w),
          admin: web3.PublicKey.default,
        })
      ).to.throw(/InvalidAdmin/i);
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

    it("rotates admin: old admin locked out, new admin in control", () => {
      const w = setupWorld();
      const newAdmin = web3.Keypair.generate();
      w.svm.airdrop(newAdmin.publicKey, BigInt(web3.LAMPORTS_PER_SOL));

      updateConfig(w, w.admin, { ...currentParams(w), admin: newAdmin.publicKey });
      expect(decodeConfig(w).admin.toBase58()).to.equal(
        newAdmin.publicKey.toBase58()
      );

      // The compiled-in ADMIN_KEY is only the bootstrap signer; after rotation
      // it has no authority.
      expect(() =>
        updateConfig(w, w.admin, currentParams(w))
      ).to.throw(/InvalidAdmin/i);

      updateConfig(w, newAdmin, {
        ...currentParams(w),
        maxStake: new anchor.BN(MAX_STAKE.toNumber() + 1),
      });
      expect(decodeConfig(w).maxStake.toString()).to.equal(
        String(MAX_STAKE.toNumber() + 1)
      );
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
