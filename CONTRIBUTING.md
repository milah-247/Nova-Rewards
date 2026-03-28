# Contributing to Nova Rewards

Thanks for taking the time to contribute. This guide covers the essentials for
getting your environment set up and making changes to the codebase.

---

## Prerequisites

- Node.js 18+
- Docker + Docker Compose (for the local database)
- Rust + `wasm32-unknown-unknown` target (for smart contract work)
- Soroban CLI (for contract deployment and invocation)

```bash
# Rust + wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Soroban CLI
cargo install --locked soroban-cli
```

---

## Quick Start

```bash
git clone https://github.com/your-org/nova-rewards.git
cd nova-rewards/novaRewards

cp .env.example .env          # fill in your keys
docker-compose up -d          # start Postgres + Redis
npm install
node scripts/setup.js         # fund accounts + issue NOVA on Testnet
cd backend && npm start
```

---

## Stellar & Soroban Integration

Before working on any issue tagged `smart-contract` or `webhook-listener`,
read the integration reference first:

**[docs/stellar/integration.md](docs/stellar/integration.md)**

It covers:

- The Stellar account model and Horizon base URLs
- How the backend authenticates requests (merchant API key + user JWT)
- Annotated TypeScript snippets for loading accounts, submitting transactions,
  streaming payment events, and parsing Soroban contract events
- End-to-end sequence diagram for wallet-signature → contract invocation
- Horizon error codes (`tx_failed`, `op_underfunded`, `op_bad_auth`) and how
  Nova handles each

To verify your local setup runs against Testnet before diving in:

```bash
npx ts-node scripts/hello-stellar.ts
```

---

## Smart Contract Work

See [docs/upgrade-guide.md](docs/upgrade-guide.md) for the full build →
install → upgrade → migrate workflow.

Contract event schemas (topics + data shapes) are documented in
[docs/contract-events.md](docs/contract-events.md).

---

## Running Tests

```bash
# Backend unit + integration tests
cd novaRewards/backend && npm test

# Soroban contract tests
cd contracts && cargo test
```

---

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Reference the issue number in the PR title: `fix: handle op_underfunded (#123)`
- All new Stellar/blockchain code should include error handling for the common
  Horizon error codes documented in `docs/stellar/integration.md`
- Do not commit `.env` files or secret keys
