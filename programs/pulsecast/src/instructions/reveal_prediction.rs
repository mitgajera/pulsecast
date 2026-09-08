use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};
use session_keys::{session_auth_or, SessionError};

use crate::{errors::PulseCastError, RevealPrediction};

#[session_auth_or(
    ctx.accounts.prediction.user == ctx.accounts.signer.key(),
    SessionError::InvalidToken
)]
pub fn reveal_prediction(ctx: Context<RevealPrediction>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    validate_reveal(
        ctx.accounts.prediction.resolve_at,
        now,
        ctx.accounts.prediction.predicted_price,
    )?;
    require!(
        ctx.accounts.signer.key() == ctx.accounts.prediction.user
            || ctx.accounts.signer.key() == ctx.accounts.prediction.session_signer,
        PulseCastError::InvalidSessionSigner
    );

    MagicIntentBundleBuilder::new(
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit_and_undelegate(&[ctx.accounts.prediction.to_account_info()])
    .build_and_invoke()?;

    Ok(())
}

fn validate_reveal(resolve_at: i64, now: i64, predicted_price: i64) -> Result<()> {
    require!(now >= resolve_at, PulseCastError::ResolutionTooEarly);
    require!(predicted_price > 0, PulseCastError::PredictionMissing);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reveals_at_resolution_boundary() {
        assert!(validate_reveal(180, 180, 10_000_00).is_ok());
    }

    #[test]
    fn rejects_early_or_missing_prediction() {
        assert!(validate_reveal(180, 179, 10_000_00).is_err());
        assert!(validate_reveal(180, 180, 0).is_err());
    }
}
