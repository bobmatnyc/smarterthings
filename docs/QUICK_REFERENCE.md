# Quick Reference Guide

Fast access to common commands and workflows for mcp-smartthings.

## 🚀 Most Common Commands

```bash
# Development
make dev                # Start development mode
make build              # Build project
make test               # Run tests
make quality            # Type check + lint + test

# Version Management
make version-status     # Check version and suggested bump
make version-current    # Show current version

# Release
make release-auto       # Auto-detect and create release
make release-patch      # Patch release (1.0.0 → 1.0.1)
make release-minor      # Minor release (1.0.0 → 1.1.0)
make release-major      # Major release (1.0.0 → 2.0.0)
make release-dry-run    # Test release without changes
```

## 📋 Complete Command Reference

### Development
| Command | Description |
|---------|-------------|
| `make install` | Install dependencies |
| `make dev` | Start development mode with watch |
| `make chat` | Run interactive chat CLI |
| `make alexa-server` | Run Alexa server |

### Build
| Command | Description |
|---------|-------------|
| `make build` | Full production build |
| `make build-dev` | Development build (skip validation) |
| `make build-clean` | Clean build artifacts |
| `make build-verify` | Verify build artifacts |
| `make build-history` | Show build history |
| `make build-latest` | Show latest build info |

### Testing
| Command | Description |
|---------|-------------|
| `make test` | Run all tests |
| `make test-watch` | Run tests in watch mode |
| `make test-coverage` | Run tests with coverage |
| `make test-unit` | Run unit tests only |
| `make test-integration` | Run integration tests only |

### Code Quality
| Command | Description |
|---------|-------------|
| `make lint` | Run linter |
| `make lint-fix` | Run linter with auto-fix |
| `make format` | Format code |
| `make format-check` | Check code formatting |
| `make typecheck` | Run TypeScript type checking |
| `make quality` | Run all quality checks |
| `make verify` | Full verification suite |

### Version Management
| Command | Description |
|---------|-------------|
| `make version-current` | Show current version |
| `make version-status` | Show version status and suggested bump |
| `make version-sync` | Sync version across all files |

### Release
| Command | Description |
|---------|-------------|
| `make release-patch` | Create patch release (1.0.0 → 1.0.1) |
| `make release-minor` | Create minor release (1.0.0 → 1.1.0) |
| `make release-major` | Create major release (1.0.0 → 2.0.0) |
| `make release-auto` | Auto-detect release type from commits |
| `make release-dry-run` | Dry run of release process |

### Cleanup
| Command | Description |
|---------|-------------|
| `make clean` | Clean all generated files |
| `make clean-all` | Clean everything including node_modules |

## 🔄 Common Workflows

### Bug Fix Release
```bash
# 1. Fix the bug
git add .
git commit -m "fix(auth): resolve token issue"

# 2. Create release
make release-patch
# Result: 1.0.0 → 1.0.1
```

### Feature Release
```bash
# 1. Implement feature
git add .
git commit -m "feat(devices): add lock support"

# 2. Create release
make release-minor
# Result: 1.0.0 → 1.1.0
```

### Breaking Change Release
```bash
# 1. Make breaking changes
git add .
git commit -m "feat(api)!: redesign interface"

# 2. Create release
make release-major
# Result: 1.0.0 → 2.0.0
```

### Test Before Release
```bash
# 1. Check version status
make version-status

# 2. Run quality checks
make quality

# 3. Test release
make release-dry-run

# 4. Create actual release
make release-auto
```

## 📝 Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Common Types
| Type | Version Bump | Example |
|------|--------------|---------|
| `fix:` | PATCH | `fix(auth): resolve token issue` |
| `feat:` | MINOR | `feat(devices): add thermostat support` |
| `feat!:` | MAJOR | `feat(api)!: redesign interface` |
| `BREAKING CHANGE:` | MAJOR | See below |

### Breaking Change Example
```bash
git commit -m "feat(api): redesign device control

BREAKING CHANGE: Device control API has been completely redesigned"
```

## 🛠️ Environment Variables

### Build Script
```bash
SKIP_VALIDATION=true bash scripts/build.sh  # Skip pre-build checks
SKIP_TESTS=true bash scripts/build.sh        # Skip tests
```

### Release Script
```bash
DRY_RUN=true bash scripts/release.sh patch   # Test without changes
SKIP_TESTS=true bash scripts/release.sh patch # Skip tests
SKIP_BUILD=true bash scripts/release.sh patch # Skip build
SKIP_PUBLISH=true bash scripts/release.sh patch # Skip npm publish
```

## 📚 Documentation Links

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md) - Detailed release guide
- [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md) - Build system docs
- [VERSIONING_SYSTEM.md](./VERSIONING_SYSTEM.md) - System overview
- [README.md](../README.md) - Project overview

## 🔍 Quick Checks

### Check Current Version
```bash
make version-current
# Output: 1.0.3
```

### Check Version Status
```bash
make version-status
# Output:
# Current version: 1.0.3
# Last git tag: v1.0.3
# Suggested bump: minor
# Recent commits:
#   - feat: new feature
#   - fix: bug fix
```

### Check Build History
```bash
make build-history
# Shows recent builds with metadata
```

### Check Package Info
```bash
make package-info
# Shows name, version, description, etc.
```

## ⚡ Quick Tips

1. **Always check status before release**
   ```bash
   make version-status
   ```

2. **Use dry run to test**
   ```bash
   make release-dry-run
   ```

3. **Run quality checks regularly**
   ```bash
   make quality
   ```

4. **Use conventional commits**
   - `fix:` for bug fixes
   - `feat:` for new features
   - `feat!:` for breaking changes

5. **Check build artifacts**
   ```bash
   make build-verify
   ```

6. **View changelog**
   ```bash
   make changelog
   ```

## 🆘 Troubleshooting

### Build Fails
```bash
# Check what's failing
make quality

# Fix and retry
make lint-fix
make format
make build
```

### Version Mismatch
```bash
# Sync version across files
make version-sync
```

### Release Fails
```bash
# Test first
make release-dry-run

# Check status
git status
make version-status
```

### Tests Failing
```bash
# Run tests
make test

# Run specific suite
make test-unit
make test-integration
```

## 📞 Getting Help

```bash
# Show all make targets
make help

# Show script usage
bash scripts/version.sh
bash scripts/release.sh
bash scripts/build-tracker.sh
```

## 🎯 Success Checklist

Before releasing:
- [ ] All tests passing (`make test`)
- [ ] Code formatted (`make format`)
- [ ] Code linted (`make lint`)
- [ ] Type check passes (`make typecheck`)
- [ ] Documentation updated
- [ ] Working directory clean (`git status`)

After releasing:
- [ ] Git tag exists
- [ ] npm package published
- [ ] GitHub release created
- [ ] Package installable
