use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use session_keys::{Session, SessionTokenV2};

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod oracle;
pub mod state;

declare_id!("4UVCJQeggToFwbNx4QgbAvFe1cpQ3aUWRVkYV19VJUQu");

#[ephemeral]
#[program]
pub mod pulsecast {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, args: instructions::InitializeArgs) -> Result<()> {
        instructions::initialize(ctx, args)
    }

    pub fn create_market(ctx: Context<CreateMarket>, round_id: u64, open_at: i64) -> Result<()> {
        instructions::create_market(ctx, round_id, open_at)
    }

    pub fn enter_market(ctx: Context<EnterMarket>) -> Result<()> {
        instructions::enter_market(ctx)
    }

    pub fn delegate_prediction(ctx: Context<DelegatePrediction>) -> Result<()> {
        instructions::delegate_prediction(ctx)
    }

    pub fn make_prediction_private(ctx: Context<MakePredictionPrivate>) -> Result<()> {
        instructions::make_prediction_private(ctx)
    }

    pub fn submit_prediction(ctx: Context<SubmitPrediction>, predicted_price: i64) -> Result<()> {
        instructions::submit_prediction(ctx, predicted_price)
    }

    pub fn authorize_prediction_session(
        ctx: Context<AuthorizePredictionSession>,
        session_signer: Pubkey,
    ) -> Result<()> {
        instructions::authorize_prediction_session(ctx, session_signer)
    }

    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market(ctx)
    }

    pub fn reveal_prediction(ctx: Context<RevealPrediction>) -> Result<()> {
        instructions::reveal_prediction(ctx)
    }

    pub fn capture_opening_price(ctx: Context<CaptureOpeningPrice>) -> Result<()> {
        instructions::capture_opening_price(ctx)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        instructions::resolve_market(ctx)
    }

    pub fn score_prediction(ctx: Context<ScorePrediction>) -> Result<()> {
        instructions::score_prediction(ctx)
    }

    pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
        instructions::settle_market(ctx)
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        instructions::claim_payout(ctx)
    }

    pub fn pause_protocol(ctx: Context<SetProtocolPause>) -> Result<()> {
        instructions::set_protocol_pause(ctx, true)
    }

    pub fn unpause_protocol(ctx: Context<SetProtocolPause>) -> Result<()> {
        instructions::set_protocol_pause(ctx, false)
    }

    pub fn propose_authority(
        ctx: Context<ProposeAuthority>,
        pending_authority: Pubkey,
    ) -> Result<()> {
        instructions::propose_authority(ctx, pending_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority(ctx)
    }
}

#[derive(Accounts)]
pub struct ProposeAuthority<'info> {
    #[account(
        mut,
        seeds = [constants::CONFIG_SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, state::GlobalConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(
        mut,
        seeds = [constants::CONFIG_SEED],
        bump = config.bump,
        constraint = config.pending_authority == pending_authority.key() @ errors::PulseCastError::Unauthorized
    )]
    pub config: Account<'info, state::GlobalConfig>,
    pub pending_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetProtocolPause<'info> {
    #[account(
        mut,
        seeds = [constants::CONFIG_SEED],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, state::GlobalConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(seeds = [constants::CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(
        seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, state::Round>,
    #[account(
        mut,
        seeds = [
            constants::PREDICTION_SEED,
            round.key().as_ref(),
            user.key().as_ref()
        ],
        bump = prediction.bump,
        has_one = round,
        has_one = user
    )]
    pub prediction: Account<'info, state::Prediction>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = config
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = sponsor,
        associated_token::mint = usdc_mint,
        associated_token::authority = user
    )]
    pub user_usdc: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub sponsor: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, state::Round>,
}

#[derive(Accounts)]
pub struct ScorePrediction<'info> {
    #[account(
        mut,
        seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, state::Round>,
    #[account(
        mut,
        seeds = [
            constants::PREDICTION_SEED,
            round.key().as_ref(),
            prediction.user.as_ref()
        ],
        bump = prediction.bump,
        has_one = round
    )]
    pub prediction: Account<'info, state::Prediction>,
}

#[derive(Accounts)]
pub struct CaptureOpeningPrice<'info> {
    #[account(seeds = [constants::CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(
        mut,
        seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, state::Round>,
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(seeds = [constants::CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(
        mut,
        seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, state::Round>,
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[commit]
#[derive(Accounts)]
pub struct RevealPrediction<'info> {
    #[account(
        mut,
        seeds = [
            constants::PREDICTION_SEED,
            prediction.round.as_ref(),
            user.key().as_ref()
        ],
        bump = prediction.bump,
        has_one = user
    )]
    pub prediction: Account<'info, state::Prediction>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct LockMarket<'info> {
    #[account(
        mut,
        seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, state::Round>,
}

#[derive(Accounts)]
pub struct AuthorizePredictionSession<'info> {
    #[account(
        mut,
        seeds = [
            constants::PREDICTION_SEED,
            prediction.round.as_ref(),
            user.key().as_ref()
        ],
        bump = prediction.bump,
        has_one = user
    )]
    pub prediction: Account<'info, state::Prediction>,
    /// CHECK: Existing canonical permission PDA validated by seeds.
    #[account(
        mut,
        seeds = [
            ephemeral_rollups_sdk::access_control::structs::PERMISSION_SEED,
            prediction.key().as_ref()
        ],
        bump,
        seeds::program = permission_program.key()
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Address constrained to the MagicBlock ephemeral vault.
    #[account(
        mut,
        address = Pubkey::new_from_array(
            ephemeral_rollups_sdk::consts::EPHEMERAL_VAULT_ID.to_bytes()
        )
    )]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Address constrained to the MagicBlock program.
    #[account(
        address = Pubkey::new_from_array(
            ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID.to_bytes()
        )
    )]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: Address constrained to the MagicBlock permission program.
    #[account(
        address = Pubkey::new_from_array(
            ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID.to_bytes()
        )
    )]
    pub permission_program: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts, Session)]
pub struct SubmitPrediction<'info> {
    #[account(
        mut,
        seeds = [
            constants::PREDICTION_SEED,
            prediction.round.as_ref(),
            prediction.user.as_ref()
        ],
        bump = prediction.bump
    )]
    pub prediction: Account<'info, state::Prediction>,
    #[session(
        signer = signer,
        authority = prediction.user.key()
    )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct MakePredictionPrivate<'info> {
    #[account(
        mut,
        seeds = [
            constants::PREDICTION_SEED,
            prediction.round.as_ref(),
            user.key().as_ref()
        ],
        bump = prediction.bump,
        has_one = user
    )]
    pub prediction: Account<'info, state::Prediction>,
    /// CHECK: Canonical permission PDA validated by seeds and permission program.
    #[account(
        mut,
        seeds = [
            ephemeral_rollups_sdk::access_control::structs::PERMISSION_SEED,
            prediction.key().as_ref()
        ],
        bump,
        seeds::program = permission_program.key()
    )]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Address is constrained to the MagicBlock ephemeral vault.
    #[account(
        mut,
        address = Pubkey::new_from_array(
            ephemeral_rollups_sdk::consts::EPHEMERAL_VAULT_ID.to_bytes()
        )
    )]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Address is constrained to the MagicBlock program.
    #[account(
        address = Pubkey::new_from_array(
            ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID.to_bytes()
        )
    )]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: Address is constrained to the MagicBlock permission program.
    #[account(
        address = Pubkey::new_from_array(
            ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID.to_bytes()
        )
    )]
    pub permission_program: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePrediction<'info> {
    #[account(seeds = [constants::CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()], bump = round.bump)]
    pub round: Account<'info, state::Round>,
    #[account(
        mut,
        del,
        seeds = [constants::PREDICTION_SEED, round.key().as_ref(), user.key().as_ref()],
        bump = prediction.bump,
        has_one = round,
        has_one = user
    )]
    pub prediction: Account<'info, state::Prediction>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct EnterMarket<'info> {
    #[account(seeds = [constants::CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, state::GlobalConfig>,
    #[account(mut, seeds = [constants::ROUND_SEED, &round.id.to_le_bytes()], bump = round.bump)]
    pub round: Account<'info, state::Round>,
    #[account(
        init,
        payer = sponsor,
        space = 8 + state::Prediction::INIT_SPACE,
        seeds = [constants::PREDICTION_SEED, round.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub prediction: Account<'info, state::Prediction>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = user
    )]
    pub user_usdc: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = sponsor,
        associated_token::mint = usdc_mint,
        associated_token::authority = config
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub sponsor: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
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
