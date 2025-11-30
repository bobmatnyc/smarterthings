# Linear Tracking Hygiene Research - Ticket 1M-370

**Research Date**: 2025-11-30
**Ticket**: [1M-370 - Review project board and establish Linear tracking hygiene](https://linear.app/1m-hyperdev/issue/1M-370/review-project-board-and-establish-linear-tracking-hygiene)
**Project**: mcp-smarterthings (89098cb0dd3c)
**Researcher**: Research Agent

---

## Executive Summary

Analysis of Linear tracking hygiene for the mcp-smartthings project reveals **GOOD overall hygiene** with some organizational improvements needed. The ticket 1M-370 appears to reference work completed in the **mcp-ticketer** project (not mcp-smartthings), suggesting a potential project context mismatch.

**Key Findings**:
- ✅ **Strong completion tracking**: 50+ completed tickets with clear state transitions
- ✅ **Active development**: 3 tickets in progress, 50 open tickets
- ✅ **Good priority distribution**: Clear critical/high/medium/low priority assignments
- ⚠️ **Parent-child relationships**: Some tickets missing parent epic assignments
- ⚠️ **Project context confusion**: Ticket 1M-370 references mcp-ticketer work but is in mcp-smartthings project
- ⚠️ **Analysis tools unavailable**: mcp-ticketer[analysis] dependencies not installed

**Hygiene Score**: 7.5/10 (Good, with room for improvement)

---

## 1. Ticket 1M-370 Requirements Analysis

### Ticket Details
- **ID**: 1M-370
- **Title**: Review project board and establish Linear tracking hygiene
- **Status**: In Progress (HIGH priority)
- **Created**: 2025-11-29T15:01:22Z
- **Updated**: 2025-11-29T15:01:27Z
- **Parent Epic**: cbeff74a-edd7-4125-ac73-f64161cf91b3 (mcp-ticketer epic)
- **Assignee**: None

### Stated Objectives
1. ✅ **Backfill tickets** for completed v1.3.1 and v1.2.15 work
2. ✅ **Link tickets** to git commits and CHANGELOG entries
3. ⏳ **Document lessons learned** about tracking discipline
4. ⏳ **Create process improvement ticket** for future prevention

### Acceptance Criteria
- ✅ All recent completed work has corresponding Linear tickets (marked DONE)
- ✅ Tickets linked to project epic (mcp-ticketer eac28953c267)
- ⏳ Process improvement ticket created
- ⏳ Tracking gap documented and resolved

### Related Work Referenced
- **1M-363**: Implement 20k token pagination (DONE) - v1.3.1
- **1M-315**: Automatic project_update tool (DONE) - v1.2.15
- **1M-316**: Project status analysis tool (DONE) - v1.2.15
- **Git commits**: 40007fc, 4d51770, e51cef9, 2dadc7b
- **CHANGELOG**: v1.3.1, v1.2.15 sections

### Backfill Tickets Created
Analysis shows these backfill tickets were already created:
- ✅ **1M-372**: [Backfill] Implement 20k token pagination (v1.3.1) - DONE
- ✅ **1M-373**: [Backfill] Automatic project updates on ticket transitions (v1.2.15) - DONE
- ✅ **1M-374**: [Backfill] Project status analysis with actionable insights (v1.2.15) - DONE
- ✅ **1M-375**: [Backfill] Fix workflow state handling and epic assignment (v1.2.15) - DONE

**Finding**: The backfill objective has been **COMPLETED** - all 4 backfill tickets created and marked DONE.

---

## 2. Project Context Analysis

### Critical Finding: Project Mismatch

**Issue**: Ticket 1M-370 references work completed in the **mcp-ticketer** project, but the ticket is assigned to the **mcp-smartthings** epic.

**Evidence**:
- Ticket description mentions "mcp-ticketer eac28953c267" as the target project
- Referenced tickets (1M-363, 1M-315, 1M-316) are mcp-ticketer features
- Git commits mentioned (40007fc, 4d51770, etc.) are from mcp-ticketer repo
- Current analysis is running in mcp-smartthings project (/Users/masa/Projects/mcp-smartthings)
- Ticket's parent_epic is cbeff74a-edd7-4125-ac73-f64161cf91b3 (mcp-ticketer epic)

**Impact**:
- Researching mcp-smartthings project hygiene when ticket scope is mcp-ticketer hygiene
- May need to analyze mcp-ticketer project instead
- Cross-project ticket tracking may need clarification

**Recommendation**:
- Clarify ticket scope - should it analyze mcp-ticketer or mcp-smartthings?
- If mcp-ticketer: Re-run analysis in correct project context
- If mcp-smartthings: Update ticket description to reflect actual project scope

---

## 3. Current Linear Hygiene State (mcp-smartthings)

### Ticket Distribution

**By State**:
- **Open**: 50 tickets
- **In Progress**: 3 tickets (1M-382, 1M-370, 1M-275)
- **Done**: 50+ tickets (excellent completion tracking)

**By Priority** (sample of open tickets):
- **Critical**: 1M-371 (Phase 2: Core Platform Architecture)
- **High**: 1M-415 (Refactor Commands to SOA/DI)
- **Medium**: Various tickets
- **Low**: 1M-428 (Update documentation)

### Parent-Child Relationships

**Strong Hierarchy Examples**:
- ✅ **1M-415** (Refactor SOA/DI) has 13 child tickets (1M-416 through 1M-428)
  - Clear work breakdown structure
  - Parent epic: 244a309e-c073-4643-a9a6-0d2409349781

- ✅ **1M-371** (Phase 2 Platform) has 6 child tickets (1M-376 through 1M-381)
  - Clear phase planning
  - Parent epic: 4a248615-f1dd-4669-9f61-edec2d2355ac

**Orphaned Tickets** (examples needing epic assignment):
- Many open tickets from the initial list (1M-428, 1M-414, 1M-413, etc.) may lack clear epic relationships
- Need comprehensive scan to identify all orphans

### Completed Work Tracking

**Recent Completions** (from CHANGELOG and done tickets):
- ✅ **1M-411**: Phase 4.1 - Automation script building MCP tools (DONE)
- ✅ **1M-412**: Phase 4.2 - Direct Mode API (DONE)
- ✅ **1M-287**: Phase 3.2 - get_system_status MCP tool (DONE)
- ✅ **1M-288**: Phase 3.3 - Health checks in DiagnosticWorkflow (DONE)
- ✅ **1M-286**: PatternDetector service (DONE)
- ✅ **1M-311**: Integration tests for DiagnosticWorkflow (DONE)

**Git Commit Tracking**:
Recent commits show good ticket references:
```
5e834ef docs: add comprehensive Direct Mode API documentation (1M-412)
b0c8935 feat: implement Direct Mode API for in-process tool calls (1M-412)
8e4ae71 docs: add research and QA verification for automation tools (1M-411)
4ebf40d feat: implement automation script building MCP tools (1M-411)
81842b5 docs: add QA verification reports and dual-mode MCP architecture (1M-287, 1M-288)
```

**Finding**: Excellent git-to-ticket linkage in recent work (1M-411, 1M-412, 1M-287, 1M-288).

---

## 4. Hygiene Issues Identified

### 4.1 Analysis Tools Unavailable

**Issue**: mcp-ticketer analysis features not available
```
Error: "Analysis features not available"
Message: "Install analysis dependencies with: pip install mcp-ticketer[analysis]"
Required: scikit-learn>=1.3.0, rapidfuzz>=3.0.0, numpy>=1.24.0
```

**Impact**: Cannot run automated hygiene checks:
- `ticket_find_similar()` - Duplicate detection unavailable
- `ticket_find_stale()` - Stale ticket detection unavailable
- `ticket_find_orphaned()` - Orphaned ticket detection unavailable
- `ticket_cleanup_report()` - Comprehensive cleanup report unavailable

**Recommendation**:
```bash
pip install mcp-ticketer[analysis]
```

**Priority**: MEDIUM - enables automated hygiene monitoring

### 4.2 Epic List Query Failure

**Issue**: Linear API error when listing epics
```
Error: Variable "$filter" got invalid value { teams: { some: [Object] } }
Field "teams" is not defined by type "ProjectFilter"
```

**Impact**: Cannot validate epic structure or identify orphaned tickets programmatically

**Recommendation**:
- Report bug to mcp-ticketer maintainers
- Use alternative query method to list epics
- Validate epic relationships through individual ticket reads

**Priority**: HIGH - blocks automated epic hygiene validation

### 4.3 Large Response Sizes

**Issue**: Initial ticket_list query exceeded 25,000 token limit (68,472 tokens returned)

**Mitigation Applied**:
- Used compact mode
- Applied state filters (open, in_progress, done)
- Reduced limit to 50 tickets per query

**Finding**: Pagination working correctly after adjustment. No systematic issue.

### 4.4 Project Context Confusion

**Issue**: Ticket 1M-370 scope unclear - references mcp-ticketer but analyzed in mcp-smartthings

**Evidence**: See Section 2 "Project Context Analysis"

**Recommendation**:
- Clarify intended project scope
- If mcp-ticketer: Re-run analysis in that project
- If cross-project: Document multi-project tracking requirements

**Priority**: HIGH - affects accuracy of hygiene analysis

---

## 5. Ticket Quality Assessment

### Strong Practices Observed

✅ **Clear Titles**: Descriptive, action-oriented titles
- "Implement 20k token pagination for all MCP tool responses" (1M-363)
- "Refactor Commands to SOA/DI Architecture" (1M-415)

✅ **Detailed Descriptions**: Comprehensive context and requirements
- 1M-363, 1M-315, 1M-316 all have detailed problem statements, requirements, and acceptance criteria

✅ **Priority Assignment**: Consistent priority levels
- Critical, high, medium, low clearly assigned
- Priority reflects actual urgency (e.g., 1M-371 Phase 2 = critical)

✅ **State Transitions**: Clear progression through workflow
- open → in_progress → done
- No tickets stuck in ambiguous states

✅ **Tagging**: Meaningful tags applied
- 1M-363: ["terminal-ui", "schema", "examples"]
- 1M-315: ["integration-tests", "api-integration", "p0-critical", "ai-features"]
- 1M-316: ["analysis", "recommendations", "high-priority", "ai"]

✅ **Assignee Tracking**: Tickets have assignees where appropriate
- 1M-415, 1M-428: bob@matsuoka.com
- 1M-371: bob@matsuoka.com

### Areas for Improvement

⚠️ **Incomplete Descriptions**: Some tickets may lack detail
- Could not verify all 50+ open tickets individually
- Manual review needed for tickets without extensive descriptions

⚠️ **Orphaned Tickets**: Tickets without parent epic assignments
- Comprehensive scan blocked by epic_list failure
- Sample checks show most have epics, but full audit needed

⚠️ **Stale Ticket Detection**: Unable to identify inactive tickets
- Analysis tools unavailable (requires mcp-ticketer[analysis])
- Manual review of last_updated timestamps needed

⚠️ **Duplicate Detection**: Cannot identify similar tickets
- Analysis tools unavailable
- Risk of duplicate work or fragmented discussions

---

## 6. Git Commit Linkage Analysis

### Recent Commits (Last 30)

**Excellent Linkage Examples**:
```
5e834ef docs: add comprehensive Direct Mode API documentation (1M-412)
b0c8935 feat: implement Direct Mode API (1M-412)
8e4ae71 docs: add research and QA verification (1M-411)
4ebf40d feat: implement automation script building MCP tools (1M-411)
81842b5 docs: add QA verification reports (1M-287, 1M-288)
6ff3e1f feat: implement get_system_status MCP tool (1M-287)
510a92d feat: integrate health checks into DiagnosticWorkflow (1M-288)
a029900 feat: implement PatternDetector service (1M-286)
18d4e39 feat: add integration tests for DiagnosticWorkflow (1M-311)
```

**Good Practices**:
- Consistent ticket ID format in commit messages (1M-XXX)
- Multiple commits per ticket show progressive work
- Documentation commits linked to feature tickets

**Commits Without Ticket Links**:
```
0fc0ddc chore: update build metadata
fc6e2ed fix: resolve 62 TypeScript strict mode errors
daa9840 fix: resolve CI workflow and TypeScript strict mode errors
b2b49c1 fix: skip integration tests in CI environments
d5e33d5 docs: add GitHub Actions workflow verification reports
84bd57d fix: remove duplicate pnpm version specification
1c0a2dd docs: add Integration Tests badge to README
8a287f5 feat: add GitHub Actions workflow for integration tests
```

**Analysis**:
- ~40% of recent commits (12/30) lack ticket references
- Many are infrastructure/chore commits (build, CI, fixes)
- May not need ticket tracking for small maintenance tasks

**Recommendation**:
- Continue linking feature commits to tickets (already doing well)
- Consider optional ticket tracking for chore/fix commits
- Document policy: When to require ticket references

---

## 7. CHANGELOG Hygiene

### Current State (v0.7.0)

**Strengths**:
- Follows [Keep a Changelog](https://keepachangelog.com/) format
- Clear version sections with dates
- Features linked to ticket IDs with Linear URLs
- Comprehensive descriptions of changes
- Grouped by Added/Changed/Fixed categories

**Example Entry** (excellent format):
```markdown
### Added
- **Pattern Detection in Diagnostic Framework** ([#1M-307](https://linear.app/1m-hyperdev/issue/1M-307))
  - Implemented 4 pattern detection algorithms
  - Achieved 95%+ confidence on real-world automation detection
  - Performance: <100ms for 100 events
  - 12/12 comprehensive test coverage
```

**Unreleased Section**:
- Currently has 2 major features documented
- Shows active development tracking
- Ready for next release tagging

**Finding**: CHANGELOG hygiene is **EXCELLENT** - comprehensive, well-formatted, properly linked.

---

## 8. Missing Information Identification

### Tickets Needing Descriptions

**Could not verify** without reading all 50+ open tickets individually.

**Sample Check** (verified tickets have descriptions):
- ✅ 1M-363: Detailed description with problem, requirements, acceptance criteria
- ✅ 1M-315: Comprehensive description with background, requirements, technical notes
- ✅ 1M-316: Extensive description with goals, implementation details, acceptance criteria
- ✅ 1M-415: Clear description with issues, goals, scope, phases
- ✅ 1M-428: Brief but complete description with acceptance criteria

**Recommendation**: Spot-check remaining open tickets for description completeness.

### Tickets Missing Priority

**From compact listing**, most tickets appear to have priority assigned:
- 1M-371: critical
- 1M-415: high
- 1M-428: low

**Recommendation**: Run full priority audit with query:
```python
ticket_list(project_id="...", priority=None)  # Find unassigned
```

### Tickets Without Assignees

**Examples from verified tickets**:
- ❌ 1M-370: No assignee (current ticket - should be assigned!)
- ❌ 1M-363: No assignee (completed work)
- ✅ 1M-415: bob@matsuoka.com
- ✅ 1M-428: bob@matsuoka.com
- ✅ 1M-371: bob@matsuoka.com

**Finding**: Mix of assigned and unassigned tickets. Unassigned pattern seems to correlate with:
- Completed tickets (may be acceptable)
- Process improvement tickets like 1M-370

**Recommendation**: Assign 1M-370 since it's in progress.

---

## 9. Recommendations and Action Plan

### Immediate Actions (Week 1)

1. **CLARIFY PROJECT SCOPE** (Priority: CRITICAL)
   - Determine if 1M-370 should analyze mcp-ticketer or mcp-smartthings
   - Update ticket description to reflect actual project scope
   - If mcp-ticketer: Re-run this analysis in correct repository
   - If mcp-smartthings: Update ticket description to remove mcp-ticketer references

2. **ASSIGN TICKET 1M-370** (Priority: HIGH)
   - Ticket is in progress but has no assignee
   - Action: Assign to current owner (likely bob@matsuoka.com based on pattern)

3. **INSTALL ANALYSIS DEPENDENCIES** (Priority: MEDIUM)
   ```bash
   pip install mcp-ticketer[analysis]
   ```
   - Enables automated duplicate detection
   - Enables stale ticket identification
   - Enables orphaned ticket scanning
   - Enables comprehensive cleanup reports

4. **REPORT EPIC_LIST BUG** (Priority: HIGH)
   - Linear API query failure prevents epic hygiene validation
   - Error: "Field 'teams' is not defined by type 'ProjectFilter'"
   - Impact: Cannot programmatically validate epic structure
   - Action: Report to mcp-ticketer maintainers with error details

### Short-term Improvements (Week 2-4)

5. **RUN AUTOMATED HYGIENE ANALYSIS**
   - After installing analysis dependencies, run:
     ```python
     ticket_find_similar(threshold=0.75, limit=20)
     ticket_find_stale(age_threshold_days=30, activity_threshold_days=14)
     ticket_find_orphaned(limit=100)
     ticket_cleanup_report(summary_only=False)
     ```
   - Review findings and create cleanup tickets

6. **VALIDATE EPIC ASSIGNMENTS**
   - Manual review of epic assignments (until epic_list fixed)
   - Ensure all open tickets linked to appropriate epics
   - Create missing epic relationships

7. **AUDIT TICKET PRIORITIES**
   - Review all open tickets for priority assignments
   - Ensure priorities reflect current business needs
   - Update stale priorities (work from months ago may have changed)

8. **STANDARDIZE CHORE COMMIT POLICY**
   - Document when ticket references are required in commits
   - Options:
     - Required for features/bugs (already doing well)
     - Optional for chore/fix/docs (current mixed practice)
     - Required for all commits (most strict)
   - Add to CONTRIBUTING.md

### Long-term Process Improvements

9. **CREATE PROCESS IMPROVEMENT TICKET** (Per 1M-370 acceptance criteria)
   - Title: "Establish Linear tracking discipline and automation"
   - Objectives:
     - Prevent future tracking gaps
     - Automate hygiene monitoring (weekly cleanup reports)
     - Document ticket creation workflow
     - Create commit message templates with ticket references
   - Acceptance criteria:
     - Weekly automated hygiene reports
     - Documented ticket workflow in CONTRIBUTING.md
     - Git hooks for commit message validation (optional)
     - Training materials for new contributors

10. **AUTOMATE HYGIENE MONITORING**
    - Schedule weekly hygiene reports
    - Integration options:
      - GitHub Actions scheduled job
      - Linear webhook on ticket transitions
      - CLI cron job: `aitrackdown ticket cleanup-report`
    - Alert on:
      - Stale tickets (>30 days no activity)
      - Orphaned tickets (no epic)
      - Duplicate tickets (>85% similarity)
      - Missing priorities or assignees

11. **DOCUMENT LESSONS LEARNED** (Per 1M-370 acceptance criteria)
    - Create docs/LINEAR_TRACKING_BEST_PRACTICES.md
    - Include:
      - Commit message format requirements
      - When to create tickets (features, bugs, chores)
      - Epic organization principles
      - CHANGELOG update workflow
      - Backfill procedure (when needed)
    - Share with team

---

## 10. Evidence-Based Hygiene Score

### Scoring Criteria (0-10 scale)

| Criteria | Score | Evidence |
|----------|-------|----------|
| **Ticket Descriptions** | 9/10 | Sample checks show comprehensive descriptions with acceptance criteria |
| **Priority Assignment** | 8/10 | Most tickets have priorities; some gaps need audit |
| **State Transitions** | 10/10 | Clear workflow progression, no stuck tickets observed |
| **Parent-Child Relationships** | 7/10 | Strong hierarchies exist (1M-415, 1M-371) but orphans likely present |
| **Assignee Tracking** | 7/10 | Mix of assigned/unassigned; pattern suggests process, not neglect |
| **Git Commit Linkage** | 8/10 | 60% of commits linked to tickets; excellent for features |
| **CHANGELOG Hygiene** | 10/10 | Exemplary format, comprehensive, properly linked |
| **Completion Tracking** | 9/10 | 50+ done tickets, clear completion tracking |
| **Stale Ticket Management** | ?/10 | Cannot verify without analysis tools |
| **Duplicate Prevention** | ?/10 | Cannot verify without analysis tools |

**Overall Hygiene Score**: **7.5/10** (Good)

**Rationale**:
- Strong foundation: descriptions, priorities, CHANGELOG, completions
- Known gaps: orphaned tickets, analysis tools unavailable, epic validation blocked
- Project context confusion impacts accuracy (may be tracking wrong project)

**Target Score**: 9/10
**Gap to Close**: 1.5 points

---

## 11. Technical Context

### Analysis Limitations

1. **Analysis Dependencies Missing**
   - scikit-learn, rapidfuzz, numpy not installed
   - Automated hygiene checks unavailable
   - Manual analysis only

2. **Epic List Query Failure**
   - Linear API error prevents epic validation
   - Cannot programmatically identify orphaned tickets
   - Workaround: Individual ticket reads (inefficient)

3. **Large Dataset Handling**
   - Initial query returned 68,472 tokens (exceeded 25k limit)
   - Required pagination and state filtering
   - Successfully mitigated with compact mode

4. **Project Context Ambiguity**
   - Ticket 1M-370 references mcp-ticketer project
   - Analysis conducted in mcp-smartthings project
   - May need re-analysis in correct context

### Tools Used

- `mcp__mcp-ticketer__ticket_read`: Individual ticket details
- `mcp__mcp-ticketer__ticket_list`: Ticket listing with pagination
- `mcp__mcp-ticketer__config_get`: Configuration validation
- `git log`: Commit history analysis
- `Read`: CHANGELOG examination

### Tools Attempted (Failed)

- `mcp__mcp-ticketer__ticket_find_similar`: Analysis deps missing
- `mcp__mcp-ticketer__ticket_find_stale`: Analysis deps missing
- `mcp__mcp-ticketer__ticket_find_orphaned`: Analysis deps missing
- `mcp__mcp-ticketer__epic_list`: Linear API error

---

## 12. Next Steps

### For Ticket 1M-370 Completion

To close ticket 1M-370, complete these remaining acceptance criteria:

- [x] All recent completed work has corresponding Linear tickets (marked DONE)
  - ✅ Backfill tickets 1M-372, 1M-373, 1M-374, 1M-375 created and completed
- [x] Tickets linked to project epic (mcp-ticketer eac28953c267)
  - ✅ All backfill tickets linked to cbeff74a-edd7-4125-ac73-f64161cf91b3
- [ ] Process improvement ticket created
  - ⏳ Create ticket per Section 9, Recommendation #9
- [ ] Tracking gap documented and resolved
  - ✅ This research document serves as tracking gap documentation
  - ⏳ Resolution requires implementing process improvements

### Recommended Immediate Actions

1. **Clarify project scope** (1M-370: mcp-ticketer or mcp-smartthings?)
2. **Install analysis dependencies** (`pip install mcp-ticketer[analysis]`)
3. **Assign ticket 1M-370** (currently unassigned)
4. **Create process improvement ticket** (per acceptance criteria)
5. **Re-run automated hygiene scans** (after dependency installation)

### Follow-up Research

If 1M-370 scope is actually mcp-ticketer project:
- Run this analysis in /path/to/mcp-ticketer repository
- Focus on tickets 1M-363, 1M-315, 1M-316 completion tracking
- Validate git commits 40007fc, 4d51770, e51cef9, 2dadc7b
- Review CHANGELOG v1.3.1 and v1.2.15 sections

---

## Appendix A: Ticket Samples

### Sample: Well-Formed Ticket (1M-363)

```markdown
Title: Implement 20k token pagination for all MCP tool responses
State: done
Priority: high
Tags: ["terminal-ui", "schema", "examples"]

Description:
## Problem
MCP tool responses can exceed 20,000 tokens...

## Requirements
* All MCP tools must detect when response would exceed 20k tokens
* Implement automatic pagination mechanism
...

## Acceptance Criteria
- [ ] No single MCP tool response exceeds 20k tokens
- [ ] Paginated responses include total count
...

## Technical Approach
1. Add token counting utility function
2. Implement pagination wrapper
...
```

**Strengths**: Clear problem statement, detailed requirements, acceptance criteria, technical approach.

### Sample: Parent-Child Hierarchy (1M-415)

```
Parent: 1M-415 - Refactor Commands to SOA/DI Architecture
├── 1M-416 - Design service interfaces using Protocol
├── 1M-417 - Enhance DI container for service registration
├── 1M-418 - Create base service infrastructure
├── 1M-419 - Write service layer integration tests
├── 1M-420 - Implement MemoryService with Protocol interface
├── 1M-421 - Implement ConfigService
├── 1M-422 - Implement InstallerService
├── 1M-423 - Implement SetupService
├── 1M-424 - Implement DiagnosticService
├── 1M-425 - Implement GitSyncService
├── 1M-426 - Migrate remaining CLI commands to use services
├── 1M-427 - Performance optimization and cleanup
└── 1M-428 - Update documentation for service architecture
```

**Strengths**: Clear work breakdown, logical progression, 13 subtasks for manageable chunks.

---

## Appendix B: Analysis Commands Reference

### Automated Hygiene Checks (Requires mcp-ticketer[analysis])

```python
# Find duplicate tickets
ticket_find_similar(
    threshold=0.75,      # 75% similarity
    limit=20,            # Return top 20 duplicates
    internal_limit=100   # Scan 100 tickets
)

# Find stale tickets
ticket_find_stale(
    age_threshold_days=30,          # At least 30 days old
    activity_threshold_days=14,     # No activity for 14 days
    states=["open", "waiting", "blocked"],
    limit=50
)

# Find orphaned tickets
ticket_find_orphaned(
    limit=100  # Scan 100 tickets
)

# Generate comprehensive cleanup report
ticket_cleanup_report(
    include_similar=True,
    include_stale=True,
    include_orphaned=True,
    summary_only=False  # Full details
)
```

### Manual Hygiene Queries

```python
# List tickets by state
ticket_list(project_id="...", state="open", compact=True, limit=50)

# Find tickets without assignees
ticket_list(project_id="...", assignee=None)

# Find high priority open tickets
ticket_list(project_id="...", state="open", priority="high")

# Read individual ticket details
ticket_read(ticket_id="1M-XXX")
```

---

## Appendix C: Git Commit Statistics

**Total Recent Commits Analyzed**: 30
**Commits with Ticket References**: 18 (60%)
**Commits without Ticket References**: 12 (40%)

**Breakdown by Type**:
- Feature commits with tickets: 12/15 (80%)
- Documentation commits with tickets: 4/6 (67%)
- Fix commits with tickets: 2/9 (22%)

**Conclusion**: Feature and documentation commits consistently linked. Fix/chore commits inconsistently linked (acceptable for minor changes).

---

## Appendix D: Related Tickets Summary

### 1M-363: Implement 20k token pagination
- **Status**: DONE
- **Priority**: High
- **Impact**: Prevents context overload from large MCP responses
- **Git Commits**: Present in CHANGELOG v1.3.1
- **Backfill**: 1M-372 created for historical tracking

### 1M-315: Automatic project_update tool
- **Status**: DONE
- **Priority**: Medium
- **Impact**: Automatic epic status updates on ticket transitions
- **Git Commits**: Present in CHANGELOG v1.2.15
- **Backfill**: 1M-373 created for historical tracking

### 1M-316: Project status analysis tool
- **Status**: DONE
- **Priority**: High
- **Impact**: Intelligent work plan generation from epic analysis
- **Git Commits**: Present in CHANGELOG v1.2.15
- **Backfill**: 1M-374 created for historical tracking

All three tickets successfully backfilled and marked DONE per 1M-370 objectives.

---

## Research Metadata

**Research Agent**: Research Agent (Claude Code)
**Analysis Duration**: ~10 minutes
**Tickets Analyzed**: 110+ (50 open, 3 in_progress, 50+ done)
**Tools Used**: mcp-ticketer, git, grep
**Token Usage**: ~50,000 tokens (within memory budget)
**Limitations**: Analysis tools unavailable, epic_list query failed, project context ambiguity

**Research Output**: This document serves as the comprehensive tracking hygiene analysis for ticket 1M-370.
