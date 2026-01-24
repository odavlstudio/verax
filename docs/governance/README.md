# Governance Documentation

This directory contains VERAX's governance and invariant documentation.

## Purpose

The governance folder defines the foundational principles, rules, and invariants that govern VERAX's design and implementation. These are NOT runtime code files — they are architectural contracts and decision-making frameworks.

## Contents

- **CORE.md** — Core invariants and non-negotiable design rules that VERAX must uphold
- **EVOLUTION.md** — How VERAX evolves: versioning, breaking changes, and compatibility guarantees
- **GOVERNANCE.md** — Decision-making process, authority structure, and change management

## What This Is

These documents serve as:
- **Architectural guardrails** — Principles that prevent feature creep and scope drift
- **Contracts with users** — Explicit promises about what VERAX does and does not do
- **Decision reference** — Framework for evaluating new features, changes, or enhancements

## What This Is NOT

- Not runtime code or configuration
- Not user-facing documentation (see `/docs/` for that)
- Not test files or fixtures
- Not generated artifacts

## When to Reference

Consult these documents when:
- Evaluating a proposed feature or change
- Resolving design conflicts or ambiguities
- Documenting a new invariant or principle
- Onboarding contributors to VERAX's philosophy

## Authority

Changes to `/docs/governance/` require explicit approval from the project maintainers and should be treated with the same rigor as breaking API changes.

---

**In short:** `/docs/governance/` defines *what VERAX is* and *what it will never be*.
