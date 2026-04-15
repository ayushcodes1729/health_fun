use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked
};

use crate::{StakeAccount, StakeConfig, TreasuryConfig};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ ErrorCode::InvalidStakeOwnerError,
        has_one = mint
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        seeds = [b"config"],
        bump = stake_config.bump
    )]
    pub stake_config: Account<'info, StakeConfig>,

    #[account(
        seeds = [b"treasury_config", mint.key().as_ref()],
        bump = treasury_config.bump,
        has_one = mint,
        has_one = vault @ ErrorCode::InvalidTreasuryVaultError
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        seeds = [b"treasury_authority", mint.key().as_ref()],
        bump = treasury_config.vault_bump
    )]
    /// CHECK: PDA authority only
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = treasury_vault.key() == treasury_config.vault @ ErrorCode::InvalidTreasuryVaultError
    )]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Claim<'info> {
    pub fn claim(&mut self) -> Result<()> {
        require!(!self.stake_account.claimed, ErrorCode::AlreadyClaimedError);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= self.stake_account.unlock_at, ErrorCode::StakeStillLockedError);

        let won = self.stake_account.days_goal_met >= self.stake_account.total_days;
        let decimals = self.mint.decimals;
        let amount = self.vault.amount;

        let user_key = self.user.key();
        let stake_bump = [self.stake_account.bump];

        let stake_seeds: &[&[u8]] = &[
            b"stake",
            user_key.as_ref(),
            &stake_bump,
        ];

        
        if won {
            let cpi_accounts = TransferChecked {
                from: self.vault.to_account_info(),
                mint: self.mint.to_account_info(),
                to: self.user_ata.to_account_info(),
                authority: self.stake_account.to_account_info(),
            };

            let signer_seeds = &[stake_seeds];

            let cpi_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );

            transfer_checked(cpi_ctx, amount, decimals)?;
        } else {
            let cpi_accounts = TransferChecked {
                from: self.vault.to_account_info(),
                mint: self.mint.to_account_info(),
                to: self.treasury_vault.to_account_info(),
                authority: self.stake_account.to_account_info(),
            };

            
            let signer_seeds = &[stake_seeds];

            let cpi_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );

            transfer_checked(cpi_ctx, amount, decimals)?;
        }

        self.stake_account.claimed = true;

        Ok(())
    }
}

