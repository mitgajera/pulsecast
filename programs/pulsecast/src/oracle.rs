use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::{
    constants::{
        BPS_DENOMINATOR, MAX_ORACLE_AGE_SECONDS, MAX_ORACLE_CONFIDENCE_BPS, ORACLE_GRACE_SECONDS,
    },
    errors::PulseCastError,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OracleObservation {
    pub price: i64,
    pub confidence: u64,
    pub exponent: i32,
    pub publish_time: i64,
    pub prev_publish_time: i64,
}

pub fn read_verified_observation(
    update: &PriceUpdateV2,
    expected_feed_id: [u8; 32],
) -> Result<OracleObservation> {
    require!(
        update.verification_level == VerificationLevel::Full,
        PulseCastError::OracleNotFullyVerified
    );
    require!(
        update.price_message.feed_id == expected_feed_id,
        PulseCastError::InvalidOracleFeed
    );
    Ok(OracleObservation {
        price: update.price_message.price,
        confidence: update.price_message.conf,
        exponent: update.price_message.exponent,
        publish_time: update.price_message.publish_time,
        prev_publish_time: update.price_message.prev_publish_time,
    })
}

pub fn validate_observation(
    observation: OracleObservation,
    expected_exponent: i32,
    target_time: i64,
    now: i64,
) -> Result<()> {
    require!(observation.price > 0, PulseCastError::InvalidPrice);
    require!(
        observation.exponent == expected_exponent,
        PulseCastError::InvalidOracleExponent
    );
    require!(
        observation.prev_publish_time < target_time && target_time <= observation.publish_time,
        PulseCastError::OraclePriceBeforeResolution
    );
    require!(
        observation.publish_time <= target_time.saturating_add(ORACLE_GRACE_SECONDS),
        PulseCastError::OraclePriceAfterGrace
    );
    require!(
        observation.publish_time <= now
            && now.saturating_sub(observation.publish_time) <= MAX_ORACLE_AGE_SECONDS,
        PulseCastError::StaleOraclePrice
    );

    let confidence_bps = u128::from(observation.confidence)
        .checked_mul(BPS_DENOMINATOR)
        .ok_or(PulseCastError::ArithmeticOverflow)?;
    let maximum_confidence = (observation.price as u128)
        .checked_mul(u128::from(MAX_ORACLE_CONFIDENCE_BPS))
        .ok_or(PulseCastError::ArithmeticOverflow)?;
    require!(
        confidence_bps <= maximum_confidence,
        PulseCastError::OracleConfidenceTooWide
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn observation() -> OracleObservation {
        OracleObservation {
            price: 10_000_000_000,
            confidence: 10_000_000,
            exponent: -8,
            publish_time: 180,
            prev_publish_time: 179,
        }
    }

    #[test]
    fn accepts_fresh_bounded_observation() {
        assert!(validate_observation(observation(), -8, 180, 181).is_ok());
    }

    #[test]
    fn rejects_wrong_time_exponent_and_confidence() {
        let mut value = observation();
        value.publish_time = 179;
        assert!(validate_observation(value, -8, 180, 181).is_err());
        value = observation();
        value.exponent = -6;
        assert!(validate_observation(value, -8, 180, 181).is_err());
        value = observation();
        value.confidence = 200_000_000;
        assert!(validate_observation(value, -8, 180, 181).is_err());
    }
}
