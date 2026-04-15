use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{StakeConfig, TreasuryConfig};
use crate::constants::ADMIN_KEY;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct InitializeTreasuryForMint<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = stake_config.bump
    )]
    pub stake_config: Account<'info, StakeConfig>,

    #[account(
        init,
        payer = admin,
        space = 8 + TreasuryConfig::INIT_SPACE,
        seeds = [b"treasury_config", mint.key().as_ref()],
        bump
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(
        seeds = [b"treasury_authority", mint.key().as_ref()],
        bump
    )]
    /// CHECK: PDA authority only
    pub treasury_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = treasury_authority,
        associated_token::token_program = token_program
    )]
    pub treasury_vault: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeTreasuryForMint<'info> {
    pub fn initialize_treasury_for_mint(
        &mut self,
        bumps: &InitializeTreasuryForMintBumps,
    ) -> Result<()> {
        require_eq!(
            self.admin.key().to_string(),
            ADMIN_KEY,
            ErrorCode::InvalidAdminError
        );

        self.treasury_config.set_inner(TreasuryConfig {
            mint: self.mint.key(),
            vault: self.treasury_vault.key(),
            bump: bumps.treasury_config,
            vault_bump: bumps.treasury_authority,
        });

        Ok(())
    }
}

