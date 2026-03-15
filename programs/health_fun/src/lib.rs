pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7k8STpaJxptrSVn8BLRDw1CgqGMZoU8iVUjkzHA9oCdp");

#[program]
pub mod health_fun {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, max_stake: u64, max_freeze_time: i64, min_freeze_time: i64) -> Result<()> {
        ctx.accounts.initialize_config(max_stake, max_freeze_time, min_freeze_time, &ctx.bumps)?;
        Ok(())
    }
}
