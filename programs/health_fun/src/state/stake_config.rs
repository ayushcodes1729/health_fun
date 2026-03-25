use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StakeConfig {
    pub max_stake: u64,
    pub max_freeze_time: i64,
    pub min_freeze_time: i64,
    pub treasury_bump: u8,
    pub bump: u8,
    pub switchboard_feed: Pubkey
}
