use anchor_lang::prelude::*;

use crate::{events::ProtocolPauseChanged, SetProtocolPause};

pub fn set_protocol_pause(ctx: Context<SetProtocolPause>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    emit!(ProtocolPauseChanged {
        authority: ctx.accounts.authority.key(),
        paused,
    });
    Ok(())
}
