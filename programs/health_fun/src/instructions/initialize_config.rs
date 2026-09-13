use anchor_lang::prelude::*;

use crate::constants::ADMIN_KEY;
use crate::error::ErrorCode;
use crate::StakeConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + StakeConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub stake_config: Account<'info, StakeConfig>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeConfig<'info> {
    pub fn initialize_config(
        &mut self,
        max_stake: u64,
        max_lock_duration: i64,
        min_lock_duration: i64,
        verification_key: Pubkey,
        bumps: &InitializeConfigBumps,
    ) -> Result<()> {
        require_eq!(
            self.admin.key().to_string(),
            ADMIN_KEY,
            ErrorCode::InvalidAdminError
        );

        StakeConfig::validate_bounds(max_stake, min_lock_duration, max_lock_duration)?;

        self.stake_config.set_inner(StakeConfig {
            max_stake,
            max_lock_duration,
            min_lock_duration,
            verification_key,
            bump: bumps.stake_config,
            admin: self.admin.key(),
        });

        Ok(())
    }
}
