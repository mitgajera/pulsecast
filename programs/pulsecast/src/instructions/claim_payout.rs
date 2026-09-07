use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

use crate::{errors::PulseCastError, events::PayoutClaimed, state::RoundStatus, ClaimPayout};

pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
    require!(
        ctx.accounts.round.status == RoundStatus::Settled,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        ctx.accounts.prediction.scored,
        PulseCastError::InvalidSettlementAccounts
    );
    require!(
        !ctx.accounts.prediction.claimed,
        PulseCastError::PayoutAlreadyClaimed
    );

    let amount = ctx.accounts.prediction.payout;
    ctx.accounts.prediction.claimed = true;

    if amount > 0 {
        let bump = [ctx.accounts.config.bump];
        let signer_seeds: &[&[u8]] = &[crate::constants::CONFIG_SEED, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.user_usdc.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;
    }

    emit!(PayoutClaimed {
        round: ctx.accounts.round.key(),
        user: ctx.accounts.user.key(),
        amount,
    });
    Ok(())
}
