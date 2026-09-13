use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::StakeConfig;

/// Emitted on every config change so key rotations and limit changes are
/// auditable from transaction history alone.
#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub max_stake: u64,
    pub min_lock_duration: i64,
    pub max_lock_duration: i64,
    pub verification_key: Pubkey,
}

/// Full replacement of the mutable limits and the oracle key. Callers pass
/// every value, including the ones they are not changing, so a stale client
/// cannot accidentally revert a field it did not know about.
///
/// Admin is deliberately not here: it moves via the two-step
/// `propose_admin` / `accept_admin` so a mistyped key can never take
/// authority without first proving it can sign.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigParams {
    pub max_stake: u64,
    pub min_lock_duration: i64,
    pub max_lock_duration: i64,
    pub verification_key: Pubkey,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = stake_config.bump,
        has_one = admin @ ErrorCode::InvalidAdminError
    )]
    pub stake_config: Account<'info, StakeConfig>,
}

impl<'info> UpdateConfig<'info> {
    pub fn update_config(&mut self, params: ConfigParams) -> Result<()> {
        StakeConfig::validate_bounds(
            params.max_stake,
            params.min_lock_duration,
            params.max_lock_duration,
        )?;

        // The zero key is never a legitimate oracle. At best it halts every
        // attestation until re-rotated; at worst it decodes to a small-order
        // curve point under which non-strict ed25519 accepts forged
        // signatures. Rejecting it removes the question either way.
        require!(
            params.verification_key != Pubkey::default(),
            ErrorCode::InvalidVerificationKeyError
        );

        // Existing stakes are unaffected: lock bounds are checked once at stake
        // time and max_stake at deposit. verification_key takes effect for the
        // next attestation of every user, which is what key rotation needs.
        self.stake_config.max_stake = params.max_stake;
        self.stake_config.min_lock_duration = params.min_lock_duration;
        self.stake_config.max_lock_duration = params.max_lock_duration;
        self.stake_config.verification_key = params.verification_key;

        emit!(ConfigUpdated {
            admin: self.admin.key(),
            max_stake: params.max_stake,
            min_lock_duration: params.min_lock_duration,
            max_lock_duration: params.max_lock_duration,
            verification_key: params.verification_key,
        });

        Ok(())
    }
}
