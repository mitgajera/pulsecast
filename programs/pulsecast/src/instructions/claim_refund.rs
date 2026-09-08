use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

use crate::{errors::PulseCastError, state::RoundStatus, ClaimRefund};

pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    require!(
        ctx.accounts.round.status == RoundStatus::Cancelled,
        PulseCastError::InvalidMarketStatus
    );
    require!(
        !ctx.accounts.prediction.claimed,
        PulseCastError::PayoutAlreadyClaimed
    );

    ctx.accounts.prediction.claimed = true;
    ctx.accounts.round.claimed_count = ctx
        .accounts
        .round
        .claimed_count
        .checked_add(1)
        .ok_or(PulseCastError::ArithmeticOverflow)?;

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
        ctx.accounts.round.entry_amount,
        ctx.accounts.usdc_mint.decimals,
    )?;
    Ok(())
}
