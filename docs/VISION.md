# VERAX Vision

VERAX exists to produce **Evidence**-backed, deterministic artifacts about user-visible behavior, without guessing and without modifying user code.

## Core principles

1. **Evidence**
   - Every finding must be grounded in observable signals and traceable artifacts.
   - If evidence is incomplete, the outcome is **INCOMPLETE** and must not be treated as safe.

2. **Determinism**
   - Same inputs should produce byte-stable canonical artifacts.
   - Non-deterministic diagnostics must be explicitly separated from canonical outputs.

3. **Zero Configuration**
   - Runs with sensible defaults; configuration is optional, not required.
   - No hidden config system that changes behavior across environments.

4. **read-only**
   - VERAX does not modify application state or source code.
   - Any write-side behavior is blocked or treated as out of scope unless explicitly acknowledged.

5. **Silent Failures**
   - Focus on detecting user actions that appear to succeed but do nothing (dead buttons, broken navigation, no-op forms).
   - Outcomes prioritize surfacing real, user-facing failure modes with audit-grade artifacts.
