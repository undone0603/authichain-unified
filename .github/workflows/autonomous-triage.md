# Autonomous Triage Agent

**Role**: Review incoming issues, assign labels based on the Turborepo workspace structure, and propose initial fixes.
**Guardrails**: Read-only access to source code; restricted to drafting pull requests and commenting. Cannot merge.
**Triggers**: 
  on: 
    issues: [opened, edited]
EOFmkdir -p apps/workers/src/orchestration
touch apps/workers/src/orchestration/llm-router.ts
