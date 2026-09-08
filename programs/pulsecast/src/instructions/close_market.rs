use anchor_lang::prelude::*;

use crate::{errors::PulseCastError, state::RoundStatus, CloseMarket};

pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
    require!(
        ctx.accounts.round.status == RoundStatus::Settled
            || ctx.accounts.round.status == RoundStatus::Cancelled,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        ctx.accounts.round.claimed_count == ctx.accounts.round.prediction_count,
        PulseCastError::UnclaimedPayouts
    );
    Ok(())
}
