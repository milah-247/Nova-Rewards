# Emergency Runbook

This document outlines the emergency procedures for the Nova Rewards / TipJar smart contracts.

## Emergency Pause (Circuit Breaker)

In case of a detected vulnerability or ongoing attack, the contract can be paused to freeze all state-changing operations.

### Who can pause?
Only the **Admin** address has the authority to pause and unpause the contract.

### How to pause?
Invoke the `pause` function on the contract using the Admin account.

```bash
stellar contract invoke --id <CONTRACT_ID> --source-account <ADMIN_KEY> -- pause --admin <ADMIN_ADDRESS>
```

### How to unpause?
Once the issue is resolved or the threat is mitigated, invoke the `unpause` function.

```bash
stellar contract invoke --id <CONTRACT_ID> --source-account <ADMIN_KEY> -- unpause --admin <ADMIN_ADDRESS>
```

## What to communicate to users?
- **Announcement:** Notify users via official channels (Twitter/X, Discord, Telegram) that a temporary freeze is in effect for security reasons.
- **Assurance:** Inform users that their funds (held in escrow) are safe and read-only functions (like checking balances) remain operational.
- **ETA:** Provide an estimated time for resolution if possible.

## Recovery Procedure
1. Identify the vulnerability.
2. Develop a fix.
3. If necessary, use the `upgrade` function to replace the contract WASM.
4. Verify the fix in a test environment.
5. Unpause the contract.
