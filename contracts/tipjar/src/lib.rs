#![no_std]

pub mod interfaces;
pub mod integrations;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short,
    token, Address, BytesN, Env, Map, String, Vec,
};

pub mod upgrade;

#[cfg(test)]
extern crate std;

// Advanced Event System
pub mod events;

// Automated Market Maker
pub mod amm;

// Governance System
pub mod governance;

// Staking and Rewards
pub mod staking;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipWithMessage {
    pub sender: Address,
    pub creator: Address,
    pub amount: i128,
    pub message: String,
    pub metadata: Map<String, String>,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub id: u64,
    pub creator: Address,
    pub goal_amount: i128,
    pub current_amount: i128,
    pub description: String,
    pub deadline: Option<u64>,
    pub completed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchTip {
    pub creator: Address,
    pub token: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LockedTip {
    pub sender: Address,
    pub creator: Address,
    pub token: Address,
    pub amount: i128,
    pub unlock_timestamp: u64,
}

/// Internal record of a tip for refund tracking.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipRecord {
    pub id: u64,
    pub sender: Address,
    pub creator: Address,
    pub token: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub refunded: bool,
    pub refund_requested: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TimePeriod {
    AllTime,
    Monthly,
    Weekly,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub address: Address,
    pub total_amount: i128,
    pub tip_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ParticipantKind {
    Tipper,
    Creator,
}

/// Query parameters for tip history retrieval.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipHistoryQuery {
    pub creator: Option<Address>,
    pub sender: Option<Address>,
    pub min_amount: Option<i128>,
    pub max_amount: Option<i128>,
    pub start_time: Option<u64>,
    pub end_time: Option<u64>,
    pub limit: u32,
    pub offset: u32,
}

/// Role enum for role-based access control.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Admin,
    Moderator,
    Creator,
}

/// A sponsor-funded tip matching program.
///
/// `match_ratio` is in basis points: 100 = 1:1, 200 = 2:1.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MatchingProgram {
    pub id: u64,
    pub sponsor: Address,
    pub creator: Address,
    pub token: Address,
    pub match_ratio: u32,
    pub max_match_amount: i128,
    pub current_matched: i128,
    pub active: bool,
}

/// A record of a single tip, used for refund tracking.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipRecord {
    pub id: u64,
    pub sender: Address,
    pub creator: Address,
    pub token: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub refunded: bool,
    pub refund_requested: bool,
}

/// Storage layout for persistent contract data.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Token contract address whitelist state (bool).
    TokenWhitelist(Address),
    /// Creator's currently withdrawable balance held by this contract per token.
    CreatorBalance(Address, Address), // (creator, token)
    /// Historical total tips ever received by creator per token.
    CreatorTotal(Address, Address),   // (creator, token)
    /// Emergency pause state (bool).
    Paused,
    /// Contract administrator (Address).
    Admin,
    /// Messages appended for a creator.
    CreatorMessages(Address),
    /// Current number of milestones for a creator (used for ID).
    MilestoneCounter(Address),
    /// Data for a specific milestone.
    Milestone(Address, u64),
    /// Active milestone IDs for a creator to track.
    ActiveMilestones(Address),
    /// Maps an address to its assigned Role (persistent).
    UserRole(Address),
    /// Maps a Role to the set of addresses holding it (persistent).
    RoleMembers(Role),
    /// Aggregate stats for a tipper in a specific time bucket (bucket_id: 0=AllTime, YYYYMM=Monthly, YYYYWW=Weekly).
    TipperAggregate(Address, u32),
    /// Aggregate stats for a creator in a specific time bucket.
    CreatorAggregate(Address, u32),
    /// Ordered list of all known tipper addresses for a bucket.
    TipperParticipants(u32),
    /// Ordered list of all known creator addresses for a bucket.
    CreatorParticipants(u32),
    /// Locked tip record keyed by (creator, tip_id).
    LockedTip(Address, u64),
    /// Per-creator counter for assigning tip IDs (u64).
    LockedTipCounter(Address),
    /// Global matching program counter.
    MatchingCounter,
    /// Individual matching program by ID.
    MatchingProgram(u64),
    /// Matching program IDs indexed under a creator.
    CreatorMatchingPrograms(Address),
    /// Individual tip record by global tip ID.
    TipRecord(u64),
    /// Global tip counter for assigning tip IDs.
    TipCounter,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TipJarError {
    AlreadyInitialized = 1,
    TokenNotWhitelisted = 2,
    InvalidAmount = 3,
    NothingToWithdraw = 4,
    MessageTooLong = 5,
    MilestoneNotFound = 6,
    MilestoneAlreadyCompleted = 7,
    InvalidGoalAmount = 8,
    Unauthorized = 9,
    RoleNotFound = 10,
    BatchTooLarge = 11,
    InsufficientBalance = 12,
    InvalidUnlockTime = 13,
    TipStillLocked = 14,
    LockedTipNotFound = 15,
    MatchingProgramNotFound = 16,
    MatchingProgramInactive = 17,
    InvalidMatchRatio = 18,
    DexNotConfigured = 19,
    NftNotConfigured = 20,
    SwapFailed = 21,
    ContractPaused = 22,
}



#[contract]
pub struct TipJarContract;

#[contractimpl]
impl TipJarContract {
    /// One-time setup to choose the administrator for the TipJar.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, TipJarError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        grant_role_internal(&env, &admin, &admin, Role::Admin);
    }

    /// Adds a token to the whitelist (Admin only).
    pub fn add_token(env: Env, admin: Address, token: Address) {
        Self::require_not_paused(&env);
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenWhitelist(token), &true);
    }

    /// Removes a token from the whitelist (Admin only).
    pub fn remove_token(env: Env, admin: Address, token: Address) {
        Self::require_not_paused(&env);
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenWhitelist(token), &false);
    }

    /// Moves `amount` tokens from `sender` into contract escrow for `creator`.
    pub fn tip(env: Env, sender: Address, creator: Address, token: Address, amount: i128) {
        Self::require_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, TipJarError::InvalidAmount);
        }
        if !Self::is_whitelisted(env.clone(), token.clone()) {
            panic_with_error!(&env, TipJarError::TokenNotWhitelisted);
        }

        sender.require_auth();

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let balance_key = DataKey::CreatorBalance(creator.clone(), token.clone());
        let total_key = DataKey::CreatorTotal(creator.clone(), token.clone());
        let storage = env.storage().persistent();

        let next_balance: i128 = storage.get(&balance_key).unwrap_or(0) + amount;
        let next_total: i128 = storage.get(&total_key).unwrap_or(0) + amount;

        let balance_key = DataKey::CreatorBalance(creator.clone(), token.clone());
        let total_key = DataKey::CreatorTotal(creator.clone(), token.clone());
        let storage = env.storage().persistent();

        // Record the tip for refund tracking.
        let tip_id = next_tip_id(&env);
        let record = TipRecord {
            id: tip_id,
            sender: sender.clone(),
            creator: creator.clone(),
            token: token.clone(),
            amount,
            timestamp: env.ledger().timestamp(),
            refunded: false,
            refund_requested: false,
        };
        env.storage().persistent().set(&DataKey::TipRecord(tip_id), &record);

        env.events()
            .publish((symbol_short!("tip"), creator.clone(), token), (sender.clone(), amount));

        update_leaderboard_aggregates(&env, &sender, &creator, amount);
        tip_id
    }

    /// Allows supporters to attach a note and metadata to a tip.
    pub fn tip_with_message(
        env: Env,
        sender: Address,
        creator: Address,
        token: Address,
        amount: i128,
        message: String,
        metadata: Map<String, String>,
    ) {
        Self::require_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, TipJarError::InvalidAmount);
        }
        if message.len() > 280 {
            panic_with_error!(&env, TipJarError::MessageTooLong);
        }
        if !Self::is_whitelisted(env.clone(), token.clone()) {
            panic_with_error!(&env, TipJarError::TokenNotWhitelisted);
        }

        sender.require_auth();

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let balance_key = DataKey::CreatorBalance(creator.clone(), token.clone());
        let total_key = DataKey::CreatorTotal(creator.clone(), token.clone());
        let msgs_key = DataKey::CreatorMessages(creator.clone());
        let storage = env.storage().persistent();

        storage.set(&balance_key, &(storage.get::<_, i128>(&balance_key).unwrap_or(0) + amount));
        storage.set(&total_key, &(storage.get::<_, i128>(&total_key).unwrap_or(0) + amount));

        let timestamp = env.ledger().timestamp();
        let payload = TipWithMessage {
            sender: sender.clone(),
            creator: creator.clone(),
            amount,
            message: message.clone(),
            metadata: metadata.clone(),
            timestamp,
        };
        let mut messages: Vec<TipWithMessage> = storage
            .get(&msgs_key)
            .unwrap_or_else(|| Vec::new(&env));
        messages.push_back(payload);
        env.storage().persistent().set(&msgs_key, &messages);

        // Record the tip for refund tracking.
        let tip_id = next_tip_id(&env);
        let record = TipRecord {
            id: tip_id,
            sender: sender.clone(),
            creator: creator.clone(),
            token: token.clone(),
            amount,
            timestamp,
            refunded: false,
            refund_requested: false,
        };
        env.storage().persistent().set(&DataKey::TipRecord(tip_id), &record);

        env.events().publish(
            (symbol_short!("tip_msg"), creator.clone()),
            (sender.clone(), amount, message, metadata),
        );

        update_leaderboard_aggregates(&env, &sender, &creator, amount);
    }

    /// Returns total historical tips for a creator for a specific token.
    pub fn get_total_tips(env: Env, creator: Address, token: Address) -> i128 {
        env.storage().persistent().get(&DataKey::CreatorTotal(creator, token)).unwrap_or(0)
    }

    /// Returns stored messages for a creator.
    pub fn get_messages(env: Env, creator: Address) -> Vec<TipWithMessage> {
        env.storage()
            .persistent()
            .get(&DataKey::CreatorMessages(creator))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns currently withdrawable escrowed tips for a creator for a specific token.
    pub fn get_withdrawable_balance(env: Env, creator: Address, token: Address) -> i128 {
        env.storage().persistent().get(&DataKey::CreatorBalance(creator, token)).unwrap_or(0)
    }

    /// Allows creator to withdraw their accumulated escrowed tips for a specific token.
    pub fn withdraw(env: Env, creator: Address, token: Address) {
        Self::require_not_paused(&env);
        creator.require_auth();
        require_role(&env, &creator, Role::Creator);

        let key = DataKey::CreatorBalance(creator.clone(), token.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            panic_with_error!(&env, TipJarError::NothingToWithdraw);
        }

        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();

        token_client.transfer(&contract_address, &creator, &amount);
        env.storage().persistent().set(&key, &0i128);

        env.events()
            .publish((symbol_short!("withdraw"), creator, token), amount);
    }

    /// Returns tip-with-message records matching the given query filters, sorted by
    /// timestamp descending, with offset/limit pagination.
    ///
    /// When `query.creator` is `Some`, only that creator's messages are scanned.
    /// When `None`, all known creators (from the AllTime leaderboard participant list) are scanned.
    /// No auth required; available even when the contract is paused.
    pub fn get_tip_history(env: Env, query: TipHistoryQuery) -> Vec<TipWithMessage> {
        let limit = if query.limit == 0 || query.limit > 100 { 100 } else { query.limit };

        // Collect all candidate records from relevant creator(s).
        let mut all: Vec<TipWithMessage> = Vec::new(&env);

        if let Some(ref creator) = query.creator {
            collect_creator_messages(&env, creator, &mut all);
        } else {
            // Scan all known creators from the AllTime bucket participant list.
            let participants: Vec<Address> = env
                .storage()
                .persistent()
                .get(&DataKey::CreatorParticipants(0u32))
                .unwrap_or_else(|| Vec::new(&env));
            for creator in participants.iter() {
                collect_creator_messages(&env, &creator, &mut all);
            }
        }

        // Apply filters.
        let mut filtered: Vec<TipWithMessage> = Vec::new(&env);
        for record in all.iter() {
            if let Some(ref sender) = query.sender {
                if record.sender != *sender { continue; }
            }
            if let Some(min) = query.min_amount {
                if record.amount < min { continue; }
            }
            if let Some(max) = query.max_amount {
                if record.amount > max { continue; }
            }
            if let Some(start) = query.start_time {
                if record.timestamp < start { continue; }
            }
            if let Some(end) = query.end_time {
                if record.timestamp > end { continue; }
            }
            filtered.push_back(record);
        }

        // Sort descending by timestamp (selection sort — no_std compatible).
        let n = filtered.len();
        let mut i = 0u32;
        while i < n {
            let mut newest = i;
            let mut j = i + 1;
            while j < n {
                if filtered.get(j).unwrap().timestamp > filtered.get(newest).unwrap().timestamp {
                    newest = j;
                }
                j += 1;
            }
            if newest != i {
                let a = filtered.get(i).unwrap();
                let b = filtered.get(newest).unwrap();
                filtered.set(i, b);
                filtered.set(newest, a);
            }
            i += 1;
        }

        // Paginate.
        let total = filtered.len();
        if query.offset >= total {
            return Vec::new(&env);
        }
        let end = {
            let candidate = query.offset + limit;
            if candidate > total { total } else { candidate }
        };
        let mut page: Vec<TipWithMessage> = Vec::new(&env);
        let mut idx = query.offset;
        while idx < end {
            page.push_back(filtered.get(idx).unwrap());
            idx += 1;
        }
        page
    }

    /// Returns tip-with-message records for a specific creator, sorted by timestamp
    /// descending, limited to `limit` results (capped at 100).
    ///
    /// No auth required; available even when the contract is paused.
    pub fn get_creator_tips(env: Env, creator: Address, limit: u32) -> Vec<TipWithMessage> {
        let effective_limit = if limit == 0 || limit > 100 { 100 } else { limit };
        let messages: Vec<TipWithMessage> = env
            .storage()
            .persistent()
            .get(&DataKey::CreatorMessages(creator))
            .unwrap_or_else(|| Vec::new(&env));

        // Sort descending by timestamp.
        let mut sorted = messages.clone();
        let n = sorted.len();
        let mut i = 0u32;
        while i < n {
            let mut newest = i;
            let mut j = i + 1;
            while j < n {
                if sorted.get(j).unwrap().timestamp > sorted.get(newest).unwrap().timestamp {
                    newest = j;
                }
                j += 1;
            }
            if newest != i {
                let a = sorted.get(i).unwrap();
                let b = sorted.get(newest).unwrap();
                sorted.set(i, b);
                sorted.set(newest, a);
            }
            i += 1;
        }

        // Return up to effective_limit records.
        let end = if effective_limit > n { n } else { effective_limit };
        let mut result: Vec<TipWithMessage> = Vec::new(&env);
        let mut idx = 0u32;
        while idx < end {
            result.push_back(sorted.get(idx).unwrap());
            idx += 1;
        }
        result
    }

    pub fn is_whitelisted(env: Env, token: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::TokenWhitelist(token))
            .unwrap_or(false)
    }

    /// Emergency pause to stop all state-changing activities (Admin only).
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((soroban_sdk::Symbol::new(&env, "contract_paused"), admin), env.ledger().timestamp());
    }

    /// Resume contract activities after an emergency pause (Admin only).
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((soroban_sdk::Symbol::new(&env, "contract_unpaused"), admin), env.ledger().timestamp());
    }



    /// Replaces the contract WASM with `new_wasm_hash` (Admin only).
    /// All storage is preserved automatically by the Soroban host.
    /// Increments the on-chain version counter and emits an `upgraded` event.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        Self::require_not_paused(&env);
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);

        let version: u32 = env.storage().instance().get(&DataKey::Version).unwrap_or(0);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        env.storage().instance().set(&DataKey::Version, &(version + 1));

        env.events().publish((symbol_short!("upgraded"), admin), version + 1);
    }

    /// Returns the current upgrade version (0 = never upgraded).
    pub fn get_version(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Version).unwrap_or(0)
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    fn require_not_paused(env: &Env) {
        if Self::is_paused(env) {
            panic_with_error!(env, TipJarError::ContractPaused);
        }
    }


    fn next_tip_id(env: &Env) -> u64 {
        let id: u64 = env.storage().instance().get(&DataKey::TipCounter).unwrap_or(0);
        env.storage().instance().set(&DataKey::TipCounter, &(id + 1));
        id
    }

    /// Sender requests a refund within the grace period (24 h). Auto-approved if within grace.
    pub fn request_refund(env: Env, sender: Address, tip_id: u64) {
        Self::require_not_paused(&env);
        sender.require_auth();
        let mut record: TipRecord = env
            .storage()
            .persistent()
            .get(&DataKey::TipRecord(tip_id))
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::LockedTipNotFound));

        if record.sender != sender {
            panic_with_error!(&env, TipJarError::Unauthorized);
        }
        if record.refunded {
            panic_with_error!(&env, TipJarError::NothingToWithdraw);
        }

        let elapsed = env.ledger().timestamp().saturating_sub(record.timestamp);
        if elapsed <= GRACE_PERIOD_SECS {
            // Auto-approve: deduct from creator balance and refund sender.
            let balance_key = DataKey::CreatorBalance(record.creator.clone(), record.token.clone());
            let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
            let new_balance = if balance >= record.amount { balance - record.amount } else { 0 };
            env.storage().persistent().set(&balance_key, &new_balance);

            let token_client = token::Client::new(&env, &record.token);
            token_client.transfer(&env.current_contract_address(), &sender, &record.amount);

            record.refunded = true;
            env.storage().persistent().set(&DataKey::TipRecord(tip_id), &record);

            env.events().publish(
                (symbol_short!("refund"), record.creator.clone()),
                (tip_id, sender, record.amount),
            );
        } else {
            // Past grace period: mark as requested, requires admin approval.
            record.refund_requested = true;
            env.storage().persistent().set(&DataKey::TipRecord(tip_id), &record);

            env.events().publish(
                (symbol_short!("ref_req"), record.creator.clone()),
                (tip_id, sender),
            );
        }
    }

    /// Admin approves a refund request that is past the grace period.
    pub fn approve_refund(env: Env, admin: Address, tip_id: u64) {
        Self::require_not_paused(&env);
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);

        let mut record: TipRecord = env
            .storage()
            .persistent()
            .get(&DataKey::TipRecord(tip_id))
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::LockedTipNotFound));

        if !record.refund_requested || record.refunded {
            panic_with_error!(&env, TipJarError::NothingToWithdraw);
        }

        let balance_key = DataKey::CreatorBalance(record.creator.clone(), record.token.clone());
        let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        let new_balance = if balance >= record.amount { balance - record.amount } else { 0 };
        env.storage().persistent().set(&balance_key, &new_balance);

        let token_client = token::Client::new(&env, &record.token);
        token_client.transfer(&env.current_contract_address(), &record.sender, &record.amount);

        record.refunded = true;
        env.storage().persistent().set(&DataKey::TipRecord(tip_id), &record);

        env.events().publish(
            (symbol_short!("ref_appr"), record.creator.clone()),
            (tip_id, record.sender, record.amount),
        );
    }

    /// Returns `true` iff `target` currently holds `role`. No authorization required.
    pub fn has_role(env: Env, target: Address, role: Role) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::UserRole(target))
            .map(|r: Role| r == role)
            .unwrap_or(false)
    }

    /// Grants `role` to `target`. Caller must be Admin.
    pub fn grant_role(env: Env, caller: Address, target: Address, role: Role) {
        Self::require_not_paused(&env);
        caller.require_auth();
        require_role(&env, &caller, Role::Admin);
        grant_role_internal(&env, &caller, &target, role);
    }

    /// Revokes the role from `target`. Caller must be Admin.
    /// Panics with `RoleNotFound` if `target` holds no role.
    pub fn revoke_role(env: Env, caller: Address, target: Address) {
        Self::require_not_paused(&env);
        caller.require_auth();
        require_role(&env, &caller, Role::Admin);

        // Read the current role; panic if absent.
        let role: Role = env
            .storage()
            .persistent()
            .get(&DataKey::UserRole(target.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::RoleNotFound));

        // Remove the UserRole entry.
        env.storage()
            .persistent()
            .remove(&DataKey::UserRole(target.clone()));

        // Remove target from RoleMembers.
        let members_key = DataKey::RoleMembers(role.clone());
        let mut members: Vec<Address> = env
            .storage()
            .persistent()
            .get(&members_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut filtered: Vec<Address> = Vec::new(&env);
        for a in members.iter() {
            if a != target {
                filtered.push_back(a);
            }
        }
        members = filtered;
        env.storage().persistent().set(&members_key, &members);

        // Emit role_rvk event: topics = (symbol, target, role), data = caller.
        env.events().publish(
            (symbol_short!("role_rvk"), target.clone(), role.clone()),
            caller.clone(),
        );
    }

    /// Tips multiple creators in a single transaction.
    ///
    /// Returns one `Result<(), TipJarError>` per entry, in input order.
    /// A single `sender.require_auth()` covers the entire batch.
    pub fn tip_batch(env: Env, sender: Address, tips: soroban_sdk::Vec<BatchTip>) -> soroban_sdk::Vec<Result<(), TipJarError>> {
        // 1. Pause guard — same pattern as `tip`
        Self::require_not_paused(&env);

        // 2. Empty batch short-circuit — no auth required
        if tips.len() == 0 {
            return soroban_sdk::Vec::new(&env);
        }

        // 3. Size guard
        if tips.len() > 50u32 {
            panic_with_error!(&env, TipJarError::BatchTooLarge);
        }

        // 4. Single authorization for the entire batch
        sender.require_auth();

        // 5. Process each entry independently
        let mut results: soroban_sdk::Vec<Result<(), TipJarError>> = soroban_sdk::Vec::new(&env);
        for entry in tips.iter() {
            results.push_back(process_single_tip(&env, &sender, &entry));
        }

        results
    }

    /// Returns a ranked page of top tippers for the given time period.
    /// No auth required; available even when the contract is paused.
    pub fn get_top_tippers(env: Env, period: TimePeriod, offset: u32, limit: u32) -> Vec<LeaderboardEntry> {
        let bucket = bucket_id_for_period(&env, &period);
        ranked_page(&env, DataKey::TipperParticipants(bucket), true, bucket, offset, limit)
    }

    /// Returns a ranked page of top creators for the given time period.
    /// No auth required; available even when the contract is paused.
    pub fn get_top_creators(env: Env, period: TimePeriod, offset: u32, limit: u32) -> Vec<LeaderboardEntry> {
        let bucket = bucket_id_for_period(&env, &period);
        ranked_page(&env, DataKey::CreatorParticipants(bucket), false, bucket, offset, limit)
    }

    /// Locks `amount` tokens from `sender` in escrow for `creator`, releasing only after `unlock_timestamp`.
    ///
    /// Returns the assigned `tip_id` (monotonically increasing per creator, starting at 0).
    pub fn tip_locked(
        env: Env,
        sender: Address,
        creator: Address,
        token: Address,
        amount: i128,
        unlock_timestamp: u64,
    ) -> u64 {
        // 1. Pause guard
        Self::require_not_paused(&env);
        // 2. Token whitelist check
        if !Self::is_whitelisted(env.clone(), token.clone()) {
            panic_with_error!(&env, TipJarError::TokenNotWhitelisted);
        }
        // 3. Amount guard
        if amount <= 0 {
            panic_with_error!(&env, TipJarError::InvalidAmount);
        }
        // 4. Timestamp guard
        if unlock_timestamp <= env.ledger().timestamp() {
            panic_with_error!(&env, TipJarError::InvalidUnlockTime);
        }
        // 5. Auth
        sender.require_auth();

        // 6. Read/increment per-creator tip counter
        let counter_key = DataKey::LockedTipCounter(creator.clone());
        let tip_id: u64 = env.storage().persistent().get(&counter_key).unwrap_or(0u64);
        env.storage().persistent().set(&counter_key, &(tip_id + 1));

        // 7. Transfer tokens from sender to this contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        // 8. Store the LockedTip record
        let locked_tip = LockedTip {
            sender: sender.clone(),
            creator: creator.clone(),
            token: token.clone(),
            amount,
            unlock_timestamp,
        };
        env.storage()
            .persistent()
            .set(&DataKey::LockedTip(creator.clone(), tip_id), &locked_tip);

        // 9. Emit event
        env.events().publish(
            (symbol_short!("tip_lckd"), creator.clone(), token.clone()),
            (tip_id, sender.clone(), amount, unlock_timestamp),
        );

        // 10. Return tip_id
        tip_id
    }

    /// Withdraws a locked tip to the creator after its unlock timestamp has elapsed.
    ///
    /// Requires the caller to hold the `Creator` role.
    pub fn withdraw_locked(env: Env, creator: Address, tip_id: u64) {
        // 1. Pause guard
        Self::require_not_paused(&env);
        // 2. Auth
        creator.require_auth();
        // 3. Role check
        require_role(&env, &creator, Role::Creator);

        // 4. Load the locked tip record
        let locked_tip: LockedTip = env
            .storage()
            .persistent()
            .get(&DataKey::LockedTip(creator.clone(), tip_id))
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::LockedTipNotFound));

        // 5. Time check
        if env.ledger().timestamp() < locked_tip.unlock_timestamp {
            panic_with_error!(&env, TipJarError::TipStillLocked);
        }

        // 6. Transfer tokens from contract to creator
        let token_client = token::Client::new(&env, &locked_tip.token);
        token_client.transfer(&env.current_contract_address(), &creator, &locked_tip.amount);

        // 7. Remove the record
        env.storage()
            .persistent()
            .remove(&DataKey::LockedTip(creator.clone(), tip_id));

        // 8. Emit event
        env.events().publish(
            (symbol_short!("lck_wdrw"), creator.clone(), locked_tip.token.clone()),
            (tip_id, locked_tip.amount),
        );
    }

    /// Returns the stored `LockedTip` for the given creator and tip_id.
    ///
    /// No auth required; available even when the contract is paused.
    pub fn get_locked_tip(env: Env, creator: Address, tip_id: u64) -> LockedTip {
        env.storage()
            .persistent()
            .get(&DataKey::LockedTip(creator, tip_id))
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::LockedTipNotFound))
    }

    /// Sponsor creates a matching program and deposits `max_match_amount` tokens
    /// into the contract as the matching budget.
    ///
    /// `match_ratio` is in basis points: 100 = 1:1, 200 = 2:1.
    pub fn create_matching_program(
        env: Env,
        sponsor: Address,
        creator: Address,
        token: Address,
        match_ratio: u32,
        max_match_amount: i128,
    ) -> u64 {
        Self::require_not_paused(&env);
        if match_ratio == 0 {
            panic_with_error!(&env, TipJarError::InvalidMatchRatio);
        }
        if max_match_amount <= 0 {
            panic_with_error!(&env, TipJarError::InvalidAmount);
        }
        if !Self::is_whitelisted(env.clone(), token.clone()) {
            panic_with_error!(&env, TipJarError::TokenNotWhitelisted);
        }

        sponsor.require_auth();

        // Sponsor deposits the full matching budget upfront.
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sponsor, &env.current_contract_address(), &max_match_amount);

        let program_id = next_matching_id(&env);
        let program = MatchingProgram {
            id: program_id,
            sponsor: sponsor.clone(),
            creator: creator.clone(),
            token: token.clone(),
            match_ratio,
            max_match_amount,
            current_matched: 0,
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::MatchingProgram(program_id), &program);

        let mut programs: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CreatorMatchingPrograms(creator.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        programs.push_back(program_id);
        env.storage()
            .persistent()
            .set(&DataKey::CreatorMatchingPrograms(creator.clone()), &programs);

        env.events().publish(
            (symbol_short!("match_new"), creator, token),
            (sponsor, program_id, match_ratio, max_match_amount),
        );

        program_id
    }

    /// Send a tip that is automatically matched by the first active matching
    /// program for this creator/token pair (if any budget remains).
    ///
    /// Returns `(tip_matched_amount)` — the amount the sponsor contributed.
    pub fn tip_with_match(
        env: Env,
        sender: Address,
        creator: Address,
        token: Address,
        amount: i128,
    ) -> i128 {
        Self::require_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, TipJarError::InvalidAmount);
        }
        if !Self::is_whitelisted(env.clone(), token.clone()) {
            panic_with_error!(&env, TipJarError::TokenNotWhitelisted);
        }

        sender.require_auth();

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        // Find the first active matching program with remaining budget.
        let mut matched_amount: i128 = 0;
        let programs: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::CreatorMatchingPrograms(creator.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        for program_id in programs.iter() {
            let key = DataKey::MatchingProgram(program_id);
            let mut program: MatchingProgram = match env.storage().persistent().get(&key) {
                Some(p) => p,
                None => continue,
            };

            if !program.active || program.token != token {
                continue;
            }

            let remaining = program.max_match_amount - program.current_matched;
            if remaining <= 0 {
                continue;
            }

            // match_amount = tip * ratio / 100, capped at remaining budget.
            let raw_match = amount
                .checked_mul(program.match_ratio as i128)
                .unwrap_or(i128::MAX)
                / 100;
            matched_amount = if raw_match > remaining { remaining } else { raw_match };

            program.current_matched += matched_amount;
            if program.current_matched >= program.max_match_amount {
                program.active = false;
            }
            env.storage().persistent().set(&key, &program);
            break;
        }

        let total_credit = amount + matched_amount;
        let balance_key = DataKey::CreatorBalance(creator.clone(), token.clone());
        let total_key = DataKey::CreatorTotal(creator.clone(), token.clone());
        let new_balance: i128 =
            env.storage().persistent().get(&balance_key).unwrap_or(0) + total_credit;
        let new_total: i128 =
            env.storage().persistent().get(&total_key).unwrap_or(0) + total_credit;
        env.storage().persistent().set(&balance_key, &new_balance);
        env.storage().persistent().set(&total_key, &new_total);

        env.events().publish(
            (symbol_short!("tip_match"), creator.clone(), token.clone()),
            (sender, amount, matched_amount),
        );

        matched_amount
    }

    /// Sponsor cancels their matching program and reclaims unspent budget.
    pub fn cancel_matching_program(env: Env, sponsor: Address, program_id: u64) {
        Self::require_not_paused(&env);
        sponsor.require_auth();

        let key = DataKey::MatchingProgram(program_id);
        let mut program: MatchingProgram = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::MatchingProgramNotFound));

        if program.sponsor != sponsor {
            panic_with_error!(&env, TipJarError::Unauthorized);
        }
        if !program.active {
            panic_with_error!(&env, TipJarError::MatchingProgramInactive);
        }

        let unspent = program.max_match_amount - program.current_matched;
        program.active = false;
        env.storage().persistent().set(&key, &program);

        if unspent > 0 {
            let token_client = token::Client::new(&env, &program.token);
            token_client.transfer(&env.current_contract_address(), &sponsor, &unspent);
        }

        env.events().publish(
            (symbol_short!("match_end"), program.creator, program.token),
            (sponsor, program_id, unspent),
        );
    }

    /// Returns a matching program by ID.
    pub fn get_matching_program(env: Env, program_id: u64) -> MatchingProgram {
        env.storage()
            .persistent()
            .get(&DataKey::MatchingProgram(program_id))
            .unwrap_or_else(|| panic_with_error!(&env, TipJarError::MatchingProgramNotFound))
    }

    // ── Cross-contract composability ─────────────────────────────────────────

    /// Admin: store the DEX contract address used for token swaps.
    pub fn set_dex(env: Env, admin: Address, dex: Address) {
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);
        env.storage().instance().set(&DataKey::DexContract, &dex);
    }

    /// Admin: store the NFT contract address used for tip rewards.
    pub fn set_nft_contract(env: Env, admin: Address, nft: Address) {
        admin.require_auth();
        require_role(&env, &admin, Role::Admin);
        env.storage().instance().set(&DataKey::NftContract, &nft);
    }

    /// Tip a creator by first swapping `input_token` → tip token via the configured DEX.
    ///
    /// `input_amount`  – amount of `input_token` the sender provides.
    /// `min_output`    – minimum tip-token amount accepted (slippage guard).
    /// `tip_token`     – the whitelisted token the creator receives.
    pub fn tip_with_swap(
        env: Env,
        sender: Address,
        creator: Address,
        input_token: Address,
        tip_token: Address,
        input_amount: i128,
        min_output: i128,
    ) -> u64 {
        Self::require_not_paused(&env);
        if input_amount <= 0 {
            panic_with_error!(&env, TipJarError::InvalidAmount);
        }
        if !Self::is_whitelisted(env.clone(), tip_token.clone()) {
            panic_with_error!(&env, TipJarError::TokenNotWhitelisted);
        }
        if !env.storage().instance().has(&DataKey::DexContract) {
            panic_with_error!(&env, TipJarError::DexNotConfigured);
        }

        sender.require_auth();

        let output_amount =
            integrations::swap::swap_to_tip_token(&env, &sender, &input_token, &tip_token, input_amount, min_output);

        Self::tip(env, sender, creator, tip_token, output_amount)
    }

    /// Tip a creator and optionally mint an NFT reward to the sender when the
    /// tip meets or exceeds `nft_threshold` (in the tip token's base units).
    pub fn tip_with_nft_reward(
        env: Env,
        sender: Address,
        creator: Address,
        token: Address,
        amount: i128,
        nft_threshold: i128,
        nft_metadata: String,
    ) -> u64 {
        Self::require_not_paused(&env);

        let tip_id = Self::tip(env.clone(), sender.clone(), creator, token, amount);

        if amount >= nft_threshold {
            let nft_address: Address = env
                .storage()
                .instance()
                .get(&DataKey::NftContract)
                .unwrap_or_else(|| panic_with_error!(&env, TipJarError::NftNotConfigured));

            interfaces::nft::NftClient::new(&env, &nft_address).mint(&sender, &nft_metadata);
        }

        tip_id
    }
}

/// Increments and returns the next matching program ID.
fn next_matching_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::MatchingCounter)
        .unwrap_or(0);
    let next = id + 1;
    env.storage().instance().set(&DataKey::MatchingCounter, &next);
    next
}

/// Increments and returns the next global tip ID.
fn next_tip_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::TipCounter)
        .unwrap_or(0);
    let next = id + 1;
    env.storage().instance().set(&DataKey::TipCounter, &next);
    next
}

/// Shared write path for granting a role. Used by `grant_role` and `init`.
///
/// - Writes `role` to `DataKey::UserRole(target)` in persistent storage.
/// - Adds `target` to `DataKey::RoleMembers(role)` (deduplicating if already present).
/// - Emits a `role_grant` event.
fn grant_role_internal(env: &Env, caller: &Address, target: &Address, role: Role) {
    // Write the user → role mapping.
    env.storage()
        .persistent()
        .set(&DataKey::UserRole(target.clone()), &role);

    // Read-modify-write the role → members list.
    let members_key = DataKey::RoleMembers(role.clone());
    let mut members: Vec<Address> = env
        .storage()
        .persistent()
        .get(&members_key)
        .unwrap_or_else(|| Vec::new(env));

    // Only add if not already present (dedup).
    let already_present = members.iter().any(|a| a == *target);
    if !already_present {
        members.push_back(target.clone());
    }
    env.storage().persistent().set(&members_key, &members);

    // Emit role_grnt event: topics = (symbol, target, role), data = caller.
    env.events().publish(
        (symbol_short!("role_grnt"), target.clone(), role),
        caller.clone(),
    );
}

/// Panics with `TipJarError::Unauthorized` unless `addr` currently holds `required`.
fn require_role(env: &Env, addr: &Address, required: Role) {
    // Inline the has_role logic (has_role public fn is implemented in task 3.1).
    let holds: bool = env
        .storage()
        .persistent()
        .get(&DataKey::UserRole(addr.clone()))
        .map(|r: Role| r == required)
        .unwrap_or(false);

    if !holds {
        panic_with_error!(env, TipJarError::Unauthorized);
    }
}

/// Processes a single tip entry within a batch.
///
/// Validates amount, checks token whitelist, pre-checks sender balance,
/// performs the transfer, updates storage, and emits a tip event.
fn process_single_tip(env: &Env, sender: &Address, entry: &BatchTip) -> Result<(), TipJarError> {
    // 1. Validate amount > 0
    if entry.amount <= 0 {
        return Err(TipJarError::InvalidAmount);
    }

    // 2. Check token whitelist in INSTANCE storage
    let whitelisted: bool = env
        .storage()
        .instance()
        .get(&DataKey::TokenWhitelist(entry.token.clone()))
        .unwrap_or(false);
    if !whitelisted {
        return Err(TipJarError::TokenNotWhitelisted);
    }

    // 3. Pre-check sender balance to avoid panic on transfer
    let token_client = token::Client::new(env, &entry.token);
    let sender_balance = token_client.balance(sender);
    if sender_balance < entry.amount {
        return Err(TipJarError::InsufficientBalance);
    }

    // 4. Transfer tokens from sender to this contract
    token_client.transfer(sender, &env.current_contract_address(), &entry.amount);

    // 5. Increment CreatorBalance in PERSISTENT storage
    let balance_key = DataKey::CreatorBalance(entry.creator.clone(), entry.token.clone());
    let next_balance: i128 = env
        .storage()
        .persistent()
        .get(&balance_key)
        .unwrap_or(0)
        + entry.amount;
    env.storage().persistent().set(&balance_key, &next_balance);

    // 6. Increment CreatorTotal in PERSISTENT storage
    let total_key = DataKey::CreatorTotal(entry.creator.clone(), entry.token.clone());
    let next_total: i128 = env
        .storage()
        .persistent()
        .get(&total_key)
        .unwrap_or(0)
        + entry.amount;
    env.storage().persistent().set(&total_key, &next_total);

    // 7. Emit tip event: topics = ("tip", creator, token), data = (sender, amount)
    env.events().publish(
        (symbol_short!("tip"), entry.creator.clone(), entry.token.clone()),
        (sender.clone(), entry.amount),
    );

    update_leaderboard_aggregates(env, sender, &entry.creator, entry.amount);

    Ok(())
}

/// Registers `addr` in the participant list stored under `key` if not already present.
/// Loads `Vec<Address>` from persistent storage, appends `addr` only if absent, writes back.
fn register_participant(env: &Env, key: DataKey, addr: &Address) {
    let mut participants: Vec<Address> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    let already_present = participants.iter().any(|a| a == *addr);
    if !already_present {
        participants.push_back(addr.clone());
        env.storage().persistent().set(&key, &participants);
    }
}

/// Updates tipper and creator leaderboard aggregates for a single tip.
/// Called from `tip`, `tip_with_message`, and `process_single_tip` (on Ok path).
fn update_leaderboard_aggregates(env: &Env, tipper: &Address, creator: &Address, amount: i128) {
    let periods = [TimePeriod::AllTime, TimePeriod::Monthly, TimePeriod::Weekly];

    for period in periods.iter() {
        let bucket = bucket_id_for_period(env, period);

        // Update tipper aggregate
        let tipper_key = DataKey::TipperAggregate(tipper.clone(), bucket);
        let mut tipper_entry: LeaderboardEntry = env
            .storage()
            .persistent()
            .get(&tipper_key)
            .unwrap_or(LeaderboardEntry {
                address: tipper.clone(),
                total_amount: 0,
                tip_count: 0,
            });
        tipper_entry.total_amount += amount;
        tipper_entry.tip_count += 1;
        env.storage().persistent().set(&tipper_key, &tipper_entry);
        register_participant(env, DataKey::TipperParticipants(bucket), tipper);

        // Update creator aggregate
        let creator_key = DataKey::CreatorAggregate(creator.clone(), bucket);
        let mut creator_entry: LeaderboardEntry = env
            .storage()
            .persistent()
            .get(&creator_key)
            .unwrap_or(LeaderboardEntry {
                address: creator.clone(),
                total_amount: 0,
                tip_count: 0,
            });
        creator_entry.total_amount += amount;
        creator_entry.tip_count += 1;
        env.storage().persistent().set(&creator_key, &creator_entry);
        register_participant(env, DataKey::CreatorParticipants(bucket), creator);
    }
}

/// Panics with `TipJarError::Unauthorized` unless `addr` holds at least one role in `roles`.
fn require_any_role(env: &Env, addr: &Address, roles: &[Role]) {
    let assigned: Option<Role> = env
        .storage()
        .persistent()
        .get(&DataKey::UserRole(addr.clone()));

    let has_any = match assigned {
        Some(r) => roles.iter().any(|required| *required == r),
        None => false,
    };

    if !has_any {
        panic_with_error!(env, TipJarError::Unauthorized);
    }
}

/// Returns the bucket_id for the given period at the current ledger timestamp.
/// - AllTime → 0u32
/// - Monthly → year * 100 + month  (e.g. 202507 for July 2025)
/// - Weekly  → iso_year * 100 + iso_week (e.g. 202528 for week 28 of 2025)
///
/// All arithmetic is integer-only (no_std compatible, no floats).
fn bucket_id_for_period(env: &Env, period: &TimePeriod) -> u32 {
    match period {
        TimePeriod::AllTime => 0u32,
        TimePeriod::Monthly => {
            let ts = env.ledger().timestamp(); // Unix seconds (u64)
            let days = (ts / 86400) as i64;
            // Proleptic Gregorian calendar from days since Unix epoch (1970-01-01)
            let z = days + 719468i64;
            let era = if z >= 0 { z } else { z - 146096 } / 146097;
            let doe = z - era * 146097;
            let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
            let y = yoe + era * 400;
            let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
            let mp = (5 * doy + 2) / 153;
            let month = mp + if mp < 10 { 3 } else { -9 };
            let year = y + if month <= 2 { 1 } else { 0 };
            (year * 100 + month) as u32
        }
        TimePeriod::Weekly => {
            let ts = env.ledger().timestamp();
            let days = (ts / 86400) as i64;
            // Day of week: 0=Mon, 6=Sun (Unix epoch 1970-01-01 was a Thursday = 3)
            let dow = (days + 3).rem_euclid(7); // 0=Mon..6=Sun
            // ISO week date: find the Thursday of the current week
            let thursday = days + (3 - dow);
            // Year of that Thursday (proleptic Gregorian)
            let z = thursday + 719468i64;
            let era = if z >= 0 { z } else { z - 146096 } / 146097;
            let doe = z - era * 146097;
            let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
            let iso_year = yoe + era * 400;
            // Day of year for Jan 4 of iso_year (always in week 1)
            // ISO week number: (doy_of_thursday - doy_of_jan4_thursday) / 7 + 1
            // Simpler: week = (day_of_year_of_thursday + 10) / 7  where doy is 1-based
            // Use: week = (doy_of_thursday + 10) / 7  where doy is 0-based
            let doy_thu = doe - (365 * yoe + yoe / 4 - yoe / 100); // 0-based
            let iso_week = (doy_thu + 10) / 7;
            (iso_year * 100 + iso_week) as u32
        }
    }
}

/// Loads all participant aggregates for a given bucket, sorts descending by
/// `(total_amount, tip_count)`, and returns the requested page slice.
///
/// - `participants_key`: storage key for the `Vec<Address>` participant list
/// - `is_tipper`: if true, loads `TipperAggregate`; otherwise `CreatorAggregate`
/// - `bucket`: the time-period bucket id
/// - `offset` / `limit`: pagination parameters (limit capped at 100)
fn ranked_page(
    env: &Env,
    participants_key: DataKey,
    is_tipper: bool,
    bucket: u32,
    offset: u32,
    limit: u32,
) -> Vec<LeaderboardEntry> {
    // 1. Zero limit → empty immediately
    if limit == 0 {
        return Vec::new(env);
    }

    // 2. Load participant list
    let participants: Vec<Address> = env
        .storage()
        .persistent()
        .get(&participants_key)
        .unwrap_or_else(|| Vec::new(env));

    let total = participants.len();

    // 3. Empty list or offset past end → empty
    if total == 0 || offset >= total {
        return Vec::new(env);
    }

    // 4. Build a soroban Vec of LeaderboardEntry values
    let mut entries: Vec<LeaderboardEntry> = Vec::new(env);
    for addr in participants.iter() {
        let agg_key = if is_tipper {
            DataKey::TipperAggregate(addr.clone(), bucket)
        } else {
            DataKey::CreatorAggregate(addr.clone(), bucket)
        };
        let entry: LeaderboardEntry = env
            .storage()
            .persistent()
            .get(&agg_key)
            .unwrap_or(LeaderboardEntry {
                address: addr.clone(),
                total_amount: 0,
                tip_count: 0,
            });
        entries.push_back(entry);
    }

    // 5. Selection sort descending by (total_amount, tip_count)
    let n = entries.len();
    let mut i = 0u32;
    while i < n {
        let mut best = i;
        let mut j = i + 1;
        while j < n {
            let a = entries.get(best).unwrap();
            let b = entries.get(j).unwrap();
            if b.total_amount > a.total_amount
                || (b.total_amount == a.total_amount && b.tip_count > a.tip_count)
            {
                best = j;
            }
            j += 1;
        }
        if best != i {
            let tmp_i = entries.get(i).unwrap();
            let tmp_best = entries.get(best).unwrap();
            entries.set(i, tmp_best);
            entries.set(best, tmp_i);
        }
        i += 1;
    }

    // 6. Clamp limit to 100
    let effective_limit = if limit > 100 { 100 } else { limit };

    // 7. Slice [offset .. offset + effective_limit]
    let end = {
        let candidate = offset + effective_limit;
        if candidate > total { total } else { candidate }
    };

    let mut result: Vec<LeaderboardEntry> = Vec::new(env);
    let mut idx = offset;
    while idx < end {
        result.push_back(entries.get(idx).unwrap());
        idx += 1;
    }

    result
}

/// Appends all `TipWithMessage` records for `creator` into `out`.
fn collect_creator_messages(env: &Env, creator: &Address, out: &mut Vec<TipWithMessage>) {
    let messages: Vec<TipWithMessage> = env
        .storage()
        .persistent()
        .get(&DataKey::CreatorMessages(creator.clone()))
        .unwrap_or_else(|| Vec::new(env));
    for m in messages.iter() {
        out.push_back(m);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events as _, Ledger as _}, token, Address, Env};

    /// Returns (env, contract_id, token_id_1, token_id_2, admin).
    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_id_1 = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_id_2 = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let admin = Address::generate(&env);
        let contract_id = env.register(TipJarContract, ());
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);
        tipjar_client.init(&admin);
        tipjar_client.add_token(&admin, &token_id_1);

        (env, contract_id, token_id_1, token_id_2, admin)
    }

    #[test]
    fn test_tipping_functionality_multi_token() {
        let (env, contract_id, token_id_1, token_id_2, admin) = setup();
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);
        let token_client_1 = token::Client::new(&env, &token_id_1);
        let token_admin_client_1 = token::StellarAssetClient::new(&env, &token_id_1);
        let token_admin_client_2 = token::StellarAssetClient::new(&env, &token_id_2);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin_client_1.mint(&sender, &1_000);
        token_admin_client_2.mint(&sender, &1_000);

        // Success for whitelisted token 1
        tipjar_client.tip(&sender, &creator, &token_id_1, &250);
        assert_eq!(token_client_1.balance(&sender), 750);
        assert_eq!(token_client_1.balance(&contract_id), 250);
        assert_eq!(tipjar_client.get_total_tips(&creator, &token_id_1), 250);

        // Failure for non-whitelisted token 2
        let result = tipjar_client.try_tip(&sender, &creator, &token_id_2, &100);
        assert!(result.is_err());

        // Success after whitelisting token 2
        tipjar_client.add_token(&admin, &token_id_2);
        tipjar_client.tip(&sender, &creator, &token_id_2, &300);
        assert_eq!(tipjar_client.get_total_tips(&creator, &token_id_2), 300);
    }

    #[test]
    fn test_balance_tracking_and_withdraw() {
        let (env, contract_id, token_id, _, admin) = setup();
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);
        let token_client = token::Client::new(&env, &token_id);
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
        let sender_a = Address::generate(&env);
        let sender_b = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin_client.mint(&sender_a, &1_000);
        token_admin_client.mint(&sender_b, &1_000);

        tipjar_client.tip(&sender_a, &creator, &token_id, &100);
        tipjar_client.tip(&sender_b, &creator, &token_id, &300);

        assert_eq!(tipjar_client.get_total_tips(&creator, &token_id), 400);
        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id), 400);

        // Grant Creator role so withdraw passes role check
        tipjar_client.grant_role(&admin, &creator, &Role::Creator);
        tipjar_client.withdraw(&creator, &token_id);

        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id), 0);
        assert_eq!(token_client.balance(&creator), 400);
    }

    #[test]
    fn test_multi_token_balance_and_withdraw() {
        let (env, contract_id, token_id_1, token_id_2, admin) = setup();
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);
        let token_client_1 = token::Client::new(&env, &token_id_1);
        let token_client_2 = token::Client::new(&env, &token_id_2);
        let token_admin_client_1 = token::StellarAssetClient::new(&env, &token_id_1);
        let token_admin_client_2 = token::StellarAssetClient::new(&env, &token_id_2);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        tipjar_client.add_token(&admin, &token_id_2);
        token_admin_client_1.mint(&sender, &1_000);
        token_admin_client_2.mint(&sender, &1_000);

        tipjar_client.tip(&sender, &creator, &token_id_1, &100);
        tipjar_client.tip(&sender, &creator, &token_id_2, &300);

        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id_1), 100);
        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id_2), 300);

        // Grant Creator role so withdraw passes role check
        tipjar_client.grant_role(&admin, &creator, &Role::Creator);

        // Withdraw token 1
        tipjar_client.withdraw(&creator, &token_id_1);
        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id_1), 0);
        assert_eq!(token_client_1.balance(&creator), 100);
        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id_2), 300);

        // Withdraw token 2
        tipjar_client.withdraw(&creator, &token_id_2);
        assert_eq!(tipjar_client.get_withdrawable_balance(&creator, &token_id_2), 0);
        assert_eq!(token_client_2.balance(&creator), 300);
    }

    #[test]
    #[should_panic]
    fn test_invalid_tip_amount() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin_client.mint(&sender, &100);
        tipjar_client.tip(&sender, &creator, &token_id_1, &0);
    }

    #[test]
    fn test_pause_unpause() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);

        tipjar_client.pause(&admin);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        let result = tipjar_client.try_tip(&sender, &creator, &token_id_1, &100);
        assert!(result.is_err());

        tipjar_client.unpause(&admin);

        let token_admin_client = token::StellarAssetClient::new(&env, &token_id_1);
        token_admin_client.mint(&sender, &100);
        tipjar_client.tip(&sender, &creator, &token_id_1, &100);
        assert_eq!(tipjar_client.get_total_tips(&creator, &token_id_1), 100);
    }

    #[test]
    #[should_panic]
    fn test_pause_admin_only() {
        let (env, contract_id, _, _, _) = setup();
        let tipjar_client = TipJarContractClient::new(&env, &contract_id);
        let non_admin = Address::generate(&env);

        tipjar_client.pause(&non_admin);
    }

    // ── Task 6.1: grant_role / has_role happy paths ──────────────────────────

    #[test]
    fn test_grant_role_admin_variant() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        client.grant_role(&admin, &target, &Role::Admin);
        assert!(client.has_role(&target, &Role::Admin));
    }

    #[test]
    fn test_grant_role_moderator_variant() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        client.grant_role(&admin, &target, &Role::Moderator);
        assert!(client.has_role(&target, &Role::Moderator));
    }

    #[test]
    fn test_grant_role_creator_variant() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        client.grant_role(&admin, &target, &Role::Creator);
        assert!(client.has_role(&target, &Role::Creator));
    }

    #[test]
    fn test_grant_role_idempotent_no_duplicate_in_role_members() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        // Grant the same role twice.
        client.grant_role(&admin, &target, &Role::Moderator);
        client.grant_role(&admin, &target, &Role::Moderator);

        // has_role must still be true.
        assert!(client.has_role(&target, &Role::Moderator));

        // RoleMembers must not contain a duplicate entry.
        let members: Vec<Address> = env
            .as_contract(&contract_id, || {
                env.storage()
                    .persistent()
                    .get(&DataKey::RoleMembers(Role::Moderator))
                    .unwrap_or_else(|| Vec::new(&env))
            });
        let count = members.iter().filter(|a| *a == target).count();
        assert_eq!(count, 1, "target should appear exactly once in RoleMembers");
    }

    // ── Task 6.2: revoke_role happy path and error cases ─────────────────────

    #[test]
    fn test_revoke_role_removes_role() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        client.grant_role(&admin, &target, &Role::Moderator);
        assert!(client.has_role(&target, &Role::Moderator));

        client.revoke_role(&admin, &target);
        assert!(!client.has_role(&target, &Role::Moderator));
    }

    #[test]
    fn test_revoke_role_unassigned_returns_role_not_found() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let target = Address::generate(&env);

        let result = client.try_revoke_role(&admin, &target);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::RoleNotFound.into()
        );
    }

    #[test]
    fn test_non_admin_grant_role_returns_unauthorized() {
        let (env, contract_id, _, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let non_admin = Address::generate(&env);
        let target = Address::generate(&env);

        let result = client.try_grant_role(&non_admin, &target, &Role::Creator);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::Unauthorized.into()
        );
    }

    #[test]
    fn test_non_admin_revoke_role_returns_unauthorized() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let non_admin = Address::generate(&env);
        let target = Address::generate(&env);

        // Give target a role so the revoke would otherwise succeed.
        client.grant_role(&admin, &target, &Role::Creator);

        let result = client.try_revoke_role(&non_admin, &target);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::Unauthorized.into()
        );
    }

    // ── Task 6.3: enforced existing functions ────────────────────────────────

    #[test]
    fn test_moderator_can_pause_and_unpause() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let moderator = Address::generate(&env);

        client.grant_role(&admin, &moderator, &Role::Moderator);

        // Should succeed without panic.
        client.pause(&moderator);
        client.unpause(&moderator);
    }

    #[test]
    fn test_creator_cannot_pause() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let creator = Address::generate(&env);

        client.grant_role(&admin, &creator, &Role::Creator);

        let result = client.try_pause(&creator);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::Unauthorized.into()
        );
    }

    #[test]
    fn test_moderator_cannot_add_token() {
        let (env, contract_id, _, token_id_2, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let moderator = Address::generate(&env);

        client.grant_role(&admin, &moderator, &Role::Moderator);

        let result = client.try_add_token(&moderator, &token_id_2);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::Unauthorized.into()
        );
    }

    #[test]
    fn test_non_creator_cannot_withdraw() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let moderator = Address::generate(&env);

        client.grant_role(&admin, &moderator, &Role::Moderator);

        // Moderator has no Creator role — withdraw must be rejected.
        let result = client.try_withdraw(&moderator, &token_id_1);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::Unauthorized.into()
        );
    }

    #[test]
    fn test_init_auto_grants_admin_role() {
        // setup() already calls init(); verify the admin address has Admin role.
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);

        assert!(client.has_role(&admin, &Role::Admin));
    }

    // ── Task 3.2: tip_batch control flow ─────────────────────────────────────

    #[test]
    fn test_tip_batch_empty_returns_empty_vec() {
        let (env, contract_id, _, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let sender = Address::generate(&env);

        let tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        let results = client.tip_batch(&sender, &tips);

        assert_eq!(results.len(), 0);
        // No auth should have been recorded (empty batch short-circuits before require_auth).
        let auths = env.auths();
        assert!(
            auths.is_empty(),
            "no auth should be recorded for an empty batch"
        );
    }

    #[test]
    fn test_tip_batch_single_valid_entry() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &500);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 100,
        });

        let results = client.tip_batch(&sender, &tips);

        assert_eq!(results.len(), 1);
        assert_eq!(results.get(0).unwrap(), Ok(()));

        // Storage updated
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 100);
        assert_eq!(client.get_total_tips(&creator, &token_id_1), 100);
    }

    #[test]
    fn test_tip_batch_51_entries_returns_batch_too_large() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &100_000);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        for _ in 0..51 {
            tips.push_back(BatchTip {
                creator: creator.clone(),
                token: token_id_1.clone(),
                amount: 1,
            });
        }

        let result = client.try_tip_batch(&sender, &tips);
        assert!(result.is_err(), "51-entry batch should return an error");
    }

    #[test]
    fn test_tip_batch_exactly_50_entries_succeeds() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        // Mint enough for 50 tips of 10 each
        token_admin.mint(&sender, &500);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        for _ in 0..50 {
            tips.push_back(BatchTip {
                creator: creator.clone(),
                token: token_id_1.clone(),
                amount: 10,
            });
        }

        let results = client.tip_batch(&sender, &tips);

        assert_eq!(results.len(), 50);
        for i in 0..50 {
            assert_eq!(results.get(i).unwrap(), Ok(()));
        }

        // All 50 tips accumulated
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 500);
        assert_eq!(client.get_total_tips(&creator, &token_id_1), 500);
    }

    #[test]
    fn test_tip_batch_paused_rejects_batch() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &500);
        client.pause(&admin);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 100,
        });

        let result = client.try_tip_batch(&sender, &tips);
        assert!(result.is_err(), "paused contract should reject tip_batch");

        // No storage changes
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 0);
        assert_eq!(client.get_total_tips(&creator, &token_id_1), 0);
    }

    // ── Task 5.1: mixed and accumulation scenarios ────────────────────────────

    #[test]
    fn test_tip_batch_mixed_invalid_amount() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &500);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 100, // valid
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 0, // invalid
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 50, // valid
        });

        let results = client.tip_batch(&sender, &tips);

        // Result vec length == input length
        assert_eq!(results.len(), 3);
        assert_eq!(results.get(0).unwrap(), Ok(()));
        assert_eq!(results.get(1).unwrap(), Err(TipJarError::InvalidAmount));
        assert_eq!(results.get(2).unwrap(), Ok(()));

        // Only valid entries committed: 100 + 50 = 150
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 150);
        assert_eq!(client.get_total_tips(&creator, &token_id_1), 150);
    }

    #[test]
    fn test_tip_batch_mixed_non_whitelisted_token() {
        let (env, contract_id, token_id_1, token_id_2, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin_1 = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        // token_id_2 is NOT whitelisted (setup only whitelists token_id_1)
        token_admin_1.mint(&sender, &500);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 100, // valid, whitelisted
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_2.clone(),
            amount: 50, // invalid, not whitelisted
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 75, // valid, whitelisted
        });

        let results = client.tip_batch(&sender, &tips);

        assert_eq!(results.len(), 3);
        assert_eq!(results.get(0).unwrap(), Ok(()));
        assert_eq!(
            results.get(1).unwrap(),
            Err(TipJarError::TokenNotWhitelisted)
        );
        assert_eq!(results.get(2).unwrap(), Ok(()));

        // Only whitelisted entries committed
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 175);
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_2), 0);
    }

    #[test]
    fn test_tip_batch_mixed_insufficient_balance() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        // Mint only 100 tokens — not enough for a 200-token tip
        token_admin.mint(&sender, &150);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 50, // valid, sufficient
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 200, // insufficient balance
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 50, // valid, sufficient (100 remaining after first tip)
        });

        let results = client.tip_batch(&sender, &tips);

        assert_eq!(results.len(), 3);
        assert_eq!(results.get(0).unwrap(), Ok(()));
        assert_eq!(
            results.get(1).unwrap(),
            Err(TipJarError::InsufficientBalance)
        );
        assert_eq!(results.get(2).unwrap(), Ok(()));

        // 50 + 50 = 100 committed
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 100);
    }

    #[test]
    fn test_tip_batch_accumulates_same_creator() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 100,
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 200,
        });
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 300,
        });

        let results = client.tip_batch(&sender, &tips);

        assert_eq!(results.len(), 3);
        for i in 0..3 {
            assert_eq!(results.get(i).unwrap(), Ok(()));
        }

        // 100 + 200 + 300 = 600 accumulated for the same creator
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id_1), 600);
        assert_eq!(client.get_total_tips(&creator, &token_id_1), 600);
    }

    #[test]
    fn test_tip_batch_events_match_single_tip() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);

        // Call single tip and capture the event
        client.tip(&sender, &creator, &token_id_1, &100);
        let single_events = env.events().all();
        let (single_contract, single_topics, _) = single_events.last().unwrap();

        // Call tip_batch with one equivalent entry
        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id_1.clone(),
            amount: 100,
        });
        client.tip_batch(&sender, &tips);

        let batch_events = env.events().all();
        let (batch_contract, batch_topics, _) = batch_events.last().unwrap();

        // Contract address and topics (symbol, creator, token) must match
        assert_eq!(
            single_contract, batch_contract,
            "contract address should match"
        );
        assert_eq!(
            single_topics, batch_topics,
            "event topics (\"tip\", creator, token) should match"
        );
    }

    // ── Task 8.1: Integration and tiebreaker tests ────────────────────────────

    #[test]
    fn test_leaderboard_tip_updates_all_periods() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);
        client.tip(&sender, &creator, &token_id, &200);

        // AllTime tipper
        let tippers_all = client.get_top_tippers(&TimePeriod::AllTime, &0, &10);
        assert_eq!(tippers_all.len(), 1);
        assert_eq!(tippers_all.get(0).unwrap().total_amount, 200);
        assert_eq!(tippers_all.get(0).unwrap().tip_count, 1);

        // AllTime creator
        let creators_all = client.get_top_creators(&TimePeriod::AllTime, &0, &10);
        assert_eq!(creators_all.len(), 1);
        assert_eq!(creators_all.get(0).unwrap().total_amount, 200);
        assert_eq!(creators_all.get(0).unwrap().tip_count, 1);

        // Monthly tipper
        let tippers_monthly = client.get_top_tippers(&TimePeriod::Monthly, &0, &10);
        assert_eq!(tippers_monthly.len(), 1);
        assert_eq!(tippers_monthly.get(0).unwrap().total_amount, 200);
        assert_eq!(tippers_monthly.get(0).unwrap().tip_count, 1);

        // Monthly creator
        let creators_monthly = client.get_top_creators(&TimePeriod::Monthly, &0, &10);
        assert_eq!(creators_monthly.len(), 1);
        assert_eq!(creators_monthly.get(0).unwrap().total_amount, 200);
        assert_eq!(creators_monthly.get(0).unwrap().tip_count, 1);

        // Weekly tipper
        let tippers_weekly = client.get_top_tippers(&TimePeriod::Weekly, &0, &10);
        assert_eq!(tippers_weekly.len(), 1);
        assert_eq!(tippers_weekly.get(0).unwrap().total_amount, 200);
        assert_eq!(tippers_weekly.get(0).unwrap().tip_count, 1);

        // Weekly creator
        let creators_weekly = client.get_top_creators(&TimePeriod::Weekly, &0, &10);
        assert_eq!(creators_weekly.len(), 1);
        assert_eq!(creators_weekly.get(0).unwrap().total_amount, 200);
        assert_eq!(creators_weekly.get(0).unwrap().tip_count, 1);
    }

    #[test]
    fn test_leaderboard_tip_with_message_updates_aggregates() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);

        let message = soroban_sdk::String::from_str(&env, "hello");
        let metadata = soroban_sdk::Map::new(&env);
        client.tip_with_message(&sender, &creator, &token_id, &150, &message, &metadata);

        // AllTime tipper
        let tippers = client.get_top_tippers(&TimePeriod::AllTime, &0, &10);
        assert_eq!(tippers.len(), 1);
        assert_eq!(tippers.get(0).unwrap().total_amount, 150);
        assert_eq!(tippers.get(0).unwrap().tip_count, 1);

        // AllTime creator
        let creators = client.get_top_creators(&TimePeriod::AllTime, &0, &10);
        assert_eq!(creators.len(), 1);
        assert_eq!(creators.get(0).unwrap().total_amount, 150);
        assert_eq!(creators.get(0).unwrap().tip_count, 1);
    }

    #[test]
    fn test_leaderboard_tip_batch_successful_entry_updates_aggregates() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);

        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator.clone(),
            token: token_id.clone(),
            amount: 300,
        });
        let results = client.tip_batch(&sender, &tips);
        assert_eq!(results.get(0).unwrap(), Ok(()));

        let tippers = client.get_top_tippers(&TimePeriod::AllTime, &0, &10);
        assert_eq!(tippers.len(), 1);
        assert_eq!(tippers.get(0).unwrap().total_amount, 300);
        assert_eq!(tippers.get(0).unwrap().tip_count, 1);

        let creators = client.get_top_creators(&TimePeriod::AllTime, &0, &10);
        assert_eq!(creators.len(), 1);
        assert_eq!(creators.get(0).unwrap().total_amount, 300);
        assert_eq!(creators.get(0).unwrap().tip_count, 1);
    }

    #[test]
    fn test_leaderboard_tip_batch_failed_entry_no_aggregate_update() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator_valid = Address::generate(&env);
        let creator_invalid = Address::generate(&env);

        token_admin.mint(&sender, &1_000);

        // Mix: valid entry (amount=100), then invalid entry (amount=0)
        let mut tips: soroban_sdk::Vec<BatchTip> = soroban_sdk::Vec::new(&env);
        tips.push_back(BatchTip {
            creator: creator_valid.clone(),
            token: token_id.clone(),
            amount: 100,
        });
        tips.push_back(BatchTip {
            creator: creator_invalid.clone(),
            token: token_id.clone(),
            amount: 0, // invalid — should not update aggregates
        });

        let results = client.tip_batch(&sender, &tips);
        assert_eq!(results.get(0).unwrap(), Ok(()));
        assert_eq!(results.get(1).unwrap(), Err(TipJarError::InvalidAmount));

        // Valid creator has aggregate
        let creators = client.get_top_creators(&TimePeriod::AllTime, &0, &10);
        assert_eq!(creators.len(), 1);
        assert_eq!(creators.get(0).unwrap().address, creator_valid);
        assert_eq!(creators.get(0).unwrap().total_amount, 100);

        // Invalid creator has no aggregate (not in participant list)
        let tippers = client.get_top_tippers(&TimePeriod::AllTime, &0, &10);
        assert_eq!(tippers.len(), 1); // only the sender from the valid entry
        // Confirm the invalid creator is absent from creators list
        let found_invalid = creators.iter().any(|e| e.address == creator_invalid);
        assert!(!found_invalid, "failed entry's creator should not appear in leaderboard");
    }

    #[test]
    fn test_leaderboard_tiebreaker_ordering() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        // tipper_a: 1 tip of 100 → total_amount=100, tip_count=1
        let tipper_a = Address::generate(&env);
        token_admin.mint(&tipper_a, &1_000);
        let creator_a = Address::generate(&env);
        client.tip(&tipper_a, &creator_a, &token_id, &100);

        // tipper_b: 2 tips of 50 each → total_amount=100, tip_count=2
        let tipper_b = Address::generate(&env);
        token_admin.mint(&tipper_b, &1_000);
        let creator_b = Address::generate(&env);
        client.tip(&tipper_b, &creator_b, &token_id, &50);
        client.tip(&tipper_b, &creator_b, &token_id, &50);

        let tippers = client.get_top_tippers(&TimePeriod::AllTime, &0, &10);
        assert_eq!(tippers.len(), 2);

        let first = tippers.get(0).unwrap();
        let second = tippers.get(1).unwrap();

        // Both have equal total_amount=100; tipper_b has higher tip_count=2 so comes first
        assert_eq!(first.total_amount, 100);
        assert_eq!(second.total_amount, 100);
        assert!(
            first.tip_count > second.tip_count,
            "higher tip_count should rank first when total_amount is equal"
        );
        assert_eq!(first.address, tipper_b);
        assert_eq!(second.address, tipper_a);
    }

    #[test]
    fn test_leaderboard_zero_limit_returns_empty() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);
        client.tip(&sender, &creator, &token_id, &100);

        let result = client.get_top_tippers(&TimePeriod::AllTime, &0, &0);
        assert_eq!(result.len(), 0, "limit=0 should return empty vec");
    }

    #[test]
    fn test_leaderboard_offset_past_end_returns_empty() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        // Create 2 tippers
        let sender_a = Address::generate(&env);
        let sender_b = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender_a, &1_000);
        token_admin.mint(&sender_b, &1_000);
        client.tip(&sender_a, &creator, &token_id, &100);
        client.tip(&sender_b, &creator, &token_id, &200);

        // offset=10 is past the 2 tippers
        let result = client.get_top_tippers(&TimePeriod::AllTime, &10, &5);
        assert_eq!(result.len(), 0, "offset past end should return empty vec");
    }

    #[test]
    fn test_leaderboard_queries_available_while_paused() {
        let (env, contract_id, token_id, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sender, &1_000);
        client.tip(&sender, &creator, &token_id, &100);

        // Pause the contract
        client.pause(&admin);

        // Queries must succeed without panic even while paused
        let tippers = client.get_top_tippers(&TimePeriod::AllTime, &0, &10);
        let creators = client.get_top_creators(&TimePeriod::AllTime, &0, &10);

        assert_eq!(tippers.len(), 1, "get_top_tippers should work while paused");
        assert_eq!(creators.len(), 1, "get_top_creators should work while paused");
    }

    // ── Helper: advance ledger timestamp ─────────────────────────────────────

    fn advance_time(env: &Env, new_ts: u64) {
        env.ledger().with_mut(|li| {
            li.timestamp = new_ts;
        });
    }

    // ── Task 6.1: tip_locked unit tests ──────────────────────────────────────

    #[test]
    fn test_tip_locked_happy_path() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let token_client = token::Client::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let current_ts = env.ledger().timestamp();
        let unlock_ts = current_ts + 1000;

        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);
        assert_eq!(tip_id, 0, "first tip_id should be 0");

        // Verify stored record
        let locked = client.get_locked_tip(&creator, &tip_id);
        assert_eq!(locked.sender, sender);
        assert_eq!(locked.creator, creator);
        assert_eq!(locked.token, token_id_1);
        assert_eq!(locked.amount, 500);
        assert_eq!(locked.unlock_timestamp, unlock_ts);

        // Verify sender balance decreased
        assert_eq!(token_client.balance(&sender), 500);
        assert_eq!(token_client.balance(&contract_id), 500);
    }

    #[test]
    fn test_tip_locked_token_not_whitelisted() {
        let (env, contract_id, _, token_id_2, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_2);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let result = client.try_tip_locked(&sender, &creator, &token_id_2, &500, &unlock_ts);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::TokenNotWhitelisted.into());
    }

    #[test]
    fn test_tip_locked_invalid_amount() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let result = client.try_tip_locked(&sender, &creator, &token_id_1, &0, &unlock_ts);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::InvalidAmount.into());
    }

    #[test]
    fn test_tip_locked_invalid_unlock_time() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        // unlock_timestamp == current ledger timestamp (not strictly future)
        let current_ts = env.ledger().timestamp();
        let result = client.try_tip_locked(&sender, &creator, &token_id_1, &100, &current_ts);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::InvalidUnlockTime.into());
    }

    #[test]
    fn test_tip_locked_paused() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);

        client.pause(&admin);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        let unlock_ts = env.ledger().timestamp() + 1000;

        let result = client.try_tip_locked(&sender, &creator, &token_id_1, &100, &unlock_ts);
        assert!(result.is_err());
    }

    // ── Task 6.2: withdraw_locked unit tests ─────────────────────────────────

    #[test]
    fn test_withdraw_locked_happy_path() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let token_client = token::Client::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        // Advance time past unlock
        advance_time(&env, unlock_ts + 1);

        // Grant Creator role
        client.grant_role(&admin, &creator, &Role::Creator);

        let creator_balance_before = token_client.balance(&creator);
        client.withdraw_locked(&creator, &tip_id);

        // Tokens transferred to creator
        assert_eq!(token_client.balance(&creator), creator_balance_before + 500);
        assert_eq!(token_client.balance(&contract_id), 0);

        // Record removed
        let result = client.try_get_locked_tip(&creator, &tip_id);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::LockedTipNotFound.into());
    }

    #[test]
    fn test_withdraw_locked_tip_still_locked() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        // Grant Creator role but do NOT advance time
        client.grant_role(&admin, &creator, &Role::Creator);

        let result = client.try_withdraw_locked(&creator, &tip_id);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::TipStillLocked.into());
    }

    #[test]
    fn test_withdraw_locked_unauthorized() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        // Advance time but do NOT grant Creator role
        advance_time(&env, unlock_ts + 1);

        let result = client.try_withdraw_locked(&creator, &tip_id);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::Unauthorized.into());
    }

    #[test]
    fn test_withdraw_locked_not_found() {
        let (env, contract_id, _, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        client.grant_role(&admin, &creator, &Role::Creator);

        let result = client.try_withdraw_locked(&creator, &99);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::LockedTipNotFound.into());
    }

    #[test]
    fn test_withdraw_locked_paused() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        advance_time(&env, unlock_ts + 1);
        client.grant_role(&admin, &creator, &Role::Creator);
        client.pause(&admin);

        let result = client.try_withdraw_locked(&creator, &tip_id);
        assert!(result.is_err());
    }

    // ── Task 6.3: get_locked_tip unit tests ──────────────────────────────────

    #[test]
    fn test_get_locked_tip_not_found() {
        let (env, contract_id, _, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let result = client.try_get_locked_tip(&creator, &0);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::LockedTipNotFound.into());
    }

    #[test]
    fn test_get_locked_tip_while_paused() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        client.pause(&admin);

        // get_locked_tip should succeed even while paused
        let locked = client.get_locked_tip(&creator, &tip_id);
        assert_eq!(locked.amount, 500);
    }

    // ── Task 6.4: event emission unit tests ──────────────────────────────────

    #[test]
    fn test_tip_locked_event() {
        let (env, contract_id, token_id_1, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        let events = env.events().all();
        let last = events.last().unwrap();
        // Topics: (symbol "tip_lckd", creator, token)
        let topics: soroban_sdk::Vec<soroban_sdk::Val> = last.1;
        let topic_sym: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get(0).unwrap());
        assert_eq!(topic_sym, soroban_sdk::Symbol::new(&env, "tip_lckd"));
    }

    #[test]
    fn test_withdraw_locked_event() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &1_000);

        let unlock_ts = env.ledger().timestamp() + 1000;
        let tip_id = client.tip_locked(&sender, &creator, &token_id_1, &500, &unlock_ts);

        advance_time(&env, unlock_ts + 1);
        client.grant_role(&admin, &creator, &Role::Creator);
        client.withdraw_locked(&creator, &tip_id);

        let events = env.events().all();
        let last = events.last().unwrap();
        let topics: soroban_sdk::Vec<soroban_sdk::Val> = last.1;
        let topic_sym: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get(0).unwrap());
        assert_eq!(topic_sym, soroban_sdk::Symbol::new(&env, "lck_wdrw"));
    }

    // ── Task 7.1: multiple concurrent locked tips ─────────────────────────────

    #[test]
    fn test_multiple_concurrent_locked_tips() {
        let (env, contract_id, token_id_1, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id_1);
        let token_client = token::Client::new(&env, &token_id_1);

        let sender = Address::generate(&env);
        let creator = Address::generate(&env);
        token_admin.mint(&sender, &3_000);

        let base_ts = env.ledger().timestamp();
        let unlock_ts_0 = base_ts + 100;
        let unlock_ts_1 = base_ts + 200;
        let unlock_ts_2 = base_ts + 300;

        // Create 3 locked tips
        let id0 = client.tip_locked(&sender, &creator, &token_id_1, &100, &unlock_ts_0);
        let id1 = client.tip_locked(&sender, &creator, &token_id_1, &200, &unlock_ts_1);
        let id2 = client.tip_locked(&sender, &creator, &token_id_1, &300, &unlock_ts_2);

        assert_eq!(id0, 0);
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);

        // Grant Creator role
        client.grant_role(&admin, &creator, &Role::Creator);

        // Advance past first unlock only
        advance_time(&env, unlock_ts_0 + 1);

        // Withdraw tip 0
        client.withdraw_locked(&creator, &id0);
        assert_eq!(token_client.balance(&creator), 100);

        // Tips 1 and 2 still exist
        let tip1 = client.get_locked_tip(&creator, &id1);
        assert_eq!(tip1.amount, 200);
        let tip2 = client.get_locked_tip(&creator, &id2);
        assert_eq!(tip2.amount, 300);

        // Tip 0 is gone
        let gone = client.try_get_locked_tip(&creator, &id0);
        assert_eq!(gone.unwrap_err().unwrap(), TipJarError::LockedTipNotFound.into());

        // Advance past all unlock times
        advance_time(&env, unlock_ts_2 + 1);

        // Withdraw remaining tips
        client.withdraw_locked(&creator, &id1);
        client.withdraw_locked(&creator, &id2);

        assert_eq!(token_client.balance(&creator), 600);
        assert_eq!(token_client.balance(&contract_id), 0);

        // All records removed
        assert_eq!(
            client.try_get_locked_tip(&creator, &id1).unwrap_err().unwrap(),
            TipJarError::LockedTipNotFound.into()
        );
        assert_eq!(
            client.try_get_locked_tip(&creator, &id2).unwrap_err().unwrap(),
            TipJarError::LockedTipNotFound.into()
        );
    }

    // ── Matching program tests ────────────────────────────────────────────────

    #[test]
    fn test_match_calculation_1_to_1() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let token_client = token::Client::new(&env, &token_id);
        let sponsor = Address::generate(&env);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sponsor, &1_000);
        token_admin.mint(&sender, &500);

        // 1:1 match, budget = 500
        let program_id = client.create_matching_program(
            &sponsor, &creator, &token_id, &100u32, &500i128,
        );
        assert_eq!(token_client.balance(&sponsor), 500); // 500 deposited

        let matched = client.tip_with_match(&sender, &creator, &token_id, &200);

        assert_eq!(matched, 200); // 1:1
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id), 400);
        assert_eq!(client.get_total_tips(&creator, &token_id), 400);

        let program = client.get_matching_program(&program_id);
        assert_eq!(program.current_matched, 200);
        assert!(program.active);
    }

    #[test]
    fn test_match_calculation_2_to_1() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sponsor = Address::generate(&env);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sponsor, &1_000);
        token_admin.mint(&sender, &500);

        // 2:1 match (ratio=200), budget = 1000
        client.create_matching_program(&sponsor, &creator, &token_id, &200u32, &1_000i128);

        let matched = client.tip_with_match(&sender, &creator, &token_id, &100);

        assert_eq!(matched, 200); // 2:1
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id), 300);
    }

    #[test]
    fn test_match_limit_caps_at_budget() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sponsor = Address::generate(&env);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sponsor, &150);
        token_admin.mint(&sender, &1_000);

        // 1:1 match but only 150 budget
        client.create_matching_program(&sponsor, &creator, &token_id, &100u32, &150i128);

        // Tip of 200 — match capped at 150
        let matched = client.tip_with_match(&sender, &creator, &token_id, &200);
        assert_eq!(matched, 150);
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id), 350);
    }

    #[test]
    fn test_program_exhaustion_deactivates() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sponsor = Address::generate(&env);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sponsor, &100);
        token_admin.mint(&sender, &1_000);

        let program_id =
            client.create_matching_program(&sponsor, &creator, &token_id, &100u32, &100i128);

        // Exhaust the budget in one tip
        let matched = client.tip_with_match(&sender, &creator, &token_id, &100);
        assert_eq!(matched, 100);

        let program = client.get_matching_program(&program_id);
        assert!(!program.active); // exhausted

        // Next tip gets no match
        let matched2 = client.tip_with_match(&sender, &creator, &token_id, &100);
        assert_eq!(matched2, 0);
    }

    #[test]
    fn test_cancel_matching_program_returns_unspent() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let token_client = token::Client::new(&env, &token_id);
        let sponsor = Address::generate(&env);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sponsor, &500);
        token_admin.mint(&sender, &200);

        let program_id =
            client.create_matching_program(&sponsor, &creator, &token_id, &100u32, &500i128);

        // Use 100 of the budget
        client.tip_with_match(&sender, &creator, &token_id, &100);

        // Cancel — should return 400 unspent
        client.cancel_matching_program(&sponsor, &program_id);
        assert_eq!(token_client.balance(&sponsor), 400);

        let program = client.get_matching_program(&program_id);
        assert!(!program.active);
    }

    #[test]
    fn test_multiple_concurrent_matching_programs() {
        let (env, contract_id, token_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sponsor1 = Address::generate(&env);
        let sponsor2 = Address::generate(&env);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        token_admin.mint(&sponsor1, &200);
        token_admin.mint(&sponsor2, &300);
        token_admin.mint(&sender, &1_000);

        // Two programs — first one (sponsor1) used first
        client.create_matching_program(&sponsor1, &creator, &token_id, &100u32, &200i128);
        client.create_matching_program(&sponsor2, &creator, &token_id, &100u32, &300i128);

        // Tip 300 — sponsor1 covers up to 200 (its full budget)
        let matched = client.tip_with_match(&sender, &creator, &token_id, &300);
        assert_eq!(matched, 200); // sponsor1 exhausted

        // Next tip picks up sponsor2
        let matched2 = client.tip_with_match(&sender, &creator, &token_id, &100);
        assert_eq!(matched2, 100);
    }

    // ── Upgrade tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_get_version_initial_is_zero() {
        let (env, contract_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        assert_eq!(client.get_version(), 0);
    }

    #[test]
    fn test_upgrade_increments_version_and_preserves_state() {
        let (env, contract_id, token_id, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let sender = Address::generate(&env);
        let creator = Address::generate(&env);

        // Establish some state before upgrading.
        token_admin.mint(&sender, &500);
        client.tip(&sender, &creator, &token_id, &500);
        assert_eq!(client.get_total_tips(&creator, &token_id), 500);

        // Simulate an upgrade using the current WASM hash (no-op replacement).
        let wasm_hash = env.deployer().upload_contract_wasm(TipJarContract::wasm());
        client.upgrade(&admin, &wasm_hash);

        // Version bumped.
        assert_eq!(client.get_version(), 1);

        // State preserved.
        assert_eq!(client.get_total_tips(&creator, &token_id), 500);
        assert_eq!(client.get_withdrawable_balance(&creator, &token_id), 500);
    }

    #[test]
    fn test_upgrade_multiple_times_increments_version_each_time() {
        let (env, contract_id, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let wasm_hash = env.deployer().upload_contract_wasm(TipJarContract::wasm());

        client.upgrade(&admin, &wasm_hash);
        assert_eq!(client.get_version(), 1);

        client.upgrade(&admin, &wasm_hash);
        assert_eq!(client.get_version(), 2);
    }

    #[test]
    fn test_upgrade_non_admin_returns_unauthorized() {
        let (env, contract_id, _, _) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let non_admin = Address::generate(&env);
        let wasm_hash = env.deployer().upload_contract_wasm(TipJarContract::wasm());

        let result = client.try_upgrade(&non_admin, &wasm_hash);
        assert_eq!(
            result.unwrap_err().unwrap(),
            TipJarError::Unauthorized.into()
        );
        assert_eq!(client.get_version(), 0);
    }

    #[test]
    fn test_upgrade_emits_event() {
        let (env, contract_id, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        let wasm_hash = env.deployer().upload_contract_wasm(TipJarContract::wasm());

        client.upgrade(&admin, &wasm_hash);

        let events = env.events().all();
        let last = events.last().unwrap();
        let topics: soroban_sdk::Vec<soroban_sdk::Val> = last.1;
        let topic_sym: soroban_sdk::Symbol =
            soroban_sdk::FromVal::from_val(&env, &topics.get(0).unwrap());
        assert_eq!(topic_sym, soroban_sdk::Symbol::new(&env, "upgraded"));
    }

    #[test]
    fn test_pause_unpause_capabilities() {
        let (env, contract_id, _, admin) = setup();
        let client = TipJarContractClient::new(&env, &contract_id);
        
        // 1. Initial State: Read-only access should work
        assert_eq!(client.get_version(), 0);
        
        // 2. Pause
        client.pause(&admin);
        
        // 3. State-changing should fail
        let wasm_hash = env.deployer().upload_contract_wasm(TipJarContract::wasm());
        let result = client.try_upgrade(&admin, &wasm_hash);
        assert_eq!(result.unwrap_err().unwrap(), TipJarError::ContractPaused.into());
        
        // 4. Read-only should still work
        assert_eq!(client.get_version(), 0);
        
        // 5. Unpause
        client.unpause(&admin);
        
        // 6. State-changing should work again
        client.upgrade(&admin, &wasm_hash);
        assert_eq!(client.get_version(), 1);
    }
}

