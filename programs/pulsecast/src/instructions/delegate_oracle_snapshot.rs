use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::{constants::PRIVATE_COMMIT_FREQUENCY_MS, DelegateOracleSnapshot};

pub fn delegate_oracle_snapshot(ctx: Context<DelegateOracleSnapshot>) -> Result<()> {
    let round = ctx.accounts.round.key();
    let seeds = [crate::constants::ORACLE_SNAPSHOT_SEED, round.as_ref()];

    ctx.accounts.delegate_oracle_snapshot(
        &ctx.accounts.authority,
        &seeds,
        DelegateConfig {
            commit_frequency_ms: PRIVATE_COMMIT_FREQUENCY_MS,
            validator: Some(ctx.accounts.config.tee_validator),
        },
    )?;
    Ok(())
}
