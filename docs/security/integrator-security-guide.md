# Merchant & Integrator Security Guide

This guide provides security best practices for merchants and developers integrating with the Nova Rewards platform. Following these guidelines is essential for protecting your users and your business.

## 1. API Key Management

Your API keys grant access to the Nova Rewards backend. Treat them like passwords.

- **Never expose keys in the frontend:** All API calls to Nova Rewards should be made from your backend. Never include your `NOVA_API_SECRET` in client-side code (JavaScript, mobile apps, etc.).
- **Environment variables:** Store keys in environment variables or a secure vault (e.g., AWS Secrets Manager, HashiCorp Vault). Never commit keys to version control.
- **Principle of Least Privilege:** If possible, use scoped API keys that only have permissions for the specific actions your integration needs.
- **Rotation:** Rotate your API keys periodically (e.g., every 90 days) and immediately if you suspect a leak.

## 2. Webhook Security

Nova Rewards uses webhooks to notify your system of events (e.g., reward redemption, campaign status changes).

- **Verify Signatures:** Nova Rewards signs every webhook payload with a HMAC-SHA256 signature. You MUST verify this signature using your `WEBHOOK_SECRET` to ensure the request originated from Nova Rewards.
- **HTTPS Only:** Ensure your webhook endpoint uses HTTPS with a valid SSL/TLS certificate.
- **IP Allowlisting:** If possible, restrict incoming traffic to your webhook endpoint to Nova Rewards' known IP ranges.
- **Replay Protection:** Check the `X-Nova-Timestamp` header in the webhook request. If the timestamp is too old (e.g., > 5 minutes), reject the request to prevent replay attacks.

### Example Webhook Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
```

## 3. Idempotency

Network issues can lead to duplicate requests.

- **Use Idempotency Keys:** When issuing rewards or processing redemptions, always provide a unique `idempotency_key` (e.g., a UUID). Nova Rewards will ensure that requests with the same key are only processed once.
- **Handle 409 Conflicts:** If you receive a `409 Conflict` error, it means the request with that idempotency key was already processed or is in progress.

## 4. Sensitive Data Handling

- **Wallet Addresses:** While wallet addresses are public on the blockchain, treat them as sensitive in your logs and databases to protect user privacy.
- **Personal Information:** Avoid sending unnecessary PII (Personally Identifiable Information) to Nova Rewards. Use internal user IDs instead.

## 5. Trustline Verification

Users cannot receive NOVA tokens without a trustline.

- **Check Before Issuance:** Use the `/api/trustline/verify` endpoint to check if a user has established the necessary trustline before attempting to issue a token reward.
- **UX for Users:** Provide clear instructions to users on how to establish a trustline (e.g., using their Freighter wallet) if they haven't done so.

## 6. Rate Limiting

- **Respect Headers:** Pay attention to `X-RateLimit-*` headers in API responses.
- **Exponential Backoff:** If you receive a `429 Too Many Requests` error, implement exponential backoff before retrying.

## 7. Reporting Security Issues

If you discover a security vulnerability in the Nova Rewards platform or our integration guides, please follow our [Responsible Disclosure Policy](../../SECURITY.md).
