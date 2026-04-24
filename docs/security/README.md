# Nova Rewards — Security Documentation

This directory contains the security posture documentation for the Nova Rewards platform.

## Documents

| Document | Description |
|----------|-------------|
| [Integrator Security Guide](./integrator-security-guide.md) | **Recommended for Merchants.** How to securely integrate with our API and Webhooks. |
| [Known Limitations](./limitations-and-mitigations.md) | Transparent overview of platform limitations and their mitigations. |
| [Threat Model](./threat-model.md) | STRIDE analysis of threats across contracts, API, frontend, and infrastructure |
| [Incident Response Plan](./incident-response-plan.md) | Severity classification, response phases, and playbooks for common incident types |
| [Security Best Practices](./security-best-practices.md) | Coding and operational standards for contracts, backend, frontend, and infrastructure |
| [Encryption Policy](./encryption.md) | How data is encrypted at rest and in transit. |
| [Responsible Disclosure](../../SECURITY.md) | How to report vulnerabilities and our bug bounty program. |

## Quick Reference

**Suspected active incident?** → Follow the [Incident Response Plan](./incident-response-plan.md)

**Integrating as a Merchant?** → Read the [Integrator Security Guide](./integrator-security-guide.md)

**Starting a new feature?** → Review [Security Best Practices](./security-best-practices.md) for your layer

**Threat assessment for a change?** → Reference the [Threat Model](./threat-model.md)

**Audit reports** → See [`/docs/audits/`](../audits/README.md)
