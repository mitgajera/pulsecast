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

    let replacement = Keypair::new();
    let impostor = Keypair::new();
    svm.expire_blockhash();
    let propose =
        propose_authority_instruction(program_id, config, authority.pubkey(), replacement.pubkey());
    assert!(send_authority_transaction(&mut svm, propose, &authority));
    assert_eq!(
        config_state(&svm, config).pending_authority,
        replacement.pubkey()
    );

    svm.expire_blockhash();
    let unauthorized_accept = accept_authority_instruction(program_id, config, impostor.pubkey());
    assert!(!send_user_transaction(
        &mut svm,
        unauthorized_accept,
        &authority,
        &impostor,
    ));
    assert_eq!(config_state(&svm, config).authority, authority.pubkey());

    svm.expire_blockhash();
    let accept = accept_authority_instruction(program_id, config, replacement.pubkey());
    assert!(send_user_transaction(
        &mut svm,
        accept,
        &authority,
        &replacement,
    ));
    let state = config_state(&svm, config);
    assert_eq!(state.authority, replacement.pubkey());
    assert_eq!(state.pending_authority, Pubkey::default());
    assert_eq!(
        svm.get_balance(&replacement.pubkey()).unwrap_or_default(),
        0
    );

    svm.expire_blockhash();
    let propose_back =
        propose_authority_instruction(program_id, config, replacement.pubkey(), authority.pubkey());
    assert!(send_user_transaction(
        &mut svm,
        propose_back,
        &authority,
        &replacement,
    ));
    svm.expire_blockhash();
    let accept_back = accept_authority_instruction(program_id, config, authority.pubkey());
    assert!(send_authority_transaction(
        &mut svm,
        accept_back,
        &authority,
    ));
    assert_eq!(config_state(&svm, config).authority, authority.pubkey());

    let round_id: u64 = 1;
    let clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    let open_at = clock.unix_timestamp.div_euclid(60).saturating_add(1) * 60;
    let round = Pubkey::find_program_address(
        &[pulsecast::constants::ROUND_SEED, &round_id.to_le_bytes()],
        &program_id,
    )
    .0;
    let oracle_snapshot = Pubkey::find_program_address(
        &[pulsecast::constants::ORACLE_SNAPSHOT_SEED, round.as_ref()],
        &program_id,
    )
    .0;
    let instruction = Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::CreateMarket { round_id, open_at }.data(),
        pulsecast::accounts::CreateMarket {
            config,
            round,
            oracle_snapshot,
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

    let attacker = Keypair::new();
    let unauthorized_pause = pause_instruction(program_id, config, attacker.pubkey(), true);
    assert!(!send_user_transaction(
        &mut svm,
        unauthorized_pause,
        &authority,
        &attacker,
    ));
    assert!(!config_state(&svm, config).paused);

    svm.expire_blockhash();
    let pause = pause_instruction(program_id, config, authority.pubkey(), true);
    assert!(send_authority_transaction(&mut svm, pause, &authority));
    assert!(config_state(&svm, config).paused);

    svm.expire_blockhash();
    let paused_entry = enter_market_instruction(
        program_id,
        config,
        round,
        prediction,
        mint,
        user_usdc,
        vault,
        user.pubkey(),
        authority.pubkey(),
    );
    assert!(!send_user_transaction(
        &mut svm,
        paused_entry,
        &authority,
        &user,
    ));
    assert_eq!(token_balance(&svm, user_usdc), user_starting_usdc);
    assert!(svm.get_account(&prediction).is_none());

    svm.expire_blockhash();
    let unpause = pause_instruction(program_id, config, authority.pubkey(), false);
    assert!(send_authority_transaction(&mut svm, unpause, &authority));
    assert!(!config_state(&svm, config).paused);

    svm.expire_blockhash();

    let wrong_vault_instruction = enter_market_instruction(
        program_id,
        config,
        round,
        prediction,
        mint,
        user_usdc,
        user_usdc,
        user.pubkey(),
        authority.pubkey(),
    );
    assert!(!send_user_transaction(
        &mut svm,
        wrong_vault_instruction,
        &authority,
        &user,
    ));

    let other_owner = Pubkey::new_unique();
    let other_owner_usdc = get_associated_token_address(&other_owner, &mint);
    set_token_account(
        &mut svm,
        other_owner_usdc,
        mint,
        other_owner,
        user_starting_usdc,
    );
    svm.expire_blockhash();
    let wrong_owner_instruction = enter_market_instruction(
        program_id,
        config,
        round,
        prediction,
        mint,
        other_owner_usdc,
        vault,
        user.pubkey(),
        authority.pubkey(),
    );
    assert!(!send_user_transaction(
        &mut svm,
        wrong_owner_instruction,
        &authority,
        &user,
    ));

    let wrong_mint = Pubkey::new_unique();
    let wrong_mint_user_ata = get_associated_token_address(&user.pubkey(), &wrong_mint);
    let wrong_mint_vault = get_associated_token_address(&config, &wrong_mint);
    set_mint(&mut svm, wrong_mint, user_starting_usdc);
    set_token_account(
        &mut svm,
        wrong_mint_user_ata,
        wrong_mint,
        user.pubkey(),
        user_starting_usdc,
    );
    svm.expire_blockhash();
    let wrong_mint_instruction = enter_market_instruction(
        program_id,
        config,
        round,
        prediction,
        wrong_mint,
        wrong_mint_user_ata,
        wrong_mint_vault,
        user.pubkey(),
        authority.pubkey(),
    );
    assert!(!send_user_transaction(
        &mut svm,
        wrong_mint_instruction,
        &authority,
        &user,
    ));
    assert_eq!(token_balance(&svm, user_usdc), user_starting_usdc);
    assert!(svm.get_account(&prediction).is_none());

    svm.expire_blockhash();
    let instruction = enter_market_instruction(
        program_id,
        config,
        round,
        prediction,
        mint,
        user_usdc,
        vault,
        user.pubkey(),
        authority.pubkey(),
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

    svm.expire_blockhash();
    let instruction = enter_market_instruction(
        program_id,
        config,
        round,
        prediction,
        mint,
        user_usdc,
        vault,
        user.pubkey(),
        authority.pubkey(),
    );
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&authority, &user])
            .unwrap();
    assert!(svm.send_transaction(transaction).is_err());
    assert_eq!(
        token_balance(&svm, user_usdc),
        user_starting_usdc - args.entry_amount
    );
    assert_eq!(token_balance(&svm, vault), args.entry_amount);

    let late_user = Keypair::new();
    let late_user_usdc = get_associated_token_address(&late_user.pubkey(), &mint);
    let late_prediction = Pubkey::find_program_address(
        &[
            pulsecast::constants::PREDICTION_SEED,
            round.as_ref(),
            late_user.pubkey().as_ref(),
        ],
        &program_id,
    )
    .0;
    set_token_account(
        &mut svm,
        late_user_usdc,
        mint,
        late_user.pubkey(),
        user_starting_usdc,
    );
    svm.expire_blockhash();
    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = state.lock_at;
    svm.set_sysvar(&clock);
    let instruction = enter_market_instruction(
        program_id,
        config,
        round,
        late_prediction,
        mint,
        late_user_usdc,
        vault,
        late_user.pubkey(),
        authority.pubkey(),
    );
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[&authority, &late_user])
            .unwrap();
    assert!(svm.send_transaction(transaction).is_err());
    assert_eq!(token_balance(&svm, late_user_usdc), user_starting_usdc);
    assert!(svm.get_account(&late_prediction).is_none());

    svm.expire_blockhash();
    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = open_at;
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

#[allow(clippy::too_many_arguments)]
fn enter_market_instruction(
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

fn send_user_transaction(
    svm: &mut LiteSVM,
    instruction: Instruction,
    sponsor: &Keypair,
    user: &Keypair,
) -> bool {
    let blockhash = svm.latest_blockhash();
    let message = Message::new_with_blockhash(&[instruction], Some(&sponsor.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[sponsor, user]).unwrap();
    svm.send_transaction(transaction).is_ok()
}

fn send_authority_transaction(
    svm: &mut LiteSVM,
    instruction: Instruction,
    authority: &Keypair,
) -> bool {
    let blockhash = svm.latest_blockhash();
    let message =
        Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let transaction =
        VersionedTransaction::try_new(VersionedMessage::Legacy(message), &[authority]).unwrap();
    svm.send_transaction(transaction).is_ok()
}

fn pause_instruction(
    program_id: Pubkey,
    config: Pubkey,
    authority: Pubkey,
    paused: bool,
) -> Instruction {
    let data = if paused {
        pulsecast::instruction::PauseProtocol {}.data()
    } else {
        pulsecast::instruction::UnpauseProtocol {}.data()
    };
    Instruction::new_with_bytes(
        program_id,
        &data,
        pulsecast::accounts::SetProtocolPause { config, authority }.to_account_metas(None),
    )
}

fn config_state(svm: &LiteSVM, address: Pubkey) -> pulsecast::state::GlobalConfig {
    let account = svm.get_account(&address).unwrap();
    pulsecast::state::GlobalConfig::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn propose_authority_instruction(
    program_id: Pubkey,
    config: Pubkey,
    authority: Pubkey,
    pending_authority: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::ProposeAuthority { pending_authority }.data(),
        pulsecast::accounts::ProposeAuthority { config, authority }.to_account_metas(None),
    )
}

fn accept_authority_instruction(
    program_id: Pubkey,
    config: Pubkey,
    pending_authority: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        program_id,
        &pulsecast::instruction::AcceptAuthority {}.data(),
        pulsecast::accounts::AcceptAuthority {
            config,
            pending_authority,
        }
        .to_account_metas(None),
    )
}
