use std::{rc::Rc, str::FromStr};

use anchor_client::{Client, Cluster, CommitmentConfig, Signer};
use anchor_lang::{prelude::Pubkey, AccountDeserialize};
use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use solana_keypair::read_keypair_file;
use solana_system_interface::program as system_program;

const DEFAULT_RPC: &str = "https://api.devnet.solana.com";
const DEFAULT_WS: &str = "wss://api.devnet.solana.com";
const PRIVATE_RPC: &str = "https://devnet-tee.magicblock.app";
const PRIVATE_WS: &str = "wss://devnet-tee.magicblock.app";
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
    #[arg(long, default_value = PRIVATE_RPC)]
    private_rpc: String,
    #[arg(long, default_value = PRIVATE_WS)]
    private_ws: String,
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
    ShowOracle,
    SetOracleExponent {
        #[arg(long)]
        exponent: i32,
    },
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
    DelegateSnapshot {
        #[arg(long)]
        round_id: u64,
    },
    CaptureOpening {
        #[arg(long)]
        round_id: u64,
    },
    LockMarket {
        #[arg(long)]
        round_id: u64,
    },
    ResolveMarket {
        #[arg(long)]
        round_id: u64,
    },
    FinalizeMarket {
        #[arg(long)]
        round_id: u64,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let payer = read_keypair_file(&cli.keypair)
        .map_err(|error| anyhow::anyhow!(error.to_string()))
        .with_context(|| format!("failed to read operator keypair {}", cli.keypair))?;
    let authority = payer.pubkey();
    let use_router = matches!(
        &cli.command,
        Command::CaptureOpening { .. } | Command::ResolveMarket { .. } | Command::ShowOracle
    );
    let (rpc, ws) = if use_router {
        authenticated_private_urls(&cli.private_rpc, &cli.private_ws, &payer)?
    } else {
        (cli.rpc, cli.ws)
    };
    let client = Client::new_with_options(
        Cluster::Custom(rpc, ws),
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
        Command::ShowOracle => {
            let address = Pubkey::from_str(MAGICBLOCK_BTC_FEED)?;
            let account = program.rpc().get_account(&address)?;
            let update =
                pyth_solana_receiver_sdk::price_update::PriceUpdateV2::try_deserialize_unchecked(
                    &mut account.data.as_slice(),
                )?;
            println!(
                "oracle {address}\nowner {}\nfeed {}\nprice {}\nconfidence {}\nexponent {}\npublish time {}\nprevious publish time {}",
                account.owner,
                Pubkey::new_from_array(update.price_message.feed_id),
                update.price_message.price,
                update.price_message.conf,
                update.price_message.exponent,
                update.price_message.publish_time,
                update.price_message.prev_publish_time
            );
        }
        Command::SetOracleExponent { exponent } => {
            let config = config_address();
            let signature = program
                .request()
                .accounts(pulsecast::accounts::SetOracleExponent { config, authority })
                .args(pulsecast::instruction::SetOracleExponent { exponent })
                .send()?;
            println!("updated oracle exponent to {exponent}\nsignature {signature}");
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
        Command::DelegateSnapshot { round_id } => {
            let config = config_address();
            let (round, oracle_snapshot) = round_addresses(round_id);
            let delegation_program = sdk_pubkey(ephemeral_rollups_sdk::id());
            let buffer_oracle_snapshot = Pubkey::find_program_address(
                &[
                    ephemeral_rollups_sdk::pda::DELEGATE_BUFFER_TAG,
                    oracle_snapshot.as_ref(),
                ],
                &pulsecast::ID,
            )
            .0;
            let delegation_record_oracle_snapshot = Pubkey::find_program_address(
                &[
                    ephemeral_rollups_sdk::pda::DELEGATION_RECORD_TAG,
                    oracle_snapshot.as_ref(),
                ],
                &delegation_program,
            )
            .0;
            let delegation_metadata_oracle_snapshot = Pubkey::find_program_address(
                &[
                    ephemeral_rollups_sdk::pda::DELEGATION_METADATA_TAG,
                    oracle_snapshot.as_ref(),
                ],
                &delegation_program,
            )
            .0;
            let signature = program
                .request()
                .accounts(pulsecast::accounts::DelegateOracleSnapshot {
                    config,
                    buffer_oracle_snapshot,
                    delegation_record_oracle_snapshot,
                    delegation_metadata_oracle_snapshot,
                    round,
                    oracle_snapshot,
                    authority,
                    owner_program: pulsecast::ID,
                    delegation_program,
                    system_program: system_program::ID,
                })
                .args(pulsecast::instruction::DelegateOracleSnapshot {})
                .send()?;
            println!("delegated snapshot {oracle_snapshot}\nsignature {signature}");
        }
        Command::CaptureOpening { round_id } => {
            let (_, oracle_snapshot) = round_addresses(round_id);
            let snapshot: pulsecast::state::OracleSnapshot = program.account(oracle_snapshot)?;
            wait_until_chain_time(&program, snapshot.open_at)?;
            let signature = program
                .request()
                .accounts(pulsecast::accounts::CaptureOpeningPrice {
                    oracle_snapshot,
                    price_update: Pubkey::from_str(MAGICBLOCK_BTC_FEED)?,
                })
                .args(pulsecast::instruction::CaptureOpeningPrice {})
                .send()?;
            println!("captured opening for {oracle_snapshot}\nsignature {signature}");
        }
        Command::LockMarket { round_id } => {
            let (round, _) = round_addresses(round_id);
            let state: pulsecast::state::Round = program.account(round)?;
            wait_until_chain_time(&program, state.lock_at)?;
            let signature = program
                .request()
                .accounts(pulsecast::accounts::LockMarket { round })
                .args(pulsecast::instruction::LockMarket {})
                .send()?;
            println!("locked round {round}\nsignature {signature}");
        }
        Command::ResolveMarket { round_id } => {
            let (_, oracle_snapshot) = round_addresses(round_id);
            let snapshot: pulsecast::state::OracleSnapshot = program.account(oracle_snapshot)?;
            wait_until_chain_time(&program, snapshot.resolve_at)?;
            let signature = program
                .request()
                .accounts(pulsecast::accounts::ResolveMarket {
                    oracle_snapshot,
                    price_update: Pubkey::from_str(MAGICBLOCK_BTC_FEED)?,
                    authority,
                    magic_program: sdk_pubkey(ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID),
                    magic_context: sdk_pubkey(ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID),
                })
                .args(pulsecast::instruction::ResolveMarket {})
                .send()?;
            println!("resolved snapshot {oracle_snapshot}\nsignature {signature}");
        }
        Command::FinalizeMarket { round_id } => {
            let config = config_address();
            let (round, oracle_snapshot) = round_addresses(round_id);
            let signature = program
                .request()
                .accounts(pulsecast::accounts::FinalizeMarket {
                    config,
                    round,
                    oracle_snapshot,
                })
                .args(pulsecast::instruction::FinalizeMarket {})
                .send()?;
            println!("finalized round {round}\nsignature {signature}");
        }
    }
    Ok(())
}

fn config_address() -> Pubkey {
    Pubkey::find_program_address(&[pulsecast::constants::CONFIG_SEED], &pulsecast::ID).0
}

fn round_addresses(round_id: u64) -> (Pubkey, Pubkey) {
    let round = Pubkey::find_program_address(
        &[pulsecast::constants::ROUND_SEED, &round_id.to_le_bytes()],
        &pulsecast::ID,
    )
    .0;
    let oracle_snapshot = Pubkey::find_program_address(
        &[pulsecast::constants::ORACLE_SNAPSHOT_SEED, round.as_ref()],
        &pulsecast::ID,
    )
    .0;
    (round, oracle_snapshot)
}

fn sdk_pubkey(value: ephemeral_rollups_sdk::compat::Pubkey) -> Pubkey {
    Pubkey::new_from_array(value.to_bytes())
}

fn authenticated_private_urls(
    rpc: &str,
    ws: &str,
    payer: &impl Signer,
) -> Result<(String, String)> {
    let http = reqwest::blocking::Client::new();
    let challenge_url = format!("{rpc}/auth/challenge?pubkey={}", payer.pubkey());
    let challenge_json: serde_json::Value =
        http.get(challenge_url).send()?.error_for_status()?.json()?;
    let challenge = challenge_json["challenge"]
        .as_str()
        .context("TEE challenge response did not contain a challenge")?;
    let signature = bs58::encode(payer.sign_message(challenge.as_bytes()).as_ref()).into_string();
    let response = http
        .post(format!("{rpc}/auth/login"))
        .json(&serde_json::json!({
            "pubkey": payer.pubkey().to_string(),
            "challenge": challenge,
            "signature": signature,
        }))
        .send()?
        .error_for_status()?;
    let auth: serde_json::Value = response.json()?;
    let token = auth["token"]
        .as_str()
        .context("TEE login response did not contain a token")?;
    Ok((
        format!("{rpc}?token={token}"),
        format!("{ws}?token={token}"),
    ))
}

fn next_safe_minute() -> i64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock predates Unix epoch")
        .as_secs() as i64;
    (now.div_euclid(60) + 2) * 60
}

fn wait_until_chain_time<C>(program: &anchor_client::Program<C>, target: i64) -> Result<()>
where
    C: Clone + std::ops::Deref,
    C::Target: Signer + Sized,
{
    loop {
        let slot = program.rpc().get_slot()?;
        let now = program.rpc().get_block_time(slot)?;
        if now >= target {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
}
