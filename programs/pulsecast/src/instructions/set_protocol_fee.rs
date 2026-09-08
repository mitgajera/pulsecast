use anchor_lang::prelude::*;

use crate::{constants::MAX_PROTOCOL_FEE_BPS, errors::PulseCastError, SetProtocolFee};

pub fn set_protocol_fee(ctx: Context<SetProtocolFee>, fee_bps: u16) -> Result<()> {
    require!(
        fee_bps <= MAX_PROTOCOL_FEE_BPS,
        PulseCastError::InvalidBasisPoints
    );
    ctx.accounts.config.fee_bps = fee_bps;
    Ok(())
}
