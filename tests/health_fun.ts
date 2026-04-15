import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { web3 } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity } from "@metaplex-foundation/umi";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import {
  createHealthFunProgram,
  fetchStakeConfig,
  getHealthFunProgramId,
  initializeConfig,
  safeFetchStakeConfig,
} from "../clients/generated/umi/src";

const MAX_STAKE = 1_000_000n;
const MAX_FREEZE_TIME = 60n * 60n * 24n * 30n;
const MIN_FREEZE_TIME = 60n * 60n * 24n;

type AnchorWalletWithPayer = anchor.Wallet & { payer: web3.Keypair };

function createTestUmi(
  connection: web3.Connection,
  signer: web3.Keypair,
) {
  const umi = createUmi(connection);
  umi.use(keypairIdentity(fromWeb3JsKeypair(signer)));
  umi.programs.add(createHealthFunProgram(), true);
  return umi;
}

async function airdrop(
  connection: web3.Connection,
  publicKey: web3.PublicKey,
  lamports: number,
) {
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const admin = (provider.wallet as AnchorWalletWithPayer).payer;
  const balance = await connection.getBalance(publicKey, "confirmed");

  if (balance >= lamports) {
    return;
  }

  const transferIx = web3.SystemProgram.transfer({
    fromPubkey: admin.publicKey,
    toPubkey: publicKey,
    lamports: lamports - balance,
  });
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const transaction = new web3.Transaction({
    feePayer: admin.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }).add(transferIx);

  await web3.sendAndConfirmTransaction(connection, transaction, [admin], {
    commitment: "confirmed",
  });
}

describe("health_fun codama client", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const admin = (provider.wallet as AnchorWalletWithPayer).payer;
  const verificationKey = admin.publicKey;
  const adminVerificationKey = fromWeb3JsPublicKey(verificationKey);
  const adminUmi = createTestUmi(provider.connection, admin);
  const healthFunProgramId = getHealthFunProgramId(adminUmi);
  const healthFunProgramIdWeb3 = new web3.PublicKey(healthFunProgramId);
  const [stakeConfigAddress, stakeConfigBump] =
    web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      healthFunProgramIdWeb3,
    );
  const [treasuryAddress, treasuryBump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), stakeConfigAddress.toBuffer()],
    healthFunProgramIdWeb3,
  );
  const stakeConfigPda = adminUmi.eddsa.findPda(healthFunProgramId, [
    new Uint8Array(Buffer.from("config")),
  ]);

  it("rejects initialize_config when the signer is not the configured admin", async () => {
    const existingStakeConfig = await safeFetchStakeConfig(adminUmi, stakeConfigPda);

    if (existingStakeConfig) {
      return;
    }

    const badAdmin = web3.Keypair.generate();
    await airdrop(
      provider.connection,
      badAdmin.publicKey,
      web3.LAMPORTS_PER_SOL,
    );

    const badAdminUmi = createTestUmi(provider.connection, badAdmin);

    try {
      await initializeConfig(badAdminUmi, {
        admin: badAdminUmi.identity,
        maxStake: MAX_STAKE,
        maxFreezeTime: MAX_FREEZE_TIME,
        minFreezeTime: MIN_FREEZE_TIME,
        verificationKey: adminVerificationKey,
      }).sendAndConfirm(badAdminUmi);

      expect.fail("initializeConfig should have failed for a non-admin signer");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).to.include("Invalid admin pubkey");
    }
  });

  it("initializes stake config through the generated Codama client", async () => {
    const existingStakeConfig = await safeFetchStakeConfig(adminUmi, stakeConfigPda);

    if (!existingStakeConfig) {
      await initializeConfig(adminUmi, {
        admin: adminUmi.identity,
        maxStake: MAX_STAKE,
        maxFreezeTime: MAX_FREEZE_TIME,
        minFreezeTime: MIN_FREEZE_TIME,
        verificationKey: adminVerificationKey,
      }).sendAndConfirm(adminUmi);
    }

    const stakeConfig = await fetchStakeConfig(adminUmi, stakeConfigPda);

    expect(stakeConfig.publicKey).to.equal(stakeConfigPda[0]);
    expect(stakeConfig.maxStake).to.equal(MAX_STAKE);
    expect(stakeConfig.maxFreezeTime).to.equal(MAX_FREEZE_TIME);
    expect(stakeConfig.minFreezeTime).to.equal(MIN_FREEZE_TIME);
    expect(stakeConfig.bump).to.equal(stakeConfigBump);
    expect(stakeConfig.verificationKey).to.equal(adminVerificationKey);
  });
});
