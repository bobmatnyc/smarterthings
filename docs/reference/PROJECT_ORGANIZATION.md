# Project Organization Standard

**Project**: mcp-smarterthings
**Version**: 1.0.0
**Last Updated**: 2025-12-23
**Status**: Active

This document defines the file organization standards for the mcp-smarterthings project. All contributors must follow these conventions.

## Quick Reference

| File Type | Location | Examples |
|-----------|----------|----------|
| **Tests (E2E)** | `/tests/e2e/` | `*.spec.ts` files |
| **Tests (Unit)** | `/tests/unit/` | `*.test.ts` files |
| **Tests (Integration)** | `/tests/integration/` | Integration test suites |
| **Debug Scripts** | `/scripts/debug/` | One-off debugging scripts |
| **Test Scripts** | `/scripts/test/` | Test automation scripts |
| **Build Scripts** | `/scripts/build/` | Build automation |
| **Release Scripts** | `/scripts/release/` | Release automation |
| **Utility Scripts** | `/scripts/utils/` | Reusable utilities |
| **Research Docs** | `/docs/research/` | Investigation & analysis docs |
| **QA Docs** | `/docs/qa/` | Test reports & verification |
| **Implementation Docs** | `/docs/implementation/` | Feature implementation docs |
| **Setup Docs** | `/docs/setup/` | Setup & configuration guides |
| **API Docs** | `/docs/api/` | API reference documentation |
| **Reference Docs** | `/docs/reference/` | Standards & specifications |

## Directory Structure

```
smarterthings/
├── src/                          # Production source code
│   ├── mcp/                      # MCP server implementation
│   ├── services/                 # Business logic services
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Shared utilities
│
├── tests/                        # ALL test files
│   ├── e2e/                      # End-to-end tests (*.spec.ts)
│   ├── unit/                     # Unit tests (*.test.ts)
│   ├── integration/              # Integration tests
│   ├── fixtures/                 # Test data and fixtures
│   └── helpers/                  # Test utilities
│
├── scripts/                      # ALL scripts (NOT in root)
│   ├── debug/                    # One-off debugging scripts
│   ├── test/                     # Test automation scripts
│   ├── build/                    # Build automation
│   ├── release/                  # Release automation
│   └── utils/                    # Reusable utility scripts
│
├── docs/                         # ALL documentation (NOT in root)
│   ├── research/                 # Research & investigation docs
│   ├── qa/                       # QA reports & verification
│   ├── implementation/           # Implementation documentation
│   ├── setup/                    # Setup & configuration guides
│   ├── api/                      # API reference documentation
│   ├── reference/                # Standards & specifications
│   └── examples/                 # Usage examples
│
├── web/                          # Web frontend (SvelteKit)
│   ├── src/
│   │   ├── routes/               # SvelteKit routes
│   │   ├── lib/                  # Shared components & utilities
│   │   └── stores/               # Svelte stores
│   └── static/                   # Static assets
│
└── [root files]                  # Only essential root files
    ├── README.md
    ├── CONTRIBUTING.md
    ├── LICENSE
    ├── CHANGELOG.md
    ├── package.json
    └── tsconfig.json
```

## File Placement Rules

### 1. Test Files

**Rule**: ALL test files must be in `/tests/` directory.

| File Pattern | Location | Notes |
|--------------|----------|-------|
| `*.spec.ts` | `/tests/e2e/` | End-to-end/integration tests (Playwright) |
| `*.test.ts` | `/tests/unit/` | Unit tests (Vitest) |
| Test fixtures | `/tests/fixtures/` | Test data, mocks, fixtures |
| Test helpers | `/tests/helpers/` | Shared test utilities |

**Examples**:
```
✅ tests/e2e/verify-mondrian-dashboard.spec.ts
✅ tests/unit/treemap.test.ts
❌ verify-mondrian-quick.spec.ts (root - WRONG)
❌ src/lib/utils/treemap.test.ts (colocated - WRONG)
```

**Naming Convention**:
- E2E tests: Describe user flow or feature verification
  - `verify-{feature}-{aspect}.spec.ts`
  - `test-{feature}-{behavior}.spec.ts`
- Unit tests: Match source file name
  - `module-name.test.ts` for `module-name.ts`

### 2. Scripts

**Rule**: ALL scripts must be in `/scripts/` with appropriate subdirectory.

| Script Type | Location | Examples |
|-------------|----------|----------|
| Debug scripts | `/scripts/debug/` | `debug-auth-loop.js` |
| Test automation | `/scripts/test/` | `test-oauth-token-flow.ts` |
| Build automation | `/scripts/build/` | `build-version.sh` |
| Release automation | `/scripts/release/` | `release.sh` |
| Utilities | `/scripts/utils/` | `check-oauth-tokens.ts` |

**Examples**:
```
✅ scripts/debug/debug-auth-loop.js
✅ scripts/test/test-oauth-api-call.js
✅ scripts/utils/get-devices-for-test.ts
❌ debug-auth-loop.js (root - WRONG)
❌ test-oauth-token-flow.ts (root - WRONG)
```

**Script Lifecycle**:
- One-off investigation scripts → `/scripts/debug/` (delete when done)
- Reusable utilities → `/scripts/utils/` (keep)
- Temporary scripts → Delete or move to appropriate category

### 3. Documentation

**Rule**: ALL documentation must be in `/docs/` with category subdirectory.

| Doc Type | Location | Naming Pattern |
|----------|----------|----------------|
| Research | `/docs/research/` | `{topic}-{date}.md` |
| QA Reports | `/docs/qa/` | `{feature}-verification-{date}.md` |
| Implementation | `/docs/implementation/` | `{FEATURE}-{ASPECT}.md` (UPPERCASE) |
| Setup Guides | `/docs/setup/` | `{TOOL}-SETUP.md` |
| API Reference | `/docs/api/` | `{api-name}-reference.md` |
| Standards | `/docs/reference/` | `{STANDARD}.md` (UPPERCASE) |

**Examples**:
```
✅ docs/research/oauth-auth-redirect-loop-root-cause-2025-12-23.md
✅ docs/qa/development-servers-verification-2025-12-23.md
✅ docs/implementation/MONDRIAN-DASHBOARD-PHASE1.md
✅ docs/setup/PM2-NGROK-SETUP.md
✅ docs/reference/PROJECT_ORGANIZATION.md
❌ AUTH_REDIRECT_LOOP_ROOT_CAUSE.md (root - WRONG)
❌ PM2_NGROK_SETUP.md (root - WRONG)
```

**Naming Conventions**:
- Research docs: `{topic}-{date}.md` (lowercase with date)
- Implementation docs: `{FEATURE}-{ASPECT}.md` (UPPERCASE for major features)
- Setup guides: `{TOOL}-SETUP.md` (UPPERCASE for clarity)
- Standards: `{STANDARD}.md` (UPPERCASE, descriptive)

**Date Format**: Always use `YYYY-MM-DD` format in filenames

### 4. Root Files

**Rule**: Only essential project files allowed in root.

**Allowed Root Files**:
```
✅ README.md               # Project overview
✅ CONTRIBUTING.md         # Contribution guidelines
✅ LICENSE                 # License file
✅ CHANGELOG.md            # Release changelog (auto-generated)
✅ CLAUDE.md               # Claude AI instructions
✅ package.json            # NPM package manifest
✅ tsconfig.json           # TypeScript configuration
✅ .gitignore              # Git ignore rules
✅ .env.example            # Environment variable template
✅ Makefile                # Build automation
```

**Prohibited Root Files**:
```
❌ Any *.spec.ts files     → Move to /tests/e2e/
❌ Any *.test.ts files     → Move to /tests/unit/
❌ Debug scripts           → Move to /scripts/debug/
❌ Research docs           → Move to /docs/research/
❌ Setup guides            → Move to /docs/setup/
❌ Temporary files         → Delete or move to /scripts/debug/
```

## Framework-Specific Conventions

### SvelteKit Frontend (web/)

```
web/
├── src/
│   ├── routes/                   # File-based routing
│   │   ├── +page.svelte          # Route page component
│   │   ├── +page.ts              # Route data loading
│   │   ├── +layout.svelte        # Layout component
│   │   └── +server.ts            # Server-side endpoints
│   │
│   ├── lib/                      # Shared code
│   │   ├── components/           # Reusable components
│   │   ├── stores/               # Svelte stores
│   │   └── utils/                # Utility functions
│   │
│   └── app.html                  # HTML template
│
└── static/                       # Static assets (images, fonts)
```

### Node.js Backend (src/)

```
src/
├── mcp/                          # MCP server
│   ├── tools/                    # MCP tool implementations
│   └── server.ts                 # MCP server entry point
│
├── services/                     # Business logic
│   ├── smartthings/              # SmartThings API integration
│   └── rules/                    # Rules engine
│
├── types/                        # TypeScript types
│   └── smartthings.ts
│
└── utils/                        # Shared utilities
    └── logger.ts
```

## Naming Conventions

### Files

| Context | Convention | Examples |
|---------|-----------|----------|
| TypeScript modules | kebab-case | `device-manager.ts` |
| Test files | kebab-case + suffix | `device-manager.test.ts` |
| Svelte components | PascalCase | `DeviceCard.svelte` |
| Documentation | kebab-case | `api-reference.md` |
| Major features | UPPERCASE | `MONDRIAN-DASHBOARD-PHASE1.md` |
| Standards | UPPERCASE | `PROJECT_ORGANIZATION.md` |

### Directories

| Context | Convention | Examples |
|---------|-----------|----------|
| Source code | kebab-case | `device-polling/` |
| Documentation | kebab-case | `implementation/` |
| SvelteKit routes | kebab-case | `battery-view/` |

## Organization Workflows

### Adding a New Feature

1. **Check CONTRIBUTING.md** for development standards
2. **Create Linear ticket** for tracking
3. **Create implementation doc** in `/docs/implementation/`
4. **Write tests first** in `/tests/e2e/` or `/tests/unit/`
5. **Implement feature** in appropriate `/src/` directory
6. **Update docs** with results and verification

### Reorganizing Existing Files

1. **Identify misplaced files** (use `git status` to find untracked)
2. **Create backup** before moving
3. **Use `git mv`** for tracked files (preserves history)
4. **Use `mv`** for untracked files
5. **Update imports** if necessary
6. **Verify build** after reorganization
7. **Commit changes** with descriptive message

### Cleaning Up Temporary Files

1. **Identify temporary files** in root or `/scripts/`
2. **Determine if still needed**:
   - If reusable → Move to `/scripts/utils/`
   - If debugging → Move to `/scripts/debug/`
   - If obsolete → Delete
3. **Update documentation** if removing important scripts
4. **Commit cleanup** with clear message

## Quality Standards

### Before Committing

From CONTRIBUTING.md, always run:

```bash
make lint-fix              # Auto-fix code issues
make quality               # Run all quality checks
```

### Commit Message Format

```
<type>(<scope>): <subject> (<ticket-id>)

Examples:
feat(dashboard): implement treemap visualization (1M-123)
fix(auth): resolve OAuth redirect loop (1M-456)
docs(setup): add PM2 and ngrok configuration guide (1M-789)
refactor(tests): reorganize E2E tests into /tests/e2e/
```

### File Organization Enforcement

- **Code review**: PRs with misplaced files will be rejected
- **CI/CD**: Future validation scripts will enforce standards
- **Documentation**: Update this file when patterns change

## Migration Guide

### Moving Test Files

```bash
# E2E tests (Playwright)
mv verify-*.spec.ts tests/e2e/
mv test-*.spec.ts tests/e2e/

# Unit tests (Vitest)
mv src/**/*.test.ts tests/unit/
```

### Moving Scripts

```bash
# Debug scripts
mv debug-*.js scripts/debug/
mv debug-*.ts scripts/debug/

# Test scripts
mv test-*.ts scripts/test/
mv scripts/test-*.sh scripts/test/

# Utilities
mv scripts/check-*.ts scripts/utils/
mv scripts/get-*.ts scripts/utils/
```

### Moving Documentation

```bash
# Research docs (add date suffix)
mv FEATURE.md docs/research/feature-2025-12-23.md

# Setup guides
mv *_SETUP.md docs/setup/

# QA reports
mv *_VERIFICATION.md docs/qa/
```

## References

- **CONTRIBUTING.md**: Development workflow and quality standards
- **CLAUDE.md**: AI-assisted development guidelines
- **Linear Tickets**: Feature tracking and task management

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-23 | Initial organization standard |

---

**Questions?** See CONTRIBUTING.md or create an issue for clarification.
