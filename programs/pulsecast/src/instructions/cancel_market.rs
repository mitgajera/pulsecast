use anchor_lang::prelude::*;

use crate::{
    constants::ORACLE_GRACE_SECONDS,
    errors::PulseCastError,
    state::{OracleSnapshotStatus, RoundStatus},
    CancelMarket,
};

pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let cancel_at = round
        .resolve_at
        .checked_add(ORACLE_GRACE_SECONDS)
        .ok_or(PulseCastError::InvalidMarketSchedule)?;
    require!(
        Clock::get()?.unix_timestamp > cancel_at,
        PulseCastError::CancellationTooEarly
    );
    require!(
        !matches!(round.status, RoundStatus::Settled | RoundStatus::Cancelled),
        PulseCastError::InvalidMarketStatus
    );
    require!(
        !matches!(
            ctx.accounts.oracle_snapshot.status,
            OracleSnapshotStatus::ClosingCaptured | OracleSnapshotStatus::Finalized
        ),
        PulseCastError::InvalidMarketStatus
    );
    round.status = RoundStatus::Cancelled;
    Ok(())
}
