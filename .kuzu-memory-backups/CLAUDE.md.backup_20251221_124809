# Smarter Things - AI Development Guide

> **For AI Assistants (Claude, GPT, etc.)**: This document provides essential context for working with the Smarter Things codebase.

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
- ✅ `package.json`, `pnpm-lock.yaml`, `package-lock.json`
- ✅ `.gitignore`, `.env.example`
- ✅ Configuration files: `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, etc.
- ✅ `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- ✅ `CLAUDE.md` (this file)

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

## 🏗️ Project Structure Requirements

### Key Architecture Patterns

**Backend - TypeScript 5.6+ Strict Mode:**
- Branded types for domain safety (`DeviceId`, `SceneId`, `LocationId`)
- Discriminated unions for type-safe state management
- Comprehensive type definitions in `src/types/`
- Fastify web framework with CORS and Helmet security
- MCP SDK v1.22.0 for Model Context Protocol integration

**Frontend - Svelte 5 with Runes API:**
- Modern reactive programming with `$state`, `$derived`, `$effect` runes
- Svelte 5.43.8 with SvelteKit 2.48.5
- No more stores for component state (legacy pattern still used for global state)
- Improved TypeScript 5.9.3 support and type inference
- Component architecture in `web/src/lib/components/`

**UI Framework:**
- Skeleton UI 4.7.1 for component primitives
- Tailwind CSS 4.1.17 for utility-first styling
- svelte-sonner for toast notifications
- Responsive design with WCAG 2.1 AA compliance

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

**Testing Structure:**
- Unit tests: `tests/unit/` - mirror `src/` structure
- Integration tests: `tests/integration/` - test service interactions
- E2E tests: `tests/e2e/` - test full workflows with Playwright
- Test fixtures: `tests/fixtures/` - mock data and test utilities

---

## 🛠️ Development Workflow

### Quality Standards

**Before suggesting commits:**
1. Run `pnpm run quality` (typecheck + lint + test)
2. Fix any linting errors with `pnpm run lint:fix`
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

## 🔌 Integration Details

### Supported Smart Home Platforms

1. **SmartThings** (Primary) - 100% capability coverage
   - Personal Access Token (PAT) required
   - Scopes: `r:devices:*`, `x:devices:*`, `r:scenes:*`, `x:scenes:*`, `r:locations:*`
   - OAuth2 implementation with PKCE and state validation (secured in Sprint 1.2)
   - Setup: See [docs/SMARTAPP_SETUP.md](docs/SMARTAPP_SETUP.md)
   - Security: See [docs/security/OAUTH2-SECURITY-FIXES-1M-543.md](docs/security/OAUTH2-SECURITY-FIXES-1M-543.md)

2. **Lutron** - Via SmartThings integration
   - Setup: See [docs/LUTRON-SETUP.md](docs/LUTRON-SETUP.md)
   - Requires Lutron Caséta bridge + SmartThings hub

3. **Brilliant** - Via SmartThings integration
   - Setup: See [docs/BRILLIANT-SETUP.md](docs/BRILLIANT-SETUP.md)
   - Requires Brilliant Control panel + SmartThings hub
   - Auto-detection and grouped controls (Sprint 1.2)

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
- Docs: [docs/qa/QA-REPORT-AUTOMATIONS-1M-550.md](docs/qa/QA-REPORT-AUTOMATIONS-1M-550.md)

### Rules Management UI
Full rules lifecycle management:
- Rules list view with enable/disable toggle (ticket 1M-538)
- Rule execution with confirmation
- Rule deletion API with proper state management
- Components: `RuleCard.svelte`, `RuleList.svelte`
- Store: `ruleStore.svelte.ts` (Svelte 5 Runes)
- API: `/api/rules`, `/api/rules/:id`, `/api/rules/:id/execute`
- Docs: [docs/RULES_IMPLEMENTATION.md](docs/RULES_IMPLEMENTATION.md)

### Brilliant Device Controls
Enhanced device detection and grouping:
- Automatic Brilliant device detection (ticket 1M-559)
- Grouped device controls for Brilliant panels (4-light and 2-light configurations)
- Room-based device organization
- Components: `BrilliantGroupedControls.svelte`
- Docs: [docs/implementation/BRILLIANT-UI-CONTROLS-IMPLEMENTATION.md](docs/implementation/BRILLIANT-UI-CONTROLS-IMPLEMENTATION.md)

### OAuth2 Security Hardening
Comprehensive OAuth2 security improvements (ticket 1M-543):
- PKCE (Proof Key for Code Exchange) implementation
- State parameter validation to prevent CSRF attacks
- Secure token refresh mechanisms
- Manual security testing completed
- Route: `src/routes/oauth.ts`
- Docs: [docs/security/OAUTH2-SECURITY-FIXES-1M-543.md](docs/security/OAUTH2-SECURITY-FIXES-1M-543.md)
- QA: [docs/qa/OAUTH2-SECURITY-VERIFICATION-REPORT.md](docs/qa/OAUTH2-SECURITY-VERIFICATION-REPORT.md)

### UI Enhancements
- Toast notification system (svelte-sonner) - [docs/implementation/TOAST-IMPLEMENTATION-SUMMARY.md](docs/implementation/TOAST-IMPLEMENTATION-SUMMARY.md)
- Device filter URL persistence - [docs/implementation/DEVICE-FILTER-URL-PERSISTENCE.md](docs/implementation/DEVICE-FILTER-URL-PERSISTENCE.md)
- Loading skeleton components (WCAG 2.1 AA compliant) - [docs/qa/LOADING-COMPONENTS-SUMMARY.md](docs/qa/LOADING-COMPONENTS-SUMMARY.md)
- Room navigation breadcrumbs with dynamic icons - [docs/qa/BREADCRUMB-IMPLEMENTATION-SUMMARY.md](docs/qa/BREADCRUMB-IMPLEMENTATION-SUMMARY.md)

---

## 🚀 Running the Project

### Development Mode (Recommended)

```bash
# Full stack (backend + frontend)
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

### Port Configuration

**LOCKED PORTS (DO NOT CHANGE):**
- Backend: **5182** (configured in `.env.local`, `src/config/environment.ts`)
- Frontend: **5181** (configured in `web/vite.config.ts`)

See [docs/PORT-CONFIGURATION.md](docs/PORT-CONFIGURATION.md) for details.

### Building

```bash
# Full build with validation
pnpm build

# Quick build (skip validation/tests)
pnpm build:dev

# Build frontend only
pnpm build:web

# Build both
pnpm build:all
```

---

## 🧪 Testing

### Test Commands

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# MCP Inspector (visual testing)
pnpm test:inspector
```

### Test Organization

- **Unit tests**: Fast, isolated tests for individual functions/classes
- **Integration tests**: Test service interactions and API integrations
- **E2E tests**: Full workflow testing with Playwright (requires running servers)
- **Manual testing**: QA procedures documented in `docs/qa/`

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
- [Automations QA Report](docs/qa/QA-REPORT-AUTOMATIONS-1M-550.md)

### Implementation (Sprint 1.2)
- [Automations Implementation](docs/summaries/AUTOMATION-INTEGRATION-SUMMARY.md)
- [Rules Implementation](docs/RULES_IMPLEMENTATION.md)
- [Brilliant UI Controls](docs/implementation/BRILLIANT-UI-CONTROLS-IMPLEMENTATION.md)
- [Device Filter URL Persistence](docs/implementation/DEVICE-FILTER-URL-PERSISTENCE.md)
- [Toast Notifications](docs/implementation/TOAST-IMPLEMENTATION-SUMMARY.md)
- [Loading Components](docs/qa/LOADING-COMPONENTS-SUMMARY.md)

### Security
- [OAuth2 Security Fixes](docs/security/OAUTH2-SECURITY-FIXES-1M-543.md)
- [OAuth2 Verification Report](docs/qa/OAUTH2-SECURITY-VERIFICATION-REPORT.md)

### Legacy Implementation
- [Alexa Implementation](docs/implementation/ALEXA_CUSTOM_SKILL_IMPLEMENTATION.md)
- [Chatbot Implementation](docs/implementation/CHATBOT_IMPLEMENTATION.md)
- [Diagnostic Tools](docs/implementation/DIAGNOSTIC_TOOLS_IMPLEMENTATION.md)

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
3. Search [GitHub Issues](https://github.com/bobmatnyc/mcp-smarterthings/issues)
4. Open a new issue with detailed description and logs

---

**Made with ❤️ for AI-assisted development**
