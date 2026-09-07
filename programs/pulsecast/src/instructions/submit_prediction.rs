use anchor_lang::prelude::*;
use session_keys::{session_auth_or, SessionError};

use crate::{errors::PulseCastError, SubmitPrediction};

#[session_auth_or(
    ctx.accounts.prediction.user == ctx.accounts.signer.key(),
    SessionError::InvalidToken
)]
pub fn submit_prediction(ctx: Context<SubmitPrediction>, predicted_price: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    validate_submission(ctx.accounts.prediction.lock_at, now, predicted_price)?;
    require!(
        ctx.accounts.signer.key() == ctx.accounts.prediction.user
            || ctx.accounts.signer.key() == ctx.accounts.prediction.session_signer,
        PulseCastError::InvalidSessionSigner
    );

    let prediction = &mut ctx.accounts.prediction;
    prediction.predicted_price = predicted_price;
    prediction.submitted_at = now;
    Ok(())
}

fn validate_submission(lock_at: i64, now: i64, predicted_price: i64) -> Result<()> {
    require!(now < lock_at, PulseCastError::BettingClosed);
    require!(predicted_price > 0, PulseCastError::InvalidPrice);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_positive_price_before_lock() {
        assert!(validate_submission(150, 149, 10_000_00).is_ok());
    }

    #[test]
    fn rejects_lock_boundary_and_invalid_price() {
        assert!(validate_submission(150, 150, 10_000_00).is_err());
        assert!(validate_submission(150, 149, 0).is_err());
        assert!(validate_submission(150, 149, -1).is_err());
    }
}
