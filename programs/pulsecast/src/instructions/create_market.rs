use anchor_lang::prelude::*;

use crate::{
    constants::{BETTING_SECONDS, MARKET_SECONDS},
    errors::PulseCastError,
    events::MarketCreated,
    state::{is_minute_aligned, OracleSnapshotStatus, RoundStatus},
    CreateMarket,
};

pub fn create_market(ctx: Context<CreateMarket>, round_id: u64, open_at: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let (lock_at, resolve_at) = validate_schedule(open_at, now)?;
    require!(!ctx.accounts.config.paused, PulseCastError::ProtocolPaused);

    let round = &mut ctx.accounts.round;
    round.id = round_id;
    round.status = RoundStatus::Scheduled;
    round.open_at = open_at;
    round.lock_at = lock_at;
    round.resolve_at = resolve_at;
    round.start_price = 0;
    round.start_publish_time = 0;
    round.actual_price = 0;
    round.actual_publish_time = 0;
    round.total_pool = 0;
    round.total_score = 0;
    round.protocol_fee = 0;
    round.prediction_count = 0;
    round.scored_count = 0;
    round.claimed_count = 0;
    round.entry_amount = ctx.accounts.config.entry_amount;
    round.fee_bps = ctx.accounts.config.fee_bps;
    round.max_error_bps = ctx.accounts.config.max_error_bps;
    round.bump = ctx.bumps.round;

    let snapshot = &mut ctx.accounts.oracle_snapshot;
    snapshot.round = round.key();
    snapshot.status = OracleSnapshotStatus::Pending;
    snapshot.open_at = open_at;
    snapshot.lock_at = lock_at;
    snapshot.resolve_at = resolve_at;
    snapshot.feed_id = ctx.accounts.config.btc_usd_feed_id;
    snapshot.exponent = ctx.accounts.config.oracle_exponent;
    snapshot.start_price = 0;
    snapshot.start_publish_time = 0;
    snapshot.actual_price = 0;
    snapshot.actual_publish_time = 0;
    snapshot.bump = ctx.bumps.oracle_snapshot;

    emit!(MarketCreated {
        round: round.key(),
        round_id,
        open_at,
        lock_at,
        resolve_at,
        entry_amount: ctx.accounts.config.entry_amount,
    });
    Ok(())
}

fn validate_schedule(open_at: i64, now: i64) -> Result<(i64, i64)> {
    require!(
        is_minute_aligned(open_at),
        PulseCastError::MarketNotMinuteAligned
    );
    require!(open_at > now, PulseCastError::MarketStartNotFuture);

    let lock_at = open_at
        .checked_add(BETTING_SECONDS)
        .ok_or(PulseCastError::InvalidMarketSchedule)?;
    let resolve_at = open_at
        .checked_add(MARKET_SECONDS)
        .ok_or(PulseCastError::InvalidMarketSchedule)?;
    Ok((lock_at, resolve_at))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_exact_thirty_sixty_schedule() {
        assert_eq!(validate_schedule(120, 119).unwrap(), (150, 180));
    }

    #[test]
    fn rejects_partial_or_non_future_start() {
        assert!(validate_schedule(121, 100).is_err());
        assert!(validate_schedule(120, 120).is_err());
        assert!(validate_schedule(-60, -61).is_err());
    }
}
