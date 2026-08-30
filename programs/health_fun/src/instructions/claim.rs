use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked
};

use crate::{StakeAccount, TreasuryConfig};
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
    pub stake_account: Box<Account<'info, StakeAccount>>,

    #[account(
        seeds = [b"config"],
        bump
    )]
    /// CHECK: Config PDA is validated by seeds only and not used in claim logic.
    pub stake_config: UncheckedAccount<'info>,

    #[account(
        seeds = [b"treasury_config", mint.key().as_ref()],
        bump = treasury_config.bump,
        has_one = mint
    )]
    pub treasury_config: Box<Account<'info, TreasuryConfig>>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"treasury_authority", mint.key().as_ref()],
        bump = treasury_config.vault_bump
    )]
    /// CHECK: PDA authority only
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        mut
    )]
    pub treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Claim<'info> {
    pub fn claim(&mut self) -> Result<()> {
        require_keys_eq!(
            self.treasury_vault.key(),
            self.treasury_config.vault,
            ErrorCode::InvalidTreasuryVaultError
        );

        require!(!self.stake_account.claimed, ErrorCode::AlreadyClaimedError);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= self.stake_account.unlock_at, ErrorCode::StakeStillLockedError);

        let won = self.stake_account.days_goal_met >= self.stake_account.total_days;
        let decimals = self.mint.decimals;

        // Pay out the amount the program recorded, not the vault balance.
        // Anyone can transfer into an SPL token account without the owner's
        // consent, so paying `vault.amount` let a user smuggle past `max_stake`
        // with a direct transfer and withdraw the whole inflated balance.
        // Anything above the recorded stake is swept to the treasury, which
        // removes the incentive to do so and leaves the vault empty either way.
        let vault_balance = self.vault.amount;
        let staked = self.stake_account.staked_amount.min(vault_balance);
        let excess = vault_balance - staked;

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

            transfer_checked(cpi_ctx, staked, decimals)?;
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

            transfer_checked(cpi_ctx, staked, decimals)?;
        }

        // Sweep any tokens transferred into the vault outside `stake`.
        if excess > 0 {
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

            transfer_checked(cpi_ctx, excess, decimals)?;
        }

        // The vault is empty now, so close it and return its rent to the user.
        // Leaving it open stranded the rent-exempt lamports permanently: nothing
        // in the program could ever move them afterwards.
        let signer_seeds = &[stake_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.vault.to_account_info(),
                destination: self.user.to_account_info(),
                authority: self.stake_account.to_account_info(),
            },
            signer_seeds,
        );

        close_account(cpi_ctx)?;

        self.stake_account.claimed = true;

        Ok(())
    }
}

