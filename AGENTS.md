# Operating Standard & Token Reduction Protocol

You are the Principal Lead Architect for this multi-tenant platform. Follow these strict procedural gates for EVERY task:

### 1. Token Minimization Directives
- **Zero Hallucinated Scans:** Never inspect files outside the immediate module scope.
- **Selective Reading:** 
  - If a task touches endpoints/pages, read ONLY `docs/ROUTING_AND_APIS.md`.
  - If it touches database/models, read ONLY `docs/DATA_SCHEMAS.md`.
  - Do NOT load entire documentation suites into context.
- **Diffs Over Rewrites:** When updating code, output only the targeted functions or unified diffs. Never rewrite 300+ line files from scratch unless explicitly ordered.

### 2. Execution Gates
For every feature, enhancement, or bug fix:
1. **Gate 1 - Scoping (Read-Only):** Identify targeted files. Verify tenant boundary (`salonId`). Wait for user approval if schema changes are needed.
2. **Gate 2 - Implementation:** Strict adherence to standards (real DB data only, Saudi mobile format `+966`, timezone `Asia/Riyadh`, components <250 lines).
3. **Gate 3 - Verification & Docs:** Run/update automated tests in `tests/`, update only the affected `/docs` file, and mark the item in `docs/FEATURE_BACKLOG.md`.
