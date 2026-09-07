use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Prediction {
    pub round: Pubkey,
    pub user: Pubkey,
    pub lock_at: i64,
    pub predicted_price: i64,
    pub submitted_at: i64,
    pub error: u64,
    pub score: u64,
    pub payout: u64,
    pub scored: bool,
    pub claimed: bool,
    pub bump: u8,
}
