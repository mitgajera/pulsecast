use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    errors::PulseCastError,
    events::MarketResolved,
    oracle::{read_verified_observation, validate_observation},
    state::RoundStatus,
    ResolveMarket,
};

pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
    let clock = Clock::get()?;
    let round = &mut ctx.accounts.round;
    require!(
        round.status == RoundStatus::Watching,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        clock.unix_timestamp >= round.resolve_at,
        PulseCastError::ResolutionTooEarly
    );
    require!(round.start_price > 0, PulseCastError::InvalidPrice);

    let data = ctx.accounts.price_update.try_borrow_data()?;
    let update = PriceUpdateV2::try_deserialize_unchecked(&mut data.as_ref())?;
    let observation = read_verified_observation(&update, ctx.accounts.config.btc_usd_feed_id)?;
    validate_observation(
        observation,
        ctx.accounts.config.oracle_exponent,
        round.resolve_at,
        clock.unix_timestamp,
    )?;

    round.actual_price = observation.price;
    round.actual_publish_time = observation.publish_time;
    round.status = RoundStatus::Resolved;
    emit!(MarketResolved {
        round: round.key(),
        actual_price: observation.price,
        oracle_publish_time: observation.publish_time,
    });
    Ok(())
}
