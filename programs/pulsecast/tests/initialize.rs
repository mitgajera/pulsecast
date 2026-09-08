use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

#[test]
fn initializes_market_and_locks_it_at_the_betting_deadline() {
    let program_id = pulsecast::id();
    let authority = Keypair::new();
    let config = Pubkey::find_program_address(&[pulsecast::constants::CONFIG_SEED], &program_id).0;
    let mut svm = LiteSVM::new();
    let program = include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../target/deploy/pulsecast.so"
    ));
    svm.add_program(program_id, program).unwrap();
    svm.airdrop(&authority.pubkey(), 1_000_000_000).unwrap();

    let args = pulsecast::instructions::InitializeArgs {
        usdc_mint: pulsecast::constants::DEVNET_USDC_MINT,
        btc_usd_feed_id: [1; 32],
        oracle_exponent: -8,
        tee_validator: Pubkey::new_unique(),
        entry_amount: 1_000_000,
        fee_bps: 300,
        max_error_bps: 50,
    };
    let instruction = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::Initialize { args: args.clone() }.data(),
        pulsecast::accounts::Initialize {
            config,
            authority: authority.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&authority]).unwrap();

    svm.send_transaction(transaction).unwrap();

    let account = svm.get_account(&config).unwrap();
    let state =
        pulsecast::state::GlobalConfig::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.authority, authority.pubkey());
    assert_eq!(state.usdc_mint, args.usdc_mint);
    assert_eq!(state.entry_amount, args.entry_amount);
    assert_eq!(state.fee_bps, args.fee_bps);
    assert_eq!(state.max_error_bps, args.max_error_bps);
    assert!(!state.paused);

    let round_id: u64 = 1;
    let clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    let open_at = clock.unix_timestamp.div_euclid(60).saturating_add(1) * 60;
    let round = Pubkey::find_program_address(
        &[pulsecast::constants::ROUND_SEED, &round_id.to_le_bytes()],
        &program_id,
    )
    .0;
    let instruction = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::CreateMarket { round_id, open_at }.data(),
        pulsecast::accounts::CreateMarket {
            config,
            round,
            authority: authority.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&authority]).unwrap();

    svm.send_transaction(transaction).unwrap();

    let account = svm.get_account(&round).unwrap();
    let state = pulsecast::state::Round::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.id, round_id);
    assert_eq!(state.open_at, open_at);
    assert_eq!(state.lock_at, open_at + 30);
    assert_eq!(state.resolve_at, open_at + 60);
    assert_eq!(state.entry_amount, args.entry_amount);
    assert_eq!(state.status, pulsecast::state::RoundStatus::Scheduled);

    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = state.lock_at;
    svm.set_sysvar(&clock);
    let instruction = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::LockMarket {}.data(),
        pulsecast::accounts::LockMarket { round }.to_account_metas(None),
    );
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&authority]).unwrap();

    svm.send_transaction(transaction).unwrap();

    let account = svm.get_account(&round).unwrap();
    let state = pulsecast::state::Round::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.status, pulsecast::state::RoundStatus::Watching);
}
