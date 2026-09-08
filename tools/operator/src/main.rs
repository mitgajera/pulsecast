use std::{rc::Rc, str::FromStr};

use anchor_client::{Client, Cluster, CommitmentConfig, Signer};
use anchor_lang::prelude::Pubkey;
use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use solana_keypair::read_keypair_file;
use solana_system_interface::program as system_program;

const DEFAULT_RPC: &str = "https://api.devnet.solana.com";
const DEFAULT_WS: &str = "wss://api.devnet.solana.com";
const MAGICBLOCK_BTC_FEED: &str = "71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr";
const MAGICBLOCK_TEE_VALIDATOR: &str = "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo";

#[derive(Parser)]
#[command(name = "pulsecast-operator")]
struct Cli {
    #[arg(long, default_value = ".wallets/operator.json")]
    keypair: String,
    #[arg(long, default_value = DEFAULT_RPC)]
    rpc: String,
    #[arg(long, default_value = DEFAULT_WS)]
    ws: String,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Addresses {
        #[arg(long)]
        round_id: Option<u64>,
    },
    ShowConfig,
    Initialize {
        #[arg(long, default_value_t = 1_000_000)]
        entry_amount: u64,
        #[arg(long, default_value_t = 300)]
        fee_bps: u16,
        #[arg(long, default_value_t = 50)]
        max_error_bps: u16,
    },
    CreateMarket {
        #[arg(long)]
        round_id: u64,
        #[arg(long)]
        open_at: Option<i64>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let payer = read_keypair_file(&cli.keypair)
        .map_err(|error| anyhow::anyhow!(error.to_string()))
        .with_context(|| format!("failed to read operator keypair {}", cli.keypair))?;
    let authority = payer.pubkey();
    let client = Client::new_with_options(
        Cluster::Custom(cli.rpc, cli.ws),
        Rc::new(payer),
        CommitmentConfig::confirmed(),
    );
    let program = client.program(pulsecast::ID)?;

    match cli.command {
        Command::Addresses { round_id } => {
            let config = config_address();
            println!("program {}\nconfig {config}", pulsecast::ID);
            if let Some(round_id) = round_id {
                let (round, _) = Pubkey::find_program_address(
                    &[pulsecast::constants::ROUND_SEED, &round_id.to_le_bytes()],
                    &pulsecast::ID,
                );
                let (oracle_snapshot, _) = Pubkey::find_program_address(
                    &[pulsecast::constants::ORACLE_SNAPSHOT_SEED, round.as_ref()],
                    &pulsecast::ID,
                );
                println!("round {round}\noracle snapshot {oracle_snapshot}");
            }
        }
        Command::ShowConfig => {
            let config = config_address();
            let state: pulsecast::state::GlobalConfig = program
                .account(config)
                .with_context(|| format!("config {config} is not initialized"))?;
            println!(
                "config {config}\nauthority {}\nusdc mint {}\nentry amount {}\nfee bps {}\nmax error bps {}\ntee validator {}\npaused {}",
                state.authority,
                state.usdc_mint,
                state.entry_amount,
                state.fee_bps,
                state.max_error_bps,
                state.tee_validator,
                state.paused
            );
        }
        Command::Initialize {
            entry_amount,
            fee_bps,
            max_error_bps,
        } => {
            let config = config_address();
            let args = pulsecast::instructions::InitializeArgs {
                usdc_mint: pulsecast::constants::DEVNET_USDC_MINT,
                btc_usd_feed_id: Pubkey::from_str(MAGICBLOCK_BTC_FEED)?.to_bytes(),
                oracle_exponent: -8,
                tee_validator: Pubkey::from_str(MAGICBLOCK_TEE_VALIDATOR)?,
                entry_amount,
                fee_bps,
                max_error_bps,
            };
            let signature = program
                .request()
                .accounts(pulsecast::accounts::Initialize {
                    config,
                    authority,
                    system_program: system_program::ID,
                })
                .args(pulsecast::instruction::Initialize { args })
                .send()?;
            println!("initialized config {config}\nsignature {signature}");
        }
        Command::CreateMarket { round_id, open_at } => {
            let open_at = open_at.unwrap_or_else(next_safe_minute);
            if open_at.rem_euclid(60) != 0 {
                bail!("open_at must be a minute boundary");
            }
            let config = config_address();
            let (round, _) = Pubkey::find_program_address(
                &[pulsecast::constants::ROUND_SEED, &round_id.to_le_bytes()],
                &pulsecast::ID,
            );
            let (oracle_snapshot, _) = Pubkey::find_program_address(
                &[pulsecast::constants::ORACLE_SNAPSHOT_SEED, round.as_ref()],
                &pulsecast::ID,
            );
            let signature = program
                .request()
                .accounts(pulsecast::accounts::CreateMarket {
                    config,
                    round,
                    oracle_snapshot,
                    authority,
                    system_program: system_program::ID,
                })
                .args(pulsecast::instruction::CreateMarket { round_id, open_at })
                .send()?;
            println!(
                "created round {round_id} at {round}\noracle snapshot {oracle_snapshot}\nopen_at {open_at}\nsignature {signature}"
            );
        }
    }
    Ok(())
}

fn config_address() -> Pubkey {
    Pubkey::find_program_address(&[pulsecast::constants::CONFIG_SEED], &pulsecast::ID).0
}

fn next_safe_minute() -> i64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock predates Unix epoch")
        .as_secs() as i64;
    (now.div_euclid(60) + 2) * 60
}
