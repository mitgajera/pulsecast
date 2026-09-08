use anchor_lang::prelude::*;

use crate::{
    errors::PulseCastError,
    events::MarketResolved,
    state::{OracleSnapshotStatus, RoundStatus},
    FinalizeMarket,
};

pub fn finalize_market(ctx: Context<FinalizeMarket>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let snapshot = &ctx.accounts.oracle_snapshot;

    require!(
        round.status == RoundStatus::Watching,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        snapshot.status == OracleSnapshotStatus::ClosingCaptured,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        snapshot.open_at == round.open_at
            && snapshot.lock_at == round.lock_at
            && snapshot.resolve_at == round.resolve_at,
        PulseCastError::InvalidMarketSchedule
    );
    require!(
        snapshot.feed_id == ctx.accounts.config.btc_usd_feed_id
            && snapshot.exponent == ctx.accounts.config.oracle_exponent,
        PulseCastError::InvalidOracleFeed
    );
    require!(
        snapshot.start_price > 0 && snapshot.actual_price > 0,
        PulseCastError::InvalidPrice
    );
    require!(
        snapshot.start_publish_time >= round.open_at,
        PulseCastError::StaleOraclePrice
    );
    require!(
        snapshot.actual_publish_time >= round.resolve_at,
        PulseCastError::OraclePriceBeforeResolution
    );

    round.start_price = snapshot.start_price;
    round.start_publish_time = snapshot.start_publish_time;
    round.actual_price = snapshot.actual_price;
    round.actual_publish_time = snapshot.actual_publish_time;
    round.status = RoundStatus::Resolved;
    ctx.accounts.oracle_snapshot.status = OracleSnapshotStatus::Finalized;

    emit!(MarketResolved {
        round: round.key(),
        actual_price: round.actual_price,
        oracle_publish_time: round.actual_publish_time,
    });
    Ok(())
}
