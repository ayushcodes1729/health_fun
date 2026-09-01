use anchor_lang::prelude::*;

/// Permanent per-user record, created on the first challenge and never closed.
///
/// The per-challenge `StakeAccount` is closed on claim so its rent goes back to
/// the user, which means individual challenges leave no on-chain trace. This
/// account keeps the parts that other on-chain programs could want to read —
/// aggregates, not history — at a one-time rent cost instead of one rent
/// payment per challenge. Full per-challenge detail is emitted as a
/// `ChallengeSettled` event for the backend to index.
#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub user: Pubkey,
    /// Challenges settled with `days_goal_met >= total_days`.
    pub challenges_completed: u32,
    /// Challenges settled short of the goal, where the stake was forfeited.
    pub challenges_failed: u32,
    /// Consecutive completed challenges; reset to 0 by a forfeit.
    pub current_streak: u32,
    /// Highest `current_streak` ever reached.
    pub longest_streak: u32,
    /// Lifetime total staked, in the mint's base units. Sums across mints, so
    /// it is only meaningful when a single mint is in use.
    pub total_staked: u64,
    pub bump: u8,
}
