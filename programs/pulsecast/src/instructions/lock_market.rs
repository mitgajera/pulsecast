use anchor_lang::prelude::*;

use crate::{errors::PulseCastError, events::MarketLocked, state::RoundStatus, LockMarket};

pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    validate_lock(ctx.accounts.round.status, ctx.accounts.round.lock_at, now)?;

    let round = &mut ctx.accounts.round;
    round.status = RoundStatus::Watching;
    emit!(MarketLocked {
        round: round.key(),
        prediction_count: round.prediction_count,
        total_pool: round.total_pool,
    });
    Ok(())
}

fn validate_lock(status: RoundStatus, lock_at: i64, now: i64) -> Result<()> {
    require!(
        matches!(status, RoundStatus::Scheduled | RoundStatus::Betting),
        PulseCastError::InvalidMarketStatus
    );
    require!(now >= lock_at, PulseCastError::LockTooEarly);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locks_at_exact_boundary_or_later() {
        assert!(validate_lock(RoundStatus::Betting, 150, 150).is_ok());
        assert!(validate_lock(RoundStatus::Scheduled, 150, 151).is_ok());
    }

    #[test]
    fn rejects_early_or_repeated_transition() {
        assert!(validate_lock(RoundStatus::Betting, 150, 149).is_err());
        assert!(validate_lock(RoundStatus::Watching, 150, 150).is_err());
        assert!(validate_lock(RoundStatus::Resolved, 150, 180).is_err());
    }
}
