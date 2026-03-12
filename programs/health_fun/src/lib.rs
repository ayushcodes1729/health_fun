pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7k8STpaJxptrSVn8BLRDw1CgqGMZoU8iVUjkzHA9oCdp");

#[program]
pub mod health_fun {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }
}
