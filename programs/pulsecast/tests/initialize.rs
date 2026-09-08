use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_account::Account as SolanaAccount,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_associated_token_account_interface::address::get_associated_token_address,
    spl_token_interface::state::{Account as TokenAccount, AccountState, Mint},
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

    let user = Keypair::new();
    let user_starting_usdc = 5_000_000;
    let mint = pulsecast::constants::DEVNET_USDC_MINT;
    let user_usdc = get_associated_token_address(&user.pubkey(), &mint);
    let vault = get_associated_token_address(&config, &mint);
    let prediction = Pubkey::find_program_address(
        &[
            pulsecast::constants::PREDICTION_SEED,
            round.as_ref(),
            user.pubkey().as_ref(),
        ],
        &program_id,
    )
    .0;
    set_mint(&mut svm, mint, user_starting_usdc);
    set_token_account(&mut svm, user_usdc, mint, user.pubkey(), user_starting_usdc);
    assert_eq!(svm.get_balance(&user.pubkey()).unwrap_or_default(), 0);

    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = open_at;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();
    let instruction = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::EnterMarket {}.data(),
        pulsecast::accounts::EnterMarket {
            config,
            round,
            prediction,
            usdc_mint: mint,
            user_usdc,
            vault,
            user: user.pubkey(),
            sponsor: authority.pubkey(),
            associated_token_program: spl_associated_token_account_interface::program::ID,
            token_program: spl_token_interface::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&authority, &user])
            .unwrap();

    svm.send_transaction(transaction).unwrap();

    assert_eq!(
        token_balance(&svm, user_usdc),
        user_starting_usdc - args.entry_amount
    );
    assert_eq!(token_balance(&svm, vault), args.entry_amount);
    assert_eq!(svm.get_balance(&user.pubkey()).unwrap_or_default(), 0);
    let account = svm.get_account(&round).unwrap();
    let state = pulsecast::state::Round::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.total_pool, args.entry_amount);
    assert_eq!(state.prediction_count, 1);
    assert_eq!(state.status, pulsecast::state::RoundStatus::Betting);

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
    assert!(svm.send_transaction(transaction).is_err());

    let account = svm.get_account(&round).unwrap();
    let state = pulsecast::state::Round::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(state.status, pulsecast::state::RoundStatus::Betting);

    svm.expire_blockhash();
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

fn set_mint(svm: &mut LiteSVM, address: Pubkey, supply: u64) {
    let mint = Mint {
        supply,
        decimals: 6,
        is_initialized: true,
        ..Mint::default()
    };
    let mut data = vec![0; Mint::LEN];
    Mint::pack(mint, &mut data).unwrap();
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

fn token_balance(svm: &LiteSVM, address: Pubkey) -> u64 {
    let account = svm.get_account(&address).unwrap();
    TokenAccount::unpack(&account.data).unwrap().amount
}
