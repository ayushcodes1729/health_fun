use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {

    #[msg("Invalid admin pubkey")]
    InvalidAdminError,

    #[msg("Stake amount is higher than max stake")]
    MaxStakeError,

    #[msg("Lock period is out of range")]
    DurationOutOfRangeError,
    
    #[msg("Stake owner is invalid")]
    InvalidStakeOwnerError,

    #[msg("Already deposited once in stake")]
    AlreadyDepositedError,
}
