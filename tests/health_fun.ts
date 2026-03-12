import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { HealthFun } from "../target/types/health_fun";

describe("health_fun", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.healthFun as Program<HealthFun>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
