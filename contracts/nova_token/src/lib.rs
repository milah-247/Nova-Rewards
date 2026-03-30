#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env,
};

// ── Storage keys ─────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    TotalSupply,
    Balance(Address),
    /// (owner, spender) → approved amount
    Allowance(Address, Address),
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct NovaToken;

#[contractimpl]
impl NovaToken {
    /// One-time initialisation. Sets the admin and zeroes total supply.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn balance_of(env: &Env, addr: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr.clone()))
            .unwrap_or(0)
    }

    fn set_balance(env: &Env, addr: &Address, amount: i128) {
        env.storage()
            .persistent()
            .set(&DataKey::Balance(addr.clone()), &amount);
    }

    fn get_allowance(env: &Env, owner: &Address, spender: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(owner.clone(), spender.clone()))
            .unwrap_or(0)
    }

    fn set_allowance(env: &Env, owner: &Address, spender: &Address, amount: i128) {
        env.storage()
            .persistent()
            .set(&DataKey::Allowance(owner.clone(), spender.clone()), &amount);
    }

    // ── Mint ──────────────────────────────────────────────────────────────────

    /// Mint `amount` tokens to `to`. Admin-gated.
    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::admin(&env).require_auth();
        assert!(amount > 0, "amount must be positive");

        let new_bal = Self::balance_of(&env, &to) + amount;
        Self::set_balance(&env, &to, new_bal);

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("mint")),
            (to, amount),
        );
    }

    // ── Burn ──────────────────────────────────────────────────────────────────

    /// Burn `amount` tokens from `from`. Caller must be `from`.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let bal = Self::balance_of(&env, &from);
        assert!(bal >= amount, "insufficient balance");
        Self::set_balance(&env, &from, bal - amount);

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("burn")),
            (from, amount),
        );
    }

    // ── Transfer ──────────────────────────────────────────────────────────────

    /// Transfer `amount` tokens from `from` to `to`. Caller must be `from`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");
        Self::set_balance(&env, &from, from_bal - amount);
        let to_bal = Self::balance_of(&env, &to);
        Self::set_balance(&env, &to, to_bal + amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("transfer")),
            (from, to, amount),
        );
    }

    // ── Approve / transfer_from ───────────────────────────────────────────────

    /// Approve `spender` to spend up to `amount` on behalf of `owner`.
    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        assert!(amount >= 0, "amount must be non-negative");
        Self::set_allowance(&env, &owner, &spender, amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("approve")),
            (owner, spender, amount),
        );
    }

    /// Transfer `amount` from `from` to `to` using `spender`'s allowance.
    /// Spender must have sufficient allowance granted by `from`.
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        spender.require_auth();
        assert!(amount > 0, "amount must be positive");

        let allowed = Self::get_allowance(&env, &from, &spender);
        assert!(allowed >= amount, "insufficient allowance");

        let from_bal = Self::balance_of(&env, &from);
        assert!(from_bal >= amount, "insufficient balance");

        // Deduct allowance
        Self::set_allowance(&env, &from, &spender, allowed - amount);

        // Move tokens
        Self::set_balance(&env, &from, from_bal - amount);
        let to_bal = Self::balance_of(&env, &to);
        Self::set_balance(&env, &to, to_bal + amount);

        env.events().publish(
            (symbol_short!("nova_tok"), symbol_short!("transfer")),
            (from, to, amount),
        );
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn balance(env: Env, addr: Address) -> i128 {
        Self::balance_of(&env, &addr)
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        Self::get_allowance(&env, &owner, &spender)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events}, Env};

    fn setup() -> (Env, Address, NovaTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(NovaToken, ());
        let client = NovaTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_mint_emits_event() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &500);
        assert_eq!(client.balance(&user), 500);
        assert_eq!(client.total_supply(), 500);
        let _ = env.events().all();
    }

    #[test]
    fn test_burn_emits_event() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &200);
        client.burn(&user, &50);
        assert_eq!(client.balance(&user), 150);
        assert_eq!(client.total_supply(), 150);
        let _ = env.events().all();
    }

    #[test]
    fn test_transfer_emits_event() {
        let (env, _admin, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&alice, &300);
        client.transfer(&alice, &bob, &100);
        assert_eq!(client.balance(&alice), 200);
        assert_eq!(client.balance(&bob), 100);
        let _ = env.events().all();
    }

    #[test]
    fn test_approve_emits_event() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        client.approve(&owner, &spender, &1000);
        assert_eq!(client.allowance(&owner, &spender), 1000);
        let _ = env.events().all();
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_burn_insufficient_balance() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        client.mint(&user, &10);
        client.burn(&user, &100);
    }

    #[test]
    fn test_transfer_from_spends_allowance() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.mint(&owner, &1000);
        client.approve(&owner, &spender, &400);
        client.transfer_from(&spender, &owner, &recipient, &250);

        assert_eq!(client.balance(&owner), 750);
        assert_eq!(client.balance(&recipient), 250);
        assert_eq!(client.allowance(&owner, &spender), 150);
        let _ = env.events().all();
    }

    #[test]
    #[should_panic(expected = "insufficient allowance")]
    fn test_transfer_from_exceeds_allowance() {
        let (env, _admin, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.mint(&owner, &1000);
        client.approve(&owner, &spender, &100);
        client.transfer_from(&spender, &owner, &recipient, &500);
    }

    #[test]
    fn test_total_supply_tracks_mint_and_burn() {
        let (env, _admin, client) = setup();
        let user = Address::generate(&env);
        assert_eq!(client.total_supply(), 0);
        client.mint(&user, &1000);
        assert_eq!(client.total_supply(), 1000);
        client.burn(&user, &300);
        assert_eq!(client.total_supply(), 700);
    }
}
