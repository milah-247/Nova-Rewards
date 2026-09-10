/**
 * Regression test for Nova-Rewards#1302: duplicate `headers()` keys in
 * next.config.js silently dropped the CSP header and static-asset caching.
 * Asserts the single merged headers() serves the full security set plus
 * the cache rules.
 */
const { readFileSync } = require('fs');
const nextConfig = require('../next.config.js');

describe('next.config.js headers()', () => {
  let routes;

  beforeAll(async () => {
    expect(typeof nextConfig.headers).toBe('function');
    routes = await nextConfig.headers();
  });

  const headersFor = (source) => {
    const route = routes.find((r) => r.source === source);
    expect(route).toBeDefined();
    return Object.fromEntries(route.headers.map((h) => [h.key, h.value]));
  };

  it('serves the full security header set on /(.*)', () => {
    const h = headersFor('/(.*)');
    expect(h['Content-Security-Policy']).toMatch(/default-src 'self'/);
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Strict-Transport-Security']).toMatch(/max-age=31536000/);
    expect(h['Referrer-Policy']).toBeDefined();
    expect(h['Permissions-Policy']).toBeDefined();
    // Kept deliberately per #1302. `mode=block` matters: a bare `1` is the
    // variant with a known cross-site leak, so assert the value, not presence.
    expect(h['X-XSS-Protection']).toBe('1; mode=block');
  });

  it('exposes exactly one headers() definition', () => {
    // The original bug was two `async headers()` keys in one object literal,
    // where the second silently won. Reading the source is the only way to see
    // it from a test: the evaluated config already collapsed to the last one.
    const source = readFileSync(require.resolve('../next.config.js'), 'utf8');
    const definitions = source.match(/^\s*async headers\(\)/gm) || [];
    expect(definitions).toHaveLength(1);
  });

  it('serves long-lived cache rules for static assets', () => {
    const h = headersFor('/_next/static/(.*)');
    expect(h['Cache-Control']).toMatch(/max-age=31536000/);
  });
});
