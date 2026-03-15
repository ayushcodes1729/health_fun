use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub staked_at: i64,
    pub total_days: u16,
    pub goal_type: Goal,
    pub days_goal_met: u16,
    pub last_day_checked: u16,
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