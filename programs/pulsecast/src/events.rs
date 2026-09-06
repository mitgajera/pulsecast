use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub round: Pubkey,
    pub round_id: u64,
    pub open_at: i64,
    pub lock_at: i64,
    pub resolve_at: i64,
    pub entry_amount: u64,
}

#[event]
pub struct PredictionSubmitted {
    pub round: Pubkey,
    pub user: Pubkey,
    pub submitted_at: i64,
}

#[event]
pub struct MarketLocked {
    pub round: Pubkey,
    pub prediction_count: u16,
    pub total_pool: u64,
}

#[event]
pub struct MarketResolved {
    pub round: Pubkey,
    pub actual_price: i64,
    pub oracle_publish_time: i64,
}

#[event]
pub struct MarketSettled {
    pub round: Pubkey,
    pub total_pool: u64,
    pub total_payout: u64,
    pub protocol_fee: u64,
}
