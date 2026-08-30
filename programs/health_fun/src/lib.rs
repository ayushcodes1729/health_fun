pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("AurTvci86g6Wx95U93zQtonzV3CwHq7Ehpw9chS1oqCa");

#[program]
pub mod health_fun {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        max_stake: u64,
        max_lock_duration: i64,
        min_lock_duration: i64,
        verification_key: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize_config(max_stake, max_lock_duration, min_lock_duration, verification_key, &ctx.bumps)?;
        Ok(())
    }

    pub fn initialize_health_data(
        ctx: Context<InitializeHealthData>,
        verification_key: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize_health_data(verification_key)?;
        Ok(())
    }

    pub fn initialize_treasury_for_mint(
        ctx: Context<InitializeTreasuryForMint>,
    ) -> Result<()> {
        ctx.accounts.initialize_treasury_for_mint(&ctx.bumps)?;
        Ok(())
    }

    pub fn stake(
        ctx: Context<Stake>,
        staked_amount: u64,
        total_days: u16,
        goal_type: Goal,
        goal_per_day: u32,
    ) -> Result<()> {
        ctx.accounts
            .init_stake(staked_amount, total_days, goal_type, goal_per_day, &ctx.bumps)?;
        Ok(())
    }

    pub fn update_health_data(
        ctx: Context<UpdateHealthData>,
        attestation_data: AttestationData,
    ) -> Result<()> {
        ctx.accounts.update_health_data(attestation_data)?;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        ctx.accounts.claim()?;
        Ok(())
    }
}
