use anchor_lang::prelude::*;

use crate::{HealthData, StakeConfig};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct InitializeHealthData<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + HealthData::INIT_SPACE,
        seeds = [b"health" , user.key().as_ref()],
        bump
    )]
    pub health_data: Account<'info, HealthData>,

    #[account(
        seeds = [b"config"],
        bump
    )]
    pub stake_config: Account<'info, StakeConfig>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeHealthData<'info> {
    pub fn initialize_health_data(
        &mut self,
        verification_key: Pubkey
    ) -> Result<()> {

        require!(verification_key == self.stake_config.verification_key, ErrorCode::InvalidVerificationKeyError);
        let current_timestamp = Clock::get()?.unix_timestamp;

        let epoch_day = current_timestamp.checked_div(86400).expect("Epoch day after division with 86400") as u16;

        self.health_data.set_inner(HealthData { user: self.user.key(), last_sync_timestamp: current_timestamp, epoch_day, steps:0,  sleep_hours: 0, gym: false, last_nonce: 0 });
        Ok(())
    }
}
