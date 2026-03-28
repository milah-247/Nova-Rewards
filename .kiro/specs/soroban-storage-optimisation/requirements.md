# Requirements Document

## Introduction

This feature optimises the on-chain storage layout of six Soroban smart contracts
(`nova-rewards`, `nova_token`, `admin_roles`, `reward_pool`, `vesting`, `referral`)
to reduce WASM binary size and ledger storage costs, prevent ledger-entry expiry,
and document the resulting schema.

The optimisation work covers four areas:

1. **Key consolidation** – merge multiple instance-storage keys that are always
   read/written together into a single consolidated state struct.
2. **Type substitution** – replace `String` with `Bytes` / `BytesN` for
   fixed-length identifiers to reduce XDR encoding overhead.
3. **TTL management** – add `extend_ttl` calls on every persistent entry to
   prevent ledger expiry.
4. **Schema documentation** – produce `docs/storage-schema.md` describing the
   optimised layout of every contract.

## Glossary

- **Auditor**: The tooling or developer process that inspects contract source
  files to enumerate storage keys and their access patterns.
- **Consolidator**: The refactoring step that merges multiple storage keys into
  a single `ContractState` struct value.
- **ContractState**: A `#[contracttype]` struct that groups fields always read
  and written together, stored under a single instance-storage key.
- **DataKey**: The `#[contracttype]` enum used in each contract to identify
  storage entries.
- **Instance_Storage**: Soroban `env.storage().instance()` — shared across all
  invocations of a contract instance; TTL is extended automatically with each
  invocation.
- **Persistent_Storage**: Soroban `env.storage().persistent()` — per-entry TTL
  that must be explicitly extended to avoid ledger expiry.
- **TTL**: Time-To-Live; the number of ledgers a storage entry remains live
  before it is archived and must be restored.
- **extend_ttl**: The Soroban SDK call
  `env.storage().persistent().extend_ttl(key, threshold, extend_to)` that
  refreshes a persistent entry's TTL.
- **WASM_Inspector**: The `stellar contract inspect --wasm <path>` CLI command
  used to measure binary size before and after optimisation.
- **Storage_Schema_Doc**: The file `docs/storage-schema.md` that documents the
  final storage layout of every contract.
- **nova-rewards**: The `NovaRewardsContract` in `contracts/nova-rewards/src/lib.rs`.
- **nova_token**: The `NovaToken` contract in `contracts/nova_token/src/lib.rs`.
- **admin_roles**: The `AdminRolesContract` in `contracts/admin_roles/src/lib.rs`.
- **reward_pool**: The `RewardPool` contract in `contracts/reward_pool/src/lib.rs`.
- **vesting**: The `VestingContract` in `contracts/vesting/src/lib.rs`.
- **referral**: The `ReferralContract` in `contracts/referral/src/lib.rs`.

---

## Requirements

### Requirement 1: Storage Key Audit

**User Story:** As a contract developer, I want a complete audit of all storage
keys across every contract, so that I can identify consolidation opportunities
before making any code changes.

#### Acceptance Criteria

1. THE Auditor SHALL enumerate every `DataKey` variant used in instance storage
   and persistent storage for all six contracts.
2. THE Auditor SHALL identify groups of instance-storage keys that are always
   read and written together within the same function call.
3. THE Auditor SHALL produce a written summary listing each identified
   consolidation candidate, the contract it belongs to, and the keys involved.
4. WHEN a key is used in only one function and never read independently,
   THE Auditor SHALL flag it as a consolidation candidate.

---

### Requirement 2: Instance Storage Consolidation — admin_roles

**User Story:** As a contract developer, I want the four instance-storage keys
in `admin_roles` (`Admin`, `PendingAdmin`, `Signers`, `Threshold`) consolidated
where appropriate, so that the number of distinct ledger entries is reduced.

#### Acceptance Criteria

1. THE Consolidator SHALL merge `Admin`, `Signers`, and `Threshold` — which are
   always initialised together — into a single `AdminState` struct stored under
   one instance-storage key.
2. WHEN `propose_admin` or `accept_admin` is called, THE admin_roles contract
   SHALL read and write the consolidated `AdminState` struct in a single
   storage operation per field group.
3. THE admin_roles contract SHALL preserve `PendingAdmin` as a separate
   optional instance-storage key because it is absent until a transfer is
   proposed.
4. THE admin_roles contract SHALL pass all existing tests after consolidation
   without modification to test assertions.

---

### Requirement 3: Instance Storage Consolidation — nova-rewards

**User Story:** As a contract developer, I want the instance-storage keys in
`nova-rewards` (`Admin`, `MigratedVersion`, `XlmToken`, `Router`) consolidated
where appropriate, so that initialisation and swap-config writes touch fewer
ledger entries.

#### Acceptance Criteria

1. THE Consolidator SHALL merge `Admin` and `MigratedVersion` — set together
   during `initialize` — into a single `CoreState` struct stored under one
   instance-storage key.
2. THE Consolidator SHALL merge `XlmToken` and `Router` — set together during
   `set_swap_config` — into a single `SwapConfig` struct stored under one
   instance-storage key.
3. WHEN `swap_for_xlm` is called, THE nova-rewards contract SHALL read
   `SwapConfig` in a single storage get rather than two separate gets.
4. THE nova-rewards contract SHALL pass all existing tests after consolidation
   without modification to test assertions.

---

### Requirement 4: Instance Storage Consolidation — reward_pool

**User Story:** As a contract developer, I want the two instance-storage keys
in `reward_pool` (`Admin`, `Balance`) consolidated into a single struct, so
that every deposit and withdrawal touches one ledger entry instead of two.

#### Acceptance Criteria

1. THE Consolidator SHALL merge `Admin` and `Balance` into a single `PoolState`
   struct stored under one instance-storage key.
2. WHEN `deposit` or `withdraw` is called, THE reward_pool contract SHALL read
   and write `PoolState` in a single storage round-trip.
3. THE reward_pool contract SHALL pass all existing tests after consolidation
   without modification to test assertions.

---

### Requirement 5: Instance Storage Consolidation — referral

**User Story:** As a contract developer, I want the two instance-storage keys
in `referral` (`Admin`, `PoolBalance`) consolidated into a single struct, so
that pool funding and credit operations touch one ledger entry.

#### Acceptance Criteria

1. THE Consolidator SHALL merge `Admin` and `PoolBalance` into a single
   `ReferralState` struct stored under one instance-storage key.
2. WHEN `fund_pool` or `credit_referrer` is called, THE referral contract SHALL
   read and write `ReferralState` in a single storage round-trip.
3. THE referral contract SHALL pass all existing tests after consolidation
   without modification to test assertions.

---

### Requirement 6: Instance Storage Consolidation — vesting

**User Story:** As a contract developer, I want the two instance-storage keys
in `vesting` (`Admin`, `PoolBalance`) consolidated into a single struct, so
that pool funding and release operations touch one ledger entry.

#### Acceptance Criteria

1. THE Consolidator SHALL merge `Admin` and `PoolBalance` into a single
   `VestingState` struct stored under one instance-storage key.
2. WHEN `fund_pool` or `release` is called, THE vesting contract SHALL read
   and write `VestingState` in a single storage round-trip.
3. THE vesting contract SHALL pass all existing tests after consolidation
   without modification to test assertions.

---

### Requirement 7: Persistent Storage TTL Extension — nova_token

**User Story:** As a contract developer, I want every persistent storage write
in `nova_token` to be accompanied by a TTL extension, so that `Balance` and
`Allowance` entries never expire unexpectedly.

#### Acceptance Criteria

1. WHEN `set_balance` writes a `Balance(Address)` persistent entry,
   THE nova_token contract SHALL call `extend_ttl` on that entry with a
   threshold of at least 100 ledgers and an extension target of at least
   500 ledgers.
2. WHEN `approve` writes an `Allowance(Address, Address)` persistent entry,
   THE nova_token contract SHALL call `extend_ttl` on that entry with a
   threshold of at least 100 ledgers and an extension target of at least
   500 ledgers.
3. WHEN `balance_of` reads a `Balance(Address)` persistent entry that exists,
   THE nova_token contract SHALL call `extend_ttl` on that entry to refresh
   its TTL.
4. THE nova_token contract SHALL pass all existing tests after TTL changes
   without modification to test assertions.

---

### Requirement 8: Persistent Storage TTL Extension — referral

**User Story:** As a contract developer, I want every persistent storage write
in `referral` to be accompanied by a TTL extension, so that `Referral` and
`TotalReferrals` entries never expire.

#### Acceptance Criteria

1. WHEN `register_referral` writes a `Referral(Address)` persistent entry,
   THE referral contract SHALL call `extend_ttl` on that entry with a threshold
   of at least 100 ledgers and an extension target of at least 500 ledgers.
2. WHEN `register_referral` writes a `TotalReferrals(Address)` persistent
   entry, THE referral contract SHALL call `extend_ttl` on that entry with a
   threshold of at least 100 ledgers and an extension target of at least
   500 ledgers.
3. WHEN `get_referrer` reads a `Referral(Address)` persistent entry that
   exists, THE referral contract SHALL call `extend_ttl` on that entry to
   refresh its TTL.
4. THE referral contract SHALL pass all existing tests after TTL changes
   without modification to test assertions.

---

### Requirement 9: Persistent Storage TTL Extension — vesting

**User Story:** As a contract developer, I want every persistent storage write
in `vesting` to be accompanied by a TTL extension, so that `Schedule` entries
never expire during a beneficiary's vesting period.

#### Acceptance Criteria

1. WHEN `create_schedule` writes a `Schedule(Address, u32)` persistent entry,
   THE vesting contract SHALL call `extend_ttl` on that entry with a threshold
   of at least 100 ledgers and an extension target of at least 500 ledgers.
2. WHEN `release` writes an updated `Schedule(Address, u32)` persistent entry,
   THE vesting contract SHALL call `extend_ttl` on that entry with a threshold
   of at least 100 ledgers and an extension target of at least 500 ledgers.
3. WHEN `get_schedule` reads a `Schedule(Address, u32)` persistent entry,
   THE vesting contract SHALL call `extend_ttl` on that entry to refresh its
   TTL.
4. THE vesting contract SHALL pass all existing tests after TTL changes
   without modification to test assertions.

---

### Requirement 10: WASM Size Measurement

**User Story:** As a contract developer, I want WASM binary sizes measured
before and after optimisation, so that I can verify the changes produce a
measurable reduction.

#### Acceptance Criteria

1. WHEN the WASM_Inspector is run against each contract's unoptimised binary,
   THE WASM_Inspector SHALL record the baseline byte count for each contract.
2. WHEN the WASM_Inspector is run against each contract's optimised binary,
   THE WASM_Inspector SHALL record the post-optimisation byte count for each
   contract.
3. THE Storage_Schema_Doc SHALL include a table comparing baseline and
   post-optimisation WASM sizes for all six contracts.
4. IF the optimised WASM size for any contract is larger than the baseline,
   THEN THE Consolidator SHALL document the reason in the Storage_Schema_Doc.

---

### Requirement 11: Storage Schema Documentation

**User Story:** As a contract developer, I want a `docs/storage-schema.md` file
that documents the final storage layout of every contract, so that future
contributors understand the on-chain data model at a glance.

#### Acceptance Criteria

1. THE Storage_Schema_Doc SHALL contain one section per contract listing every
   storage key, its storage type (instance or persistent), its Rust type, and
   its TTL policy.
2. THE Storage_Schema_Doc SHALL describe each consolidated struct's fields and
   the rationale for grouping them.
3. THE Storage_Schema_Doc SHALL include the WASM size comparison table required
   by Requirement 10.
4. WHEN a persistent entry has a TTL extension policy, THE Storage_Schema_Doc
   SHALL state the threshold and extension-target ledger counts used.
5. THE Storage_Schema_Doc SHALL be written in Markdown and located at
   `docs/storage-schema.md`.
