import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { PROGRAM_ID } from "./config";

/**
 * PDA derivations. Seeds must match the program exactly; see the `seeds = [...]`
 * constraints in programs/health_fun/src/instructions/*.rs.
 */

function pda(seeds: (Buffer | Uint8Array)[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

export const stakeConfigPda = () => pda([Buffer.from("config")]);

export const stakeAccountPda = (user: PublicKey) =>
  pda([Buffer.from("stake"), user.toBuffer()]);

export const vaultPda = (user: PublicKey) =>
  pda([Buffer.from("vault"), user.toBuffer()]);

export const healthDataPda = (user: PublicKey) =>
  pda([Buffer.from("health"), user.toBuffer()]);

export const userProfilePda = (user: PublicKey) =>
  pda([Buffer.from("profile"), user.toBuffer()]);

export const treasuryConfigPda = (mint: PublicKey) =>
  pda([Buffer.from("treasury_config"), mint.toBuffer()]);

export const treasuryAuthorityPda = (mint: PublicKey) =>
  pda([Buffer.from("treasury_authority"), mint.toBuffer()]);

/** The treasury's token account is the ATA of the treasury authority PDA. */
export const treasuryVaultAta = (mint: PublicKey) =>
  getAssociatedTokenAddressSync(mint, treasuryAuthorityPda(mint), true);

export const userAta = (mint: PublicKey, user: PublicKey) =>
  getAssociatedTokenAddressSync(mint, user, false);
