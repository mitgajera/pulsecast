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

    pub fn create_market(ctx: Context<CreateMarket>, round_id: u64, open_at: i64) -> Result<()> {
        instructions::create_market(ctx, round_id, open_at)
    }
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct CreateMarket<'info> {
    #[account(
        seeds = [constants::CONFIG_SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + state::Round::INIT_SPACE,
        seeds = [constants::ROUND_SEED, &round_id.to_le_bytes()],
        bump
    )]
    pub round: Account<'info, state::Round>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
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
