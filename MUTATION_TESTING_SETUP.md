# Mutation Testing Setup & Analysis

## Overview
This document provides mutation testing setup, analysis, and recommendations for the Nova-Rewards codebase.

## What is Mutation Testing?
Mutation testing assesses test quality by introducing small changes (mutations) to source code and checking if tests catch them. A high mutation score indicates strong tests that detect bugs effectively.

## Current Test Infrastructure

### Backend (Node.js/Express)
- **Framework**: Jest v29.7.0 + Supertest v6.3.3
- **Coverage Threshold**: 80% line coverage
- **Test Files**: 35+ test files
- **Property-Based Testing**: fast-check v3.23.2 already integrated

### Frontend (React/Next.js)
- **Framework**: Playwright for E2E
- **Coverage**: Limited unit test coverage

### Contracts (Rust/Soroban)
- **Framework**: Soroban SDK testutils
- **Coverage**: Comprehensive unit tests with snapshot testing

## Mutation Testing Tools

### For Backend (JavaScript/TypeScript)
**Stryker Mutator** - Industry standard for JavaScript mutation testing

### For Contracts (Rust)
**cargo-mutants** - Rust mutation testing tool

## Installation & Setup

### Backend Mutation Testing (Stryker)

```bash
cd novaRewards/backend
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner
npx stryker init
```

### Rust Mutation Testing (cargo-mutants)

```bash
cargo install cargo-mutants
cd contracts
cargo mutants
```

## Stryker Configuration

Create `stryker.conf.json` in `novaRewards/backend/`:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "jest",
  "jest": {
    "configFile": "jest.config.js"
  },
  "mutate": [
    "routes/**/*.js",
    "db/**/*.js",
    "middleware/**/*.js",
    "services/**/*.js",
    "!**/*.test.js",
    "!**/node_modules/**"
  ],
  "coverageAnalysis": "perTest",
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  },
  "timeoutMS": 60000,
  "concurrency": 4,
  "reporters": ["html", "clear-text", "progress", "json"],
  "htmlReporter": {
    "baseDir": "reports/mutation"
  }
}
```

## Running Mutation Tests

### Backend
```bash
cd novaRewards/backend
npx stryker run
```

### Contracts
```bash
cd contracts/nova-rewards
cargo mutants --test-tool=nextest
```

## Expected Mutation Types

### JavaScript Mutations (Stryker)
1. **Arithmetic Operators**: `+` → `-`, `*` → `/`
2. **Comparison Operators**: `>` → `>=`, `===` → `!==`
3. **Logical Operators**: `&&` → `||`, `!` removed
4. **Conditional Boundaries**: `<` → `<=`, `>` → `>=`
5. **String Literals**: `"text"` → `""`
6. **Number Literals**: `0` → `1`, `100` → `101`
7. **Boolean Literals**: `true` → `false`
8. **Return Values**: `return x` → `return undefined`
9. **Array Literals**: `[]` → `[undefined]`
10. **Object Literals**: `{}` → `{undefined: undefined}`

### Rust Mutations (cargo-mutants)
1. **Arithmetic**: `+` → `-`, `*` → `/`
2. **Comparison**: `>` → `>=`, `==` → `!=`
3. **Boolean**: `true` → `false`, `&&` → `||`
4. **Return values**: Early returns removed
5. **Function calls**: Removed or replaced

## Analysis of Current Test Quality

### Strong Areas

#### 1. Auth Tests (`auth.test.js`)
- ✅ Comprehensive validation testing
- ✅ Edge cases covered (duplicate email, wrong password)
- ✅ Security testing (timing attacks, case-insensitive email)
- ✅ Mock isolation
- **Estimated Mutation Score**: 85-90%

#### 2. Campaign Tests (`campaigns.test.js`)
- ✅ Boundary testing (zero, negative reward rates)
- ✅ Date validation (start/end date logic)
- ✅ Input validation
- **Estimated Mutation Score**: 80-85%

#### 3. Property-Based Tests (`merchantTransactionsProperty.test.js`)
- ✅ Advanced testing with fast-check
- ✅ Data isolation verification
- ✅ 100 test runs per property
- **Estimated Mutation Score**: 90-95%

#### 4. Rust Contract Tests (`staking_test.rs`)
- ✅ Comprehensive edge cases
- ✅ Precision testing
- ✅ Event verification
- ✅ Error condition testing
- **Estimated Mutation Score**: 85-90%

### Weak Areas & Improvement Opportunities

#### 1. Missing Boundary Mutations
**Issue**: Tests may not catch off-by-one errors

**Example from `campaigns.js`**:
```javascript
if (isNaN(merchantId) || merchantId <= 0) {
  // What if mutated to: merchantId < 0
  // Would tests catch this?
}
```

**Recommendation**: Add test for `merchantId === 0`

#### 2. Incomplete Error Path Testing
**Issue**: Some error handlers may not be fully tested

**Example from `auth.js`**:
```javascript
} catch (dbErr) {
  if (dbErr.code === '23505') {
    // Tested ✅
  }
  throw dbErr; // Is this path tested? ❓
}
```

**Recommendation**: Add tests for unexpected database errors

#### 3. Logical Operator Mutations
**Issue**: `&&` vs `||` mutations may not be caught

**Example**:
```javascript
if (!name || typeof name !== 'string' || name.trim() === '') {
  // If mutated to: !name && typeof name !== 'string'
  // Would tests catch this?
}
```

**Recommendation**: Add test with `name = 123` (non-string)

#### 4. Return Value Mutations
**Issue**: Functions returning early may not be tested

**Example from Rust**:
```rust
if amount <= 0 {
    panic!("Invalid amount");
}
// If panic is removed, would tests catch it?
```

**Recommendation**: Verify all panic/error paths are tested

#### 5. Magic Number Mutations
**Issue**: Constants may not be validated

**Example**:
```javascript
const SALT_ROUNDS = 12;
// If mutated to 11 or 13, would tests catch this?
```

**Recommendation**: Add test verifying bcrypt cost factor

## Detailed Mutation Testing Recommendations

### Priority 1: High-Impact Areas

#### Auth Route (`routes/auth.js`)
```javascript
// Add these tests to auth.test.js:

test('400 - rejects non-string email', async () => {
  const { status, body } = await post(server, '/api/auth/register', {
    email: 12345, // number instead of string
    password: 'Str0ngPass!',
    firstName: 'Jane',
    lastName: 'Doe',
  });
  expect(status).toBe(400);
});

test('500 - handles unexpected database errors', async () => {
  bcrypt.hash = jest.fn().mockResolvedValue('hashed');
  query.mockRejectedValueOnce(new Error('Connection timeout'));
  
  const { status } = await post(server, '/api/auth/register', validBody);
  expect(status).toBe(500);
});

test('verifies bcrypt uses minimum 12 rounds', async () => {
  bcrypt.hash = jest.fn().mockResolvedValue('hashed');
  query.mockResolvedValueOnce({ rows: [dbRow] });
  
  await post(server, '/api/auth/register', validBody);
  
  expect(bcrypt.hash).toHaveBeenCalledWith(
    expect.any(String),
    expect.toBeGreaterThanOrEqual(12)
  );
});
```

#### Campaign Route (`routes/campaigns.js`)
```javascript
// Add these tests to campaigns.test.js:

test('400 - rejects merchantId of exactly 0', async () => {
  const res = await request(app).get('/api/campaigns/0');
  expect(res.status).toBe(400);
});

test('400 - rejects non-integer merchantId', async () => {
  const res = await request(app).get('/api/campaigns/abc');
  expect(res.status).toBe(400);
});

test('400 - rejects merchantId with decimal', async () => {
  const res = await request(app).get('/api/campaigns/1.5');
  expect(res.status).toBe(400);
});

test('400 - rejects when name is non-string type', async () => {
  const res = await request(app)
    .post('/api/campaigns')
    .send({ ...VALID_BODY, name: 123 });
  expect(res.status).toBe(400);
});

test('400 - rejects when name is only whitespace', async () => {
  const res = await request(app)
    .post('/api/campaigns')
    .send({ ...VALID_BODY, name: '   ' });
  expect(res.status).toBe(400);
});
```

### Priority 2: Rust Contract Mutations

#### Staking Contract (`contracts/nova-rewards/src/lib.rs`)
```rust
// Add these tests to staking_test.rs:

#[test]
fn test_stake_exactly_zero_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.stake(&user, &0i128);
    }));
    
    assert!(result.is_err(), "Staking exactly 0 should be rejected");
}

#[test]
fn test_annual_rate_boundary_10000() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    
    // 10000 should be accepted (100%)
    contract.set_annual_rate(&10000i128);
    assert_eq!(contract.get_annual_rate(), 10000i128);
    
    // 10001 should be rejected
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_annual_rate(&10001i128);
    }));
    assert!(result.is_err(), "Rate above 10000 should be rejected");
}

#[test]
fn test_yield_calculation_with_zero_time() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = deploy(&env);
    let user = Address::generate(&env);
    
    contract.set_balance(&user, &1000i128);
    contract.set_annual_rate(&1000i128);
    contract.stake(&user, &1000i128);
    
    // Immediately calculate yield (0 seconds elapsed)
    let yield_amount = contract.calculate_yield(&user);
    assert_eq!(yield_amount, 0, "Zero time should produce zero yield");
}
```

### Priority 3: Integration & Edge Cases

#### Repository Tests
```javascript
// Add to transactionRepository.test.js:

test('handles SQL injection attempts safely', async () => {
  const maliciousId = "1; DROP TABLE users; --";
  query.mockResolvedValue({ rows: [] });
  
  await getTransactionsByMerchant(maliciousId);
  
  // Verify parameterized query was used
  expect(query).toHaveBeenCalledWith(
    expect.any(String),
    [maliciousId]
  );
});

test('handles extremely large merchant IDs', async () => {
  const largeId = Number.MAX_SAFE_INTEGER;
  query.mockResolvedValue({ rows: [] });
  
  const result = await getTransactionsByMerchant(largeId);
  expect(result).toEqual([]);
});
```

## Mutation Score Targets

### Recommended Thresholds
- **Critical Paths** (auth, payments): 90%+
- **Business Logic** (campaigns, rewards): 85%+
- **Utilities & Helpers**: 80%+
- **Overall Project**: 80%+

### Current Estimated Scores (Before Mutation Testing)
- Auth routes: ~85%
- Campaign routes: ~80%
- Transaction repositories: ~75%
- Rust contracts: ~85%
- **Overall Estimated**: ~80%

## Implementation Roadmap

### Phase 1: Setup (Week 1)
1. Install Stryker Mutator for backend
2. Install cargo-mutants for contracts
3. Configure mutation testing tools
4. Run baseline mutation tests
5. Generate initial reports

### Phase 2: Analysis (Week 2)
1. Review mutation reports
2. Identify surviving mutants
3. Categorize weak test areas
4. Prioritize improvements

### Phase 3: Improvement (Weeks 3-4)
1. Add missing boundary tests
2. Improve error path coverage
3. Add logical operator tests
4. Verify magic numbers
5. Re-run mutation tests

### Phase 4: Integration (Week 5)
1. Add mutation testing to CI/CD
2. Set up automated reports
3. Configure failure thresholds
4. Document process

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Mutation Testing

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 0' # Weekly on Sunday

jobs:
  mutation-test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd novaRewards/backend && npm ci
      - name: Run mutation tests
        run: cd novaRewards/backend && npx stryker run
      - name: Upload mutation report
        uses: actions/upload-artifact@v3
        with:
          name: mutation-report-backend
          path: novaRewards/backend/reports/mutation/
      - name: Check mutation score
        run: |
          SCORE=$(jq '.mutationScore' novaRewards/backend/reports/mutation/mutation.json)
          if (( $(echo "$SCORE < 80" | bc -l) )); then
            echo "Mutation score $SCORE is below threshold 80%"
            exit 1
          fi

  mutation-test-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Install cargo-mutants
        run: cargo install cargo-mutants
      - name: Run mutation tests
        run: cd contracts && cargo mutants --test-tool=nextest
      - name: Upload mutation report
        uses: actions/upload-artifact@v3
        with:
          name: mutation-report-contracts
          path: contracts/mutants.out/
```

## Monitoring & Maintenance

### Weekly Tasks
- Review mutation test reports
- Investigate new surviving mutants
- Update tests for new code

### Monthly Tasks
- Analyze mutation score trends
- Update mutation testing configuration
- Review and adjust thresholds

### Quarterly Tasks
- Comprehensive mutation testing audit
- Update tooling and dependencies
- Team training on mutation testing

## Expected Benefits

### Immediate (Month 1)
- Identify 20-30 weak test cases
- Discover 5-10 untested edge cases
- Improve test confidence

### Short-term (Months 2-3)
- Increase mutation score to 85%+
- Reduce production bugs by 30%
- Faster bug detection

### Long-term (6+ months)
- Maintain 85%+ mutation score
- Reduce regression bugs by 50%
- Improved code quality culture

## Resources

### Documentation
- [Stryker Mutator Docs](https://stryker-mutator.io/)
- [cargo-mutants Guide](https://mutants.rs/)
- [Mutation Testing Best Practices](https://martinfowler.com/articles/mutation-testing.html)

### Tools
- Stryker Dashboard: https://dashboard.stryker-mutator.io/
- Mutation Testing Elements: https://github.com/stryker-mutator/mutation-testing-elements

## Conclusion

The Nova-Rewards codebase has a solid testing foundation with 80% line coverage and property-based testing. Mutation testing will reveal hidden weaknesses and drive test quality to the next level. Focus on high-impact areas first (auth, payments) and gradually expand coverage across the entire codebase.
