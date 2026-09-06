use anchor_lang::prelude::*;

use crate::{
    constants::{BPS_DENOMINATOR, DEVNET_USDC_MINT},
    errors::PulseCastError,
    Initialize,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Eq, PartialEq)]
pub struct InitializeArgs {
    pub usdc_mint: Pubkey,
    pub btc_usd_feed_id: [u8; 32],
    pub tee_validator: Pubkey,
    pub entry_amount: u64,
    pub fee_bps: u16,
    pub max_error_bps: u16,
}

pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    validate_args(&args)?;

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.usdc_mint = args.usdc_mint;
    config.btc_usd_feed_id = args.btc_usd_feed_id;
    config.tee_validator = args.tee_validator;
    config.entry_amount = args.entry_amount;
    config.fee_bps = args.fee_bps;
    config.max_error_bps = args.max_error_bps;
    config.paused = false;
    config.bump = ctx.bumps.config;

    Ok(())
}

fn validate_args(args: &InitializeArgs) -> Result<()> {
    require_keys_eq!(
        args.usdc_mint,
        DEVNET_USDC_MINT,
        PulseCastError::InvalidUsdcMint
    );
    require!(args.entry_amount > 0, PulseCastError::InvalidEntryAmount);
    require!(
        u128::from(args.fee_bps) <= BPS_DENOMINATOR,
        PulseCastError::InvalidBasisPoints
    );
    require!(
        args.max_error_bps > 0 && u128::from(args.max_error_bps) <= BPS_DENOMINATOR,
        PulseCastError::InvalidBasisPoints
    );
    require!(
        args.btc_usd_feed_id != [0; 32],
        PulseCastError::InvalidFeedId
    );
    require!(
        args.tee_validator != Pubkey::default(),
        PulseCastError::InvalidTeeValidator
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_args() -> InitializeArgs {
        InitializeArgs {
            usdc_mint: DEVNET_USDC_MINT,
            btc_usd_feed_id: [1; 32],
            tee_validator: Pubkey::new_unique(),
            entry_amount: 1_000_000,
            fee_bps: 300,
            max_error_bps: 50,
        }
    }

    #[test]
    fn accepts_valid_devnet_configuration() {
        assert!(validate_args(&valid_args()).is_ok());
    }

    #[test]
    fn rejects_unsafe_configuration() {
        let mut args = valid_args();
        args.entry_amount = 0;
        assert!(validate_args(&args).is_err());

        args = valid_args();
        args.fee_bps = 10_001;
        assert!(validate_args(&args).is_err());

        args = valid_args();
        args.max_error_bps = 0;
        assert!(validate_args(&args).is_err());

        args = valid_args();
        args.btc_usd_feed_id = [0; 32];
        assert!(validate_args(&args).is_err());

        args = valid_args();
        args.tee_validator = Pubkey::default();
        assert!(validate_args(&args).is_err());
    }
}
