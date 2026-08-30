use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenInterface, TokenAccount, Mint, transfer_checked, TransferChecked};

use crate::{StakeAccount, StakeConfig};
use crate::stake_account::Goal;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Stake<'info>{
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        space = 8 + StakeAccount::INIT_SPACE,
        payer = user,
        seeds = [b"stake", user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        seeds = [b"config"],
        bump = stake_config.bump
    )]
    pub stake_config: Account<'info, StakeConfig>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = user,
        seeds = [b"vault", user.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = stake_account
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>
}

impl<'info> Stake<'info> {
    pub fn init_stake(
        &mut self,
        staked_amount: u64,
        total_days: u16,
        goal_type: Goal,
        goal_per_day: u32,
        bumps: &StakeBumps
    )-> Result<()> {
        // A challenge with nothing at stake is not a challenge.
        require!(staked_amount > 0, ErrorCode::ZeroStakeError);
        require!(staked_amount<self.stake_config.max_stake, ErrorCode::MaxStakeError);
        let now = Clock::get()?.unix_timestamp;
        let unlock_at = now + (total_days as i64 * 86400);

        // A zero-day challenge unlocks immediately and satisfies
        // `days_goal_met >= total_days` with no attestations at all, so it is
        // never a valid challenge regardless of how min_lock_duration is set.
        require!(total_days > 0, ErrorCode::DurationOutOfRangeError);

        // Range-check the lock *duration* in seconds. This previously computed
        // `now + total_days / 86400`, which is just `now` for any realistic
        // total_days, so the bounds could never reject anything.
        let lock_period = total_days as i64 * 86400;
        require!(self.stake_config.min_lock_duration <= lock_period && lock_period <= self.stake_config.max_lock_duration, ErrorCode::DurationOutOfRangeError);
        let last_day_checked = (now/ 86400) as u16; 

        self.stake_account.set_inner(StakeAccount {
            owner: self.user.key(),
            mint: self.mint.key(),
            staked_amount,
            staked_at: now,
            total_days,
            goal_type,
            days_goal_met: 0,
            last_day_checked,
            goal_per_day,
            vault: self.vault.key(),
            unlock_at,
            claimed: false,
            bump: bumps.stake_account
        });

        // Fund the vault in the same instruction that creates the challenge.
        // While funding was a separate step, a user could create a challenge,
        // leave the vault empty, watch `days_goal_met` accrue on-chain, and pay
        // in only once a win was already certain — a free option with no
        // downside risk. Doing the transfer here makes that unrepresentable:
        // either the challenge exists and is funded, or neither happened.
        let transfer_accounts = TransferChecked {
            from: self.user_ata.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.user.to_account_info()
        };

        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            transfer_accounts,
        );

        transfer_checked(cpi_ctx, staked_amount, self.mint.decimals)?;

        Ok(())
    }
}
