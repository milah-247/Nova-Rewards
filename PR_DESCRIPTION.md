# Issue: Close #201
# Title: feat: implement contract circuit-breaker (emergency pause) mechanism

### Description:
Implements a security 'circuit breaker' in the TipJar smart contract to freeze operations if a vulnerability is detected.

### Key Changes:
- **Pause Flag:** Added Paused: bool to the contract's instance storage (default false).
- **Security Gating:** Created a require_not_paused internal helper that panics with ContractPaused to block all state-changing functions when active.
- **Admin Control:** Restricted pause() and unpause() calls exclusively to the Admin role.
- **On-chain Events:** Emits contract_paused and contract_unpaused events with the admin address and ledger timestamp for off-chain monitoring.
- **Runbook:** Added docs/emergency-runbook.md with operational procedures.
- **Unit Testing:** Added tests verifying that state-changing calls are rejected while paused while read-only functions (balance, version) remain accessible.
