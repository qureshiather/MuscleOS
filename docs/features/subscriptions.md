# Subscriptions — Tiers & Gates

MuscleOS should feel **complete on Basic** and **worth upgrading on Pro** once a lifter outgrows
the built-in programs. Monetization sells customization, flexibility, and analytics — never the
core logging loop.

This doc owns the product rules: what each tier includes, where every gate is enforced, and what
happens when a subscription lapses.

| Related | |
|---------|--|
| Prices and store product IDs | [monetization/pricing.md](../monetization/pricing.md) |
| RevenueCat / Supabase implementation | [monetization/technical.md](../monetization/technical.md) |
| Dashboard and store console runbook | [monetization/revenuecat-setup.md](../monetization/revenuecat-setup.md) |
| Code | `apps/mobile/src/subscription/features.ts`, `src/hooks/useProGate.ts` |

## Tiers

| Tier | Price | Audience |
|------|-------|----------|
| **Basic** | Free | Anyone starting out or running a built-in program |
| **Pro** | Monthly or annual | Lifters who want their own templates, flexible sessions, and analytics |

There is **one Pro entitlement** (`MuscleOS Pro`). Monthly and annual unlock exactly the same
features; the only difference is billing period. UI labels are always "Basic" and "Pro" — the
stored tier value `free` is legacy and migrates to `basic` on read.

## Design principles

1. **Basic is a real gym log**, not a crippled demo. Built-in templates, unlimited session
   logging, rest timers, recovery, history, and export stay free forever.
2. **Pro is the growth path.** Custom programs, ad-hoc sessions, and progress analytics are what
   you want *after* you've built a routine — so the upgrade prompt arrives when it's relevant
   rather than at install.
3. **A generous free tier builds the habit.** Recovery visualization and data export are
   deliberately ungated to drive daily use and to make the app trustworthy with your data.
4. **Account before purchase.** Subscriptions attach to a Supabase identity so Pro restores
   across devices and reinstalls.
5. **RevenueCat is the source of truth** for entitlements. Supabase handles identity only.

## What each tier includes

### Basic (free)

- 9 built-in templates — PPL, Upper/Lower, Strong Lifts 5×5
- Starting a workout from any **built-in** template
- Full set logging: weight, reps, warm-up sets, add/remove sets
- Rest timers, workout sounds, rest notifications
- Reordering exercises and changing rest **within** a session
- Exercise library: browse ~399 exercises, search, filter, instructions, personal notes
- Recovery map and readiness times
- Workout history: list, inline detail, delete
- Hiding built-in templates and folders
- Resuming an in-progress workout
- Profile, units, theme, cloud sync, JSON export

### Pro

| Feature | Gate key |
|---------|----------|
| Custom templates — create, edit, **run**, folders, pin, archive | `custom_templates` |
| Save a finished workout as a template | `save_as_template` |
| Custom exercises | `custom_exercises` |
| Empty / ad-hoc workout | `empty_workout` |
| Add an exercise mid-workout | `add_exercise_mid_workout` |
| Replace an exercise mid-workout (sets carry over) | `replace_exercise_mid_workout` |
| Personal records & estimated 1RM | `personal_records` |
| Exercise progression charts | `exercise_progression` |
| Monthly training calendar | `monthly_calendar` |

Strength level comparison isn't a separate gate — it appears inside the PR and progression
screens, which are already Pro.

`ProFeature` and `PRO_FEATURE_LABELS` in `src/subscription/features.ts` are the single source for
gate keys and their paywall copy.

## Gate map

Intended to be **exhaustive**. A gate that isn't listed here is how customers find holes in the
paywall — if you add one, add a row.

| Location | Action | Gate |
|----------|--------|------|
| `(tabs)/index.tsx` | Empty workout hero | `empty_workout` |
| `(tabs)/index.tsx` | New template / new folder buttons | `custom_templates` |
| `(tabs)/index.tsx` | Template menu: rename, move, edit | `custom_templates` |
| `(tabs)/index.tsx` | **Starting** a custom template | `custom_templates` |
| `(tabs)/index.tsx` | Suggested / Recent | Custom templates filtered out entirely |
| `workout-preview.tsx` | Screen entry for a custom template | `custom_templates` |
| `active-workout.tsx` | Start from params (`_empty` or custom template) | `empty_workout`, `custom_templates` |
| `active-workout.tsx` | Add exercise | `add_exercise_mid_workout` |
| `active-workout.tsx` | Replace exercise | `replace_exercise_mid_workout` |
| `active-workout.tsx` | Save as / overwrite template | `save_as_template` |
| `active-workout.tsx` | Create exercise from the picker's empty search | `custom_exercises` |
| `active-workout.tsx` | Add / replace / remove on a **built-in** workout | Alert, not paywall — see below |
| `create-template.tsx` | Screen entry | `custom_templates` |
| `create-exercise.tsx` | Screen entry | `custom_exercises` |
| `(tabs)/exercises.tsx` | **+** button and create-from-search | `custom_exercises` |
| `(tabs)/history.tsx` | Trophy and calendar header buttons | `personal_records`, `monthly_calendar` |
| `personal-records.tsx` | Screen entry | `personal_records` |
| `exercise-progression.tsx` | Screen entry | `exercise_progression` |
| `history-monthly.tsx` | Screen entry | `monthly_calendar` |

### Screen entry vs inline action

Two helpers, both in `src/hooks/useProGate.ts`:

- **`useProGate()`** → `{ isPro, gatePro(feature?) }` for inline actions. `gatePro` returns false
  and navigates to the paywall when not Pro.
- **`useRequirePro(feature)`** redirects to the paywall on mount, for whole-screen gates.

Every Pro-only *screen* uses `useRequirePro` in addition to the button that leads to it, so a deep
link can't bypass the gate. This matters most for `/active-workout`, which is reachable from
notification taps and deep links — the home screen gate alone is not sufficient.

### Built-in workouts are an alert, not a paywall

Editing a built-in workout mid-session shows:

> **Built-in workout** — You can't edit a built-in workout. Upgrade to Pro to customize it and
> save it as a new template.

This is an alert rather than the paywall because the restriction isn't purely commercial: built-in
templates are immutable for everyone, Pro included. Pro's ability is to edit the *session* and save
the result as a **new** template. See
[product/overview.md](../product/overview.md#the-central-assumption-built-in-vs-custom).

## Paywall UX

Locked actions navigate to `/subscription?feature=<gate_key>`. The screen highlights the relevant
feature: *"{label} is included with Pro."*

The comparison lists `BASIC_FEATURES_LIST` and `PRO_FEATURES_LIST` each contain **5 items** so the
two columns stay visually balanced — keep the counts equal when editing either.

Anonymous users see **Link account** instead of purchase buttons; purchase UI stays hidden until an
account is linked, so the entitlement has an identity to attach to.

Annual is pre-selected with a "Best value" badge.

## Downgrade behaviour (Pro → Basic)

**There is no grandfathering.** Custom templates are Pro content to *run*, not only to create.

| Concern | Behaviour |
|---------|-----------|
| Custom templates and folders | **Kept, never deleted.** Still listed in the **Custom** section on the Workouts tab, rendered locked with a lock icon. |
| Starting a custom template | **Blocked** — opens `/subscription?feature=custom_templates`. |
| Suggested / Recent on home | Custom templates are **excluded**, so Basic is never offered a workout it can't start. |
| Custom section banner | A notice explains the lock and links to the paywall. |
| Built-in templates | Unaffected; all remain fully runnable. |
| Custom exercises | **Remain usable.** Creating and editing are gated, but exercises already in your library remain visible and resolvable in existing templates and sessions. |
| Workout already in progress | **Can be finished.** The gate blocks starting, so a session in flight when the subscription lapses is never destroyed. |
| History, recovery, export | Unaffected — all Basic features. |
| Resubscribing | Templates become runnable again immediately; nothing to restore. |

Templates stay **visible but locked** rather than hidden, so a lapsed subscriber doesn't believe
their data was deleted — and so the lock becomes a conversion surface.

### Single enforcement predicate

```ts
export function requiresProToStart(template: { isBuiltIn?: boolean }): boolean {
  return template.isBuiltIn !== true;
}
```

Checked at every entry point into a workout:

| Entry point | Enforcement |
|-------------|-------------|
| Home → start template | Gates to paywall before navigating |
| Home → Suggested / Recent | Custom templates filtered out of the candidate list |
| Workout preview | Redirects to the paywall on mount when locked |
| Active workout start-from-params | Blocks the effect — covers deep links and notification taps |

**Adding a new way to launch a workout means adding a check here too.**

## User flows

**Basic user.** Opens the app (anonymous Supabase session) → starts a built-in template → logs
sets, uses rest timers, checks recovery → hits a Pro action → paywall with that feature highlighted.

**Pro subscriber.** Links an account (email / Apple / Google) → picks monthly or annual →
RevenueCat grants `MuscleOS Pro` → custom templates, ad-hoc workouts, and analytics unlock.

**Restore on a new device.** Sign in with the linked account → **Restore purchases**, or the
automatic RevenueCat login on init → the entitlement syncs because
`appUserID = supabase user.id`.

## Dev and testing

| Mode | How |
|------|-----|
| Expo Go | RevenueCat preview/mock; use **Grant Pro (testing)** |
| Dev build + sandbox | Real IAP with sandbox Apple/Google accounts |
| Env flag | `EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING` |

**Grant Pro (testing)** appears when `NODE_ENV !== 'production'` or the flag is set, and writes a
local `muscleos_dev_pro_override`. Note the env flag currently **defaults to on**, so verify it is
explicitly `false` for production builds.

## Assumptions

| Assumption | Note |
|------------|------|
| One entitlement; plan affects billing only | Monthly and annual are feature-identical |
| Custom templates are Pro to **run**, not just create | The most surprising rule for lapsed users — hence the visible-but-locked treatment |
| Custom **exercises** are Pro to create or edit, but remain readable after lapse | Deliberately gentler than templates |
| An in-progress workout survives a lapse | Never destroy work in flight |
| Purchases require a linked account | Entitlements need a stable `appUserID` |
| RevenueCat is billing truth; no subscription table in Supabase | Server-side audit is a future phase |
| Tier is cached locally for offline use | `muscleos_subscription`; re-validated on foreground |

## Not implemented

- Server-side subscription mirror in Supabase (webhook → `profiles` table). RevenueCat SDK only.
- Trials, promo codes, or introductory pricing.
- Family sharing or multi-seat.
- Any per-feature à la carte purchase.

## Tests

Covered (`src/subscription/features.test.ts`):

- `requiresProToStart` — built-in vs custom
- 9 built-in templates ship
- `subscriptionPaywallPath` / `parseProFeatureParam` round-trip, including `personal_records`

Not covered:

- **Gate enforcement itself** — no test asserts that a Basic user hitting any of the entries in the
  [gate map](#gate-map) is actually redirected. Given the gate map is the paywall, this is a
  meaningful gap.
- The deep-link start-from-params gate in `active-workout.tsx`
- Downgrade rendering: locked cards, the Custom section banner, exclusion from Suggested/Recent
- `subscriptionStore` load, purchase, restore, expiry, and the legacy `free` → `basic` migration
- Paywall list length parity between Basic and Pro
