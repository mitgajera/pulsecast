use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ForecasterProfile {
    pub user: Pubkey,
    pub rounds_played: u64,
    pub wins: u64,
    pub cumulative_accuracy: u128,
    pub bump: u8,
}
