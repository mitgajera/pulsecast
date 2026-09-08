use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program,
        },
        AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    pyth_solana_receiver_sdk::price_update::{PriceFeedMessage, PriceUpdateV2, VerificationLevel},
    solana_account::Account as SolanaAccount,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_associated_token_account_interface::address::get_associated_token_address,
    spl_token_interface::state::{Account as TokenAccount, AccountState, Mint},
};

const ENTRY_AMOUNT: u64 = 1_000_000;
const STARTING_USDC: u64 = 5_000_000;
const PRICE: i64 = 10_000_000_000;
const FEED_ID: [u8; 32] = [7; 32];

#[test]
fn settles_and_claims_a_sponsored_three_user_pool() {
    let program_id = pulsecast::id();
    let sponsor = Keypair::new();
    let config = Pubkey::find_program_address(&[pulsecast::constants::CONFIG_SEED], &program_id).0;
    let mint = pulsecast::constants::DEVNET_USDC_MINT;
    let vault = get_associated_token_address(&config, &mint);
    let mut svm = LiteSVM::new();
    svm.add_program(
        program_id,
        include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../target/deploy/pulsecast.so"
        )),
    )
    .unwrap();
    svm.airdrop(&sponsor.pubkey(), 2_000_000_000).unwrap();
    set_mint(&mut svm, mint, STARTING_USDC * 3);

    let args = pulsecast::instructions::InitializeArgs {
        usdc_mint: mint,
        btc_usd_feed_id: FEED_ID,
        oracle_exponent: -8,
        tee_validator: Pubkey::new_unique(),
        entry_amount: ENTRY_AMOUNT,
        fee_bps: 300,
        max_error_bps: 50,
    };
    let initialize = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::Initialize { args }.data(),
        pulsecast::accounts::Initialize {
            config,
            authority: sponsor.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut svm, &[initialize], &sponsor, &[&sponsor]).unwrap();

    let round_id = 2_u64;
    let clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    let open_at = clock.unix_timestamp.div_euclid(60).saturating_add(1) * 60;
    let round = Pubkey::find_program_address(
        &[pulsecast::constants::ROUND_SEED, &round_id.to_le_bytes()],
        &program_id,
    )
    .0;
    let create = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::CreateMarket { round_id, open_at }.data(),
        pulsecast::accounts::CreateMarket {
            config,
            round,
            authority: sponsor.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut svm, &[create], &sponsor, &[&sponsor]).unwrap();
    set_time(&mut svm, open_at);

    let users = [Keypair::new(), Keypair::new(), Keypair::new()];
    let predicted_prices = [PRICE, PRICE + 25_000_000, PRICE + 50_000_000];
    let mut predictions = Vec::with_capacity(users.len());
    let mut user_atas = Vec::with_capacity(users.len());

    for user in &users {
        let user_ata = get_associated_token_address(&user.pubkey(), &mint);
        let prediction = prediction_address(program_id, round, user.pubkey());
        set_token_account(&mut svm, user_ata, mint, user.pubkey(), STARTING_USDC);
        let enter = enter_instruction(
            program_id,
            config,
            round,
            prediction,
            mint,
            user_ata,
            vault,
            user.pubkey(),
            sponsor.pubkey(),
        );
        send(&mut svm, &[enter], &sponsor, &[&sponsor, user]).unwrap();
        assert_eq!(svm.get_balance(&user.pubkey()).unwrap_or_default(), 0);
        predictions.push(prediction);
        user_atas.push(user_ata);
    }
    assert_eq!(token_balance(&svm, vault), ENTRY_AMOUNT * 3);

    let price_update = Pubkey::new_from_array(FEED_ID);
    set_price_update(&mut svm, price_update, sponsor.pubkey(), open_at, PRICE);
    let capture = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::CaptureOpeningPrice {}.data(),
        pulsecast::accounts::CaptureOpeningPrice {
            config,
            round,
            price_update,
        }
        .to_account_metas(None),
    );
    send(&mut svm, &[capture], &sponsor, &[&sponsor]).unwrap();

    for ((user, prediction), predicted_price) in
        users.iter().zip(predictions.iter()).zip(predicted_prices)
    {
        let submit = Instruction::new_with_bytes(
            program_id,
            &pulsecast::instruction::SubmitPrediction { predicted_price }.data(),
            pulsecast::accounts::SubmitPrediction {
                prediction: *prediction,
                session_token: None,
                signer: user.pubkey(),
            }
            .to_account_metas(None),
        );
        send(&mut svm, &[submit], &sponsor, &[&sponsor, user]).unwrap();
    }

    set_time(&mut svm, open_at + 30);
    let lock = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::LockMarket {}.data(),
        pulsecast::accounts::LockMarket { round }.to_account_metas(None),
    );
    send(&mut svm, &[lock], &sponsor, &[&sponsor]).unwrap();

    set_time(&mut svm, open_at + 60);
    set_price_update(
        &mut svm,
        price_update,
        sponsor.pubkey(),
        open_at + 60,
        PRICE,
    );
    let resolve = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::ResolveMarket {}.data(),
        pulsecast::accounts::ResolveMarket {
            config,
            round,
            price_update,
        }
        .to_account_metas(None),
    );
    send(&mut svm, &[resolve], &sponsor, &[&sponsor]).unwrap();

    for prediction in &predictions {
        let score = Instruction::new_with_bytes(
            program_id,
            &pulsecast::instruction::ScorePrediction {}.data(),
            pulsecast::accounts::ScorePrediction {
                round,
                prediction: *prediction,
            }
            .to_account_metas(None),
        );
        send(&mut svm, &[score], &sponsor, &[&sponsor]).unwrap();
    }

    let mut settle_accounts = pulsecast::accounts::SettleMarket { round }.to_account_metas(None);
    settle_accounts.extend(
        predictions
            .iter()
            .map(|prediction| AccountMeta::new(*prediction, false)),
    );
    let settle = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::SettleMarket {}.data(),
        settle_accounts,
    );
    send(&mut svm, &[settle], &sponsor, &[&sponsor]).unwrap();

    let expected_payouts = [1_940_000, 970_000, 0];
    let round_state = round_state(&svm, round);
    assert_eq!(round_state.status, pulsecast::state::RoundStatus::Settled);
    assert_eq!(round_state.total_pool, ENTRY_AMOUNT * 3);
    assert_eq!(round_state.protocol_fee, 90_000);

    for (((user, prediction), user_ata), expected_payout) in users
        .iter()
        .zip(predictions.iter())
        .zip(user_atas.iter())
        .zip(expected_payouts)
    {
        let prediction_state = prediction_state(&svm, *prediction);
        assert_eq!(prediction_state.payout, expected_payout);
        let claim = claim_instruction(
            program_id,
            config,
            round,
            *prediction,
            mint,
            vault,
            *user_ata,
            user.pubkey(),
            sponsor.pubkey(),
        );
        send(&mut svm, &[claim], &sponsor, &[&sponsor, user]).unwrap();
        assert_eq!(
            token_balance(&svm, *user_ata),
            STARTING_USDC - ENTRY_AMOUNT + expected_payout
        );
        assert_eq!(svm.get_balance(&user.pubkey()).unwrap_or_default(), 0);
    }

    assert_eq!(token_balance(&svm, vault), 90_000);
    assert_eq!(
        expected_payouts.iter().sum::<u64>() + token_balance(&svm, vault),
        ENTRY_AMOUNT * 3
    );

    let first_balance = token_balance(&svm, user_atas[0]);
    let duplicate_claim = claim_instruction(
        program_id,
        config,
        round,
        predictions[0],
        mint,
        vault,
        user_atas[0],
        users[0].pubkey(),
        sponsor.pubkey(),
    );
    assert!(send(
        &mut svm,
        &[duplicate_claim],
        &sponsor,
        &[&sponsor, &users[0]],
    )
    .is_err());
    assert_eq!(token_balance(&svm, user_atas[0]), first_balance);
    assert_eq!(token_balance(&svm, vault), 90_000);
}

fn send(
    svm: &mut LiteSVM,
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> Result<(), String> {
    svm.expire_blockhash();
    let message =
        Message::new_with_blockhash(instructions, Some(&payer.pubkey()), &svm.latest_blockhash());
    let transaction = VersionedTransaction::try_new(VersionedMessage::Legacy(message), signers)
        .map_err(|error| error.to_string())?;
    svm.send_transaction(transaction)
        .map(|_| ())
        .map_err(|error| format!("{error:?}"))
}

fn set_time(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

fn prediction_address(program_id: Pubkey, round: Pubkey, user: Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            pulsecast::constants::PREDICTION_SEED,
            round.as_ref(),
            user.as_ref(),
        ],
        &program_id,
    )
    .0
}

fn enter_instruction(
    program_id: Pubkey,
    config: Pubkey,
    round: Pubkey,
    prediction: Pubkey,
    mint: Pubkey,
    user_usdc: Pubkey,
    vault: Pubkey,
    user: Pubkey,
    sponsor: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::EnterMarket {}.data(),
        pulsecast::accounts::EnterMarket {
            config,
            round,
            prediction,
            usdc_mint: mint,
            user_usdc,
            vault,
            user,
            sponsor,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            token_program: spl_token_interface::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn claim_instruction(
    program_id: Pubkey,
    config: Pubkey,
    round: Pubkey,
    prediction: Pubkey,
    mint: Pubkey,
    vault: Pubkey,
    user_usdc: Pubkey,
    user: Pubkey,
    sponsor: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::ClaimPayout {}.data(),
        pulsecast::accounts::ClaimPayout {
            config,
            round,
            prediction,
            usdc_mint: mint,
            vault,
            user_usdc,
            user,
            sponsor,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            token_program: spl_token_interface::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn set_mint(svm: &mut LiteSVM, address: Pubkey, supply: u64) {
    let mint = Mint {
        supply,
        decimals: 6,
        is_initialized: true,
        ..Mint::default()
    };
    let mut data = vec![0; Mint::LEN];
    Mint::pack(mint, &mut data).unwrap();
    set_spl_account(svm, address, data);
}

fn set_token_account(svm: &mut LiteSVM, address: Pubkey, mint: Pubkey, owner: Pubkey, amount: u64) {
    let token_account = TokenAccount {
        mint,
        owner,
        amount,
        state: AccountState::Initialized,
        ..TokenAccount::default()
    };
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(token_account, &mut data).unwrap();
    set_spl_account(svm, address, data);
}

fn set_spl_account(svm: &mut LiteSVM, address: Pubkey, data: Vec<u8>) {
    svm.set_account(
        address,
        SolanaAccount {
            lamports: 1_000_000_000,
            data,
            owner: spl_token_interface::ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn set_price_update(
    svm: &mut LiteSVM,
    address: Pubkey,
    write_authority: Pubkey,
    publish_time: i64,
    price: i64,
) {
    let update = PriceUpdateV2 {
        write_authority,
        verification_level: VerificationLevel::Full,
        price_message: PriceFeedMessage {
            feed_id: FEED_ID,
            price,
            conf: 1_000,
            exponent: -8,
            publish_time,
            prev_publish_time: publish_time - 1,
            ema_price: price,
            ema_conf: 1_000,
        },
        posted_slot: svm.get_sysvar::<anchor_lang::prelude::Clock>().slot,
    };
    let mut data = Vec::with_capacity(PriceUpdateV2::LEN);
    update.try_serialize(&mut data).unwrap();
    svm.set_account(
        address,
        SolanaAccount {
            lamports: 1_000_000_000,
            data,
            owner: pulsecast::constants::MAGICBLOCK_ORACLE_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn token_balance(svm: &LiteSVM, address: Pubkey) -> u64 {
    let account = svm.get_account(&address).unwrap();
    TokenAccount::unpack(&account.data).unwrap().amount
}

fn round_state(svm: &LiteSVM, address: Pubkey) -> pulsecast::state::Round {
    let account = svm.get_account(&address).unwrap();
    pulsecast::state::Round::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn prediction_state(svm: &LiteSVM, address: Pubkey) -> pulsecast::state::Prediction {
    let account = svm.get_account(&address).unwrap();
    pulsecast::state::Prediction::try_deserialize(&mut account.data.as_slice()).unwrap()
}
