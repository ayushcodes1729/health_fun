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
    pub new_admin: Pubkey,
}

/// Full replacement of the mutable config fields. Callers pass every value,
/// including the ones they are not changing, so a stale client cannot
/// accidentally revert a field it did not know about.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigParams {
    pub max_stake: u64,
    pub min_lock_duration: i64,
    pub max_lock_duration: i64,
    pub verification_key: Pubkey,
    pub admin: Pubkey,
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

        // Rotating to the zero key would lock every admin instruction forever.
        require!(
            params.admin != Pubkey::default(),
            ErrorCode::InvalidAdminError
        );

        // Existing stakes are unaffected: lock bounds are checked once at stake
        // time and max_stake at deposit. verification_key takes effect for the
        // next attestation of every user, which is what key rotation needs.
        self.stake_config.max_stake = params.max_stake;
        self.stake_config.min_lock_duration = params.min_lock_duration;
        self.stake_config.max_lock_duration = params.max_lock_duration;
        self.stake_config.verification_key = params.verification_key;
        self.stake_config.admin = params.admin;

        emit!(ConfigUpdated {
            admin: self.admin.key(),
            max_stake: params.max_stake,
            min_lock_duration: params.min_lock_duration,
            max_lock_duration: params.max_lock_duration,
            verification_key: params.verification_key,
            new_admin: params.admin,
        });

        Ok(())
    }
}
