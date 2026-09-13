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

    #[msg("Invalid verification key used")]
    InvalidVerificationKeyError,

    #[msg("Current time is in the past of last sync time")]
    StaleUpdateError,

    #[msg("Attested data has invalid user key")]
    InvalidUserError,

    #[msg("Attestation data expired")]
    AttestationExpiredError,

    #[msg("Replay update of health data")]
    ReplayUpdateError,

    #[msg("Invalid epoch day in attestation")]
    InvalidEpochError,

    #[msg("Current index of sysvar instructions not found or invalid")]
    MissingEd25519IxError,

    #[msg("Invalid signature for the payload data")]
    InvalidVerificationKeySignError,

    #[msg("Invalid instruction address for signature verification")]
    InvalidInstructionError,

    #[msg("Invalid vault pubkey for treasury")]
    InvalidTreasuryVaultError,

    #[msg("The staked challenge is already claimed")]
    AlreadyClaimedError,

    #[msg("The challenge has not completed")]
    StakeStillLockedError,

    #[msg("Attested epoch day is in the future")]
    FutureEpochError,

    #[msg("Stake amount must be greater than zero")]
    ZeroStakeError,

    #[msg("Config values are invalid: max_stake must be positive and 0 <= min_lock_duration <= max_lock_duration")]
    InvalidConfigError,

    #[msg("Withdrawal amount must be greater than zero")]
    ZeroWithdrawalError,
}
