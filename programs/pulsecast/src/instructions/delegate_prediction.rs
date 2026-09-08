use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::{
    constants::PRIVATE_COMMIT_FREQUENCY_MS,
    errors::PulseCastError,
    state::{Prediction, RoundStatus},
    DelegatePrediction,
};

pub fn delegate_prediction(ctx: Context<DelegatePrediction>) -> Result<()> {
    require!(
        Clock::get()?.unix_timestamp < ctx.accounts.round.lock_at
            && matches!(ctx.accounts.round.status, RoundStatus::Betting),
        PulseCastError::BettingClosed
    );
    let prediction_data = ctx.accounts.prediction.try_borrow_data()?;
    let prediction = Prediction::try_deserialize(&mut prediction_data.as_ref())?;
    require!(
        prediction.session_signer != Pubkey::default(),
        PulseCastError::InvalidSessionSigner
    );
    drop(prediction_data);

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
