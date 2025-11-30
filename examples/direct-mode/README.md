# Direct Mode API Examples

This directory contains comprehensive examples demonstrating the Direct Mode API for in-process MCP tool execution.

## Quick Start

All examples require a SmartThings Personal Access Token:

```bash
export SMARTTHINGS_TOKEN=your-token-here
```

## Available Examples

### 1. Basic Usage (`basic-usage.ts`)

**What it demonstrates:**
- Service initialization and setup
- Device discovery and listing
- Basic device control operations
- Scene management
- System information queries
- Proper resource cleanup

**Run it:**
```bash
ts-node examples/direct-mode/basic-usage.ts
```

**Key concepts:**
- `ServiceContainer` initialization
- `createToolExecutor()` factory pattern
- Using `isSuccess()` and `isError()` type guards
- Basic CRUD operations

---

### 2. Error Handling (`error-handling.ts`)

**What it demonstrates:**
- Multiple error handling patterns
- Error code interpretation
- Retry logic with exponential backoff
- Batch operations with partial failure handling
- Graceful degradation strategies
- Structured error logging

**Run it:**
```bash
ts-node examples/direct-mode/error-handling.ts
```

**Key concepts:**
- Type guards for safe error access
- Error code categories (retryable vs non-retryable)
- Exponential backoff algorithm
- Partial success handling in batch operations
- Production-ready error logging

---

### 3. Automation Workflow (`automation-example.ts`)

**What it demonstrates:**
- Complete automation lifecycle
- Template discovery and selection
- Device capability validation
- Automation testing (dry run)
- Rule creation, updates, and deletion
- Manual automation execution

**Run it:**
```bash
ts-node examples/direct-mode/automation-example.ts
```

**Key concepts:**
- Automation templates (motion_lights, door_notification, etc.)
- `AutomationConfig` type structure
- Device capability validation workflow
- Testing before deployment
- Safe cleanup procedures

---

### 4. Type Safety Demo (`type-safety-demo.ts`)

**What it demonstrates:**
- Branded types for domain safety
- `DirectResult<T>` discriminated unions
- Type guards and type narrowing
- Generic type parameters
- Compile-time safety examples
- TypeScript type inference

**Run it:**
```bash
ts-node examples/direct-mode/type-safety-demo.ts
```

**Key concepts:**
- Branded types prevent ID mix-ups
- Discriminated unions enforce error handling
- Type narrowing with type guards
- Generic types for data safety
- Compile-time vs runtime error detection

---

## Running Examples

### Prerequisites

- Node.js 18+ and pnpm installed
- Project built (`pnpm build`)
- SmartThings PAT token configured

### Setup

```bash
# Install dependencies
pnpm install

# Build project
pnpm build

# Set environment variable
export SMARTTHINGS_TOKEN=your-token-here

# Run an example
ts-node examples/direct-mode/basic-usage.ts
```

### Running with ts-node

All examples are written in TypeScript and can be run directly with `ts-node`:

```bash
# Install ts-node if not already installed
pnpm add -g ts-node

# Run example
ts-node examples/direct-mode/basic-usage.ts
```

### Running Compiled JavaScript

Alternatively, compile and run as JavaScript:

```bash
# Compile TypeScript
pnpm build

# Run compiled example (if transpiled to dist/examples)
node dist/examples/direct-mode/basic-usage.js
```

---

## Example Summary

| Example | Focus | Complexity | Lines |
|---------|-------|------------|-------|
| `basic-usage.ts` | Getting started | Beginner | ~200 |
| `error-handling.ts` | Production patterns | Intermediate | ~300 |
| `automation-example.ts` | Complete workflow | Advanced | ~350 |
| `type-safety-demo.ts` | TypeScript features | Intermediate | ~250 |

---

## Common Patterns

### Initialization Pattern

All examples follow this initialization pattern:

```typescript
import { createToolExecutor, isSuccess } from '@bobmatnyc/mcp-smarterthings/direct';
import { ServiceContainer } from '@bobmatnyc/mcp-smarterthings/services';
import { SmartThingsService } from '@bobmatnyc/mcp-smarterthings/smartthings';

// 1. Create service
const smartThingsService = new SmartThingsService({
  token: process.env.SMARTTHINGS_TOKEN!,
});

// 2. Create container
const container = new ServiceContainer(smartThingsService);

try {
  // 3. Initialize
  await container.initialize();

  // 4. Create executor
  const executor = createToolExecutor(container);

  // 5. Use executor...

} finally {
  // 6. Cleanup
  await container.dispose();
}
```

### Error Handling Pattern

All examples use this consistent error handling pattern:

```typescript
const result = await executor.someOperation();

if (isSuccess(result)) {
  // Success path - result.data is accessible
  console.log('Success:', result.data);
} else {
  // Error path - result.error is accessible
  console.error(`Error: ${result.error.code} - ${result.error.message}`);
}
```

---

## Next Steps

1. **Read the Documentation**: [docs/direct-mode-api.md](../../docs/direct-mode-api.md)
2. **Try the Examples**: Start with `basic-usage.ts`
3. **Build Your Own**: Use examples as templates for your use case
4. **Explore the API**: Check the complete API reference in the docs

---

## Troubleshooting

### "SMARTTHINGS_TOKEN is required"

Set the environment variable before running:
```bash
export SMARTTHINGS_TOKEN=your-token-here
```

### "Cannot find module"

Ensure project is built:
```bash
pnpm build
```

### "No devices found"

Ensure your SmartThings account has devices and your PAT token has appropriate scopes:
- `r:devices:*`
- `x:devices:*`
- `r:scenes:*`
- `r:locations:*`

### TypeScript errors

Install dependencies and ensure TypeScript is configured:
```bash
pnpm install
pnpm typecheck
```

---

## Additional Resources

- **[Direct Mode API Documentation](../../docs/direct-mode-api.md)** - Complete API reference
- **[Main README](../../README.md)** - Project overview and setup
- **[Capability Mapping Guide](../../docs/capability-mapping-guide.md)** - Device capabilities reference
- **[Testing Guide](../../docs/testing/TESTING_QUICK_START.md)** - Testing strategies

---

**Questions or Issues?**

- Review example code comments for detailed explanations
- Check [GitHub Issues](https://github.com/bobmatnyc/mcp-smarterthings/issues)
- Read the comprehensive [API documentation](../../docs/direct-mode-api.md)

---

*Examples created for ticket [1M-412](https://linear.app/bobmatnyc/issue/1M-412) - Phase 4.2: Create Direct Mode API*
