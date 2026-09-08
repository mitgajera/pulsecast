use anchor_lang::prelude::*;

use crate::{
    errors::PulseCastError,
    events::{AuthorityTransferAccepted, AuthorityTransferProposed},
    AcceptAuthority, ProposeAuthority,
};

pub fn propose_authority(ctx: Context<ProposeAuthority>, pending_authority: Pubkey) -> Result<()> {
    validate_pending_authority(ctx.accounts.config.authority, pending_authority)?;
    ctx.accounts.config.pending_authority = pending_authority;
    emit!(AuthorityTransferProposed {
        authority: ctx.accounts.authority.key(),
        pending_authority,
    });
    Ok(())
}

fn validate_pending_authority(authority: Pubkey, pending_authority: Pubkey) -> Result<()> {
    require!(
        pending_authority != Pubkey::default() && pending_authority != authority,
        PulseCastError::InvalidAuthority
    );
    Ok(())
}

pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let previous_authority = ctx.accounts.config.authority;
    let authority = ctx.accounts.pending_authority.key();
    ctx.accounts.config.authority = authority;
    ctx.accounts.config.pending_authority = Pubkey::default();
    emit!(AuthorityTransferAccepted {
        previous_authority,
        authority,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_default_and_current_authorities() {
        let current = Pubkey::new_unique();
        assert!(validate_pending_authority(current, Pubkey::default()).is_err());
        assert!(validate_pending_authority(current, current).is_err());
        assert!(validate_pending_authority(current, Pubkey::new_unique()).is_ok());
    }
}
