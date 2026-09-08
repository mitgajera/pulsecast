use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::{
    errors::PulseCastError,
    oracle::{read_verified_observation, validate_observation},
    state::OracleSnapshotStatus,
    ResolveMarket,
};

pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
    let clock = Clock::get()?;
    let snapshot = &mut ctx.accounts.oracle_snapshot;
    require!(
        clock.unix_timestamp >= snapshot.resolve_at,
        PulseCastError::ResolutionTooEarly
    );
    require!(
        snapshot.status == OracleSnapshotStatus::OpeningCaptured,
        PulseCastError::InvalidMarketStatus
    );
    require!(snapshot.start_price > 0, PulseCastError::InvalidPrice);

    let data = ctx.accounts.price_update.try_borrow_data()?;
    let update = PriceUpdateV2::try_deserialize_unchecked(&mut data.as_ref())?;
    let observation = read_verified_observation(&update, snapshot.feed_id)?;
    validate_observation(
        observation,
        snapshot.exponent,
        snapshot.resolve_at,
        clock.unix_timestamp,
    )?;

    snapshot.actual_price = observation.price;
    snapshot.actual_publish_time = observation.publish_time;
    snapshot.status = OracleSnapshotStatus::ClosingCaptured;

    MagicIntentBundleBuilder::new(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.oracle_snapshot.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
