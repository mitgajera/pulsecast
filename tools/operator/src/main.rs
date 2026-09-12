use std::{path::Path, process::Command as ProcessCommand, rc::Rc, str::FromStr};

use anchor_client::{Client, Cluster, CommitmentConfig, Signer};
use anchor_lang::{
    prelude::Pubkey,
    solana_program::instruction::{AccountMeta, Instruction},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
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
    ShowMarket {
        #[arg(long)]
        round_id: u64,
    },
    ShowOracle,
    SetOracleExponent {
        #[arg(long)]
        exponent: i32,
    },
    SetProtocolFee {
        #[arg(long, default_value_t = 100)]
        fee_bps: u16,
    },
    Initialize {
        #[arg(long, default_value_t = 1_000_000)]
        entry_amount: u64,
        #[arg(long, default_value_t = 100)]
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
    CreateMarketBatch {
        #[arg(long)]
        start_round_id: u64,
        #[arg(long)]
        start_at: Option<i64>,
        #[arg(long, default_value_t = 3)]
        count: u8,
        #[arg(long, default_value_t = 60)]
        interval_seconds: i64,
    },
    DemoEnter {
        #[arg(long)]
        round_id: u64,
        #[arg(long)]
        predicted_price: i64,
        #[arg(long)]
        user_keypair: String,
        #[arg(long, default_value = ".wallets/sponsor.json")]
        sponsor_keypair: String,
    },
    DemoClaim {
        #[arg(long)]
        round_id: u64,
        #[arg(long)]
        user_keypair: String,
        #[arg(long, default_value = ".wallets/sponsor.json")]
        sponsor_keypair: String,
    },
    RunLifecycle {
        #[arg(long)]
        round_id: u64,
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
    CancelSnapshot {
        #[arg(long)]
        round_id: u64,
    },
    FinalizeMarket {
        #[arg(long)]
        round_id: u64,
    },
    SettleMarket {
        #[arg(long)]
        round_id: u64,
    },
    CloseMarket {
        #[arg(long)]
        round_id: u64,
    },
    CancelMarket {
        #[arg(long)]
        round_id: u64,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let keypair_path = cli.keypair.clone();
    let base_rpc = cli.rpc.clone();
    let base_ws = cli.ws.clone();
    let private_rpc = cli.private_rpc.clone();
    let private_ws = cli.private_ws.clone();
    let payer = read_keypair_file(&cli.keypair)
        .map_err(|error| anyhow::anyhow!(error.to_string()))
        .with_context(|| format!("failed to read operator keypair {}", cli.keypair))?;
    let authority = payer.pubkey();
    let use_router = matches!(
        &cli.command,
        Command::CaptureOpening { .. }
            | Command::ResolveMarket { .. }
            | Command::CancelSnapshot { .. }
            | Command::ShowOracle
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
                "config {config}\nauthority {}\nusdc mint {}\nentry amount {}\nfee bps {}\nmax error bps {}\noracle exponent {}\ntee validator {}\npaused {}",
                state.authority,
                state.usdc_mint,
                state.entry_amount,
                state.fee_bps,
                state.max_error_bps,
                state.oracle_exponent,
                state.tee_validator,
                state.paused
            );
        }
        Command::ShowMarket { round_id } => {
            let (round, _) = round_addresses(round_id);
            let state: pulsecast::state::Round = program.account(round)?;
            println!(
                "round {round}\nid {}\nstatus {:?}\nopen {}\nlock {}\nresolve {}\nstart price {}\nactual price {}\npool {}\npredictions {}\nscored {}\nclaimed {}",
                state.id,
                state.status,
                state.open_at,
                state.lock_at,
                state.resolve_at,
                state.start_price,
                state.actual_price,
                state.total_pool,
                state.prediction_count,
                state.scored_count,
                state.claimed_count
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
        Command::SetProtocolFee { fee_bps } => {
            let config = config_address();
            let signature = program
                .request()
                .accounts(pulsecast::accounts::SetProtocolFee { config, authority })
                .args(pulsecast::instruction::SetProtocolFee { fee_bps })
                .send()?;
            println!("updated protocol fee to {fee_bps} bps\nsignature {signature}");
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
                oracle_exponent: 8,
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
        Command::CreateMarketBatch {
            start_round_id,
            start_at,
            count,
            interval_seconds,
        } => {
            if !(1..=3).contains(&count) {
                bail!("count must be between 1 and 3");
            }
            if interval_seconds < 60 || interval_seconds.rem_euclid(60) != 0 {
                bail!("interval_seconds must be a positive multiple of 60");
            }
            let start_at = start_at.unwrap_or_else(next_safe_minute);
            if start_at.rem_euclid(60) != 0 {
                bail!("start_at must be a minute boundary");
            }
            let config = config_address();
            for offset in 0..u64::from(count) {
                let round_id = start_round_id
                    .checked_add(offset)
                    .context("round id overflow")?;
                let open_at = start_at
                    .checked_add(
                        interval_seconds
                            .checked_mul(i64::try_from(offset)?)
                            .context("market interval overflow")?,
                    )
                    .context("market timestamp overflow")?;
                let (round, oracle_snapshot) = round_addresses(round_id);
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
        Command::DemoEnter {
            round_id,
            predicted_price,
            user_keypair,
            sponsor_keypair,
        } => {
            if predicted_price <= 0 {
                bail!("predicted_price must be positive atomic USD with 8 decimals");
            }
            let user = read_keypair_file(&user_keypair)
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            let sponsor = read_keypair_file(&sponsor_keypair)
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            let sponsor_address = sponsor.pubkey();
            let demo_client = Client::new_with_options(
                Cluster::Custom(base_rpc, base_ws),
                Rc::new(sponsor),
                CommitmentConfig::confirmed(),
            );
            let demo_program = demo_client.program(pulsecast::ID)?;
            let config = config_address();
            let (round, _) = round_addresses(round_id);
            let round_state: pulsecast::state::Round = demo_program.account(round)?;
            wait_until_chain_time(&demo_program, round_state.open_at)?;
            let (prediction, _) = Pubkey::find_program_address(
                &[
                    pulsecast::constants::PREDICTION_SEED,
                    round.as_ref(),
                    user.pubkey().as_ref(),
                ],
                &pulsecast::ID,
            );
            let mint = pulsecast::constants::DEVNET_USDC_MINT;
            let user_usdc = anchor_spl::associated_token::get_associated_token_address(
                &user.pubkey(),
                &mint,
            );
            let vault = anchor_spl::associated_token::get_associated_token_address(
                &config,
                &mint,
            );
            let enter = Instruction {
                program_id: pulsecast::ID,
                accounts: pulsecast::accounts::EnterMarket {
                    config,
                    round,
                    prediction,
                    usdc_mint: mint,
                    user_usdc,
                    vault,
                    user: user.pubkey(),
                    sponsor: sponsor_address,
                    associated_token_program: anchor_spl::associated_token::ID,
                    token_program: anchor_spl::token::ID,
                    system_program: system_program::ID,
                }
                .to_account_metas(None),
                data: pulsecast::instruction::EnterMarket {}.data(),
            };
            let submit = Instruction {
                program_id: pulsecast::ID,
                accounts: pulsecast::accounts::SubmitPrediction {
                    prediction,
                    session_token: None,
                    signer: user.pubkey(),
                }
                .to_account_metas(None),
                data: pulsecast::instruction::SubmitPrediction { predicted_price }.data(),
            };
            let signature = demo_program
                .request()
                .instruction(enter)
                .instruction(submit)
                .signer(&user)
                .send()?;
            println!(
                "entered round {round_id} for {} at {predicted_price}\nprediction {prediction}\nsignature {signature}",
                user.pubkey()
            );
        }
        Command::DemoClaim {
            round_id,
            user_keypair,
            sponsor_keypair,
        } => {
            let user = read_keypair_file(&user_keypair)
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            let sponsor = read_keypair_file(&sponsor_keypair)
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            let sponsor_address = sponsor.pubkey();
            let claim_client = Client::new_with_options(
                Cluster::Custom(base_rpc, base_ws),
                Rc::new(sponsor),
                CommitmentConfig::confirmed(),
            );
            let claim_program = claim_client.program(pulsecast::ID)?;
            let config = config_address();
            let (round, _) = round_addresses(round_id);
            let round_state: pulsecast::state::Round = claim_program.account(round)?;
            let (prediction, _) = Pubkey::find_program_address(
                &[
                    pulsecast::constants::PREDICTION_SEED,
                    round.as_ref(),
                    user.pubkey().as_ref(),
                ],
                &pulsecast::ID,
            );
            let mint = pulsecast::constants::DEVNET_USDC_MINT;
            let user_usdc = anchor_spl::associated_token::get_associated_token_address(
                &user.pubkey(),
                &mint,
            );
            let vault = anchor_spl::associated_token::get_associated_token_address(&config, &mint);
            let mut request = claim_program.request().signer(&user);
            request = match round_state.status {
                pulsecast::state::RoundStatus::Settled => request
                    .accounts(pulsecast::accounts::ClaimPayout {
                        config,
                        round,
                        prediction,
                        usdc_mint: mint,
                        vault,
                        user_usdc,
                        user: user.pubkey(),
                        sponsor: sponsor_address,
                        token_program: anchor_spl::token::ID,
                    })
                    .args(pulsecast::instruction::ClaimPayout {}),
                pulsecast::state::RoundStatus::Cancelled => request
                    .accounts(pulsecast::accounts::ClaimRefund {
                        config,
                        round,
                        prediction,
                        usdc_mint: mint,
                        vault,
                        user_usdc,
                        user: user.pubkey(),
                        sponsor: sponsor_address,
                        token_program: anchor_spl::token::ID,
                    })
                    .args(pulsecast::instruction::ClaimRefund {}),
                status => bail!("round is not claimable: {status:?}"),
            };
            let signature = request.send()?;
            println!(
                "claimed round {round_id} for {}\nsignature {signature}",
                user.pubkey()
            );
        }
        Command::RunLifecycle { round_id } => {
            let executable = std::env::current_exe()?;
            let round_id = round_id.to_string();
            for command in ["delegate-snapshot", "capture-opening", "lock-market", "resolve-market"] {
                run_operator_command(
                    &executable,
                    &keypair_path,
                    &base_rpc,
                    &base_ws,
                    &private_rpc,
                    &private_ws,
                    &[command, "--round-id", &round_id],
                )?;
            }
            let mut finalized = false;
            for _ in 0..20 {
                if try_operator_command(
                    &executable,
                    &keypair_path,
                    &base_rpc,
                    &base_ws,
                    &private_rpc,
                    &private_ws,
                    &["finalize-market", "--round-id", &round_id],
                )? {
                    finalized = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
            if !finalized {
                bail!("snapshot commit did not reach base layer before finalize timeout");
            }
            run_operator_command(
                &executable,
                &keypair_path,
                &base_rpc,
                &base_ws,
                &private_rpc,
                &private_ws,
                &["settle-market", "--round-id", &round_id],
            )?;
            println!("completed lifecycle for round {round_id}");
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
        Command::CancelSnapshot { round_id } => {
            let (_, oracle_snapshot) = round_addresses(round_id);
            let signature = program
                .request()
                .accounts(pulsecast::accounts::CancelOracleSnapshot {
                    oracle_snapshot,
                    authority,
                    magic_program: sdk_pubkey(ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID),
                    magic_context: sdk_pubkey(ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID),
                })
                .args(pulsecast::instruction::CancelOracleSnapshot {})
                .send()?;
            println!("returned cancelled snapshot {oracle_snapshot}\nsignature {signature}");
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
                    authority,
                })
                .args(pulsecast::instruction::FinalizeMarket {})
                .send()?;
            println!("finalized round {round}\nsignature {signature}");
        }
        Command::SettleMarket { round_id } => {
            let (round, _) = round_addresses(round_id);
            let state: pulsecast::state::Round = program.account(round)?;
            let mut predictions: Vec<Pubkey> = program
                .accounts::<pulsecast::state::Prediction>(vec![])?
                .into_iter()
                .filter_map(|(address, prediction)| (prediction.round == round).then_some(address))
                .collect();
            predictions.sort_unstable_by_key(|address| address.to_bytes());
            if predictions.len() != usize::from(state.prediction_count) {
                bail!(
                    "found {} prediction accounts but round expects {}",
                    predictions.len(),
                    state.prediction_count
                );
            }
            for prediction in &predictions {
                let prediction_state: pulsecast::state::Prediction = program.account(*prediction)?;
                if prediction_state.scored {
                    continue;
                }
                let signature = program
                    .request()
                    .accounts(pulsecast::accounts::ScorePrediction {
                        round,
                        prediction: *prediction,
                    })
                    .args(pulsecast::instruction::ScorePrediction {})
                    .send()?;
                println!("scored prediction {prediction}\nsignature {signature}");
            }
            let signature = program
                .request()
                .accounts(pulsecast::accounts::SettleMarket { round })
                .accounts(
                    predictions
                        .iter()
                        .map(|address| AccountMeta::new(*address, false))
                        .collect::<Vec<_>>(),
                )
                .args(pulsecast::instruction::SettleMarket {})
                .send()?;
            println!("settled round {round}\nsignature {signature}");
        }
        Command::CloseMarket { round_id } => {
            let config = config_address();
            let (round, _) = round_addresses(round_id);
            let signature = program
                .request()
                .accounts(pulsecast::accounts::CloseMarket {
                    config,
                    round,
                    authority,
                })
                .args(pulsecast::instruction::CloseMarket {})
                .send()?;
            println!("closed round {round}\nsignature {signature}");
        }
        Command::CancelMarket { round_id } => {
            let config = config_address();
            let (round, oracle_snapshot) = round_addresses(round_id);
            let signature = program
                .request()
                .accounts(pulsecast::accounts::CancelMarket {
                    config,
                    round,
                    oracle_snapshot,
                    authority,
                })
                .args(pulsecast::instruction::CancelMarket {})
                .send()?;
            println!("cancelled round {round}\nsignature {signature}");
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

fn run_operator_command(
    executable: &Path,
    keypair: &str,
    rpc: &str,
    ws: &str,
    private_rpc: &str,
    private_ws: &str,
    args: &[&str],
) -> Result<()> {
    if try_operator_command(executable, keypair, rpc, ws, private_rpc, private_ws, args)? {
        Ok(())
    } else {
        bail!("operator command failed: {}", args.join(" "))
    }
}

fn try_operator_command(
    executable: &Path,
    keypair: &str,
    rpc: &str,
    ws: &str,
    private_rpc: &str,
    private_ws: &str,
    args: &[&str],
) -> Result<bool> {
    Ok(ProcessCommand::new(executable)
        .args(["--keypair", keypair, "--rpc", rpc, "--ws", ws])
        .args(["--private-rpc", private_rpc, "--private-ws", private_ws])
        .args(args)
        .status()?
        .success())
}
