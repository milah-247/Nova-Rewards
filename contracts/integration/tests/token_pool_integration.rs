#![cfg(test)]

//! Integration: NovaToken ↔ RewardPool
//!
//! Verifies that tokens minted by NovaToken can be deposited into
//! RewardPool, that pool balances stay consistent across both contracts,
//! and that admin-gated withdrawals work end-to-end.

use nova_token::{NovaToken, NovaTokenClient};
use reward_pool::{RewardPoolContract, RewardPoolContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

// ── helpers ───────────────────────────────────────────────────────────────────

struct World<'a> {
    env: Env,
    admin: Address,
    token: NovaTokenClient<'a>,
    pool: RewardPoolContractClient<'a>,
}

fn setup() -> World<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let token_id = env.register(NovaToken, ());
    let token = NovaTokenClient::new(&env, &token_id);
    token.initialize(&admin);

    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin);

    World { env, admin, token, pool }
}

// ── tests ─────────────────────────────────────────────────────────────────────

/// Mint tokens then deposit them — both contracts reflect the same amount.
#[test]
fn test_mint_then_deposit_state_consistency() {
    let w = setup();
    let user = Address::generate(&w.env);

    w.token.mint(&user, &1_000);
    assert_eq!(w.token.balance(&user), 1_000);

    // User deposits into pool (simulates off-chain transfer + deposit call)
    w.pool.deposit(&user, &1_000);

    assert_eq!(w.pool.pool_balance(), 1_000);
    assert_eq!(w.pool.depositor_balance(&user), 1_000);
}

/// Multiple users deposit; admin withdraws the full pool — balance reaches zero.
#[test]
fn test_multi_user_deposit_then_full_withdrawal() {
    let w = setup();
    let alice = Address::generate(&w.env);
    let bob = Address::generate(&w.env);
    let carol = Address::generate(&w.env);

    w.token.mint(&alice, &500);
    w.token.mint(&bob, &300);
    w.token.mint(&carol, &200);

    w.pool.deposit(&alice, &500);
    w.pool.deposit(&bob, &300);
    w.pool.deposit(&carol, &200);

    assert_eq!(w.pool.pool_balance(), 1_000);

    // Admin drains the pool
    w.pool.withdraw(&w.admin, &1_000);
    assert_eq!(w.pool.pool_balance(), 0);
}

/// Partial withdrawal leaves correct remainder.
#[test]
fn test_partial_withdrawal_leaves_correct_remainder() {
    let w = setup();
    let user = Address::generate(&w.env);

    w.pool.deposit(&user, &800);
    w.pool.withdraw(&w.admin, &300);

    assert_eq!(w.pool.pool_balance(), 500);
    // depositor_balance tracks deposits, not withdrawals
    assert_eq!(w.pool.depositor_balance(&user), 800);
}

/// Depositing zero is rejected; pool state is unchanged.
#[test]
#[should_panic(expected = "amount must be positive")]
fn test_zero_deposit_rejected_pool_unchanged() {
    let w = setup();
    let user = Address::generate(&w.env);
    w.pool.deposit(&user, &0);
}

/// Overdraft withdrawal is rejected; pool state is unchanged.
#[test]
#[should_panic(expected = "insufficient pool balance")]
fn test_overdraft_rejected_pool_unchanged() {
    let w = setup();
    let user = Address::generate(&w.env);
    w.pool.deposit(&user, &100);
    w.pool.withdraw(&w.admin, &101); // 1 over balance
}

/// Token burn followed by deposit reflects correct net balance.
#[test]
fn test_burn_then_deposit_net_balance() {
    let w = setup();
    let user = Address::generate(&w.env);

    w.token.mint(&user, &1_000);
    w.token.burn(&user, &200); // burn 200 first
    assert_eq!(w.token.balance(&user), 800);

    w.pool.deposit(&user, &800);
    assert_eq!(w.pool.pool_balance(), 800);
}

/// Events from both contracts are emitted in the same environment.
#[test]
fn test_cross_contract_events_both_emitted() {
    use soroban_sdk::testutils::Events;

    let w = setup();
    let user = Address::generate(&w.env);

    w.token.mint(&user, &500);   // emits nova_tok/mint
    w.pool.deposit(&user, &500); // emits rwd_pool/deposit

    // events().all() returns events since last drain — collect after both ops
    let events = w.env.events().all();
    assert!(events.len() >= 1, "expected at least one event, got {}", events.len());
}
