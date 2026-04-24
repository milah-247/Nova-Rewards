# Known Limitations and Mitigations

Transparency is a core value at Nova Rewards. This document outlines known technical limitations of the platform and the measures we've taken to mitigate their impact.

## 1. Stellar Network Dependencies

### Latency and Throughput
- **Limitation:** While Stellar is fast (3-5 second finality), it is not instantaneous. During periods of extreme network congestion, transaction times may increase.
- **Mitigation:** The Nova Rewards backend uses asynchronous processing for blockchain transactions. Users receive immediate feedback in the UI that their transaction is "pending," and the system polls for status or uses webhooks to confirm completion.

### Trustline Requirement
- **Limitation:** Stellar requires users to explicitly "opt-in" to receive a non-native asset by creating a trustline. This creates friction for first-time crypto users.
- **Mitigation:** We provide a simplified "One-Click Trustline" setup in the PWA using the Freighter wallet. Additionally, merchants can choose to issue "Internal Points" first, which are then convertible to NOVA tokens once the user establishes a trustline.

## 2. Smart Contract Complexity

### Fixed Logic
- **Limitation:** Once deployed, smart contracts are immutable. Bug fixes or logic changes require a complex upgrade process.
- **Mitigation:** We use a proxy-like pattern (via Soroban's contract upgradeability features) controlled by a multi-sig `admin_roles` contract. All upgrades require a 48-hour time-lock and at least two independent auditor reviews.

### Arithmetic Limits
- **Limitation:** Smart contracts use fixed-point arithmetic. Extremely large numbers or very high precision can lead to overflows or rounding errors.
- **Mitigation:** We use 128-bit integers (`i128`/`u128`) for all token calculations and have implemented extensive fuzz testing for all arithmetic-heavy functions.

## 3. Platform Governance

### Initial Centralization
- **Limitation:** In the early stages (v1.0), the Nova Rewards core team holds the primary administrative keys for contract upgrades and emergency pauses.
- **Mitigation:** Administrative actions are secured by a multi-signature wallet (Gnosis Safe or equivalent). We have a published roadmap to transition to a Decentralized Autonomous Organization (DAO) where `NOVA` token holders will vote on major platform changes.

### Oracle Dependency
- **Limitation:** For certain automated reward triggers (e.g., "Reward on external purchase"), the platform relies on external data provided by the merchant or a third-party service.
- **Mitigation:** We use a reputation-based system for data providers and implement "Circuit Breakers" that pause automated distributions if unusual patterns are detected.

## 4. Frontend Security

### Browser-Based Wallet
- **Limitation:** The platform relies on browser extensions like Freighter. If a user's browser or computer is compromised (e.g., by malware), their private keys could be at risk.
- **Mitigation:** Nova Rewards never asks for or stores user private keys or seed phrases. We educate users on hardware wallet integration and provide security warnings about browser-based threats.

## 5. Privacy

### Public Ledger
- **Limitation:** All transactions on Stellar are public. While names aren't attached to addresses, transaction patterns can sometimes be used to de-anonymize users.
- **Mitigation:** We recommend users use dedicated wallets for loyalty rewards. We are also exploring zero-knowledge proof (ZKP) integrations for future versions to enhance transactional privacy.
