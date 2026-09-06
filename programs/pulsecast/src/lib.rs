use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

declare_id!("4UVCJQeggToFwbNx4QgbAvFe1cpQ3aUWRVkYV19VJUQu");

#[program]
pub mod pulsecast {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
