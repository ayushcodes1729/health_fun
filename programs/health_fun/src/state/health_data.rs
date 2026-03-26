use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct HealthData {
    pub user: Pubkey,
    pub last_sync_timestamp: i64,
    pub epoch_day: u16,
    pub steps: u32,
    pub sleep_hours: u8,
    pub gym: bool,
}
