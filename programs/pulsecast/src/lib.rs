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

    pub fn initialize(ctx: Context<Initialize>, args: instructions::InitializeArgs) -> Result<()> {
        instructions::initialize(ctx, args)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + state::GlobalConfig::INIT_SPACE,
        seeds = [constants::CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
