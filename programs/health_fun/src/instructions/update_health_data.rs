use std::str::FromStr;
use std::usize;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked}
};
use solana_program::ed25519_program;
use crate::{HealthData, StakeAccount, StakeConfig};
use crate::error::ErrorCode;
use crate::stake_account::Goal;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AttestationData {
    pub challenge_id: u64,
    pub user: Pubkey,
    pub steps: u32,
    pub sleep_hours: u8,
    pub gym: bool,
    pub epoch_day: u16,
    pub nonce: u64,
    pub expires_at: i64,
}

#[derive(Accounts)]
pub struct UpdateHealthData<'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"health" , user.key().as_ref()],
        bump
    )]
    pub health_data: Account<'info, HealthData>,

    #[account(
        seeds = [b"config"],
        bump
    )]
    pub stake_config: Account<'info, StakeConfig>,

    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// CHECK: this must be the instructions sysvar account and is validated
    /// at runtime by comparing its address to `sysvar::instructions::id()`.
    pub instructions: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl <'info> UpdateHealthData<'info>{
    pub fn update_health_data(&mut self, a:AttestationData) -> Result<()> {

        require_eq!(self.instructions.key(), Pubkey::from_str(&solana_program::sysvar::instructions::id().to_string()).unwrap(), ErrorCode::InvalidInstructionError);
        require_eq!(self.user.key(), a.user, ErrorCode::InvalidUserError);

        let now = Clock::get()?.unix_timestamp;
        require!(now <= a.expires_at, ErrorCode::AttestationExpiredError);
        require!(now > self.health_data.last_sync_timestamp, ErrorCode::StaleUpdateError);
        require!(a.epoch_day > self.health_data.epoch_day, ErrorCode::InvalidEpochError);
        
        // stops any replay of update data instructions
        require!(a.nonce > self.health_data.last_nonce, ErrorCode::ReplayUpdateError);


        let msg = build_attestation_message(&a);
        verify_ed25519_pvs_ix(
            &self.instructions.to_account_info(),
            &self.stake_config.verification_key,
            &msg,
        )?;

        // Use the day the oracle attested to, not the day the transaction happens
        // to land. The signature covers `a.epoch_day`, and the checks above already
        // require it to move strictly forward, so it is the trustworthy value.
        // Deriving it from the clock instead would collapse every submission made
        // within one wall-clock day into a single counted day.
        let epoch_day = a.epoch_day;
        let goal_type = &self.stake_account.goal_type;

        self.health_data.user = a.user;
        self.health_data.last_sync_timestamp = now;
        self.health_data.epoch_day = epoch_day;
        self.health_data.steps = a.steps;
        self.health_data.sleep_hours = a.sleep_hours;
        self.health_data.gym = a.gym;
        self.health_data.last_nonce = a.nonce;

        if epoch_day > self.stake_account.last_day_checked {
            match goal_type {
                Goal::Gym => {
                    if a.gym  {self.stake_account.days_goal_met += 1};
                }
                Goal::Steps => {
                    if a.steps >= self.stake_account.goal_per_day {self.stake_account.days_goal_met += 1};
                }
                Goal::Sleep => { 
                    if (a.sleep_hours as u32) >= self.stake_account.goal_per_day {self.stake_account.days_goal_met += 1};
                }
            }
            self.stake_account.last_day_checked = epoch_day;
        }

        Ok(())
    } 
}

// Deterministic message format; backend must build bytes in exactly same order.
fn build_attestation_message(a: &AttestationData) -> Vec<u8> {
    let mut m = Vec::with_capacity(80);
    m.extend_from_slice(b"HEALTH_V1");
    m.extend_from_slice(a.user.as_ref());
    m.extend_from_slice(&a.challenge_id.to_le_bytes());
    m.extend_from_slice(&a.epoch_day.to_le_bytes());
    m.extend_from_slice(&a.steps.to_le_bytes());
    m.push(a.sleep_hours);
    m.push(if a.gym { 1 } else { 0 });
    m.extend_from_slice(&a.nonce.to_le_bytes());
    m.extend_from_slice(&a.expires_at.to_le_bytes());
    m
}

fn verify_ed25519_pvs_ix(
    ix_sysvar: &AccountInfo,
    verification_key: &Pubkey,
    expected_messages: &[u8]
) -> Result<()> {
    let current = load_current_index_checked(ix_sysvar).unwrap();
    let current = current as usize;
    require!(current > 0, ErrorCode::MissingEd25519IxError);

    let prev_ix = load_instruction_at_checked(current -1, ix_sysvar)?;
    require_eq!(prev_ix.program_id,Pubkey::from_str(&ed25519_program::id().to_string()).unwrap(), ErrorCode::MissingEd25519IxError);


    //ed25519_ix_matches is not a built-in Solana/Anchor function.
    // It was a placeholder helper name in the example.

    //You need to implement it yourself (or use a helper crate) to parse the ed25519 instruction data and confirm:

    //program id is Ed25519Program,
    //pubkey inside instruction equals your oracle pubkey,
    //message bytes equal your rebuilt attestation_message,
    //signature count/offset layout is valid.
    require!(
        ed25519_ix_matches(&prev_ix.data, verification_key.as_ref(), expected_messages),
        ErrorCode::InvalidVerificationKeySignError
    );

    Ok(())
}

// Expected pubkey is u8 because we are passing bytes here
fn ed25519_ix_matches(ix_data: &[u8], expected_pubkey: &[u8], expected_messages: &[u8]) -> bool {

    if expected_pubkey.len() != 32 || ix_data.len() < 16 { return false; }
    if ix_data[0] != 1 { return false; } // one signature

    let read_data = |i: usize| -> Option<u16> {
        ix_data.get(i..i+2).map(|b| u16::from_le_bytes([b[0], b[1]]))
    };

    // only offsets(indices) and lengths are typecasted to usize because they have to be used as
    // indices and usize is required there whereas others are just memory location
    let sign_off = match read_data(2) {
        Some(v) => v as usize,
        None => return false,
    };
    let sign_ix = match read_data(4) {
        Some(v) => v,
        None => return false,
    };
    let pk_off = match read_data(6) {
        Some(v) => v as usize,
        None => return false,
    };
    let pk_ix = match read_data(8) {
        Some(v) => v,
        None => return false,
    };
    let msg_off = match read_data(10) {
        Some(v) => v as usize,
        None => return false,
    };
    let msg_size = match read_data(12) {
        Some(v) => v as usize,
        None => return false,
    };
    let msg_ix = match read_data(14) {
        Some(v) => v,
        None => return false,
    };

    if sign_ix!= u16::MAX || pk_ix != u16::MAX || msg_ix != u16::MAX { return false; }
    if sign_off.checked_add(64).is_none_or(|e| e > ix_data.len()) { return false; }
    if pk_off.checked_add(32).is_none_or(|e| e > ix_data.len()) { return false; }
    if msg_off.checked_add(msg_size).is_none_or(|e| e > ix_data.len()) { return false; }
    if msg_size != expected_messages.len() { return false; }

    &ix_data[pk_off..pk_off+32] == expected_pubkey
        && &ix_data[msg_off..msg_off+msg_size] == expected_messages

}
