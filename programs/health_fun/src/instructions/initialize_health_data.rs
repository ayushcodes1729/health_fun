use anchor_lang::prelude::*;

use crate::HealthData;

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

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeHealthData<'info> {
    pub fn initialize_health_data(
        &mut self,
        steps: u32,
        sleep_hours: u8,
        gym: bool,
    ) -> Result<()> {

        let current_timestamp = Clock::get()?.unix_timestamp;

        let epoch_day = current_timestamp.checked_div(86400).expect("Epoch day after division with 86400");

        self.health_data.set_inner(HealthData {
            user: *self.user.key,
            last_sync_timestamp: current_timestamp,
            epoch_day: epoch_day as u16,
            steps,
            sleep_hours,
            gym,
        });
        Ok(())
    }
}
