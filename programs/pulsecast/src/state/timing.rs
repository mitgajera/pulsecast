use crate::constants::{BETTING_SECONDS, MARKET_SECONDS};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ClockPhase {
    Scheduled,
    Betting,
    Watching,
    AwaitingResolution,
}

pub fn phase_at(open_at: i64, now: i64) -> Option<ClockPhase> {
    let lock_at = open_at.checked_add(BETTING_SECONDS)?;
    let resolve_at = open_at.checked_add(MARKET_SECONDS)?;

    Some(if now < open_at {
        ClockPhase::Scheduled
    } else if now < lock_at {
        ClockPhase::Betting
    } else if now < resolve_at {
        ClockPhase::Watching
    } else {
        ClockPhase::AwaitingResolution
    })
}

pub fn is_minute_aligned(timestamp: i64) -> bool {
    timestamp >= 0 && timestamp % MARKET_SECONDS == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn market_phases_use_half_open_boundaries() {
        let open_at = 120;
        assert_eq!(phase_at(open_at, 119), Some(ClockPhase::Scheduled));
        assert_eq!(phase_at(open_at, 120), Some(ClockPhase::Betting));
        assert_eq!(phase_at(open_at, 149), Some(ClockPhase::Betting));
        assert_eq!(phase_at(open_at, 150), Some(ClockPhase::Watching));
        assert_eq!(phase_at(open_at, 179), Some(ClockPhase::Watching));
        assert_eq!(phase_at(open_at, 180), Some(ClockPhase::AwaitingResolution));
    }

    #[test]
    fn alignment_rejects_negative_and_partial_minutes() {
        assert!(is_minute_aligned(0));
        assert!(is_minute_aligned(120));
        assert!(!is_minute_aligned(-60));
        assert!(!is_minute_aligned(121));
    }

    #[test]
    fn phase_calculation_rejects_timestamp_overflow() {
        assert_eq!(phase_at(i64::MAX, i64::MAX), None);
    }
}
