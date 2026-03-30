#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Balance,
    Depositor(Address),
}

#[contract]
pub struct RewardPoolContract;

#[contractimpl]
impl RewardPoolContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Balance, &0_i128);
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn deposit(env: Env, depositor: Address, amount: i128) {
        depositor.require_auth();
        assert!(amount > 0, "amount must be positive");
        let pool_bal: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        env.storage().instance().set(&DataKey::Balance, &(pool_bal + amount));
        let dep_key = DataKey::Depositor(depositor.clone());
        let dep_bal: i128 = env.storage().persistent().get(&dep_key).unwrap_or(0);
        env.storage().persistent().set(&dep_key, &(dep_bal + amount));
        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("deposit")),
            (depositor, amount),
        );
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");
        let pool_bal: i128 = env.storage().instance().get(&DataKey::Balance).unwrap_or(0);
        assert!(pool_bal >= amount, "insufficient pool balance");
        env.storage().instance().set(&DataKey::Balance, &(pool_bal - amount));
        env.events().publish(
            (symbol_short!("rwd_pool"), symbol_short!("withdraw")),
            (to, amount),
        );
    }

    pub fn pool_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn depositor_balance(env: Env, depositor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Depositor(depositor)).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, RewardPoolContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RewardPoolContract, ());
        let client = RewardPoolContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_deposit_withdraw_events() {
        let (env, admin, client) = setup();
        let depositor = Address::generate(&env);
        client.deposit(&depositor, &1000);
        assert_eq!(client.pool_balance(), 1000);
        assert_eq!(client.depositor_balance(&depositor), 1000);
        client.withdraw(&admin, &400);
        assert_eq!(client.pool_balance(), 600);
    }

    #[test]
    #[should_panic(expected = "insufficient pool balance")]
    fn test_withdraw_overdraft() {
        let (_env, admin, client) = setup();
        client.withdraw(&admin, &100);
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_deposit_zero_rejected() {
        let (env, _admin, client) = setup();
        let depositor = Address::generate(&env);
        client.deposit(&depositor, &0);
    }

    #[test]
    fn test_multiple_depositors() {
        let (env, admin, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.deposit(&alice, &500);
        client.deposit(&bob, &300);
        assert_eq!(client.pool_balance(), 800);
        assert_eq!(client.depositor_balance(&alice), 500);
        assert_eq!(client.depositor_balance(&bob), 300);
    }

    #[test]
    fn test_depositor_balance_zero_for_unknown() {
        let (env, _admin, client) = setup();
        let stranger = Address::generate(&env);
        assert_eq!(client.depositor_balance(&stranger), 0);
    }

    #[test]
    #[should_panic(expected = "already initialised")]
    fn test_double_initialize_rejected() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }
}
