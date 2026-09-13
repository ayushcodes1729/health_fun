use anchor_lang::prelude::*;

use crate::constants::ADMIN_KEY;
use crate::error::ErrorCode;
use crate::StakeConfig;

/// Recovery path for a StakeConfig written by an earlier program version.
///
/// When StakeConfig gains fields, an account created under the old layout can
/// no longer be deserialised: `update_config` fails validation, and
/// `initialize_config` cannot run because the PDA already exists. This closes
/// the stale account so `initialize_config` can be run again.
///
/// It is gated on the compiled-in ADMIN_KEY rather than the stored admin field,
/// because that field is exactly what cannot be read. To keep that from being
/// a way around the two-step admin transfer, the instruction only accepts an
/// account SMALLER than the current layout: a live config can never be closed
/// through it, so once migrated it is inert.
#[derive(Accounts)]
pub struct CloseLegacyConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: cannot be typed as StakeConfig — that is the whole problem. The
    /// seeds bind it to the config PDA, and the handler checks owner and size.
    #[account(
        mut,
        seeds = [b"config"],
        bump
    )]
    pub stake_config: UncheckedAccount<'info>,
}

impl<'info> CloseLegacyConfig<'info> {
    pub fn close_legacy_config(&mut self) -> Result<()> {
        require_eq!(
            self.admin.key().to_string(),
            ADMIN_KEY,
            ErrorCode::InvalidAdminError
        );

        let info = self.stake_config.to_account_info();
        require_keys_eq!(*info.owner, crate::ID, ErrorCode::InvalidConfigError);

        // Only a legacy-sized account may be closed.
        let current_size = 8 + StakeConfig::INIT_SPACE;
        require!(
            info.data_len() < current_size,
            ErrorCode::InvalidConfigError
        );

        // Return rent to the admin and zero the account so the runtime
        // garbage-collects it; `initialize_config` can then re-create it.
        let lamports = info.lamports();
        **info.try_borrow_mut_lamports()? = 0;
        **self.admin.to_account_info().try_borrow_mut_lamports()? += lamports;
        info.assign(&system_program::ID);
        info.resize(0)?;

        Ok(())
    }
}
