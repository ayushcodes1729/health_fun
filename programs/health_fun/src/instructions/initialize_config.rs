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

    pub 
    
    #[account(
        mut,
        seeds = [b"treasury", stake_config.key().as_ref()],
        bump
    )]
    pub treasury_pda: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeConfig<'info> {
    pub fn initialize_config(
        &mut self,
        max_stake: u64,
        max_freeze_time: i64,
        min_freeze_time: i64,
        switchboard_feed: Pubkey,
        bumps: &InitializeConfigBumps,
    ) -> Result<()> {
        require_eq!(
            self.admin.key().to_string(),
            ADMIN_KEY,
            ErrorCode::InvalidAdminError
        );

        self.stake_config.set_inner(StakeConfig {
            max_stake,
            max_freeze_time,
            min_freeze_time,
            treasury_bump: bumps.treasury_pda,
            bump: bumps.stake_config,
            switchboard_feed
        });

        Ok(())
    }
}
