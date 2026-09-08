use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    errors::PulseCastError,
    events::OpeningPriceCaptured,
    oracle::{read_verified_observation, validate_observation},
    state::OracleSnapshotStatus,
    CaptureOpeningPrice,
};

pub fn capture_opening_price(ctx: Context<CaptureOpeningPrice>) -> Result<()> {
    let clock = Clock::get()?;
    let snapshot = &mut ctx.accounts.oracle_snapshot;
    require!(
        clock.unix_timestamp >= snapshot.open_at && clock.unix_timestamp < snapshot.lock_at,
        PulseCastError::BettingClosed
    );
    require!(
        snapshot.status == OracleSnapshotStatus::Pending,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        snapshot.start_price == 0,
        PulseCastError::OpeningPriceAlreadyCaptured
    );

    let data = ctx.accounts.price_update.try_borrow_data()?;
    let update = PriceUpdateV2::try_deserialize_unchecked(&mut data.as_ref())?;
    let observation = read_verified_observation(&update, snapshot.feed_id)?;
    validate_observation(
        observation,
        snapshot.exponent,
        snapshot.open_at,
        clock.unix_timestamp,
    )?;

    snapshot.start_price = observation.price;
    snapshot.start_publish_time = observation.publish_time;
    snapshot.status = OracleSnapshotStatus::OpeningCaptured;
    emit!(OpeningPriceCaptured {
        round: snapshot.round,
        price: observation.price,
        oracle_publish_time: observation.publish_time,
    });
    Ok(())
}
