use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

use crate::{errors::PulseCastError, events::MarketEntered, state::RoundStatus, EnterMarket};

pub fn enter_market(ctx: Context<EnterMarket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let round = &mut ctx.accounts.round;

    require!(!ctx.accounts.config.paused, PulseCastError::ProtocolPaused);
    require!(
        now >= round.open_at && now < round.lock_at,
        PulseCastError::BettingClosed
    );
    require!(
        matches!(round.status, RoundStatus::Scheduled | RoundStatus::Betting),
        PulseCastError::BettingClosed
    );
    require!(
        round.prediction_count < crate::constants::MAX_PARTICIPANTS,
        PulseCastError::MarketFull
    );

    let entry_amount = ctx.accounts.config.entry_amount;
    let next_pool = round
        .total_pool
        .checked_add(entry_amount)
        .ok_or(PulseCastError::ArithmeticOverflow)?;
    let next_count = round
        .prediction_count
        .checked_add(1)
        .ok_or(PulseCastError::ArithmeticOverflow)?;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.user_usdc.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        entry_amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let prediction = &mut ctx.accounts.prediction;
    prediction.round = round.key();
    prediction.user = ctx.accounts.user.key();
    prediction.session_signer = Pubkey::default();
    prediction.lock_at = round.lock_at;
    prediction.resolve_at = round.resolve_at;
    prediction.predicted_price = 0;
    prediction.submitted_at = 0;
    prediction.error = 0;
    prediction.score = 0;
    prediction.payout = 0;
    prediction.scored = false;
    prediction.claimed = false;
    prediction.bump = ctx.bumps.prediction;

    round.status = RoundStatus::Betting;
    round.total_pool = next_pool;
    round.prediction_count = next_count;

    emit!(MarketEntered {
        round: round.key(),
        user: ctx.accounts.user.key(),
        entry_amount,
    });
    Ok(())
}
