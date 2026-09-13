# MuscleOS Documentation

This directory is the **source of truth** for what MuscleOS does. If the code and these
docs disagree, one of them is a bug — see [Keeping docs in sync](#keeping-docs-in-sync).

## Start here

| Doc | What it covers |
|-----|----------------|
| [product/overview.md](product/overview.md) | What the app is, who it's for, design principles, screen map, cross-cutting assumptions |
| [features/README.md](features/README.md) | Feature index, Basic/Pro tier summary, spec status |

## Feature specs

One doc per feature area. Each states the data model, the exact behavioural rules,
the product assumptions baked in, and its tier gating.

| Doc | Feature area |
|-----|--------------|
| [features/templates.md](features/templates.md) | Workout templates — built-in vs custom, folders, CRUD, suggestions |
| [features/workout-logging.md](features/workout-logging.md) | Active workout, set logging, rest timers, notifications, finish flow |
| [features/recovery.md](features/recovery.md) | Muscle recovery model, timings, body diagram |
| [features/exercise-library.md](features/exercise-library.md) | Exercise catalog, custom exercises, search, notes |
| [features/history-analytics.md](features/history-analytics.md) | History, monthly calendar, PRs, 1RM, strength standards, progression |
| [features/subscriptions.md](features/subscriptions.md) | Basic/Pro tiers, every Pro gate, paywall UX, downgrade behaviour |
| [features/accounts-and-data.md](features/accounts-and-data.md) | Auth, profile, settings, storage, cloud sync, export |

## Engineering

| Doc | What it covers |
|-----|----------------|
| [engineering/testing.md](engineering/testing.md) | Test coverage per feature, known gaps, priority order for new tests |
| [supabase/setup.md](supabase/setup.md) | Supabase schema, exercise catalog, sync tables, local setup |
| [mobile/eas-build.md](mobile/eas-build.md) | EAS build profiles, env vars, store submission |

## Commercial / billing

Product-facing tier rules live in [features/subscriptions.md](features/subscriptions.md).
These docs cover the money and the plumbing behind it.

| Doc | What it covers |
|-----|----------------|
| [monetization/pricing.md](monetization/pricing.md) | Plans, USD list prices, store product IDs |
| [monetization/technical.md](monetization/technical.md) | RevenueCat + Supabase integration, subscription store |
| [monetization/revenuecat-setup.md](monetization/revenuecat-setup.md) | Dashboard and store console runbook |
| [monetization/launch-checklist.md](monetization/launch-checklist.md) | Pre-launch verification checklist |

---

## Conventions

**Describe what is implemented, not what is planned.** Anything not yet built goes in an
explicit "Not implemented" or "Open questions" section, never in the main body. A reader
should be able to trust that everything stated in a spec body is true of the shipped app.

**Cite the code.** Behavioural rules reference the file that enforces them, e.g.
`apps/mobile/src/utils/recovery.ts`. Exact formulas and constants are quoted or tabulated
so a reader never has to guess at rounding, defaults, or thresholds.

**Name the assumptions.** Every feature doc has an **Assumptions** section listing the
product decisions baked into the implementation (for example: recovery is time-based only
and ignores sleep and nutrition). These are the things most likely to be revisited, and
the things a new contributor is most likely to get wrong.

**One authoritative owner per fact.** Other docs may summarize a rule for navigation or
onboarding, but must link to its owner rather than redefine it. Tier gating lives in
[features/subscriptions.md](features/subscriptions.md); pricing lives in
[monetization/pricing.md](monetization/pricing.md).

---

## Keeping docs in sync

Specs rot silently, so treat them as part of the change, not as follow-up work.

**When you change a feature, update its spec in the same change.** Specifically, update the
docs when you change any of:

- A user-visible behaviour, screen, or piece of copy that a spec describes
- A default, constant, threshold, or formula (rest duration, recovery hours, 1RM formula, …)
- A domain type in `packages/types`
- Which tier a feature belongs to, or where a Pro gate is enforced
- A storage key, or whether data is local-only vs cloud-synced

**When you add a feature,** add it to the relevant feature spec (or add a new one), add a
row to the index in [features/README.md](features/README.md), and record its test status in
[engineering/testing.md](engineering/testing.md).

**When you add a Pro gate,** add it to the gate map in
[features/subscriptions.md](features/subscriptions.md). The map is meant to be exhaustive —
a gate that isn't listed is how customers find holes in the paywall.

**Prefer editing over appending.** These are specs, not a changelog. Rewrite the affected
section so it reads as a current description of the app. Git history is the changelog.

**If you find a discrepancy between a spec and the code,** fix it rather than working around
it, and say which one you treated as correct. A spec that describes a feature the code
doesn't have is worse than no spec, because it gets quoted in marketing and support.
