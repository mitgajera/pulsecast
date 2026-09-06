use crate::constants::BPS_DENOMINATOR;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MathError {
    EmptyEntries,
    LengthMismatch,
    InvalidBasisPoints,
    InvalidPrice,
    Overflow,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolAllocation {
    pub payouts: Vec<u64>,
    pub fee: u64,
    pub total_pool: u64,
    pub refunded: bool,
}

pub fn precision_score(
    predicted_price: i64,
    actual_price: i64,
    start_price: i64,
    max_error_bps: u16,
) -> Result<u64, MathError> {
    if predicted_price <= 0 || actual_price <= 0 || start_price <= 0 {
        return Err(MathError::InvalidPrice);
    }
    if max_error_bps == 0 || u128::from(max_error_bps) > BPS_DENOMINATOR {
        return Err(MathError::InvalidBasisPoints);
    }

    // Perform the multiplication before division so integer rounding happens only
    // once. Positive i64 prices and a basis-point value capped at 10_000 keep
    // the final value representable as u64, while checked arithmetic documents
    // and enforces that invariant.
    let max_error = (start_price as u128)
        .checked_mul(u128::from(max_error_bps))
        .ok_or(MathError::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MathError::Overflow)?;
    let max_error = u64::try_from(max_error).map_err(|_| MathError::Overflow)?;
    let error = predicted_price.abs_diff(actual_price);

    Ok(max_error.saturating_sub(error))
}

pub fn allocate_pool(
    scores: &[u64],
    stakes: &[u64],
    fee_bps: u16,
) -> Result<PoolAllocation, MathError> {
    if scores.is_empty() {
        return Err(MathError::EmptyEntries);
    }
    if scores.len() != stakes.len() {
        return Err(MathError::LengthMismatch);
    }
    if u128::from(fee_bps) > BPS_DENOMINATOR {
        return Err(MathError::InvalidBasisPoints);
    }

    let total_pool_u128 = stakes.iter().try_fold(0_u128, |total, stake| {
        total
            .checked_add(u128::from(*stake))
            .ok_or(MathError::Overflow)
    })?;
    let total_pool = u64::try_from(total_pool_u128).map_err(|_| MathError::Overflow)?;
    let total_score = scores.iter().try_fold(0_u128, |total, score| {
        total
            .checked_add(u128::from(*score))
            .ok_or(MathError::Overflow)
    })?;

    if total_score == 0 {
        return Ok(PoolAllocation {
            payouts: stakes.to_vec(),
            fee: 0,
            total_pool,
            refunded: true,
        });
    }

    let fee_u128 = total_pool_u128
        .checked_mul(u128::from(fee_bps))
        .ok_or(MathError::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MathError::Overflow)?;
    let distributable = total_pool_u128
        .checked_sub(fee_u128)
        .ok_or(MathError::Overflow)?;

    let mut payouts = Vec::with_capacity(scores.len());
    let mut distributed = 0_u128;
    for score in scores {
        let payout = distributable
            .checked_mul(u128::from(*score))
            .ok_or(MathError::Overflow)?
            .checked_div(total_score)
            .ok_or(MathError::Overflow)?;
        distributed = distributed.checked_add(payout).ok_or(MathError::Overflow)?;
        payouts.push(u64::try_from(payout).map_err(|_| MathError::Overflow)?);
    }

    let remainder = distributable
        .checked_sub(distributed)
        .ok_or(MathError::Overflow)?;
    if remainder > 0 {
        // The rounding remainder is assigned to the earliest entry among those
        // with the highest score. This makes settlement deterministic without
        // depending on sort stability or iteration outside this function.
        let winner_index = scores
            .iter()
            .enumerate()
            .max_by(|(left_index, left_score), (right_index, right_score)| {
                left_score
                    .cmp(right_score)
                    .then_with(|| right_index.cmp(left_index))
            })
            .map(|(index, _)| index)
            .ok_or(MathError::EmptyEntries)?;
        payouts[winner_index] = payouts[winner_index]
            .checked_add(u64::try_from(remainder).map_err(|_| MathError::Overflow)?)
            .ok_or(MathError::Overflow)?;
    }

    Ok(PoolAllocation {
        payouts,
        fee: u64::try_from(fee_u128).map_err(|_| MathError::Overflow)?,
        total_pool,
        refunded: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_is_bounded_and_monotonic() {
        let exact = precision_score(10_000_00, 10_000_00, 10_000_00, 50).unwrap();
        let close = precision_score(9_990_00, 10_000_00, 10_000_00, 50).unwrap();
        let far = precision_score(9_900_00, 10_000_00, 10_000_00, 50).unwrap();
        assert!(exact > close);
        assert!(close > far);
        assert_eq!(far, 0);
    }

    #[test]
    fn score_is_symmetric_and_zero_at_or_beyond_cutoff() {
        let actual = 10_000_00;
        let start = 10_000_00;
        let max_error_bps = 50;

        assert_eq!(
            precision_score(actual - 1_00, actual, start, max_error_bps),
            precision_score(actual + 1_00, actual, start, max_error_bps)
        );
        assert_eq!(
            precision_score(actual - 50_00, actual, start, max_error_bps),
            Ok(0)
        );
        assert_eq!(
            precision_score(actual + 50_01, actual, start, max_error_bps),
            Ok(0)
        );
    }

    #[test]
    fn score_handles_maximum_positive_i64_prices() {
        assert_eq!(
            precision_score(i64::MAX, i64::MAX, i64::MAX, 10_000),
            Ok(i64::MAX as u64)
        );
        assert_eq!(precision_score(1, i64::MAX, i64::MAX, 10_000), Ok(1));
    }

    #[test]
    fn score_uses_floor_rounding_for_basis_point_threshold() {
        assert_eq!(precision_score(99, 100, 101, 100), Ok(0));
        assert_eq!(precision_score(100, 100, 101, 100), Ok(1));
    }

    #[test]
    fn invalid_prices_and_basis_points_are_rejected() {
        assert_eq!(precision_score(0, 1, 1, 50), Err(MathError::InvalidPrice));
        assert_eq!(
            precision_score(1, 1, 1, 0),
            Err(MathError::InvalidBasisPoints)
        );
        assert_eq!(
            precision_score(1, 1, 1, 10_001),
            Err(MathError::InvalidBasisPoints)
        );
    }

    #[test]
    fn allocation_conserves_pool_and_awards_remainder_to_first_top_score() {
        let allocation = allocate_pool(&[3, 3, 1], &[1_000_000; 3], 300).unwrap();
        assert!(!allocation.refunded);
        assert_eq!(allocation.fee, 90_000);
        assert_eq!(
            allocation.payouts.iter().sum::<u64>() + allocation.fee,
            3_000_000
        );
        assert!(allocation.payouts[0] >= allocation.payouts[1]);
    }

    #[test]
    fn remainder_goes_to_earliest_highest_score() {
        let tied = allocate_pool(&[1, 1], &[4, 5], 0).unwrap();
        assert_eq!(tied.payouts, vec![5, 4]);

        let later_top_score = allocate_pool(&[1, 3, 2], &[1, 1, 8], 0).unwrap();
        assert_eq!(later_top_score.payouts, vec![1, 6, 3]);
    }

    #[test]
    fn allocation_conserves_pool_across_small_input_space() {
        for first_score in 0..=6 {
            for second_score in 0..=6 {
                for first_stake in 0..=9 {
                    for second_stake in 0..=9 {
                        for fee_bps in [0, 1, 333, 5_000, 10_000] {
                            let allocation = allocate_pool(
                                &[first_score, second_score],
                                &[first_stake, second_stake],
                                fee_bps,
                            )
                            .unwrap();
                            let paid = allocation
                                .payouts
                                .iter()
                                .try_fold(0_u64, |sum, payout| sum.checked_add(*payout))
                                .unwrap();

                            assert_eq!(paid + allocation.fee, allocation.total_pool);
                            assert_eq!(allocation.refunded, first_score == 0 && second_score == 0);
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn maximum_representable_pool_is_allocated_without_overflow() {
        let allocation = allocate_pool(&[u64::MAX, u64::MAX], &[u64::MAX, 0], 1).unwrap();
        let paid = allocation
            .payouts
            .iter()
            .try_fold(0_u64, |sum, payout| sum.checked_add(*payout))
            .unwrap();

        assert_eq!(paid + allocation.fee, u64::MAX);
        assert_eq!(allocation.total_pool, u64::MAX);
    }

    #[test]
    fn full_fee_is_supported_and_conserves_the_pool() {
        let allocation = allocate_pool(&[1, 2], &[40, 60], 10_000).unwrap();
        assert_eq!(allocation.payouts, vec![0, 0]);
        assert_eq!(allocation.fee, 100);
        assert!(!allocation.refunded);
    }

    #[test]
    fn zero_scores_refund_every_stake_without_fee() {
        let allocation = allocate_pool(&[0, 0], &[1_000_000, 2_000_000], 300).unwrap();
        assert!(allocation.refunded);
        assert_eq!(allocation.fee, 0);
        assert_eq!(allocation.payouts, vec![1_000_000, 2_000_000]);
    }

    #[test]
    fn mismatched_inputs_and_invalid_fee_are_rejected() {
        assert_eq!(allocate_pool(&[], &[], 0), Err(MathError::EmptyEntries));
        assert_eq!(allocate_pool(&[1], &[], 0), Err(MathError::LengthMismatch));
        assert_eq!(
            allocate_pool(&[1], &[1], 10_001),
            Err(MathError::InvalidBasisPoints)
        );
    }

    #[test]
    fn total_pool_overflow_is_rejected() {
        assert_eq!(
            allocate_pool(&[1, 1], &[u64::MAX, 1], 0),
            Err(MathError::Overflow)
        );
    }
}
