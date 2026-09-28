# DAY1 public frontend
Primary entry: https://fendi945.github.io/dayi-garden/workbench/.

This repository contains the public static frontend and brand assets. Private backend/Agent/quality assets live in Fendi945/dayi-core-private.

## Run
Node 22+ is used for hardening tests. Serve static files with `python3 -m http.server 8080` and open /workbench/. Existing configuration points at production: use read-only inspection unless explicitly running a synthetic E2E. Do not use local HTML files as the production entry.

## Release boundaries
- master: primary Pages workbench and legacy customer/admin routes.
- codex/direction-feedback-automation-v2: active newer customer source, deployed separately as Sites v6.
- snapshot/day1-os-v0.3-2026-09-25: immutable historical rollback anchor.
- hardening/day1-v1-production: current engineering work; not a production release until gates pass.

Read AGENTS.md. Detailed audit and deployment map are in the private core repository's CURRENT_SYSTEM_MAP.md. V1.0 hardening is not yet certified. Never expose private source or production secrets to this public repository.
