# DAY1 public frontend
Primary entry: https://fendi945.github.io/dayi-garden/workbench/.

This repository contains the public static frontend and brand assets. Private backend/Agent/quality assets live in Fendi945/dayi-core-private.

## Run
Node 22+ is used for hardening tests. Serve static files with `python3 -m http.server 8080` and open /workbench/. Existing configuration points at production: use read-only inspection unless explicitly running a synthetic E2E. Do not use local HTML files as the production entry.

Run `npm test` for session recovery/concurrency and exact protected HTML/CSS/navigation checks. Run `npm run smoke` for read-only HTTP checks of the formal URL and preserved customer routes. After deploying this candidate, run `npm run smoke -- --candidate` to verify the session module is served. `DAY1_SMOKE_URL` can point to an explicitly controlled preview base URL.
The CI workflow runs the offline tests on pushes and pull requests; it has read-only repository permissions and no deployment credentials. No production database writes occur in tests.

## Deployment and rollback
The hardening branch is a release candidate. Merge to master only after backend migrations/functions and the real owner/customer checks in the private core release runbook are verified. Publishing this branch is not evidence of successful login or delivery.
Rollback the workbench by restoring its prior file from a4a72227a005f8bfa82b310898ca0ab137fb0965 in a new commit. Preserve other changes, history, old customer routes and all brand assets. Do not reset or force-push master.
Actual desktop/phone login and a synthetic order visible to the customer are required before labelling V1.0 production-ready. Backend, customer Sites and the protected V3.4/Baize Site have separate sources and deployments.

## Release boundaries
- master: primary Pages workbench and legacy customer/admin routes.
- codex/direction-feedback-automation-v2: active newer customer source, deployed separately as Sites v6.
- snapshot/day1-os-v0.3-2026-09-25: immutable historical rollback anchor.
- hardening/day1-v1-production: current engineering work; not a production release until gates pass.

Read AGENTS.md. Detailed audit and deployment map are in the private core repository's CURRENT_SYSTEM_MAP.md. V1.0 hardening is not yet certified. Never expose private source or production secrets to this public repository.
