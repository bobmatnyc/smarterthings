.PHONY: help install build clean test lint format typecheck verify release-patch release-minor release-major release-auto publish dev version-status version-sync build-history build-clean docs-build docs-serve pre-commit setup

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

# Project directories
SCRIPTS_DIR := ./scripts
DIST_DIR := ./dist
DOCS_DIR := ./docs

##@ General

help: ## Display this help message
	@echo ""
	@echo "$(BLUE)mcp-smartthings - Makefile targets$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""

##@ Development

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@pnpm install

dev: ## Start development mode with watch
	@echo "$(BLUE)Starting development mode...$(NC)"
	@pnpm run dev

chat: ## Run interactive chat CLI (dev mode)
	@echo "$(BLUE)Starting chat CLI...$(NC)"
	@pnpm run chat:dev

alexa-server: ## Run Alexa server (dev mode)
	@echo "$(BLUE)Starting Alexa server...$(NC)"
	@pnpm run alexa-server:dev

##@ Build

build: ## Build the project (full production build)
	@echo "$(BLUE)Building project...$(NC)"
	@bash $(SCRIPTS_DIR)/build.sh

build-dev: ## Build in development mode
	@echo "$(BLUE)Building in development mode...$(NC)"
	@SKIP_VALIDATION=true SKIP_TESTS=true bash $(SCRIPTS_DIR)/build.sh

build-clean: ## Clean build artifacts
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf $(DIST_DIR)
	@echo "$(GREEN)Build artifacts cleaned$(NC)"

build-verify: ## Verify build artifacts
	@echo "$(BLUE)Verifying build artifacts...$(NC)"
	@test -d $(DIST_DIR) || (echo "$(YELLOW)dist/ directory not found$(NC)" && exit 1)
	@test -f $(DIST_DIR)/index.js || (echo "$(YELLOW)dist/index.js not found$(NC)" && exit 1)
	@echo "$(GREEN)Build artifacts verified$(NC)"

build-history: ## Show build history
	@bash $(SCRIPTS_DIR)/build-tracker.sh history

build-latest: ## Show latest build info
	@bash $(SCRIPTS_DIR)/build-tracker.sh latest

build-track-clean: ## Clean build tracking data
	@bash $(SCRIPTS_DIR)/build-tracker.sh clean

##@ Testing

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	@pnpm test

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	@pnpm run test:watch

test-coverage: ## Run tests with coverage
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@pnpm run test:coverage

test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(NC)"
	@pnpm run test:unit

test-integration: ## Run integration tests only
	@echo "$(BLUE)Running integration tests...$(NC)"
	@pnpm run test:integration

test-inspector: ## Run MCP inspector
	@echo "$(BLUE)Running MCP inspector...$(NC)"
	@pnpm run test:inspector

##@ Code Quality

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	@pnpm run lint

lint-fix: ## Run linter with auto-fix
	@echo "$(BLUE)Running linter with auto-fix...$(NC)"
	@pnpm run lint:fix

format: ## Format code with prettier
	@echo "$(BLUE)Formatting code...$(NC)"
	@pnpm run format

format-check: ## Check code formatting
	@echo "$(BLUE)Checking code formatting...$(NC)"
	@pnpm run format:check

typecheck: ## Run TypeScript type checking
	@echo "$(BLUE)Running type check...$(NC)"
	@pnpm run typecheck

quality: lint typecheck test ## Run all quality checks (lint, typecheck, test)
	@echo "$(GREEN)All quality checks passed!$(NC)"

verify: clean install typecheck lint test build ## Full verification suite
	@echo "$(GREEN)Full verification completed successfully!$(NC)"

##@ Version Management

version-current: ## Show current version
	@bash $(SCRIPTS_DIR)/version.sh current

version-status: ## Show version status and suggested bump
	@bash $(SCRIPTS_DIR)/version.sh status

version-sync: ## Sync version across all files
	@bash $(SCRIPTS_DIR)/version.sh sync

version-bump-patch: ## Bump patch version (1.0.0 -> 1.0.1)
	@bash $(SCRIPTS_DIR)/version.sh bump patch

version-bump-minor: ## Bump minor version (1.0.0 -> 1.1.0)
	@bash $(SCRIPTS_DIR)/version.sh bump minor

version-bump-major: ## Bump major version (1.0.0 -> 2.0.0)
	@bash $(SCRIPTS_DIR)/version.sh bump major

##@ Release

release-patch: ## Create patch release (1.0.0 -> 1.0.1)
	@echo "$(BLUE)Creating patch release...$(NC)"
	@bash $(SCRIPTS_DIR)/release.sh patch

release-minor: ## Create minor release (1.0.0 -> 1.1.0)
	@echo "$(BLUE)Creating minor release...$(NC)"
	@bash $(SCRIPTS_DIR)/release.sh minor

release-major: ## Create major release (1.0.0 -> 2.0.0)
	@echo "$(BLUE)Creating major release...$(NC)"
	@bash $(SCRIPTS_DIR)/release.sh major

release-auto: ## Auto-detect release type from commits
	@echo "$(BLUE)Creating auto-detected release...$(NC)"
	@bash $(SCRIPTS_DIR)/release.sh auto

release-dry-run: ## Dry run of release process (patch)
	@echo "$(BLUE)Dry run of release process...$(NC)"
	@DRY_RUN=true bash $(SCRIPTS_DIR)/release.sh patch

publish: ## Publish to npm (standalone)
	@echo "$(BLUE)Publishing to npm...$(NC)"
	@npm publish --access public

##@ Cleanup

clean: build-clean ## Clean all generated files
	@echo "$(BLUE)Cleaning all generated files...$(NC)"
	@rm -rf node_modules/.cache
	@echo "$(GREEN)Cleanup completed$(NC)"

clean-all: clean ## Clean everything including node_modules
	@echo "$(BLUE)Cleaning everything...$(NC)"
	@rm -rf node_modules
	@rm -rf .build
	@echo "$(GREEN)Deep cleanup completed$(NC)"

##@ Setup

setup: install build ## Initial project setup
	@echo "$(GREEN)Project setup completed!$(NC)"
	@echo ""
	@echo "Next steps:"
	@echo "  - Run 'make dev' to start development mode"
	@echo "  - Run 'make test' to run tests"
	@echo "  - Run 'make help' to see all available commands"

pre-commit: lint-fix format test ## Run pre-commit checks (format, lint, test)
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"

##@ CI/CD

ci-test: ## CI test workflow
	@echo "$(BLUE)Running CI tests...$(NC)"
	@pnpm run typecheck
	@pnpm run lint
	@pnpm test

ci-build: ## CI build workflow
	@echo "$(BLUE)Running CI build...$(NC)"
	@bash $(SCRIPTS_DIR)/build.sh

ci-verify: install ci-test ci-build ## Full CI verification
	@echo "$(GREEN)CI verification completed!$(NC)"

##@ Utilities

changelog: ## View changelog
	@cat CHANGELOG.md

gitignore-check: ## Check for files that should be ignored
	@echo "$(BLUE)Checking for files that should be ignored...$(NC)"
	@git status --ignored --short

package-info: ## Show package information
	@echo "$(BLUE)Package Information:$(NC)"
	@echo "Name: $$(node -p "require('./package.json').name")"
	@echo "Version: $$(node -p "require('./package.json').version")"
	@echo "Description: $$(node -p "require('./package.json').description")"
	@echo "Author: $$(node -p "require('./package.json').author")"
	@echo "License: $$(node -p "require('./package.json').license")"
