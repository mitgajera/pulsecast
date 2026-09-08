use anchor_lang::prelude::*;

use crate::{errors::PulseCastError, SetOracleExponent};

pub fn set_oracle_exponent(ctx: Context<SetOracleExponent>, exponent: i32) -> Result<()> {
    require!(
        (-12..=12).contains(&exponent),
        PulseCastError::InvalidOracleExponent
    );
    ctx.accounts.config.oracle_exponent = exponent;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn supports_standard_and_magicblock_exponents() {
        assert!((-12..=12).contains(&-8));
        assert!((-12..=12).contains(&8));
        assert!(!(-12..=12).contains(&13));
    }
}
