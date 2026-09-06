use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::{constants::PRIVATE_COMMIT_FREQUENCY_MS, DelegatePrediction};

pub fn delegate_prediction(ctx: Context<DelegatePrediction>) -> Result<()> {
    let round_key = ctx.accounts.round.key();
    let user_key = ctx.accounts.user.key();
    let seeds = [
        crate::constants::PREDICTION_SEED,
        round_key.as_ref(),
        user_key.as_ref(),
    ];

    ctx.accounts.delegate_prediction(
        &ctx.accounts.user,
        &seeds,
        DelegateConfig {
            commit_frequency_ms: PRIVATE_COMMIT_FREQUENCY_MS,
            validator: Some(ctx.accounts.config.tee_validator),
        },
    )?;
    Ok(())
}
