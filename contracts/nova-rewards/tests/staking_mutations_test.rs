#![cfg(test)]

//! Mutation-killing tests for staking functionality
//! These tests target specific mutations that may survive basic testing:
//! - Boundary conditions (0, negative, max values)
//! - Logical operators (&& vs ||, ! removal)
//! - Arithmetic operators (+/-, */÷)
//! - Comparison operators (< vs <=, > vs >=, == vs !=)

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient, SECONDS_PER_YEAR};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, Env};

fn deploy(env: &Env) -> NovaRewardsContractClient {
    let admin = Address::generate(env);
    let id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &id);
    client.initialize(&admin);
    client
}

// ---------------------------------------------------------------------------
// Boundary Mutations - Stake Amount
// ---------------------------------------------------------------------------

#[test]
fn test_stake_exactly_zero_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &0i128);
    }));
    
    assert!(result.is_err(), "Staking exactly 0 must be rejected");
}

#[test]
fn test_stake_exactly_one_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1i128);
    contract.stake(&user, &1i128);
    
    let stake = contract.get_stake(&user).unwrap();
    assert_eq!(stake.amount, 1i128);
}

#[test]
fn test_stake_negative_one_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &-1i128);
    }));
    
    assert!(result.is_err(), "Negative stake must be rejected");
}

#[test]
fn test_stake_max_i128_value() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    let max_amount = i128::MAX;
    contract.set_balance(&user, &max_amount);
    
    contract.stake(&user, &max_amount);
    
    let stake = contract.get_stake(&user).unwrap();
    assert_eq!(stake.amount, max_amount);
}

// ---------------------------------------------------------------------------
// Boundary Mutations - Annual Rate
// ---------------------------------------------------------------------------

#[test]
fn test_annual_rate_exactly_zero_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    contract.set_annual_rate(&0i128);
    assert_eq!(contract.get_annual_rate(), 0i128);
}

#[test]
fn test_annual_rate_exactly_10000_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    contract.set_annual_rate(&10000i128);
    assert_eq!(contract.get_annual_rate(), 10000i128);
}

#[test]
fn test_annual_rate_exactly_10001_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&10001i128);
    }));
    
    assert!(result.is_err(), "Rate of 10001 must be rejected");
}

#[test]
fn test_annual_rate_negative_one_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&-1i128);
    }));
    
    assert!(result.is_err(), "Negative rate must be rejected");
}

// ---------------------------------------------------------------------------
// Arithmetic Operator Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_yield_calculation_arithmetic_precision() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    let stake_amount = 1000i128;
    let rate = 1000i128; // 10%
    
    contract.set_balance(&user, &stake_amount);
    contract.set_annual_rate(&rate);
    contract.stake(&user, &stake_amount);
    
    // Advance exactly 1 year
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total = contract.unstake(&user);
    
    // Mutation: + → - in (principal + yield)
    assert_eq!(total, 1100i128, "Must be principal + yield, not principal - yield");
    assert_ne!(total, 900i128, "Catches + → - mutation");
    
    // Mutation: * → / in yield calculation
    assert_eq!(total, 1100i128, "Yield must use multiplication");
    assert_ne!(total, 1000i128, "Catches * → / mutation");
}

#[test]
fn test_yield_uses_multiplication_not_division() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &10000i128);
    contract.set_annual_rate(&500i128); // 5%
    contract.stake(&user, &10000i128);
    
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total = contract.unstake(&user);
    
    // Expected: 10000 + (10000 * 500 / 10000) = 10500
    assert_eq!(total, 10500i128);
    
    // If * was mutated to /, result would be drastically different
    assert!(total > 10000i128, "Yield must increase balance");
    assert!(total < 20000i128, "Yield must be reasonable");
}

// ---------------------------------------------------------------------------
// Comparison Operator Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_balance_check_uses_greater_than_not_greater_equal() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Set balance exactly equal to stake amount
    contract.set_balance(&user, &1000i128);
    
    // Should succeed (balance >= amount)
    contract.stake(&user, &1000i128);
    
    let stake = contract.get_stake(&user).unwrap();
    assert_eq!(stake.amount, 1000i128);
    assert_eq!(contract.get_balance(&user), 0i128);
}

#[test]
fn test_balance_check_rejects_insufficient() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Set balance one less than stake amount
    contract.set_balance(&user, &999i128);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &1000i128);
    }));
    
    assert!(result.is_err(), "Must reject when balance < amount");
}

#[test]
fn test_rate_validation_uses_correct_boundaries() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    // Test lower boundary: 0 should be accepted
    contract.set_annual_rate(&0i128);
    assert_eq!(contract.get_annual_rate(), 0i128);
    
    // Test upper boundary: 10000 should be accepted
    contract.set_annual_rate(&10000i128);
    assert_eq!(contract.get_annual_rate(), 10000i128);
    
    // Test just outside boundaries
    let result_neg = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&-1i128);
    }));
    assert!(result_neg.is_err(), "Must reject rate < 0");
    
    let result_high = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&10001i128);
    }));
    assert!(result_high.is_err(), "Must reject rate > 10000");
}

// ---------------------------------------------------------------------------
// Logical Operator Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_double_stake_check_prevents_overwrite() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &2000i128);
    
    // First stake
    contract.stake(&user, &1000i128);
    let first_stake = contract.get_stake(&user).unwrap();
    let first_timestamp = first_stake.start_time;
    
    // Advance time
    env.ledger().set_timestamp(env.ledger().timestamp() + 1000);
    
    // Second stake should fail
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &500i128);
    }));
    
    assert!(result.is_err(), "Double stake must be prevented");
    
    // Verify original stake unchanged
    let stake = contract.get_stake(&user).unwrap();
    assert_eq!(stake.amount, 1000i128);
    assert_eq!(stake.start_time, first_timestamp);
}

// ---------------------------------------------------------------------------
// Return Value Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_unstake_returns_correct_total() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.stake(&user, &1000i128);
    
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total = contract.unstake(&user);
    
    // Mutation: return value changed to 0 or removed
    assert!(total > 0, "Unstake must return non-zero value");
    assert_eq!(total, 1100i128, "Must return exact principal + yield");
    
    // Verify balance updated correctly
    assert_eq!(contract.get_balance(&user), total);
}

#[test]
fn test_calculate_yield_returns_zero_for_no_stake() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    let yield_amount = contract.calculate_yield(&user);
    
    // Mutation: return 0 → return 1
    assert_eq!(yield_amount, 0i128, "Must return exactly 0 for no stake");
    assert_ne!(yield_amount, 1i128, "Catches 0 → 1 mutation");
}

#[test]
fn test_get_annual_rate_returns_set_value() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    contract.set_annual_rate(&750i128);
    let retrieved = contract.get_annual_rate();
    
    // Mutation: return rate → return 0
    assert_eq!(retrieved, 750i128, "Must return exact set value");
    assert_ne!(retrieved, 0i128, "Catches return value mutation");
}

// ---------------------------------------------------------------------------
// Time Calculation Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_yield_calculation_uses_correct_time_formula() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&2000i128); // 20%
    contract.stake(&user, &1000i128);
    
    // Advance exactly half a year
    let half_year = SECONDS_PER_YEAR / 2;
    env.ledger().set_timestamp(env.ledger().timestamp() + half_year);
    
    let total = contract.unstake(&user);
    
    // Expected: 1000 + (1000 * 2000 * 0.5 / 10000) = 1100
    assert_eq!(total, 1100i128, "Half year at 20% should yield 10%");
    
    // Mutation: elapsed_time + start_time → elapsed_time - start_time
    // Would produce wrong result
    assert_ne!(total, 1000i128, "Time calculation must be correct");
}

#[test]
fn test_yield_zero_when_no_time_elapsed() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.stake(&user, &1000i128);
    
    // Don't advance time - unstake immediately
    let total = contract.unstake(&user);
    
    // Mutation: if elapsed_time == 0 → if elapsed_time != 0
    assert_eq!(total, 1000i128, "Zero time must produce zero yield");
}

// ---------------------------------------------------------------------------
// Division Order Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_yield_calculation_order_of_operations() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Use values that would produce different results with wrong order
    let stake_amount = 1_000_000_000i128;
    let rate = 333i128; // 3.33%
    
    contract.set_balance(&user, &stake_amount);
    contract.set_annual_rate(&rate);
    contract.stake(&user, &stake_amount);
    
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total = contract.unstake(&user);
    
    // Correct: (amount * rate * time) / (10000 * SECONDS_PER_YEAR)
    // Wrong:   (amount / 10000) * rate * time / SECONDS_PER_YEAR
    let expected = stake_amount + (stake_amount * rate / 10000);
    assert_eq!(total, expected);
    
    // Verify precision is maintained
    assert!(total > stake_amount, "Must include yield");
    assert!(total < stake_amount * 2, "Yield must be reasonable");
}

// ---------------------------------------------------------------------------
// Boolean Logic Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_stake_requires_positive_amount_and_sufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Test: amount > 0 AND balance >= amount
    // Mutation: && → ||
    
    // Case 1: amount <= 0, balance sufficient
    contract.set_balance(&user, &1000i128);
    let result1 = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &0i128);
    }));
    assert!(result1.is_err(), "Must reject zero amount even with balance");
    
    // Case 2: amount > 0, balance insufficient
    contract.set_balance(&user, &500i128);
    let result2 = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &1000i128);
    }));
    assert!(result2.is_err(), "Must reject insufficient balance even with positive amount");
    
    // Case 3: Both conditions met
    contract.set_balance(&user, &1000i128);
    contract.stake(&user, &1000i128);
    assert!(contract.get_stake(&user).is_some(), "Must succeed when both conditions met");
}

#[test]
fn test_rate_validation_requires_both_boundaries() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    // Test: rate >= 0 AND rate <= 10000
    // Mutation: && → ||
    
    // Valid rates
    contract.set_annual_rate(&0i128);
    assert_eq!(contract.get_annual_rate(), 0i128);
    
    contract.set_annual_rate(&5000i128);
    assert_eq!(contract.get_annual_rate(), 5000i128);
    
    contract.set_annual_rate(&10000i128);
    assert_eq!(contract.get_annual_rate(), 10000i128);
    
    // Invalid: below 0
    let result_low = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&-1i128);
    }));
    assert!(result_low.is_err());
    
    // Invalid: above 10000
    let result_high = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&10001i128);
    }));
    assert!(result_high.is_err());
}

// ---------------------------------------------------------------------------
// State Mutation Tests
// ---------------------------------------------------------------------------

#[test]
fn test_stake_removes_balance_completely() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    contract.stake(&user, &1000i128);
    
    // Mutation: balance - amount → balance + amount
    let remaining = contract.get_balance(&user);
    assert_eq!(remaining, 0i128, "Balance must be reduced to 0");
    assert_ne!(remaining, 2000i128, "Catches - → + mutation");
}

#[test]
fn test_unstake_adds_yield_to_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.stake(&user, &1000i128);
    
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let initial_balance = contract.get_balance(&user);
    assert_eq!(initial_balance, 0i128);
    
    contract.unstake(&user);
    
    let final_balance = contract.get_balance(&user);
    
    // Mutation: balance + total → balance - total
    assert_eq!(final_balance, 1100i128, "Balance must increase by principal + yield");
    assert!(final_balance > initial_balance, "Balance must increase");
}

// ---------------------------------------------------------------------------
// Comparison Direction Mutations
// ---------------------------------------------------------------------------

#[test]
fn test_amount_validation_direction() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    
    // Test: amount > 0 (not amount < 0)
    // Mutation: > → <
    
    let result_zero = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &0i128);
    }));
    assert!(result_zero.is_err(), "Zero must be rejected");
    
    let result_positive = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &100i128);
    }));
    assert!(result_positive.is_ok(), "Positive must be accepted");
}

#[test]
fn test_rate_upper_bound_uses_less_than_or_equal() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    // Test: rate <= 10000 (not rate < 10000)
    // Mutation: <= → <
    
    contract.set_annual_rate(&10000i128);
    assert_eq!(contract.get_annual_rate(), 10000i128, "10000 must be accepted");
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&10001i128);
    }));
    assert!(result.is_err(), "10001 must be rejected");
}

// ---------------------------------------------------------------------------
// Edge Case Combinations
// ---------------------------------------------------------------------------

#[test]
fn test_minimum_viable_stake_and_yield() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Minimum stake: 1 token
    // Minimum rate: 1 basis point (0.01%)
    contract.set_balance(&user, &1i128);
    contract.set_annual_rate(&1i128);
    contract.stake(&user, &1i128);
    
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total = contract.unstake(&user);
    
    // Expected: 1 + (1 * 1 / 10000) = 1 + 0 = 1 (truncated)
    assert_eq!(total, 1i128, "Minimum stake with minimum rate");
    assert!(total >= 1i128, "Must return at least principal");
}

#[test]
fn test_maximum_viable_stake_and_yield() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    // Large stake with maximum rate
    let large_stake = 1_000_000_000i128;
    contract.set_balance(&user, &large_stake);
    contract.set_annual_rate(&10000i128); // 100%
    contract.stake(&user, &large_stake);
    
    env.ledger().set_timestamp(env.ledger().timestamp() + SECONDS_PER_YEAR);
    
    let total = contract.unstake(&user);
    
    // Expected: 1B + 1B = 2B (100% yield)
    assert_eq!(total, 2_000_000_000i128);
    assert_eq!(contract.get_balance(&user), 2_000_000_000i128);
}
