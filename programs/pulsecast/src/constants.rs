pub const BPS_DENOMINATOR: u128 = 10_000;
pub const BETTING_SECONDS: i64 = 30;
pub const CONFIG_SEED: &[u8] = b"config";
pub const MARKET_SECONDS: i64 = 60;
pub const MAX_PARTICIPANTS: u16 = 16;
pub const MAX_ORACLE_AGE_SECONDS: i64 = 10;
pub const MAX_ORACLE_CONFIDENCE_BPS: u16 = 100;
pub const MAGICBLOCK_ORACLE_PROGRAM_ID: Pubkey =
    pubkey!("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");
pub const ORACLE_GRACE_SECONDS: i64 = 10;
pub const ORACLE_SNAPSHOT_SEED: &[u8] = b"oracle_snapshot";
pub const PREDICTION_SEED: &[u8] = b"prediction";
pub const PRIVATE_COMMIT_FREQUENCY_MS: u32 = u32::MAX;
pub const ROUND_SEED: &[u8] = b"round";
pub const DEVNET_USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

use anchor_lang::prelude::*;
