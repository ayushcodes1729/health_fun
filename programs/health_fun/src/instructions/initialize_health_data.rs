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

        // 0 means "never synced". Seeding this with the current epoch day would
        // make the first attestation impossible: update_health_data requires the
        // attested day to be both strictly greater than this field and no later
        // than the current chain day.
        let epoch_day = 0;

        self.health_data.set_inner(HealthData { user: self.user.key(), last_sync_timestamp: current_timestamp, epoch_day, steps:0,  sleep_hours: 0, gym: false, last_nonce: 0 });
        Ok(())
    }
}
