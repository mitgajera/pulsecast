use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub pending_authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub btc_usd_feed_id: [u8; 32],
    pub oracle_exponent: i32,
    pub tee_validator: Pubkey,
    pub entry_amount: u64,
    pub fee_bps: u16,
    pub max_error_bps: u16,
    pub paused: bool,
    pub bump: u8,
}
