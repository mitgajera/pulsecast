use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    errors::PulseCastError,
    events::OpeningPriceCaptured,
    oracle::{read_verified_observation, validate_observation},
    state::RoundStatus,
    CaptureOpeningPrice,
};

pub fn capture_opening_price(ctx: Context<CaptureOpeningPrice>) -> Result<()> {
    let clock = Clock::get()?;
    let round = &mut ctx.accounts.round;
    require!(
        matches!(round.status, RoundStatus::Scheduled | RoundStatus::Betting),
        PulseCastError::InvalidMarketStatus
    );
    require!(
        clock.unix_timestamp >= round.open_at && clock.unix_timestamp < round.lock_at,
        PulseCastError::BettingClosed
    );
    require!(
        round.start_price == 0,
        PulseCastError::OpeningPriceAlreadyCaptured
    );

    let data = ctx.accounts.price_update.try_borrow_data()?;
    let update = PriceUpdateV2::try_deserialize_unchecked(&mut data.as_ref())?;
    let observation = read_verified_observation(&update, ctx.accounts.config.btc_usd_feed_id)?;
    validate_observation(
        observation,
        ctx.accounts.config.oracle_exponent,
        round.open_at,
        clock.unix_timestamp,
    )?;

    round.start_price = observation.price;
    round.start_publish_time = observation.publish_time;
    emit!(OpeningPriceCaptured {
        round: round.key(),
        price: observation.price,
        oracle_publish_time: observation.publish_time,
    });
    Ok(())
}
