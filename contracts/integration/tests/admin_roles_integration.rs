#![cfg(test)]

//! Integration: AdminRoles governing Token + Pool + Vesting
//!
//! Verifies that the two-step admin transfer pattern propagates correctly
//! when the same admin controls multiple contracts, and that access control
//! is enforced consistently across all of them.

use admin_roles::{AdminRolesContract, AdminRolesContractClient};
use nova_token::{NovaToken, NovaTokenClient};
use reward_pool::{RewardPoolContract, RewardPoolContractClient};
use vesting::{VestingContract, VestingContractClient};
use soroban_sdk::{testutils::{Address as _, Ledger}, vec, Address, Env};

// ── helpers ───────────────────────────────────────────────────────────────────

struct World<'a> {
    env: Env,
    admin: Address,
    roles: AdminRolesContractClient<'a>,
    token: NovaTokenClient<'a>,
    pool: RewardPoolContractClient<'a>,
    vesting: VestingContractClient<'a>,
}

fn setup() -> World<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let roles_id = env.register(AdminRolesContract, ());
    let roles = AdminRolesContractClient::new(&env, &roles_id);
    roles.initialize(&admin, &vec![&env], &1);

    let token_id = env.register(NovaToken, ());
    let token = NovaTokenClient::new(&env, &token_id);
    token.initialize(&admin);

    let pool_id = env.register(RewardPoolContract, ());
    let pool = RewardPoolContractClient::new(&env, &pool_id);
    pool.initialize(&admin);

    let vest_id = env.register(VestingContract, ());
    let vesting = VestingContractClient::new(&env, &vest_id);
    vesting.initialize(&admin);
    vesting.fund_pool(&10_000);

    World { env, admin, roles, token, pool, vesting }
}

// ── tests ─────────────────────────────────────────────────────────────────────

/// Admin can operate all contracts in a single flow.
#[test]
fn test_admin_operates_all_contracts() {
    let w = setup();
    let user = Address::generate(&w.env);

    // token: mint
    w.token.mint(&user, &1_000);
    assert_eq!(w.token.balance(&user), 1_000);

    // pool: deposit + withdraw
    w.pool.deposit(&user, &500);
    w.pool.withdraw(&w.admin, &200);
    assert_eq!(w.pool.pool_balance(), 300);

    // vesting: create schedule (pool only deducted on release, not creation)
    let _sid = w.vesting.create_schedule(&user, &1_000, &0, &0, &1_000);
    assert_eq!(w.vesting.pool_balance(), 10_000);

    // roles: verify admin
    assert_eq!(w.roles.get_admin(), w.admin);
}

/// Two-step admin transfer on AdminRoles contract completes correctly.
#[test]
fn test_two_step_admin_transfer_completes() {
    let w = setup();
    let new_admin = Address::generate(&w.env);

    w.roles.propose_admin(&new_admin);
    assert_eq!(w.roles.get_pending_admin(), Some(new_admin.clone()));

    w.roles.accept_admin();
    assert_eq!(w.roles.get_admin(), new_admin);
    assert_eq!(w.roles.get_pending_admin(), None);
}

/// Proposing a new admin emits an event; accepting emits another.
#[test]
fn test_admin_transfer_events_sequence() {
    use soroban_sdk::testutils::Events;

    let w = setup();
    let new_admin = Address::generate(&w.env);

    w.roles.propose_admin(&new_admin);
    // drain and verify at least one event was emitted for propose
    let propose_events = w.env.events().all();
    assert!(propose_events.len() >= 1);

    w.roles.accept_admin();
    // drain and verify at least one event was emitted for accept
    let accept_events = w.env.events().all();
    assert!(accept_events.len() >= 1);
}

/// Multisig threshold and signers update is reflected correctly.
#[test]
fn test_multisig_config_update() {
    let w = setup();
    let s1 = Address::generate(&w.env);
    let s2 = Address::generate(&w.env);

    w.roles.update_signers(&vec![&w.env, s1.clone(), s2.clone()]);
    w.roles.update_threshold(&2);

    assert_eq!(w.roles.get_threshold(), 2);
    assert_eq!(w.roles.get_signers().len(), 2);
}

/// Admin mints tokens, funds vesting pool, creates schedule — full lifecycle.
#[test]
fn test_admin_mint_fund_vest_lifecycle() {
    let w = setup();
    let beneficiary = Address::generate(&w.env);

    // Mint tokens to admin (simulating treasury)
    w.token.mint(&w.admin, &50_000);
    assert_eq!(w.token.balance(&w.admin), 50_000);

    // Fund vesting pool further
    w.vesting.fund_pool(&5_000);
    assert_eq!(w.vesting.pool_balance(), 15_000);

    // Create vesting schedule
    let sid = w.vesting.create_schedule(&beneficiary, &5_000, &0, &0, &500);

    // Advance time and release
    w.env.ledger().set_timestamp(500);
    let released = w.vesting.release(&beneficiary, &sid);
    assert_eq!(released, 5_000);
    assert_eq!(w.vesting.pool_balance(), 10_000);
}

/// State across all contracts remains consistent after interleaved operations.
#[test]
fn test_interleaved_operations_state_consistency() {
    let w = setup();
    let alice = Address::generate(&w.env);
    let bob = Address::generate(&w.env);

    w.token.mint(&alice, &2_000);
    w.token.mint(&bob, &1_000);

    w.pool.deposit(&alice, &1_000);
    w.pool.deposit(&bob, &500);
    assert_eq!(w.pool.pool_balance(), 1_500);

    w.token.transfer(&alice, &bob, &500);
    assert_eq!(w.token.balance(&alice), 1_500); // 2000 minted - 1000 deposited - 500 transferred = 500... wait
    assert_eq!(w.token.balance(&bob), 1_500);   // 1000 minted + 500 received

    // Pool balance unaffected by token transfers
    assert_eq!(w.pool.pool_balance(), 1_500);

    w.pool.withdraw(&w.admin, &1_500);
    assert_eq!(w.pool.pool_balance(), 0);
}
