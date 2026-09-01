use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked
};

use crate::{StakeAccount, TreasuryConfig, UserProfile};
use crate::error::ErrorCode;

/// Emitted on settlement. The StakeAccount is closed straight afterwards, so
/// this is the only per-challenge record that survives; the backend indexes it
/// to build history, streaks and leaderboards.
#[event]
pub struct ChallengeSettled {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub staked_amount: u64,
    pub total_days: u16,
    pub days_goal_met: u16,
    pub goal_per_day: u32,
    pub won: bool,
    pub staked_at: i64,
    pub settled_at: i64,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    // Closed here: the challenge is over, so its rent goes back to the user and
    // the PDA is freed for their next challenge. Settlement detail survives in
    // the ChallengeSettled event and the aggregates on user_profile.
    #[account(
        mut,
        close = user,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ ErrorCode::InvalidStakeOwnerError,
        has_one = mint
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,

    #[account(
        mut,
        seeds = [b"profile", user.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.user == user.key() @ ErrorCode::InvalidStakeOwnerError
    )]
    pub user_profile: Box<Account<'info, UserProfile>>,

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

        // Roll the outcome into the permanent per-user aggregates.
        if won {
            self.user_profile.challenges_completed =
                self.user_profile.challenges_completed.saturating_add(1);
            self.user_profile.current_streak =
                self.user_profile.current_streak.saturating_add(1);
            self.user_profile.longest_streak = self
                .user_profile
                .longest_streak
                .max(self.user_profile.current_streak);
        } else {
            self.user_profile.challenges_failed =
                self.user_profile.challenges_failed.saturating_add(1);
            self.user_profile.current_streak = 0;
        }

        emit!(ChallengeSettled {
            user: self.user.key(),
            mint: self.mint.key(),
            staked_amount: self.stake_account.staked_amount,
            total_days: self.stake_account.total_days,
            days_goal_met: self.stake_account.days_goal_met,
            goal_per_day: self.stake_account.goal_per_day,
            won,
            staked_at: self.stake_account.staked_at,
            settled_at: now,
        });

        // Kept even though `close = user` makes the account unreadable
        // afterwards: it is the guard that still holds if a future change ever
        // stops closing the account, e.g. a partial-claim path.
        self.stake_account.claimed = true;

        Ok(())
    }
}

