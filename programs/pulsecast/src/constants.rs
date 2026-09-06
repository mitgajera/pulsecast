pub const BPS_DENOMINATOR: u128 = 10_000;
pub const BETTING_SECONDS: i64 = 30;
pub const CONFIG_SEED: &[u8] = b"config";
pub const MARKET_SECONDS: i64 = 60;
pub const MAX_PARTICIPANTS: u16 = 16;
pub const PREDICTION_SEED: &[u8] = b"prediction";
pub const ROUND_SEED: &[u8] = b"round";
pub const DEVNET_USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

use anchor_lang::prelude::*;
