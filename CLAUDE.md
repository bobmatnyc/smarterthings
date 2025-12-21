# Smarter Things - AI Development Guide

> **For AI Assistants (Claude, GPT, etc.)**: This document provides essential context for working with the Smarter Things codebase.

## 🎯 Priority Instructions

### 🔴 CRITICAL - Always Follow
1. **File Organization** - ALL documentation → `docs/`, ALL tests → `tests/`, ALL scripts → `scripts/`
2. **Port Configuration** - Backend: **5182**, Frontend: **5181** (LOCKED - DO NOT CHANGE)
3. **Type Safety** - 100% TypeScript strict mode, no `any` types
4. **Conventional Commits** - Required format: `type(scope): description`

### 🟡 HIGH PRIORITY - Default Behavior
1. **Build Command** - ONE way: `pnpm build` (or `pnpm build:dev` for quick builds)
2. **Test Command** - ONE way: `pnpm test` (or `pnpm test:unit`, `pnpm test:integration`)
3. **Dev Server** - ONE way: `bash scripts/dev-start.sh` (or `pnpm start:dev`)
4. **Quality Check** - ONE way: `pnpm run quality` (typecheck + lint + test)

### 🟢 IMPORTANT - Best Practices
1. **Code Reduction** - Target zero net new lines per feature when possible
2. **Search Before Implement** - Use MCP Vector Search or grep to find existing solutions
3. **Svelte 5 Runes** - Use `$state`, `$derived`, `$effect` (not legacy stores in components)
4. **Test Coverage** - 90%+ coverage minimum

### ⚪ OPTIONAL - Nice to Have
1. **MCP Inspector** - `pnpm test:inspector` for visual testing
2. **Chatbot Mode** - `pnpm chat` for interactive testing
3. **Shell Helpers** - `source tools/test-helpers.sh` for quick commands

---

## 📁 Project Organization Standards

### Mandatory Directory Structure

**STRICT RULES - NO EXCEPTIONS:**

#### 1. **ALL documentation → `docs/`**
- Setup guides: `docs/*-SETUP.md` (e.g., `BRILLIANT-SETUP.md`, `LUTRON-SETUP.md`)
- Research documents: `docs/research/`
- API documentation: `docs/api/`
- Architecture docs: `docs/architecture/`
- Planning docs: `docs/planning/`
- Implementation guides: `docs/implementation/`
- Testing guides: `docs/testing/`
- QA reports: `docs/qa/`
- Security documentation: `docs/security/`
- Screenshots: `docs/screenshots/`
- **NO documentation files in root directory**

#### 2. **ALL tests → `tests/`**
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Test data: `tests/data/`
- Test fixtures: `tests/fixtures/`
- Test reports: `test-results/`
- **NO test files outside tests/ directory**

#### 3. **ALL ad hoc scripts → `scripts/`**
- Build scripts: `scripts/build/`
- Deployment scripts: `scripts/deploy/`
- Utility scripts: `scripts/utils/`
- Development helpers: `scripts/dev/`
- **NO loose scripts in root directory**

### ❌ Root Directory Violations

**Files that DO NOT belong in root:**
- ❌ `*-SETUP.md` (move to `docs/`)
- ❌ `*.sh` scripts (move to `scripts/`)
- ❌ Test reports (move to `test-results/`)
- ❌ Research documents (move to `docs/research/`)
- ❌ Planning documents (move to `docs/planning/`)
- ❌ Implementation summaries (move to `docs/implementation/`)
- ❌ QA reports (move to `docs/qa/`)
- ❌ Changelogs without semantic versioning (move to `docs/`)
- ❌ Work plans (move to `docs/planning/`)
- ❌ Quick start guides (integrate into main README or move to `docs/`)

**Files that DO belong in root:**
- ✅ `README.md` (project overview only)
- ✅ `CLAUDE.md` (this file)
- ✅ `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`
- ✅ `package.json`, `pnpm-lock.yaml`, `package-lock.json`
- ✅ `.gitignore`, `.env.example`
- ✅ Configuration files: `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, etc.

### 📋 Enforcement

**Before committing:**
1. Review file organization against standards
2. Move any violations to correct directories
3. Update import paths if necessary
4. Use `git mv` to preserve git history

**Code Review Checklist:**
- [ ] No documentation in root directory
- [ ] No scripts in root directory
- [ ] All new tests in `tests/` directory
- [ ] File paths follow naming conventions

---

## 🏗️ Project Structure

### Tech Stack
- **Backend**: TypeScript 5.6+, Fastify, MCP SDK v1.22.0
- **Frontend**: Svelte 5.43.8, SvelteKit 2.48.5, Skeleton UI 4.7.1, Tailwind CSS 4.1.17
- **Testing**: Vitest, Playwright, MCP Inspector
- **Package Manager**: pnpm

### Key Architecture Patterns

**Backend - TypeScript 5.6+ Strict Mode:**
- Branded types for domain safety (`DeviceId`, `SceneId`, `LocationId`)
- Discriminated unions for type-safe state management
- Comprehensive type definitions in `src/types/`
- Fastify web framework with CORS and Helmet security
- MCP SDK v1.22.0 for Model Context Protocol integration

**Frontend - Svelte 5 with Runes API:**
- Modern reactive programming with `$state`, `$derived`, `$effect` runes
- No more stores for component state (legacy pattern still used for global state)
- Improved TypeScript 5.9.3 support and type inference
- Component architecture in `web/src/lib/components/`

**Service-Oriented Architecture:**
- Services in `src/services/`
- Adapters in `src/platforms/` or `src/lib/adapters/`
- MCP tools in `src/mcp/tools/`
- Routes in `src/routes/`

**Frontend Component Organization:**
```
web/src/lib/components/
├── automations/      # Automations & Scenes UI
├── rules/           # Rules management UI
├── devices/         # Device cards and controls
├── rooms/           # Room navigation and breadcrumbs
├── layout/          # Page layouts and navigation
├── loading/         # Loading skeleton components
└── chat/           # Chat interface
```

---

## 🚀 Single-Path Workflows

### ONE Way to Build
```bash
# Production build with validation
pnpm build

# Quick build (skip validation/tests)
pnpm build:dev

# Frontend only
pnpm build:web

# Both backend + frontend
pnpm build:all
```

### ONE Way to Run Development Server
```bash
# Full stack (backend + frontend) - RECOMMENDED
bash scripts/dev-start.sh
# or
pnpm start:dev

# Backend only (port 5182)
pnpm dev

# Frontend only (port 5181)
pnpm dev:web
```

**Access Points:**
- Frontend: http://localhost:5181
- Backend API: http://localhost:5182/api
- Health check: http://localhost:5182/health

### ONE Way to Test
```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# MCP Inspector (visual testing)
pnpm test:inspector
```

### ONE Way to Deploy
```bash
# Production deployment
pnpm build
npm start

# Development deployment
pnpm start:dev
```

### ONE Way to Check Quality
```bash
# Run all quality checks (typecheck + lint + test)
pnpm run quality

# Individual checks
pnpm typecheck    # Type checking
pnpm lint         # Linting
pnpm lint:fix     # Auto-fix linting errors
pnpm format       # Format code
pnpm format:check # Check formatting
```

---

## 🔌 Integration Details

### Supported Smart Home Platforms

1. **SmartThings** (Primary) - 100% capability coverage
   - Personal Access Token (PAT) required
   - Scopes: `r:devices:*`, `x:devices:*`, `r:scenes:*`, `x:scenes:*`, `r:locations:*`
   - OAuth2 implementation with PKCE and state validation (secured in Sprint 1.2)
   - Setup: See [docs/SMARTAPP_SETUP.md](docs/SMARTAPP_SETUP.md)

2. **Lutron** - Via SmartThings integration
   - Setup: See [docs/LUTRON-SETUP.md](docs/LUTRON-SETUP.md)
   - Requires Lutron Caséta bridge + SmartThings hub

3. **Brilliant** - Via SmartThings integration
   - Setup: See [docs/BRILLIANT-SETUP.md](docs/BRILLIANT-SETUP.md)
   - Requires Brilliant Control panel + SmartThings hub
   - Auto-detection and grouped controls

4. **Tuya** - 96% capability coverage (planned)

### Unified Capability System

Layer 2 abstraction provides platform-agnostic device control:

```typescript
import { DeviceCapability, hasCapability } from './types/unified-device.js';

// Check capability (works across all platforms)
if (hasCapability(device, DeviceCapability.DIMMER)) {
  // Set brightness - automatically converts to platform format
  await device.capabilities.dimmer.commands.setLevel(50);
}
```

See [docs/capability-mapping-guide.md](docs/capability-mapping-guide.md) for complete reference.

---

## 🎯 Recent Features (Sprint 1.2)

### Automations & Scenes UI
Complete frontend implementation for managing SmartThings automations and scenes:
- Automations list view with filtering and search (ticket 1M-546)
- Scenes list view with execution capability
- Automation detail view with status monitoring (ticket 1M-547)
- Backend API endpoints: `/api/automations`, `/api/automations/:id/execute`
- Components: `AutomationsGrid.svelte`, `AutomationCard.svelte`, `SceneCard.svelte`
- Store: `automationStore.svelte.ts` (Svelte 5 Runes)

### Rules Management UI
Full rules lifecycle management:
- Rules list view with enable/disable toggle (ticket 1M-538)
- Rule execution with confirmation
- Rule deletion API with proper state management
- Components: `RuleCard.svelte`, `RuleList.svelte`
- Store: `ruleStore.svelte.ts` (Svelte 5 Runes)
- API: `/api/rules`, `/api/rules/:id`, `/api/rules/:id/execute`

### Brilliant Device Controls
Enhanced device detection and grouping:
- Automatic Brilliant device detection (ticket 1M-559)
- Grouped device controls for Brilliant panels (4-light and 2-light configurations)
- Room-based device organization
- Components: `BrilliantGroupedControls.svelte`

### OAuth2 Security Hardening
Comprehensive OAuth2 security improvements (ticket 1M-543):
- PKCE (Proof Key for Code Exchange) implementation
- State parameter validation to prevent CSRF attacks
- Secure token refresh mechanisms
- Route: `src/routes/oauth.ts`
- Docs: [docs/security/OAUTH2-SECURITY-FIXES-1M-543.md](docs/security/OAUTH2-SECURITY-FIXES-1M-543.md)

### UI Enhancements
- Toast notification system (svelte-sonner)
- Device filter URL persistence
- Loading skeleton components (WCAG 2.1 AA compliant)
- Room navigation breadcrumbs with dynamic icons

---

## 🛠️ Development Workflow

### Quality Standards

**Before suggesting commits:**
1. Run `pnpm run quality` (typecheck + lint + test)
2. Fix any linting errors with `pnpm lint:fix`
3. Ensure all tests pass
4. Follow conventional commit format

See [CONTRIBUTING.md](CONTRIBUTING.md) for comprehensive development guidelines.

### Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, no logic changes)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, tooling

**Examples:**
```
feat(mcp): add device discovery tool
fix(smartthings): handle null device status
docs(setup): add Lutron integration guide
test(devices): add unit tests for device registry
feat(ui): add automations list view with filtering
fix(oauth): implement PKCE flow for security
```

---

## 🔐 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMARTTHINGS_PAT` | Yes | - | SmartThings Personal Access Token |
| `MCP_SERVER_NAME` | No | `smartthings-mcp` | MCP server name |
| `MCP_SERVER_VERSION` | No | `1.0.0` | MCP server version |
| `MCP_SERVER_PORT` | No | `3000` | HTTP server port (http mode only) |
| `NODE_ENV` | No | `development` | Node environment |
| `LOG_LEVEL` | No | `info` | Logging level (error, warn, info, debug) |
| `TRANSPORT_MODE` | No | `stdio` | Transport mode (stdio or http) |
| `OPENROUTER_API_KEY` | No | - | OpenRouter API key for chatbot (optional) |

---

## 📚 Documentation Index

### Setup Guides
- [SmartApp OAuth Setup](docs/SMARTAPP_SETUP.md)
- [Alexa Custom Skill Quick Start](docs/setup/ALEXA_CUSTOM_SKILL_QUICK_START.md)
- [Lutron Setup](docs/LUTRON-SETUP.md)
- [Brilliant Setup](docs/BRILLIANT-SETUP.md)
- [ngrok Quick Start](docs/setup/NGROK_QUICKSTART.md)

### API & Integration
- [Direct Mode API](docs/direct-mode-api.md)
- [Capability Mapping Guide](docs/capability-mapping-guide.md)
- [Capability Quick Reference](docs/capability-quick-reference.md)

### Testing & QA
- [Testing Quick Start](docs/testing/TESTING_QUICK_START.md)
- [Verification Checklist](docs/testing/VERIFICATION_CHECKLIST.md)
- [OAuth2 Security Testing](docs/qa/OAUTH2-SECURITY-MANUAL-TESTING.md)

### Implementation (Sprint 1.2)
- [Automations Implementation](docs/summaries/AUTOMATION-INTEGRATION-SUMMARY.md)
- [Rules Implementation](docs/RULES_IMPLEMENTATION.md)
- [Brilliant UI Controls](docs/implementation/BRILLIANT-UI-CONTROLS-IMPLEMENTATION.md)
- [Toast Notifications](docs/implementation/TOAST-IMPLEMENTATION-SUMMARY.md)

### Security
- [OAuth2 Security Fixes](docs/security/OAUTH2-SECURITY-FIXES-1M-543.md)
- [OAuth2 Verification Report](docs/qa/OAUTH2-SECURITY-VERIFICATION-REPORT.md)

For complete index, see [docs/README.md](docs/README.md).

---

## 🔍 Common Tasks

### Adding a New MCP Tool

1. Create tool definition in `src/mcp/tools/`
2. Add TypeScript types in `src/types/`
3. Implement handler logic
4. Add unit tests in `tests/unit/mcp/tools/`
5. Add integration tests in `tests/integration/`
6. Update documentation in `docs/`

### Adding Platform Support

1. Create adapter in `src/platforms/<platform>/`
2. Implement `PlatformAdapter` interface
3. Add capability mappings
4. Register in `PlatformRegistry`
5. Add tests
6. Update capability mapping docs

### Adding a New UI Feature

1. Create Svelte 5 components in `web/src/lib/components/<feature>/`
2. Use Runes API (`$state`, `$derived`, `$effect`) for reactive state
3. Create store in `web/src/lib/stores/<feature>Store.svelte.ts` for global state
4. Add routes in `web/src/routes/<feature>/`
5. Implement API endpoints in `src/routes/<feature>.ts`
6. Add E2E tests in `tests/e2e/`
7. Document in `docs/implementation/`

### Debugging Issues

**Backend:**
```bash
# Set log level to debug
LOG_LEVEL=debug pnpm dev

# Check health endpoint
curl http://localhost:5182/health

# View detailed logs
tail -f logs/combined.log
```

**Frontend:**
```bash
# Check Vite dev server
pnpm dev:web

# Browser console for runtime errors
# Network tab for API call issues
```

---

## ⚠️ Common Pitfalls

### File Organization
- ❌ Adding documentation to root
- ✅ Put all docs in `docs/`
- ❌ Creating scripts in root
- ✅ Put all scripts in `scripts/`

### Import Paths
- ❌ Using relative imports across layers
- ✅ Use absolute imports from `src/`
- ❌ Circular dependencies
- ✅ Follow dependency direction (tools → services → adapters)

### Svelte 5 Patterns
- ❌ Using old `.subscribe()` patterns in components
- ✅ Use `$state` rune for component-level reactive state
- ❌ Creating stores for component state
- ✅ Use stores only for global state (devices, chat, automations, rules)
- ✅ Use `$derived` for computed values

### Testing
- ❌ Tests outside `tests/` directory
- ✅ Mirror `src/` structure in `tests/unit/`
- ❌ Skipping quality checks before commits
- ✅ Run `pnpm run quality` before committing

### Environment Variables
- ❌ Hardcoding secrets
- ✅ Use `.env.local` (gitignored)
- ❌ Changing locked ports
- ✅ Respect port configuration (5182/5181)

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines including:
- Code quality standards
- Commit message format
- Testing requirements
- Pull request process

---

## 📞 Getting Help

1. Check existing documentation in [docs/](docs/)
2. Review [SmartThings API Documentation](https://developer.smartthings.com/docs/api/public)
3. Search [GitHub Issues](https://github.com/bobmatnyc/smarterthings/issues)
4. Open a new issue with detailed description and logs

---

**Made with ❤️ for AI-assisted development**
