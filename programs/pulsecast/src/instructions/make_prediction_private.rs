use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::{
    instructions::CreateEphemeralPermissionCpi,
    structs::{EphemeralMembersArgs, Member, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG},
};

use crate::MakePredictionPrivate;

pub fn make_prediction_private(ctx: Context<MakePredictionPrivate>) -> Result<()> {
    let round = ctx.accounts.prediction.round;
    let user = ctx.accounts.user.key();
    let bump = [ctx.accounts.prediction.bump];
    let signer_seeds: &[&[u8]] = &[
        crate::constants::PREDICTION_SEED,
        round.as_ref(),
        user.as_ref(),
        &bump,
    ];

    CreateEphemeralPermissionCpi {
        permissioned_account: ctx.accounts.prediction.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        payer: ctx.accounts.user.to_account_info(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        args: EphemeralMembersArgs {
            is_private: true,
            members: vec![Member {
                flags: TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG,
                pubkey: user,
            }],
        },
    }
    .invoke_signed(&[signer_seeds])?;

    Ok(())
}
