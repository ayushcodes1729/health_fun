use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub owner: Pubkey,
    pub staked_amount: u32,
    pub total_days: u32,
    pub goal_type: Goal,
    pub days_goal_met: u32,
    pub goal_per_day: u32,
    pub bump: u8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Goal {
    Steps,
    Sleep,
    Gym
}

impl Space for Goal {
    const INIT_SPACE: usize = 1;
}