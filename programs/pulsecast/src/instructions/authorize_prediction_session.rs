use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::{
    instructions::UpdateEphemeralPermissionCpi,
    structs::{EphemeralMembersArgs, Member, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG},
};

use crate::{errors::PulseCastError, AuthorizePredictionSession};

const PRIVATE_FLAGS: u8 = TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG;

pub fn authorize_prediction_session(
    ctx: Context<AuthorizePredictionSession>,
    session_signer: Pubkey,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        now < ctx.accounts.prediction.lock_at,
        PulseCastError::BettingClosed
    );
    require!(
        session_signer != Pubkey::default() && session_signer != ctx.accounts.user.key(),
        PulseCastError::InvalidSessionSigner
    );

    ctx.accounts.prediction.session_signer = session_signer;

    let round = ctx.accounts.prediction.round;
    let user = ctx.accounts.user.key();
    let bump = [ctx.accounts.prediction.bump];
    let signer_seeds: &[&[u8]] = &[
        crate::constants::PREDICTION_SEED,
        round.as_ref(),
        user.as_ref(),
        &bump,
    ];

    UpdateEphemeralPermissionCpi {
        permissioned_account: ctx.accounts.prediction.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        payer: ctx.accounts.sponsor.to_account_info(),
        authority: ctx.accounts.prediction.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        authority_is_signer: false,
        args: EphemeralMembersArgs {
            is_private: true,
            members: vec![
                Member {
                    flags: PRIVATE_FLAGS,
                    pubkey: user,
                },
                Member {
                    flags: PRIVATE_FLAGS,
                    pubkey: session_signer,
                },
            ],
        },
    }
    .invoke_signed(&[signer_seeds])?;

    Ok(())
}
