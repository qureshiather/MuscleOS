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
features; the only difference is billing period. There is no lifetime product — lifetime Pro is
only ever a [complimentary grant](#complimentary-pro): one with no expiry, or an expiry more than
50 years out (`isLifetimeExpiry`). UI labels are always "Basic" and "Pro" — the
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
- Managing what already exists after a lapse: renaming, pinning, archiving and deleting existing
  folders; hiding and deleting custom templates; deleting custom exercises
- Resuming an in-progress workout
- Profile, units, theme, cloud sync, JSON export and import

### Pro

| Feature | Gate key |
|---------|----------|
| Custom templates — create, edit, rename, move, **run**, and creating folders | `custom_templates` |
| Save a finished workout as a template | `save_as_template` |
| Custom exercises | `custom_exercises` |
| Empty / ad-hoc workout | `empty_workout` |
| Add an exercise mid-workout | `add_exercise_mid_workout` |
| Replace an exercise mid-workout (new exercise's previous loads in) | `replace_exercise_mid_workout` |
| Personal records & estimated 1RM | `personal_records` |
| Exercise progression charts | `exercise_progression` |
| Monthly training calendar | `monthly_calendar` |

Managing existing folders (rename, pin, archive, delete) is **not** gated — only creating one is —
so a lapsed subscriber can still tidy what they already have.

Strength level comparison isn't a separate gate — it appears inside the PR and progression
screens, which are already Pro.

`ProFeature` and `PRO_FEATURE_LABELS` in `src/subscription/features.ts` are the single source for
gate keys and their paywall copy.

## Gate map

Intended to be **exhaustive**. A gate that isn't listed here is how customers find holes in the
paywall — if you add one, add a row.

| Location | Action | Gate |
|----------|--------|------|
| `(tabs)/index.tsx` | Empty workout hero (subtitle "Included with Pro" + lock on Basic) | `empty_workout` |
| `(tabs)/index.tsx` | New template / New folder buttons (shown on Basic too) | `custom_templates` |
| `(tabs)/index.tsx` | Template menu: Rename, Move, Edit | `custom_templates` |
| `(tabs)/index.tsx` | Template menu: Hide, Delete | Ungated |
| `(tabs)/index.tsx` | New folder from the Move sheet | `custom_templates` (Move itself is gated) |
| `(tabs)/index.tsx` | Folder menu: Rename, Pin, Archive, Delete | Ungated |
| `(tabs)/index.tsx` | **Starting** a custom template (card shows a lock) | `custom_templates` |
| `(tabs)/index.tsx` | Lapsed banner in the Custom section | `custom_templates` |
| `(tabs)/index.tsx` | Suggested / Recent | Custom templates filtered out entirely |
| `workout-preview.tsx` | Screen entry for a custom template / an unknown id | `custom_templates` / `empty_workout` |
| `active-workout.tsx` | Start from params: `_empty` or an unknown id / a custom template | `empty_workout` / `custom_templates` |
| `active-workout.tsx` | Add exercise ("Pro: Add Exercise" on Basic) | `add_exercise_mid_workout` |
| `active-workout.tsx` | Replace exercise (lock icon on Basic) | `replace_exercise_mid_workout` |
| `active-workout.tsx` | Remove exercise on a custom / empty workout | Ungated |
| `active-workout.tsx` | Save as / overwrite template | `save_as_template` |
| `active-workout.tsx` | Create exercise from the picker's empty search | `custom_exercises` |
| `active-workout.tsx` | Add / replace / remove on a **built-in** workout | Alert, not paywall — see below |
| `create-template.tsx` | Screen entry | `custom_templates` |
| `create-template.tsx` | Picker's "Create '<query>'" row | `custom_exercises` |
| `create-exercise.tsx` | Screen entry | `custom_exercises` |
| `(tabs)/exercises.tsx` | **+** button and create-from-search ("Pro · save your own exercises." on Basic) | `custom_exercises` |
| `(tabs)/exercises.tsx` | Detail sheet: **Edit** on a custom exercise | `custom_exercises` |
| `(tabs)/exercises.tsx` | Detail sheet: **Delete** on a custom exercise | Ungated |
| `(tabs)/history.tsx` | Trophy and calendar header buttons | `personal_records`, `monthly_calendar` |
| `(tabs)/history.tsx` | PR badges and PR counts on session cards | `personal_records` (hidden on Basic, no paywall) |
| `personal-records.tsx` | Screen entry | `personal_records` |
| `exercise-progression.tsx` | Screen entry | `exercise_progression` |
| `history-monthly.tsx` | Screen entry | `monthly_calendar` |

`midWorkoutEditDecision` (`src/subscription/features.ts`) is the single rule for the three
mid-workout edit actions: Pro always edits; on Basic a built-in workout gets the alert for all three;
otherwise add and replace hit their paywalls and remove is allowed.

### Screen entry vs inline action

Two helpers, both in `src/hooks/useProGate.ts`:

- **`useProGate()`** → `{ isPro, gatePro(feature?) }` for inline actions. `gatePro` returns false
  and navigates to the paywall when not Pro.
- **`useRequirePro(feature)`** redirects to the paywall on mount, for whole-screen gates. It
  waits while the subscription store is loading (`shouldRedirectToPaywall`), so a Pro user is never
  bounced before the cached tier (`hydrate()`) or RevenueCat answers; the screen renders nothing
  until then.

Redirects go through `useRedirectWhenReady(href)`, which uses expo-router's `useFocusEffect` so it
only navigates once the root navigator has mounted. A plain `router.replace` in `useEffect` throws
"Attempted to navigate before mounting the Root Layout component" on a cold-start deep link.

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

Anonymous users see the same paywall — the feature highlight, the Basic vs Pro comparison and the
plan prices — but the purchase button is replaced by **Link account to purchase** (opens `/auth`),
with the note *"Subscriptions are tied to your account so Pro restores on any device."* Restore
purchases is hidden for guests. The entitlement needs an identity to attach to.

**A guest is always Basic** (`canHoldPro` in `src/subscription/plan.ts`), even if RevenueCat reports
the entitlement. After sign-out or Delete account the store can sync the device's Apple / Google
subscription onto the new guest's RevenueCat id; the subscription store ignores it, and a cached
Pro tier from the previous account is rewritten to Basic on the first load that sees a guest. Linking or signing in re-reads the entitlement.
Purchase and restore are refused for guests. The dev-only "Grant Pro (testing)" override is the
one exception.

Annual is pre-selected with a "Best value" badge.

Plan prices come from the store (`priceString`) with the period appended ("$2.99/mo",
"$19.99/yr"). When a plan's package hasn't loaded, the row shows the USD fallback from
`FALLBACK_PRICE_LABELS` in the same format, and tapping Continue for that plan says it isn't
available (*"This plan is not available right now. Try again later."*; dev builds say *"This plan
is not configured yet. Check RevenueCat setup."*). The button reads **Purchases unavailable** only
when there's no RevenueCat API key for the platform. While RevenueCat is configuring and plans are
loading, it keeps its normal copy (**Continue with Annual**) but is disabled. The annual row's
**Save N% vs monthly** is computed from the store's numeric prices, falling back to the USD list
prices (44%) when a package is missing or annual isn't cheaper.

Purchase outcomes: cancelling is silent; a failure shows **Purchase failed** with the store's
message (or *"Could not complete purchase."*); a purchase that completes without an active
entitlement says *"Purchase completed but Pro is not active yet. Try Restore purchases."*

Restore outcomes: **Purchases restored** — *"Pro is active on this device."*; **No purchases
found** — *"Nothing to restore for this account."*; **Restore failed** with the error, or *"Could
not restore purchases. Try again."*

The paywall's display rules live in `src/subscription/paywall.ts` (`planPriceLabel`,
`annualSavingsFromPrices`, `currentPlanLines`, `purchaseButtonState`).

Outside the paywall: the Profile → Account row's hint reads **Pro**, or **Basic · upgrade for
custom training**.

For a Pro user, the **Current plan** card shows the plan, **Renews {date}** when the entitlement
has an expiry, and **Manage subscription**, which opens the store's subscription settings. For a
complimentary plan it says **Until {date}** instead of "Renews", or **Lifetime** for a lifetime
grant (no expiry, or an expiry ~200 years out as RevenueCat stores them; `isLifetimeExpiry` treats
anything over 50 years away as lifetime). It also hides **Manage subscription**, because there's no store
subscription behind it.

**Restore purchases** goes through the store first. If that fails or is cancelled (for example, no
Apple / Google sign-in), it re-reads the RevenueCat customer, so a complimentary grant is still
picked up.

## Complimentary Pro

To give someone Pro for free (e.g. lifetime Pro for a friend), grant a **promotional
entitlement** in RevenueCat. You don't need a store product or an app release.

1. The person links an account (email / Apple / Google). Anonymous users can't be granted Pro,
   because their `appUserID` isn't stable.
2. Get their Supabase `user.id` from Supabase → Authentication → Users. That ID is their
   RevenueCat `appUserID`.
3. RevenueCat → Customers → find that ID → **Grant promotional entitlement** → `MuscleOS Pro` →
   **Lifetime** (or a fixed duration).
   The API equivalent is `POST /v1/subscribers/{app_user_id}/entitlements/MuscleOS%20Pro/promotional`
   with `{"duration": "lifetime"}`.
4. It unlocks right away with **Restore purchases**. Otherwise it unlocks on the next launch or
   foreground after RevenueCat's customer cache (about 5 minutes) expires.

`planFromEntitlement` (`src/subscription/plan.ts`) maps an entitlement whose store is
`PROMOTIONAL`, or whose product ID starts with `rc_promo`, to the `complimentary` plan. To revoke
it, go to RevenueCat → the customer → **Revoke**.

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
| Workout preview | `startFromParamsDecision` → redirects to the paywall when locked |
| Active workout start-from-params | `startFromParamsDecision` → covers deep links and notification taps |

`startFromParamsDecision` (`src/subscription/features.ts`) returns `wait`, `start`, or the gate:

- **Waits** while a workout is in progress (or not yet read back), and until templates *and* the
  subscription tier have loaded — a custom template is never mistaken for an unknown id, and a Pro
  user is never bounced while the tier is unknown.
- **Pro** starts anything.
- **Basic** starts only a known built-in. `_empty` and an unknown id would be an ad-hoc workout, so
  both go to `empty_workout`; a custom template goes to `custom_templates`.

A Basic built-in start always takes its plan from the template itself (`startPlanFromParams`,
`src/subscription/startPlan.ts`): URL `exerciseIds` / `sets` are ignored, so a built-in id can't
smuggle an arbitrary exercise list. Pro uses the plan in the URL, falling back to the template when
the link has none.

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
| Expo Go / dev build | **Grant Pro (testing)** on the Subscription screen |
| Dev build, back to Basic | **Reset to Basic (testing)** on the Subscription screen (shown while Pro) |
| Dev build + sandbox | Real IAP with sandbox Apple/Google accounts |
| TestFlight / Play testing track | Sandbox purchases, or a [complimentary grant](#complimentary-pro) |

**Grant Pro (testing)** appears only when React Native's `__DEV__` is true. It writes a local
`muscleos_dev_pro_override`. Release builds never show it, ignore the override, and clear any
override left over from an earlier test build. There's no env flag to turn it on in a release build.

## Assumptions

| Assumption | Note |
|------------|------|
| One entitlement; plan affects billing only | Monthly and annual are feature-identical |
| Custom templates are Pro to **run**, not just create | The most surprising rule for lapsed users — hence the visible-but-locked treatment |
| Custom **exercises** are Pro to create or edit, but remain readable after lapse | Deliberately gentler than templates |
| An in-progress workout survives a lapse | Never destroy work in flight |
| Purchases require a linked account | Entitlements need a stable `appUserID` |
| RevenueCat is billing truth; no subscription table in Supabase | Server-side audit is a future phase |
| Tier is cached locally for offline use and first paint | `muscleos_subscription`; shown at launch before auth resolves (`hydrate()`), then re-validated by `load()` on launch and foreground |
| A flaky network never downgrades Pro | `load()` keeps the cached tier, without rewriting it, when the RevenueCat customer read fails or times out; only a successful read with no entitlement downgrades (`resolveSubscriptionState`) |

## Not implemented

- Server-side subscription mirror in Supabase (webhook → `profiles` table). RevenueCat SDK only.
- Trials, promo codes, or introductory pricing.
- Family sharing or multi-seat.
- Any per-feature à la carte purchase.

## Tests

Pure (Vitest):

- `src/subscription/features.test.ts` — `requiresProToStart`; 9 built-in templates ship;
  `subscriptionPaywallPath` / `parseProFeatureParam` round-trip and rejection; every gate key has a
  label; list parity (5 + 5); **`startFromParamsDecision`** every branch (existing session, no id,
  templates or tier still loading, Pro, Basic built-in / `_empty` / unknown id / custom);
  **`shouldRedirectToPaywall`**; **`midWorkoutEditDecision`** (Pro, Basic built-in alert for all
  three actions, Basic add / replace / remove).
- `src/subscription/startPlan.test.ts` — Basic built-in plan comes from the template (smuggled
  `exerciseIds` / `sets` ignored); Pro uses the URL plan with a template fallback.
- `src/subscription/state.test.ts` — `isProState` incl. the expiry boundary; legacy `free` →
  `basic`; a guest's cached Pro is hidden on paint; `resolveSubscriptionState`: dev override
  precedence (over guests, keeps cached Pro, else a year of annual), release clears the override,
  guest always Basic, no API key → Basic, a failed customer read keeps the cache without
  persisting, entitlement → Pro / none → Basic.
- `src/subscription/paywall.test.ts` — plan order and annual default, store price + period vs USD
  fallback, savings from store prices with the 44% fallback, `currentPlanLines` (Basic, expired,
  Renews, Until, Lifetime, Manage hidden for complimentary), `purchaseButtonState` (continue,
  disabled with normal copy while loading, purchasing, unavailable only without a key, guest CTA).
- `src/subscription/pricing.test.ts` — $2.99 / $19.99 and the 44% annual saving.
- `src/subscription/plan.test.ts` — `planFromEntitlement`, `isLifetimeExpiry`, `canHoldPro`.
- `src/utils/revenueCat.test.ts` — entitlement reads; restore falls back to a fresh customer read
  (complimentary grant) and otherwise reports the store error; purchase cancel vs failure.
- `src/store/subscriptionStore.test.ts` — `hydrate()` paint / no-op; `load()`: no key,
  entitlement, real lapse, failed read keeps cached Pro, guest rewrite, legacy `free`, release
  clears / dev honours the override; expired `isPro()`; purchase and restore refused for guests;
  every purchase and restore outcome; `setPro` / `setBasic`.

UI (Jest, `src/test/ui/subscriptions/`):

- `startFromParams.test.tsx` — deep links to `/active-workout`: Basic built-in starts with the
  template plan (smuggled exercises ignored); `_empty` and unknown ids → `empty_workout` on a cold
  start without a router crash; a custom id waits for templates, then → `custom_templates`; Pro
  custom starts; Pro isn't bounced while the tier loads; a running session is untouched by a lapse.
  `/workout-preview` guard for custom, unknown, built-in (Start passes the template plan) and Pro.
- `requirePro.test.tsx` — the five `useRequirePro` screens: Basic → paywall with the right
  `?feature=`, Pro renders, no redirect while loading.
- `homeGates.test.tsx` — empty-workout hero, New template / New folder, locked cards and the
  lapsed banner, template menu Rename / Move / Edit gated and Hide / Delete ungated, folder rename
  ungated, Suggested excludes custom templates on Basic.
- `tabGates.test.tsx` — Exercises **+**, create-from-search, detail-sheet Edit on a custom
  exercise; History trophy / calendar; PR badges hidden on Basic.
- `midWorkoutGates.test.tsx` — add / replace paywalls, remove allowed, built-in alert for all
  three, Save as / Overwrite gated with the workout left running on Basic, Pro overwrite.
- `templateBuilderGates.test.tsx` — "Create '<query>'" opens the builder for Pro; a lapse while
  building redirects.
- `paywall.test.tsx` — annual pre-selected with Best value, fallback and store prices, savings,
  feature highlight from `?feature=` (unknown ignored), unavailable and loading states,
  unloaded-plan and purchase-failure alerts, restore alerts, guest view, current plan card
  (Renews / Lifetime / Until, Manage), skeleton while loading, dev testing buttons.

Not covered:

- The picker's "Create '<query>'" gate on Basic, in both the template builder and the active
  workout: both pickers sit behind Pro already (screen gate / add-exercise gate), so the row is
  unreachable on Basic in the UI; its gate is defence in depth.
- Release-build hiding of **Grant Pro (testing)** in the UI (Jest runs with `__DEV__` true); the
  store's release handling of the override is covered.
- Real store purchase sheets and RevenueCat network behaviour (mocked).
