use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StakeConfig {
    pub max_stake: u64,
    /// Longest permitted challenge, as a DURATION IN SECONDS (not a timestamp).
    /// e.g. a 90-day maximum is 90 * 86400 = 7_776_000.
    pub max_lock_duration: i64,
    /// Shortest permitted challenge, as a DURATION IN SECONDS (not a timestamp).
    pub min_lock_duration: i64,
    pub bump: u8,
    pub verification_key: Pubkey
}
