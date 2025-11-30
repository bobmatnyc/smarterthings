# Linear Tracking Hygiene Guide

**Purpose**: Maintain high-quality Linear ticket tracking to prevent tracking gaps and ensure project visibility.

**Related Tickets**:
- [1M-370](https://linear.app/1m-hyperdev/issue/1M-370) - Review project board and establish Linear tracking hygiene
- [1M-429](https://linear.app/1m-hyperdev/issue/1M-429) - Improve Linear tracking hygiene process

**Last Updated**: 2025-11-30

---

## Current Hygiene Score: 7.5/10

**Target Score**: 9.0/10

### Strengths ✅
- Excellent CHANGELOG hygiene (comprehensive, well-formatted, properly linked)
- 80% git-to-ticket linkage for feature commits
- Clear ticket descriptions with acceptance criteria
- Strong parent-child epic hierarchies (e.g., 1M-415, 1M-371)
- 50+ completed tickets with clear state transitions

### Areas for Improvement ⚠️
- Install analysis dependencies for automated hygiene checks
- Identify and assign orphaned tickets (no epic assignment)
- Standardize git commit linking policy (when required vs. optional)
- Monthly manual hygiene reviews

---

## Automated Hygiene Checks

### Prerequisites

Install mcp-ticketer analysis dependencies:

```bash
pip install mcp-ticketer[analysis]
```

This enables:
- `ticket_find_similar()` - Duplicate ticket detection
- `ticket_find_stale()` - Inactive ticket identification
- `ticket_find_orphaned()` - Tickets without epic assignments
- `ticket_cleanup_report()` - Comprehensive hygiene reports

### Running Hygiene Checks

#### Manual Execution

Use the provided hygiene check script:

```bash
# Run full hygiene analysis
pnpm run hygiene:check

# Or use the script directly
npx tsx scripts/check-linear-hygiene.ts
```

#### Automated Weekly Reports

Configure GitHub Actions workflow (see `.github/workflows/linear-hygiene.yml`):

```yaml
name: Linear Hygiene Report
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
  workflow_dispatch:  # Allow manual trigger
```

### Hygiene Check Output

The script checks for:

1. **Orphaned Tickets** (no epic assignment)
   - Threshold: <5% of open tickets
   - Action: Assign to appropriate epic within 14 days

2. **Stale Tickets** (>30 days without activity)
   - Threshold: <10% of open tickets
   - Action: Review and update or close

3. **Missing Descriptions**
   - Threshold: 0 tickets without descriptions
   - Action: Add description within 7 days

4. **Duplicate Tickets** (>85% similarity)
   - Threshold: 0 known duplicates
   - Action: Consolidate or link related tickets

5. **Git Commit Linkage**
   - Target: 90%+ for feature commits
   - Current: 80% for features, 40% overall

---

## Manual Review Checklist

### Weekly Review (5 minutes)

- [ ] Review newly created tickets for description completeness
- [ ] Check in-progress tickets have assignees
- [ ] Verify recent commits reference ticket IDs
- [ ] Update CHANGELOG for completed features

### Monthly Review (30 minutes)

- [ ] Run automated hygiene report (`pnpm run hygiene:check`)
- [ ] Review orphaned tickets and assign to epics
- [ ] Audit stale tickets (>30 days no activity)
  - Update status or close
  - Add comments explaining delays
- [ ] Validate epic structure and parent-child relationships
- [ ] Check priority assignments reflect current needs

### Quarterly Review (1-2 hours)

- [ ] Comprehensive git commit linkage audit
- [ ] Review and update hygiene processes
- [ ] Train team on hygiene best practices
- [ ] Update this documentation with lessons learned
- [ ] Generate team hygiene scorecard

---

## Git Commit Linking Standards

### Required Ticket References

**MUST include ticket ID** in commit message:

- ✅ **Feature commits** (`feat:`)
- ✅ **Bug fix commits** (`fix:`)
- ✅ **Documentation for features** (`docs:` when feature-related)

**Example**:
```bash
feat(devices): add temperature sensor support (1M-425)
fix(auth): resolve token refresh race condition (1M-432)
docs: add API reference for temperature sensors (1M-425)
```

### Optional Ticket References

**MAY include ticket ID** (use judgment):

- ⚪ **Chore commits** (`chore:`) - infrastructure, dependencies
- ⚪ **Refactoring** (`refactor:`) - if not tracked separately
- ⚪ **Test commits** (`test:`) - if adding tests for existing features
- ⚪ **Style commits** (`style:`) - formatting changes

**Example**:
```bash
chore: update build metadata
refactor: simplify error handling in auth module (1M-415)
test: add missing coverage for temperature sensors (1M-425)
```

### Not Required

**NO ticket ID needed**:

- ❌ Release commits
- ❌ Merge commits
- ❌ Version bumps
- ❌ Minor typo fixes

### Commit Message Template

```bash
<type>(<scope>): <subject> (<ticket-id>)

<body>

<footer>
```

**Example**:
```bash
feat(mcp): implement automation script building tools (1M-411)

Add new MCP tools for building automation scripts from device state:
- build_automation_script: Generate SmartThings automations
- Supports time-based and device-based triggers
- Includes validation and preview modes

Closes 1M-411
```

---

## Ticket Lifecycle Best Practices

### Creating Tickets

**Required Fields**:
- **Title**: Clear, action-oriented (e.g., "Implement temperature sensor support")
- **Description**: Problem statement, requirements, acceptance criteria
- **Priority**: Critical, High, Medium, or Low
- **Epic Assignment**: Link to parent epic/project
- **Assignee**: Assign when moving to "In Progress"

**Recommended Fields**:
- **Tags**: Relevant labels (e.g., "api-integration", "p0-critical")
- **Estimated Hours**: For planning and capacity management
- **Technical Approach**: Implementation notes or design decisions

### Ticket States

Valid state transitions:

```
open → in_progress → done
      ↓
   waiting/blocked → in_progress → done
```

**State Guidelines**:
- **Open**: Ticket created, not started
- **In Progress**: Actively being worked on (MUST have assignee)
- **Waiting**: Blocked by external dependency (add comment explaining why)
- **Blocked**: Blocked by internal dependency (link to blocking ticket)
- **Done**: Completed, tested, merged, and deployed

### Epic Organization

**Epic Structure**:
```
Project/Epic (e.g., 1M-415 - Refactor SOA/DI Architecture)
├── 1M-416 - Design service interfaces
├── 1M-417 - Enhance DI container
├── 1M-418 - Create base infrastructure
└── ... (10-15 child tickets)
```

**Best Practices**:
- Epics should have 5-20 child tickets (break down if larger)
- All open tickets should belong to an epic
- Epic descriptions should include overall goals and timeline
- Update epic status when majority of children complete

---

## CHANGELOG Update Requirements

### When to Update CHANGELOG

**Required for release** (before creating version tag):

- ✅ All **features** (`feat:`) in the release
- ✅ All **bug fixes** (`fix:`) affecting users
- ✅ Any **breaking changes** (`BREAKING CHANGE:`)
- ✅ Significant **performance improvements** (`perf:`)

**Optional** (add if notable):
- ⚪ Major refactorings that affect architecture
- ⚪ Deprecation notices
- ⚪ Security fixes (add even if not user-facing)

### CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

### Added
- **Feature Name** ([#1M-XXX](https://linear.app/1m-hyperdev/issue/1M-XXX))
  - Brief description of feature
  - Key capabilities or metrics
  - Performance notes if applicable

### Changed
- **Refactoring Name** ([#1M-XXX](https://linear.app/1m-hyperdev/issue/1M-XXX))
  - What changed and why
  - Impact on users or developers

### Fixed
- **Bug Fix** ([#1M-XXX](https://linear.app/1m-hyperdev/issue/1M-XXX))
  - What was broken
  - How it was fixed
```

**Example** (from mcp-smartthings):
```markdown
### Added
- **Automation Script Building MCP Tools** ([#1M-411](https://linear.app/1m-hyperdev/issue/1M-411))
  - Implemented `build_automation_script` for generating SmartThings automations
  - Supports time-based and device-based triggers
  - Includes validation and preview modes
  - Performance: <200ms for typical automation definitions
```

---

## Ticket Quality Standards

### Excellent Ticket Example

**Title**: `Implement 20k token pagination for all MCP tool responses`

**Description**:
```markdown
## Problem
MCP tool responses can exceed 20,000 tokens, causing context overflow
and poor user experience in Claude Code terminal UI.

## Requirements
* All MCP tools must detect when response would exceed 20k tokens
* Implement automatic pagination mechanism
* Preserve full data fidelity (no truncation)
* Provide clear navigation for paginated results

## Acceptance Criteria
- [ ] No single MCP tool response exceeds 20k tokens
- [ ] Paginated responses include total count and page info
- [ ] Navigation prompts guide users through pages
- [ ] Tests verify pagination at boundary conditions
- [ ] Documentation updated with pagination behavior

## Technical Approach
1. Add token counting utility function
2. Implement pagination wrapper for tool responses
3. Update all tools to use pagination wrapper
4. Add integration tests for large datasets
```

**Why This Is Excellent**:
- ✅ Clear problem statement
- ✅ Specific, measurable requirements
- ✅ Checkbox acceptance criteria
- ✅ Technical implementation notes
- ✅ Linked to relevant tags and epic

### Poor Ticket Examples

❌ **Too Vague**:
```
Title: Fix bug
Description: The thing doesn't work
```

❌ **Missing Context**:
```
Title: Add feature X
Description: (empty)
```

❌ **No Acceptance Criteria**:
```
Title: Improve performance
Description: Make it faster
```

---

## Troubleshooting

### Hygiene Check Script Errors

**Error**: `Analysis features not available`
```
Solution: Install analysis dependencies
pip install mcp-ticketer[analysis]
```

**Error**: `Epic list query failure`
```
Workaround: Use individual ticket reads to validate epic assignments
Report issue to mcp-ticketer maintainers
```

**Error**: `Token limit exceeded`
```
Solution: Use compact mode and pagination in queries
ticket_list(compact=True, limit=50)
```

### Common Issues

**Issue**: Tickets stuck in "Open" state
```
Action: Assign owner and move to "In Progress" when work starts
```

**Issue**: Orphaned tickets without epic
```
Action: Run hygiene check, identify orphans, assign to appropriate epic
```

**Issue**: Git commits missing ticket references
```
Action: Review commit standards, consider git hooks for validation
```

---

## Success Metrics

### Target Hygiene Scores

| Metric | Current | Target | Excellent |
|--------|---------|--------|-----------|
| Overall Hygiene Score | 7.5/10 | 9.0/10 | 9.5/10 |
| Tickets with Descriptions | 95% | 100% | 100% |
| Epic Assignment Rate | ~80% | 95% | 98% |
| Git Commit Linkage (Features) | 80% | 90% | 95% |
| Stale Tickets (<30 days activity) | Unknown | <10% | <5% |
| Orphaned Tickets | Unknown | <5% | <2% |

### Weekly Tracking

Record these metrics weekly:

```markdown
Week of YYYY-MM-DD:
- Hygiene Score: X.X/10
- Open Tickets: XX
- In Progress: XX
- Orphaned Tickets: XX (X%)
- Stale Tickets: XX (X%)
- Git Linkage: XX%
```

---

## Backfill Procedures

When tracking gaps are discovered:

### 1. Identify Tracking Gap

- Review CHANGELOG for features without tickets
- Audit git commits without ticket references
- Check completed work missing from Linear

### 2. Create Backfill Tickets

**Naming Convention**: `[Backfill] Feature Name (vX.Y.Z)`

**Example**:
```
Title: [Backfill] Implement 20k token pagination (v1.3.1)
Description: Historical tracking for work completed in v1.3.1
- Git commits: 40007fc, 4d51770
- CHANGELOG entry: v1.3.1
State: Done
```

### 3. Link Backfill Tickets

- Assign to appropriate epic
- Link to related tickets
- Reference git commits and CHANGELOG entries
- Mark as "Done" immediately (historical record)

### 4. Document Lessons Learned

- Identify root cause of tracking gap
- Update hygiene processes to prevent recurrence
- Share findings with team

---

## Resources

### Tools and Scripts

- **Hygiene Check Script**: `scripts/check-linear-hygiene.ts`
- **mcp-ticketer CLI**: `aitrackdown ticket cleanup-report`
- **Linear API**: [Linear GraphQL API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api)

### Documentation

- [Linear Tracking Hygiene Research](../docs/research/linear-tracking-hygiene-2025-11-30.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [CHANGELOG.md](../CHANGELOG.md)

### Related Tickets

- [1M-370](https://linear.app/1m-hyperdev/issue/1M-370) - Review project board and establish hygiene
- [1M-429](https://linear.app/1m-hyperdev/issue/1M-429) - Improve hygiene process (automation)

---

## Contact

**Hygiene Maintenance Owner**: Bob Matsuoka (bob@matsuoka.com)

**Questions?** Create a ticket or comment on 1M-429.

---

**Document Version**: 1.0.0
**Last Review**: 2025-11-30
**Next Review**: 2025-12-31
