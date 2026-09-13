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
    /// The oracle's ed25519 signing key. Rotatable via `update_config`; the
    /// new key takes effect for the next attestation of every user at once.
    pub verification_key: Pubkey,
    /// Authority for `update_config`, `withdraw_treasury` and treasury setup.
    /// Set from the `ADMIN_KEY` bootstrap signer at `initialize_config` and
    /// rotatable afterwards, so the compiled-in key is only needed once.
    pub admin: Pubkey,
}

impl StakeConfig {
    /// Shared by `initialize_config` and `update_config` so the two cannot
    /// drift: a config that would reject every possible stake (zero cap, or a
    /// minimum above the maximum) is never accepted from either path.
    pub fn validate_bounds(
        max_stake: u64,
        min_lock_duration: i64,
        max_lock_duration: i64,
    ) -> Result<()> {
        require!(max_stake > 0, crate::error::ErrorCode::InvalidConfigError);
        require!(
            min_lock_duration >= 0 && min_lock_duration <= max_lock_duration,
            crate::error::ErrorCode::InvalidConfigError
        );
        Ok(())
    }
}
