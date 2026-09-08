use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, InitSpace, PartialEq)]
pub enum OracleSnapshotStatus {
    Pending,
    OpeningCaptured,
    ClosingCaptured,
    Finalized,
}

#[account]
#[derive(InitSpace)]
pub struct OracleSnapshot {
    pub round: Pubkey,
    pub status: OracleSnapshotStatus,
    pub open_at: i64,
    pub lock_at: i64,
    pub resolve_at: i64,
    pub feed_id: [u8; 32],
    pub exponent: i32,
    pub start_price: i64,
    pub start_publish_time: i64,
    pub actual_price: i64,
    pub actual_publish_time: i64,
    pub bump: u8,
}
