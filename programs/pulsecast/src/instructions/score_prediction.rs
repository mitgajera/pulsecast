use anchor_lang::prelude::*;

use crate::{
    errors::PulseCastError,
    events::PredictionScored,
    math::{precision_score, MathError},
    state::RoundStatus,
    ScorePrediction,
};

pub fn score_prediction(ctx: Context<ScorePrediction>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let prediction = &mut ctx.accounts.prediction;

    require!(
        round.status == RoundStatus::Resolved,
        PulseCastError::InvalidMarketStatus
    );
    require!(!prediction.scored, PulseCastError::PredictionAlreadyScored);
    require!(
        prediction.predicted_price > 0,
        PulseCastError::PredictionMissing
    );
    require!(
        round.start_price > 0 && round.actual_price > 0,
        PulseCastError::InvalidPrice
    );

    let error = prediction.predicted_price.abs_diff(round.actual_price);
    let score = precision_score(
        prediction.predicted_price,
        round.actual_price,
        round.start_price,
        round.max_error_bps,
    )
    .map_err(|error| match error {
        MathError::InvalidPrice => PulseCastError::InvalidPrice,
        MathError::InvalidBasisPoints => PulseCastError::InvalidBasisPoints,
        _ => PulseCastError::ArithmeticOverflow,
    })?;

    round.total_score = round
        .total_score
        .checked_add(score)
        .ok_or(PulseCastError::ArithmeticOverflow)?;
    round.scored_count = round
        .scored_count
        .checked_add(1)
        .ok_or(PulseCastError::ArithmeticOverflow)?;
    prediction.error = error;
    prediction.score = score;
    prediction.scored = true;

    emit!(PredictionScored {
        round: round.key(),
        prediction: prediction.key(),
        user: prediction.user,
        error,
        score,
    });
    Ok(())
}
