#![cfg(test)]

//! Integration: Referral ↔ Vesting
//!
//! Simulates a real onboarding flow:
//!   1. A referred user is registered via the Referral contract.
//!   2. The admin credits the referrer.
//!   3. The same admin creates a vesting schedule for the referred user
//!      (e.g. as a welcome grant).
//!   4. Vesting releases are verified for correctness.
//!
//! Also tests state consistency: pool balances across both contracts
//! are tracked independently and must not interfere.

use referral::{ReferralContract, ReferralContractClient};
use vesting::{VestingContract, VestingContractClient};
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

// ── helpers ───────────────────────────────────────────────────────────────────

struct World<'a> {
    env: Env,
    admin: Address,
    referral: ReferralContractClient<'a>,
    vesting: VestingContractClient<'a>,
}

fn setup() -> World<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let ref_id = env.register(ReferralContract, ());
    let referral = ReferralContractClient::new(&env, &ref_id);
    referral.initialize(&admin);
    referral.fund_pool(&50_000);

    let vest_id = env.register(VestingContract, ());
    let vesting = VestingContractClient::new(&env, &vest_id);
    vesting.initialize(&admin);
    vesting.fund_pool(&100_000);

    World { env, admin, referral, vesting }
}

// ── tests ─────────────────────────────────────────────────────────────────────

/// Full onboarding flow: register referral → credit referrer → create vesting
/// schedule for referred user → release vested tokens.
#[test]
fn test_full_onboarding_flow() {
    let w = setup();
    let referrer = Address::generate(&w.env);
    let referred = Address::generate(&w.env);

    // Step 1: register referral
    w.referral.register_referral(&referrer, &referred);
    assert_eq!(w.referral.get_referrer(&referred), Some(referrer.clone()));
    assert_eq!(w.referral.total_referrals(&referrer), 1);

    // Step 2: credit referrer from referral pool
    w.referral.credit_referrer(&referred, &1_000);
    assert_eq!(w.referral.pool_balance(), 49_000);

    // Step 3: create vesting schedule for referred user (welcome grant)
    // start=0, cliff=0, duration=1000, amount=5000
    let sid = w.vesting.create_schedule(&referred, &5_000, &0, &0, &1_000);

    // Step 4: advance time to halfway and release
    w.env.ledger().set_timestamp(500);
    let released = w.vesting.release(&referred, &sid);
    assert_eq!(released, 2_500); // 50% of 5000
    assert_eq!(w.vesting.pool_balance(), 97_500);
}

/// Referral pool and vesting pool are independent — draining one doesn't
/// affect the other.
#[test]
fn test_pool_balances_are_independent() {
    let w = setup();
    let referrer = Address::generate(&w.env);
    let referred = Address::generate(&w.env);

    w.referral.register_referral(&referrer, &referred);
    w.referral.credit_referrer(&referred, &50_000); // drain referral pool

    assert_eq!(w.referral.pool_balance(), 0);
    // vesting pool untouched
    assert_eq!(w.vesting.pool_balance(), 100_000);
}

/// Multiple beneficiaries each get their own vesting schedule; releases
/// are independent and don't cross-contaminate.
#[test]
fn test_multiple_vesting_schedules_independent() {
    let w = setup();
    let alice = Address::generate(&w.env);
    let bob = Address::generate(&w.env);

    let sid_a = w.vesting.create_schedule(&alice, &2_000, &0, &0, &1_000);
    let sid_b = w.vesting.create_schedule(&bob,   &3_000, &0, &0, &1_000);

    w.env.ledger().set_timestamp(1_000);

    let released_a = w.vesting.release(&alice, &sid_a);
    let released_b = w.vesting.release(&bob,   &sid_b);

    assert_eq!(released_a, 2_000);
    assert_eq!(released_b, 3_000);
    assert_eq!(w.vesting.pool_balance(), 95_000); // 100_000 - 5_000
}

/// Referral credit fails when pool is empty; vesting state is unaffected.
#[test]
#[should_panic(expected = "insufficient pool balance")]
fn test_credit_fails_when_referral_pool_empty() {
    let w = setup();
    let referrer = Address::generate(&w.env);
    let referred = Address::generate(&w.env);

    w.referral.register_referral(&referrer, &referred);
    w.referral.credit_referrer(&referred, &50_000); // drain
    w.referral.credit_referrer(&referred, &1);      // should panic
}

/// Vesting cliff is respected even when referral flow completes successfully.
#[test]
#[should_panic(expected = "nothing to release")]
fn test_vesting_cliff_blocks_early_release() {
    let w = setup();
    let referrer = Address::generate(&w.env);
    let referred = Address::generate(&w.env);

    w.referral.register_referral(&referrer, &referred);

    // cliff=500, duration=1000 — nothing releasable before t=500
    let sid = w.vesting.create_schedule(&referred, &1_000, &0, &500, &1_000);

    w.env.ledger().set_timestamp(499);
    w.vesting.release(&referred, &sid); // should panic
}

/// Self-referral is rejected; no vesting schedule is created.
#[test]
#[should_panic(expected = "cannot refer yourself")]
fn test_self_referral_rejected() {
    let w = setup();
    let user = Address::generate(&w.env);
    w.referral.register_referral(&user, &user);
}

/// Duplicate referral registration is rejected.
#[test]
#[should_panic(expected = "already referred")]
fn test_duplicate_referral_rejected() {
    let w = setup();
    let referrer = Address::generate(&w.env);
    let referred = Address::generate(&w.env);
    w.referral.register_referral(&referrer, &referred);
    w.referral.register_referral(&referrer, &referred);
}
