use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

use crate::{errors::PulseCastError, RevealPrediction};

pub fn reveal_prediction(ctx: Context<RevealPrediction>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    validate_reveal(
        ctx.accounts.prediction.resolve_at,
        now,
        ctx.accounts.prediction.predicted_price,
    )?;

    MagicIntentBundleBuilder::new(
        ctx.accounts.user.to_account_info(),
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
