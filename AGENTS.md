# DAY1 frontend Agent guide
Read this repository's README.md. Then read CURRENT_SYSTEM_MAP.md, DEPRECATED.md and DAY1_SYSTEM_STATE.md in Fendi945/dayi-core-private on the hardening branch. Private architecture/rules/tests are authoritative there; do not copy private prompts or customer data here.

Production Hardening only: preserve Workbench V3.4/V3.5 confirmed behavior, every existing navigation entry, branding, current order intake and historical assets. No UI redesign, new business feature, force-push or destructive migration.
Primary entry is /workbench/ on master. The newer Sites customer implementation currently comes from codex/direction-feedback-automation-v2; it is active, not disposable. Preserve both customer contracts until real E2E passes.
Use hardening/day1-v1-production for changes, phase-labelled commits, exact source/deployment manifests and meaningful tests. No secret in client source or Git. Supabase anon/publishable keys are public configuration; service_role and API credentials are server-only.
