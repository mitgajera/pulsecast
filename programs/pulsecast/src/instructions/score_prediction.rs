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
        round.start_price > 0 && round.actual_price > 0,
        PulseCastError::InvalidPrice
    );

    let (error, score) = calculate_score(
        prediction.predicted_price,
        round.actual_price,
        round.start_price,
        round.max_error_bps,
    )?;

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

fn calculate_score(
    predicted_price: i64,
    actual_price: i64,
    start_price: i64,
    max_error_bps: u16,
) -> Result<(u64, u64)> {
    Ok(if predicted_price == 0 {
        (u64::MAX, 0)
    } else {
        let error = predicted_price.abs_diff(actual_price);
        let score = precision_score(predicted_price, actual_price, start_price, max_error_bps)
            .map_err(|error| match error {
                MathError::InvalidPrice => PulseCastError::InvalidPrice,
                MathError::InvalidBasisPoints => PulseCastError::InvalidBasisPoints,
                _ => PulseCastError::ArithmeticOverflow,
            })?;
        (error, score)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_prediction_scores_zero_without_blocking_settlement() {
        assert_eq!(calculate_score(0, 100, 100, 50).unwrap(), (u64::MAX, 0));
    }
}
