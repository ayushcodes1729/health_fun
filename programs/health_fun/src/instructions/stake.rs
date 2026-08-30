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

/// Deposit needs its own context. Reusing `Stake` meant inheriting its `init`
/// constraints, which run during account validation and try to re-create the
/// stake account and vault that `stake` already made — so the instruction could
/// never be called successfully.
#[derive(Accounts)]
pub struct DepositToVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        has_one = mint,
        constraint = stake_account.owner == user.key() @ ErrorCode::InvalidStakeOwnerError
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
        mut,
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
        require!(staked_amount<self.stake_config.max_stake, ErrorCode::MaxStakeError);
        let now = Clock::get()?.unix_timestamp;
        let unlock_at = now + (total_days as i64 * 86400);

        // Range-check the lock *duration*. This previously computed
        // `now + total_days / 86400`, which is just `now` for any realistic
        // total_days, so the bounds could never reject anything.
        let lock_period = total_days as i64 * 86400;
        require!(self.stake_config.min_freeze_time <= lock_period && lock_period <= self.stake_config.max_freeze_time, ErrorCode::DurationOutOfRangeError);
        let last_day_checked = (now/ 86400) as u16; 

        self.stake_account.set_inner(StakeAccount { 
            owner: self.user.key(), 
            mint: self.mint.key(), 
            staked_amount: 0, 
            staked_at: Clock::get()?.unix_timestamp, 
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

        Ok(())
    }
}

impl<'info> DepositToVault<'info> {
    pub fn deposit_to_vault(&mut self, staked_amount: u64) -> Result<()> {

        require!(self.stake_account.staked_amount == 0, ErrorCode::AlreadyDepositedError);

        // Enforce the configured cap against the amount actually being moved.
        // Checking it in `stake` only validated an argument that had no
        // connection to what ended up in the vault.
        require!(staked_amount < self.stake_config.max_stake, ErrorCode::MaxStakeError);

        let now = Clock::get()?.unix_timestamp;
        let last_day_checked = (now/ 86400) as u16; 

        let decimals = self.mint.decimals;

        let transfer_accounts = TransferChecked {
            from: self.user_ata.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.user.to_account_info()
        };

        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, transfer_accounts);

        transfer_checked(cpi_ctx, staked_amount, decimals)?;
        
        self.stake_account.staked_amount = staked_amount;
        self.stake_account.staked_at = now;
        self.stake_account.last_day_checked = last_day_checked;
        Ok(())
    }
}
