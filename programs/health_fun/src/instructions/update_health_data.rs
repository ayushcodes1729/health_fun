use anchor_lang::prelude::*;

use crate::{HealthData, StakeAccount};

#[derive(Accounts)]
pub struct UpdateHealthData<'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"health" , user.key().as_ref()],
        bump
    )]
    pub health_data: Account<'info, HealthData>,

    #[account(
        seeds = [b"stake", user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

   
}
