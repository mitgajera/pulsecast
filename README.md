# PulseCast

**Call the next minute.**

PulseCast is a private, minute-aligned BTC precision market for MagicBlock Blitz v8. Participants use devnet USDC to predict BTC/USD during the first 30 seconds of a market, watch the price during the final 30 seconds, and receive proportional payouts based on accuracy after oracle resolution.

## Status

Planning is complete. Phase 0 feasibility verification is in progress.

## Constraints

- Solana devnet only
- Devnet USDC only
- Solana, Rust, Cargo, and Anchor commands run in WSL
- Forecasts remain private until resolution
- No real-value deposits or mainnet deployment

See [PLAN.md](./PLAN.md) for the implementation plan and [AGENTS.md](./AGENTS.md) for repository rules.
