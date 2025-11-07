# Testing Guide

## Quick Start

Run all tests:

```bash
deno task test
```

Run tests without integration tests (faster):

```bash
deno task test:quick
```

## Available Test Commands

### Comprehensive Test Runner

```bash
deno task test              # Run all tests (type check, lint, format, unit, integration, smoke)
deno task test:quick        # Skip integration tests (faster)
deno task test:verbose      # Show detailed output
```

### Specific Test Types

```bash
deno task test:unit         # Run only unit tests
deno task test:integration  # Run only integration tests
deno task test:smoke        # Run only smoke tests (server endpoints)
```

### Code Quality

```bash
deno task check             # Type checking
deno task lint              # Linting
deno task fmt               # Format code
deno task fmt:check         # Check formatting without modifying
```

## Test Types

### 1. Type Check

Verifies TypeScript types are correct across all files.

```bash
deno check main.ts
```

### 2. Lint

Checks code quality and style issues.

```bash
deno lint
```

### 3. Format Check

Ensures code is properly formatted.

```bash
deno fmt --check
```

### 4. Unit Tests

Tests individual modules and functions.

```bash
deno test tests/
```

### 5. Integration Tests

Tests the full server with real HTTP requests.
Automatically starts a test server on port 9091.

### 6. Smoke Tests

Quick sanity checks that the server starts and basic endpoints work.
Tests:

- `/v1/models` endpoint
- `/v1/chat/completions` endpoint

## Test Runner Options

```bash
# Show help
deno run tests.ts --help

# Run with verbose output
deno run tests.ts --verbose

# Skip integration tests (faster)
deno run tests.ts --quick

# Run only specific test type
deno run tests.ts --filter "lint"

# Run only smoke tests
deno run tests.ts --smoke-only

# Run only integration tests
deno run tests.ts --integration-only
```

## Writing Tests

### Unit Test Example

```typescript
import { assertEquals } from "assert";
import { myFunction } from "../src/mymodule.ts";

Deno.test("myFunction works correctly", () => {
  const result = myFunction("input");
  assertEquals(result, "expected output");
});
```

### Integration Test Example

```typescript
Deno.test("API endpoint returns correct response", async () => {
  const response = await fetch("http://localhost:9090/v1/models");
  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.object, "list");
});
```

## CI/CD

Tests run automatically on:

- Pull requests
- Pushes to master/main branch

The CI runs:

1. Type checking
2. Linting
3. Format checking
4. Unit tests

## Troubleshooting

### Tests fail with "Permission denied"

Make sure to run with proper permissions:

```bash
deno run --allow-net --allow-env --allow-read --allow-run tests.ts
```

### Server already running on port

Kill existing server:

```bash
pkill -f "deno run.*main.ts"
```

### Integration tests timeout

Increase the timeout in tests.ts or check if the server is starting correctly.

## Test Coverage

Current test coverage:

- ✅ Type checking (all files)
- ✅ Linting (all files)
- ✅ Format checking (all files)
- ✅ Unit tests (23/23 passing - 100%)
- ✅ Smoke tests (server endpoints)
- ✅ Integration tests (8 tests - auto-skipped if server not running)

## Next Steps

To improve test coverage:

1. Add more edge case tests
2. Add more integration tests
3. Add tests for error handling
4. Add performance tests
