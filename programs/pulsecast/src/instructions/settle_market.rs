use anchor_lang::prelude::*;

use crate::{
    constants::PREDICTION_SEED,
    errors::PulseCastError,
    events::MarketSettled,
    math::allocate_pool,
    state::{Prediction, RoundStatus},
    SettleMarket,
};

pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    require!(
        round.status == RoundStatus::Resolved,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        round.scored_count == round.prediction_count,
        PulseCastError::InvalidSettlementAccounts
    );
    require!(
        ctx.remaining_accounts.len() == usize::from(round.prediction_count),
        PulseCastError::InvalidSettlementAccounts
    );

    if round.prediction_count == 0 {
        round.status = RoundStatus::Settled;
        emit_settled(round, 0);
        return Ok(());
    }

    let mut accounts: Vec<&AccountInfo> = ctx.remaining_accounts.iter().collect();
    accounts.sort_unstable_by_key(|account| account.key().to_bytes());
    require!(
        accounts
            .windows(2)
            .all(|pair| pair[0].key() != pair[1].key()),
        PulseCastError::InvalidSettlementAccounts
    );

    let round_key = round.key();
    let mut predictions = Vec::with_capacity(accounts.len());
    for account in &accounts {
        require!(
            account.owner == &crate::ID && account.is_writable,
            PulseCastError::InvalidSettlementAccounts
        );
        let data = account.try_borrow_data()?;
        let prediction = Prediction::try_deserialize(&mut data.as_ref())?;
        let (expected, _) = Pubkey::find_program_address(
            &[
                PREDICTION_SEED,
                round_key.as_ref(),
                prediction.user.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(
            expected,
            account.key(),
            PulseCastError::InvalidSettlementAccounts
        );
        require_keys_eq!(
            prediction.round,
            round_key,
            PulseCastError::InvalidSettlementAccounts
        );
        require!(
            prediction.scored && !prediction.claimed,
            PulseCastError::InvalidSettlementAccounts
        );
        predictions.push(prediction);
    }

    let scores: Vec<u64> = predictions
        .iter()
        .map(|prediction| prediction.score)
        .collect();
    let stakes = vec![round.entry_amount; predictions.len()];
    let allocation = allocate_pool(&scores, &stakes, round.fee_bps)
        .map_err(|_| PulseCastError::ArithmeticOverflow)?;
    require!(
        allocation.total_pool == round.total_pool,
        PulseCastError::PoolMismatch
    );

    for ((account, mut prediction), payout) in accounts
        .iter()
        .zip(predictions.into_iter())
        .zip(allocation.payouts.iter())
    {
        prediction.payout = *payout;
        let mut data = account.try_borrow_mut_data()?;
        prediction.try_serialize(&mut data.as_mut())?;
    }

    let total_payout = allocation.payouts.iter().try_fold(0_u64, |sum, payout| {
        sum.checked_add(*payout)
            .ok_or(PulseCastError::ArithmeticOverflow)
    })?;
    round.protocol_fee = allocation.fee;
    round.status = RoundStatus::Settled;
    emit_settled(round, total_payout);
    Ok(())
}

fn emit_settled(round: &Account<crate::state::Round>, total_payout: u64) {
    emit!(MarketSettled {
        round: round.key(),
        total_pool: round.total_pool,
        total_payout,
        protocol_fee: round.protocol_fee,
    });
}
