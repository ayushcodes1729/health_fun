use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::error::ErrorCode;
use crate::{StakeConfig, TreasuryConfig};

/// Emitted on every withdrawal so treasury outflows are auditable.
#[event]
pub struct TreasuryWithdrawn {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

/// Moves forfeited stakes out of the treasury. Without this instruction the
/// treasury vault was a one-way sink: `claim` deposited into it and nothing
/// could ever move funds back out, so every forfeit was effectively burned.
#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = stake_config.bump,
        has_one = admin @ ErrorCode::InvalidAdminError
    )]
    pub stake_config: Account<'info, StakeConfig>,

    #[account(
        seeds = [b"treasury_config", mint.key().as_ref()],
        bump = treasury_config.bump,
        has_one = mint
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(
        seeds = [b"treasury_authority", mint.key().as_ref()],
        bump = treasury_config.vault_bump
    )]
    /// CHECK: PDA authority only; signs the transfer via seeds.
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = treasury_vault.key() == treasury_config.vault
            @ ErrorCode::InvalidTreasuryVaultError
    )]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,

    // Any token account of the right mint. The admin chooses where the funds
    // go; the mint check stops a wrong-mint account being passed by mistake.
    #[account(
        mut,
        token::mint = mint
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> WithdrawTreasury<'info> {
    pub fn withdraw_treasury(&mut self, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroWithdrawalError);

        let mint_key = self.mint.key();
        let authority_bump = [self.treasury_config.vault_bump];
        let authority_seeds: &[&[u8]] = &[
            b"treasury_authority",
            mint_key.as_ref(),
            &authority_bump,
        ];
        let signer_seeds = &[authority_seeds];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.treasury_vault.to_account_info(),
                mint: self.mint.to_account_info(),
                to: self.destination.to_account_info(),
                authority: self.treasury_authority.to_account_info(),
            },
            signer_seeds,
        );

        // The token program rejects amounts above the vault balance, so no
        // separate balance check is needed here.
        transfer_checked(cpi_ctx, amount, self.mint.decimals)?;

        emit!(TreasuryWithdrawn {
            admin: self.admin.key(),
            mint: mint_key,
            destination: self.destination.key(),
            amount,
        });

        Ok(())
    }
}
