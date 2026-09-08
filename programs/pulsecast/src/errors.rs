use anchor_lang::prelude::*;

#[error_code]
pub enum PulseCastError {
    #[msg("The market start timestamp must align to a minute boundary")]
    MarketNotMinuteAligned,
    #[msg("The market must start in the future")]
    MarketStartNotFuture,
    #[msg("The market schedule exceeds the supported timestamp range")]
    InvalidMarketSchedule,
    #[msg("The protocol is paused")]
    ProtocolPaused,
    #[msg("The market is not accepting bets")]
    BettingClosed,
    #[msg("The market has not reached its lock timestamp")]
    LockTooEarly,
    #[msg("The market state does not permit this transition")]
    InvalidMarketStatus,
    #[msg("The market has not reached its resolution timestamp")]
    ResolutionTooEarly,
    #[msg("A prediction must be submitted before it can be revealed")]
    PredictionMissing,
    #[msg("The oracle account does not match the configured BTC/USD feed")]
    InvalidOracleFeed,
    #[msg("The oracle account is not owned by the MagicBlock pricing program")]
    InvalidOracleOwner,
    #[msg("The oracle update is not fully verified")]
    OracleNotFullyVerified,
    #[msg("The oracle observation is stale")]
    StaleOraclePrice,
    #[msg("The oracle observation predates the market resolution boundary")]
    OraclePriceBeforeResolution,
    #[msg("The oracle confidence interval exceeds the configured limit")]
    OracleConfidenceTooWide,
    #[msg("The oracle exponent does not match the configured exponent")]
    InvalidOracleExponent,
    #[msg("The oracle observation is outside the permitted grace window")]
    OraclePriceAfterGrace,
    #[msg("The opening oracle price has already been captured")]
    OpeningPriceAlreadyCaptured,
    #[msg("The supplied price must be positive")]
    InvalidPrice,
    #[msg("The supplied basis-point value is invalid")]
    InvalidBasisPoints,
    #[msg("The entry amount must be greater than zero")]
    InvalidEntryAmount,
    #[msg("Only the canonical devnet USDC mint is supported")]
    InvalidUsdcMint,
    #[msg("The BTC/USD feed identifier cannot be empty")]
    InvalidFeedId,
    #[msg("The TEE validator cannot be the default public key")]
    InvalidTeeValidator,
    #[msg("The session signer is invalid")]
    InvalidSessionSigner,
    #[msg("The market reached its participant limit")]
    MarketFull,
    #[msg("The prediction has already been scored")]
    PredictionAlreadyScored,
    #[msg("The market has already been settled")]
    MarketAlreadySettled,
    #[msg("The prediction payout has already been claimed")]
    PayoutAlreadyClaimed,
    #[msg("Every prediction must be claimed before the market can close")]
    UnclaimedPayouts,
    #[msg("The supplied prediction accounts do not match the market")]
    InvalidSettlementAccounts,
    #[msg("The recorded pool does not match funded entries")]
    PoolMismatch,
    #[msg("Arithmetic overflow or underflow")]
    ArithmeticOverflow,
    #[msg("The caller is not authorized for this operation")]
    Unauthorized,
    #[msg("The proposed protocol authority is invalid")]
    InvalidAuthority,
}
