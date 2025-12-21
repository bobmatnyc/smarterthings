# Documentation Organization Guidelines

## Overview

This guide defines where different types of documentation should be placed in the MCP SmartThings project to maintain consistency and discoverability.

## Directory Structure

```
/
├── README.md                    # Project overview, quick start
├── CONTRIBUTING.md              # How to contribute
├── CHANGELOG.md                 # Version history
├── QUICK-START.md              # Daily development commands
├── [Feature]-CONFIGURATION.md   # Root-level config guides (PORT-CONFIGURATION.md, etc.)
├── [Feature]-TESTING.md        # Root-level testing guides (SCENE_EXECUTION_TESTING.md, etc.)
│
└── docs/
    ├── README.md               # Documentation index
    │
    ├── setup/                  # Installation and configuration
    │   ├── installation-guide.md
    │   └── [Platform]-SETUP.md (e.g., LUTRON-SETUP.md, BRILLIANT-SETUP.md)
    │
    ├── api/                    # API documentation
    │   ├── api-reference-*.md
    │   └── direct-mode-api.md
    │
    ├── integration/            # Integration guides
    │   └── [Platform]-integration.md
    │
    ├── research/               # Research documents (dated)
    │   ├── [topic]-[YYYY-MM-DD].md
    │   └── [ticket-id]-[topic]-[YYYY-MM-DD].md
    │
    ├── qa/                     # QA reports and test results
    │   └── [test-type]-[date].md
    │
    ├── qa-reports/            # Detailed QA validation reports
    │
    ├── testing/               # Testing guides and frameworks
    │
    ├── implementation/        # Implementation details
    │
    ├── planning/              # Project planning documents
    │
    ├── summaries/             # Executive summaries
    │
    ├── validation/            # Validation reports
    │
    ├── platforms/             # Platform-specific docs
    │
    └── _archive/              # Obsolete documentation
```

## Documentation Categories and Placement

### 1. Root-Level Documentation (/)

**What goes here**: High-visibility, frequently accessed documents

**Examples**:
- `README.md` - Project overview, installation, basic usage
- `QUICK-START.md` - Daily development commands and common tasks
- `CONTRIBUTING.md` - Contribution guidelines
- `CHANGELOG.md` - Version history
- Configuration guides that developers need frequently:
  - `PORT-CONFIGURATION.md`
  - `[FEATURE]-CONFIGURATION.md`
- Testing guides for specific features:
  - `SCENE_EXECUTION_TESTING.md`
  - `[FEATURE]-TESTING.md`

**Guidelines**:
- Keep to essential documents only
- Use ALL-CAPS naming for high visibility
- Include date in filename if time-sensitive (e.g., `QA-REPORT-1M-345.md`)
- Move to docs/ after initial development phase

### 2. Setup and Installation (docs/setup/)

**What goes here**: User-facing setup guides

**Examples**:
- `installation-guide.md` - Core installation
- `LUTRON-SETUP.md` - Platform integration setup
- `BRILLIANT-SETUP.md` - Platform integration setup
- `SMARTAPP_SETUP.md` - SmartApp configuration

**Naming convention**: `[PLATFORM]-SETUP.md` (uppercase)

**Guidelines**:
- Focus on end-user instructions
- Include prerequisites, step-by-step procedures, troubleshooting
- Use clear section headings
- Include screenshots/diagrams where helpful

### 3. API Documentation (docs/api/)

**What goes here**: API reference, endpoints, data models

**Examples**:
- `api-reference-event-retrieval.md`
- `direct-mode-api.md`
- Endpoint documentation
- Data model specifications

**Guidelines**:
- Document all public APIs
- Include request/response examples
- Specify authentication requirements
- Version APIs appropriately

### 4. Research Documents (docs/research/)

**What goes here**: Investigation results, analysis, design decisions

**Naming convention**: `[topic]-[YYYY-MM-DD].md` or `[ticket-id]-[topic]-[YYYY-MM-DD].md`

**Examples**:
- `integration-requests-smartapps-lutron-2025-12-02.md`
- `brilliant-integration-analysis-2025-12-02.md`
- `smartthings-routines-vs-rules-2025-12-02.md`
- `1m-305-repository-mismatch-investigation.md`

**Guidelines**:
- **ALWAYS include date** in YYYY-MM-DD format
- Include ticket ID if related to specific work
- Document research methodology and findings
- Include recommendations and next steps
- These are historical records - don't update, create new ones

### 5. QA Documentation (docs/qa/ and docs/qa-reports/)

**What goes here**: Test reports, validation results, quality metrics

**Structure**:
- `docs/qa/` - Test results, reports
- `docs/qa-reports/` - Detailed validation reports

**Examples**:
- `FINAL-COMPREHENSIVE-TEST-REPORT.md`
- `SEMANTIC-SEARCH-TEST-REPORT.md`

**Guidelines**:
- Include test date and scope
- Document pass/fail criteria
- Link to related tickets
- Archive old reports annually

### 6. Testing Guides (docs/testing/)

**What goes here**: Testing frameworks, procedures, guides

**Examples**:
- Testing methodology
- Framework documentation
- Test automation guides

**Guidelines**:
- Separate from test results (those go in qa/)
- Focus on "how to test" not "test results"

### 7. Implementation Details (docs/implementation/)

**What goes here**: Technical implementation details, design decisions

**Examples**:
- Architecture diagrams
- Implementation plans
- Design patterns used

**Guidelines**:
- Document "why" not just "what"
- Include code examples
- Link to relevant source files

### 8. Integration Guides (docs/integration/)

**What goes here**: How to integrate with external platforms

**Examples**:
- Platform integration patterns
- API integration guides
- Webhook configurations

**Guidelines**:
- Focus on developer implementation
- User-facing setup goes in docs/setup/

### 9. Platform-Specific Docs (docs/platforms/)

**What goes here**: Platform-specific implementation details

**Structure**:
```
docs/platforms/
├── smartthings/
├── tuya/
└── lutron/
```

**Guidelines**:
- Keep platform-specific technical details here
- User setup guides go in docs/setup/

## Naming Conventions

### File Naming

1. **Setup Guides**: `[PLATFORM]-SETUP.md` (uppercase)
   - Example: `LUTRON-SETUP.md`, `BRILLIANT-SETUP.md`

2. **Research Documents**: `[topic]-[YYYY-MM-DD].md`
   - Example: `smartthings-routines-vs-rules-2025-12-02.md`
   - With ticket: `1m-345-diagnostic-speculation-analysis.md`

3. **Configuration Guides**: `[FEATURE]-CONFIGURATION.md` (uppercase)
   - Example: `PORT-CONFIGURATION.md`, `OAUTH-CONFIGURATION.md`

4. **Testing Guides**: `[FEATURE]-TESTING.md` or `[FEATURE]_TESTING.md` (uppercase)
   - Example: `SCENE_EXECUTION_TESTING.md`, `INTEGRATION_TESTING.md`

5. **API Documentation**: `[resource]-api.md` (lowercase)
   - Example: `direct-mode-api.md`, `automation-api.md`

6. **General Guides**: Use descriptive kebab-case
   - Example: `capability-mapping-guide.md`, `troubleshooting-patterns-guide.md`

### Section Naming

Use clear, hierarchical headings:
```markdown
# Main Title
## Overview
## Prerequisites
## Installation
### Step 1: ...
### Step 2: ...
## Configuration
## Usage
## Troubleshooting
## Related Documentation
```

## Document Templates

### Setup Guide Template

```markdown
# [Platform] Setup Guide

**Last Updated**: YYYY-MM-DD
**Author**: [Name/Team]
**Related Tickets**: [Ticket IDs if applicable]

## Overview

Brief description of what this integration provides.

## Prerequisites

- Required hardware/software
- Required accounts/credentials
- SmartThings hub requirements

## Installation

### Step 1: [First Step]
Detailed instructions...

### Step 2: [Second Step]
Detailed instructions...

## Configuration

Configuration steps...

## Verification

How to verify the setup works...

## Troubleshooting

Common issues and solutions...

## Limitations

Known limitations of this integration...

## Related Documentation

- Link to related docs
- Link to external resources
```

### Research Document Template

```markdown
# [Topic] Research

**Date**: YYYY-MM-DD
**Author**: [Name/Team]
**Related Tickets**: [Ticket IDs]
**Status**: [Draft/Complete/Superseded]

## Executive Summary

1-2 paragraph summary of findings and recommendations.

## Background

Context and motivation for this research.

## Research Questions

1. Question 1?
2. Question 2?

## Methodology

How the research was conducted.

## Findings

### Finding 1: [Title]
Details...

### Finding 2: [Title]
Details...

## Analysis

Interpretation of findings.

## Recommendations

1. Recommendation 1
2. Recommendation 2

## Implementation Plan (if applicable)

- Phase 1: ...
- Phase 2: ...

## Related Documentation

Links to related research or docs.
```

## Document Lifecycle

### Creating New Documentation

1. **Determine category** using guidelines above
2. **Choose appropriate location** based on category
3. **Use naming convention** for that category
4. **Include metadata** at top (date, author, ticket ID)
5. **Link from docs/README.md** if user-facing

### Updating Documentation

1. **Feature docs**: Update in place, note "Last Updated" date
2. **Research docs**: Don't update - create new dated document
3. **Setup guides**: Update in place for corrections, create new version for major changes
4. **API docs**: Version appropriately (e.g., `api-v2.md`)

### Archiving Documentation

Move to `docs/_archive/` when:
- Documentation is obsolete (replaced by newer version)
- Feature is removed
- Document is >2 years old and no longer relevant

**Keep a record** in docs/_archive/README.md explaining why archived.

## Cross-Referencing

### Linking Between Documents

Use relative paths:
```markdown
See [Port Configuration](../PORT-CONFIGURATION.md) for details.
See [Lutron Setup](setup/LUTRON-SETUP.md) for integration guide.
See [Research](research/smartthings-routines-vs-rules-2025-12-02.md) for background.
```

### Linking to Code

```markdown
See implementation in [`src/platforms/smartthings/SmartThingsAdapter.ts`](../src/platforms/smartthings/SmartThingsAdapter.ts#L1236)
```

## Documentation Index

Maintain `docs/README.md` as a comprehensive index:

```markdown
# Documentation Index

## Getting Started
- [Installation Guide](setup/installation-guide.md)
- [Quick Start](../QUICK-START.md)

## Setup Guides
- [Lutron Integration](setup/LUTRON-SETUP.md)
- [Brilliant Integration](setup/BRILLIANT-SETUP.md)

## API Reference
- [Direct Mode API](api/direct-mode-api.md)

## Developer Guides
- [Port Configuration](../PORT-CONFIGURATION.md)
- [Scene Execution Testing](../SCENE_EXECUTION_TESTING.md)

## Research
- [SmartApps and Lutron Integration](research/integration-requests-smartapps-lutron-2025-12-02.md)
```

## Review Checklist

Before committing documentation:

- [ ] File is in correct directory
- [ ] Filename follows naming convention
- [ ] Date included if research/time-sensitive
- [ ] Metadata at top (date, author, tickets)
- [ ] Clear section structure
- [ ] Links work and use relative paths
- [ ] Added to docs/README.md if user-facing
- [ ] Spell-checked and grammar-checked
- [ ] Code examples tested
- [ ] Screenshots current (if included)

## Examples from Current Project

### ✅ Correctly Placed

- `docs/LUTRON-SETUP.md` - User-facing setup guide
- `docs/research/brilliant-integration-analysis-2025-12-02.md` - Research with date
- `PORT-CONFIGURATION.md` - Root-level config (frequently needed)
- `SCENE_EXECUTION_TESTING.md` - Root-level testing guide (active development)

### 📝 Could Be Improved

- `QUICKSTART.md` and `QUICK-START.md` - Duplicate, consolidate to one
- Some root-level files could move to docs/ after active development
- Some research docs missing dates in filename

## Questions?

If unsure where a document should go:

1. Is it **user-facing**? → `docs/setup/` or `docs/`
2. Is it **API reference**? → `docs/api/`
3. Is it **research/analysis**? → `docs/research/` (with date)
4. Is it **testing**? → `docs/testing/` (guides) or `docs/qa/` (results)
5. Is it **configuration** developers need often? → Root level
6. Is it **internal technical details**? → `docs/implementation/` or `docs/platforms/`

When in doubt, prefer `docs/` over root level.
