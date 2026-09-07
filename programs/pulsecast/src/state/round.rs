use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, InitSpace, PartialEq)]
pub enum RoundStatus {
    Scheduled,
    Betting,
    Watching,
    Resolved,
    Settled,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub id: u64,
    pub status: RoundStatus,
    pub open_at: i64,
    pub lock_at: i64,
    pub resolve_at: i64,
    pub start_price: i64,
    pub start_publish_time: i64,
    pub actual_price: i64,
    pub actual_publish_time: i64,
    pub total_pool: u64,
    pub total_score: u64,
    pub protocol_fee: u64,
    pub prediction_count: u16,
    pub scored_count: u16,
    pub entry_amount: u64,
    pub fee_bps: u16,
    pub max_error_bps: u16,
    pub bump: u8,
}
