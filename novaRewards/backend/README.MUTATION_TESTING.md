# Mutation Testing Quick Start

## Run Mutation Tests

### Full Suite
```bash
npx stryker run
```

### Specific Files
```bash
npx stryker run --mutate "routes/auth.js"
npx stryker run --mutate "routes/campaigns.js,db/campaignRepository.js"
```

### View Results
```bash
# Open HTML report
start reports/mutation/index.html
```

## Run New Mutation-Killing Tests

### Auth Mutations
```bash
npm test -- auth.mutations.test.js --coverage=false
```

### Campaign Mutations
```bash
npm test -- campaigns.mutations.test.js --coverage=false
```

### All Mutation Tests
```bash
npm test -- --testPathPattern="mutations.test.js" --coverage=false
```

## Mutation Score Targets

- **Auth routes**: 90%+
- **Campaign routes**: 85%+
- **Overall backend**: 85%+

## What to Do with Surviving Mutants

1. Review the mutation in HTML report
2. Determine if it's:
   - **Equivalent mutant**: Functionally identical (ignore)
   - **Weak test**: Add test to kill it
   - **Dead code**: Remove the code
3. Add test or fix code
4. Re-run mutation tests

## Common Mutations to Watch For

### Type Coercion
```javascript
// Mutation: Remove typeof check
if (typeof value !== 'number') { ... }
```
**Test**: Pass non-number types

### Boundary Conditions
```javascript
// Mutation: <= → <
if (value <= 0) { ... }
```
**Test**: Pass exactly 0 and exactly 1

### Logical Operators
```javascript
// Mutation: && → ||
if (condition1 && condition2) { ... }
```
**Test**: Pass cases where only one condition is true

### Arithmetic Operators
```javascript
// Mutation: + → -
const total = principal + yield;
```
**Test**: Verify exact result, not just > 0

## Tips for Writing Mutation-Killing Tests

1. **Test exact values**, not just ranges
2. **Test both sides of boundaries** (n-1, n, n+1)
3. **Verify error codes and messages** explicitly
4. **Test each condition independently** in complex logic
5. **Use property-based testing** for comprehensive coverage

## Quick Reference

| Mutation Type | How to Kill |
|---------------|-------------|
| `+` → `-` | Verify exact result |
| `<` → `<=` | Test boundary pair |
| `&&` → `||` | Test each condition |
| `true` → `false` | Verify boolean value |
| `"text"` → `""` | Check exact string |
| `return x` → `return undefined` | Verify return value |

## Performance

- **Full suite**: ~30-60 minutes
- **Single file**: ~2-5 minutes
- **Concurrency**: Configured to 2 (adjust in `stryker.conf.json`)

## Troubleshooting

### Tests Timeout
Increase timeout in `stryker.conf.json`:
```json
"timeoutMS": 120000
```

### Out of Memory
Reduce concurrency:
```json
"concurrency": 1
```

### Slow Performance
Use incremental mode:
```bash
npx stryker run --incremental
```

## Resources

- Full guide: `../../MUTATION_TESTING_SETUP.md`
- Detailed report: `../../MUTATION_TESTING_REPORT.md`
- Summary: `../../MUTATION_TESTING_SUMMARY.md`
