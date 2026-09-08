use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::{constants::ORACLE_GRACE_SECONDS, errors::PulseCastError, CancelOracleSnapshot};

pub fn cancel_oracle_snapshot(ctx: Context<CancelOracleSnapshot>) -> Result<()> {
    let snapshot = &ctx.accounts.oracle_snapshot;
    let cancel_at = snapshot
        .resolve_at
        .checked_add(ORACLE_GRACE_SECONDS)
        .ok_or(PulseCastError::InvalidMarketSchedule)?;
    require!(
        Clock::get()?.unix_timestamp > cancel_at,
        PulseCastError::CancellationTooEarly
    );

    ctx.accounts.oracle_snapshot.exit(&crate::ID)?;
    MagicIntentBundleBuilder::new(
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.oracle_snapshot.to_account_info()])
    .build_and_invoke()?;
    Ok(())
}
