use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::StakeConfig;

#[event]
pub struct AdminTransferProposed {
    pub admin: Pubkey,
    /// `Pubkey::default()` means a pending proposal was cancelled.
    pub pending_admin: Pubkey,
}

#[event]
pub struct AdminTransferred {
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
}

/// Step one of a two-step admin transfer: the current admin names a successor.
/// Nothing changes hands yet. Proposing `Pubkey::default()` cancels.
#[derive(Accounts)]
pub struct ProposeAdmin<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = stake_config.bump,
        has_one = admin @ ErrorCode::InvalidAdminError
    )]
    pub stake_config: Account<'info, StakeConfig>,
}

impl<'info> ProposeAdmin<'info> {
    pub fn propose_admin(&mut self, new_admin: Pubkey) -> Result<()> {
        self.stake_config.pending_admin = new_admin;

        emit!(AdminTransferProposed {
            admin: self.admin.key(),
            pending_admin: new_admin,
        });

        Ok(())
    }
}

/// Step two: the proposed key signs to take authority. This is what makes a
/// single-step transfer's failure mode — a mistyped pubkey that nobody
/// controls locking every admin instruction forever — unrepresentable: a key
/// that cannot sign cannot become admin.
#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    pub new_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = stake_config.bump,
        constraint = stake_config.pending_admin != Pubkey::default()
            && stake_config.pending_admin == new_admin.key()
            @ ErrorCode::InvalidAdminError
    )]
    pub stake_config: Account<'info, StakeConfig>,
}

impl<'info> AcceptAdmin<'info> {
    pub fn accept_admin(&mut self) -> Result<()> {
        let previous_admin = self.stake_config.admin;

        self.stake_config.admin = self.new_admin.key();
        self.stake_config.pending_admin = Pubkey::default();

        emit!(AdminTransferred {
            previous_admin,
            new_admin: self.new_admin.key(),
        });

        Ok(())
    }
}
