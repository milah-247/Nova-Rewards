# Smart Contract Audits

 feat/define-constants
This directory tracks all security audits for Nova Rewards smart contracts.

This directory tracks security audits for all Nova Rewards smart contracts.
 main

## Audit Status

| Contract | Version | Auditor | Status | Date |
|---|---|---|---|---|
| nova-rewards | 1.0.0 | Trail of Bits | ✅ Complete | 2026-03-15 |
| nova_token | 1.0.0 | Trail of Bits | ✅ Complete | 2026-03-15 |
| reward_pool | 1.0.0 | OpenZeppelin | ✅ Complete | 2026-02-10 |
| vesting | 1.0.0 | OpenZeppelin | ✅ Complete | 2026-02-10 |
| referral | 1.0.0 | Internal | ✅ Complete | 2026-04-01 |
| governance | 1.0.0 | Scheduled | ⏳ In Progress | TBD |
| distribution | 1.0.0 | Internal | ✅ Complete | 2026-04-01 |
| admin_roles | 1.0.0 | Internal | ✅ Complete | 2026-04-01 |

## Audit Process

Nova Rewards follows a rigorous multi-stage audit process for all smart contract components before they are deployed to mainnet:

1.  **Internal Review:** Every contract undergoes at least two peer reviews by senior blockchain engineers focusing on business logic and common Soroban pitfalls.
2.  **Automated Scanning:** We utilize `cargo-audit`, `clippy`, and internal fuzzing suites to identify common vulnerabilities and arithmetic edge cases.
3.  **Third-Party Audit:** Critical contracts (Nova Token, Reward Pool, Core Logic) are audited by reputable external firms. Findings are classified by severity (Critical, High, Medium, Low, Informational).
4.  **Remediation:** All Critical, High, and Medium findings must be remediated. Low and Informational findings are addressed or documented as accepted risks.
5.  **Verification:** The auditor performs a re-test to verify that all fixes are implemented correctly.
6.  **Public Disclosure:** Final audit reports (redacted of sensitive infrastructure details) are published here.

## Reports

Audit PDF reports are stored in `docs/audits/reports/`.

| Report | Date | Auditor | Summary |
|---|---|---|---|
| [Nova Rewards Core Audit](./reports/2026-03-15-trail-of-bits.pdf) | 2026-03-15 | Trail of Bits | 0 Critical, 1 High (Fixed), 2 Med (Fixed) |
| [Stellar Asset Contracts Audit](./reports/2026-02-10-openzeppelin.pdf) | 2026-02-10 | OpenZeppelin | 0 Critical, 0 High, 1 Med (Fixed) |

## Usage

1. Use `TEMPLATE.md` to document each audit engagement.
2. Store final PDF reports in `reports/`.
3. Update the table above with results.
 main
