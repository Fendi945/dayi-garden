# DAY1 public frontend
Primary entry: https://fendi945.github.io/dayi-garden/workbench/.

This repository contains the public static frontend and brand assets. Private backend/Agent/quality assets live in Fendi945/dayi-core-private.

## Run
Node 22+ is used for hardening tests. Serve static files with `python3 -m http.server 8080` and open /workbench/. Existing configuration points at production: use read-only inspection unless explicitly running a synthetic E2E. Do not use local HTML files as the production entry.

Run `npm test` for session recovery/concurrency and exact protected HTML/CSS/navigation checks. Run `npm run smoke` for read-only HTTP checks of the formal URL and preserved customer routes. After deploying this candidate, run `npm run smoke -- --candidate` to verify the session module is served. `DAY1_SMOKE_URL` can point to an explicitly controlled preview base URL.
The login sender distinguishes an email request from a signed-in session. It prevents concurrent sends and keeps a 60-second resend deadline across reloads; only the timestamp is stored, never an email or credential. Network ambiguity and rate limiting never cause automatic resend. The server's actual quota may remain in force after this local cooldown.
The CI workflow runs the offline tests on pushes and pull requests; it has read-only repository permissions and no deployment credentials. No production database writes occur in tests.
The same-origin legacy order dashboard reuses the workbench's Supabase session and checks `day1_is_admin` with the server before showing orders. Its existing password form remains available if that session cannot be restored. Synthetic `is_test` orders are visibly labelled and use the owner API's receipt action; normal-order actions stay as before. Confirming a test order records only the simulated receipt while the current production automatic-generation setting is disabled. The dashboard still requires a real owner to confirm and upload reviewed results; never treat an unattended HTTP smoke check as that E2E proof.

## Deployment and rollback
The workbench session hardening is deployed on master/Pages through PR #2, preserving all phase commits. Runtime source 839317149a5c6d5b7172cc5ddcda6bdf8493f446 passed CI and Pages deployment; served workbench/session files and both legacy customer pages match reviewed source. Backend migrations/functions and the user-operated owner dashboard/CRM/assets/JEV read regression passed before publication. Detailed evidence and the ordered rollout are in the private core release runbook. Full V1.0 certification is still pending.
Rollback the workbench by restoring its prior file from a4a72227a005f8bfa82b310898ca0ab137fb0965 in a new commit. Preserve other changes, history, old customer routes and all brand assets. Do not reset or force-push master.
Actual desktop/phone login and a synthetic order visible to the customer are required before labelling V1.0 production-ready. Backend, customer Sites and the protected V3.4/Baize Site have separate sources and deployments.

## Release boundaries
- master: primary Pages workbench and legacy customer/admin routes.
- codex/direction-feedback-automation-v2: active newer customer source, deployed separately as Sites v6.
- snapshot/day1-os-v0.3-2026-09-25: immutable historical rollback anchor.
- hardening/day1-v1-production: phase-labelled engineering work; the session/frontend changes are merged into master, while full system acceptance remains pending.

Read AGENTS.md. Detailed audit and deployment map are in the private core repository's CURRENT_SYSTEM_MAP.md. V1.0 hardening is not yet certified. Never expose private source or production secrets to this public repository.

## Password recovery hardening
Existing reset.html and recover-v2.html retain their UI and exact redirect contracts. They load session.js plus the shared recovery.js controller: scrub callback fragments immediately, verify credentials against hosted Auth before permitting a password update, bound requests to 30 seconds, suppress concurrent sends with a timestamp-only cooldown, and clear password/token state after successful save. Network ambiguity never resends an email or repeats a password update automatically. Legacy reset-session fallback is verified server-side rather than trusted. Automated tests use synthetic requests and do not send email/change the real owner password. Actual hosted recovery remains a separate acceptance gate.

The formal Workbench design tab reads existing owner-only production status through its current session. `workbench/production-status.js` displays configured-key boolean, automatic state and approved scenes, with a read-only refresh. It never calls a model or queues/enables work and removes its view on logout. A configured key does not prove provider access or account free quota. Primary frontend has 36 tests; protected baseline HTML/CSS/navigation/hrefs remain unchanged.
