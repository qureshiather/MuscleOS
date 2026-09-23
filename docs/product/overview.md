# MuscleOS — Product Overview

## What it is

MuscleOS is a **strength-training log for the gym floor**. You pick a workout, log your sets
as you do them, and the app tells you what you lifted last time and which muscles are still
recovering. It is a mobile app (Expo / React Native, iOS + Android) with a small Next.js
marketing site.

The app is built around a single loop:

1. **Pick a workout** — a built-in program, one of your own templates, or nothing at all
2. **Log sets** — weight and reps per set, with a rest timer between them
3. **Finish** — the session is saved, the muscles you trained enter recovery
4. **Come back** — the app shows what you lifted last time and suggests what's ready to train

Everything else in the app — recovery map, history, PRs, progression charts — is a view over
the sessions produced by that loop.

## Who it's for

Lifters who train with weights on a repeating split (push/pull/legs, upper/lower, 5×5) and
want a log that is faster than a notes app and less bloated than a coaching platform. The
app assumes free-weight and machine work in a gym, not running, cycling, or classes.

It is deliberately **not** a coach. It does not prescribe weights, generate programs, count
calories, or score your form. It records what you did and shows it back to you.

## Design principles

**Fast on the gym floor.** The set row is the most important UI in the app. Weight and reps
are number-pad integers, the previous session's numbers are always visible, and completing a
set starts the rest timer without another tap.

**Local-first.** Every feature works offline against on-device storage. A Supabase account is
optional and adds backup and multi-device sync — it is never required to log a workout. See
[accounts-and-data.md](../features/accounts-and-data.md).

**Honest about what it knows.** Recovery is presented at day granularity ("Ready tomorrow")
rather than a fake percentage, because the underlying model is a fixed per-muscle timer, not
a physiological simulation. Strength standards are only shown for exercises that have real
reference data.

**Free tier is a real gym log.** Built-in programs, unlimited logging, rest timers, recovery,
history, and export are free. Pro sells customization and analytics, not the core loop. See
[subscriptions.md](../features/subscriptions.md).

**Built-in content is immutable; your content is yours.** See below.

## The central assumption: built-in vs custom

This distinction runs through templates and exercises, and it is the most important thing to
understand about the app's data model.

|  | **Built-in** | **Custom** |
|--|--------------|------------|
| Where it lives | Compiled into the app (templates) or the shared catalog (exercises) | Your device, and your account if linked |
| Who can see it | Everyone | Only you |
| Can you edit it? | **No** | **Yes** |
| Can you delete it? | No — you can **hide** it | Yes |
| Can you use it on Basic? | Yes | Templates: **no**, Pro required to run. Exercises: yes once created (creating needs Pro) |
| Identified by | `isBuiltIn: true` (templates); catalog id (exercises) | `tpl_*` / `custom_*` ids |

Built-in content is immutable because it is shipped code, shared by every user, and referenced
by ids that must stay stable. Editing a built-in template would fork it per-device and break
that guarantee. Instead, the app lets you **run a built-in template, change the session as you
go, and save the result as a new custom template** — the original stays pristine.

Hiding rather than deleting built-ins keeps ids resolvable: a session logged two years ago
still renders its exercise names even if you've since hidden that program.

Details: [templates.md](../features/templates.md), [exercise-library.md](../features/exercise-library.md).

## Screen map

Five tabs plus a stack of pushed screens. Full route table, navigator options, and app boot
sequence: [accounts-and-data.md](../features/accounts-and-data.md#navigation-and-app-boot).

### Tabs

| Tab | Route | Purpose | Spec |
|-----|-------|---------|------|
| **Exercises** | `/(tabs)/exercises` | Browse and search the ~399-exercise catalog; muscle maps, instructions, personal notes | [exercise-library.md](../features/exercise-library.md) |
| **Recovery** | `/(tabs)/recovery` | Body diagram of which muscles are still recovering and when each is ready | [recovery.md](../features/recovery.md) |
| **Workouts** | `/(tabs)/index` | Home. Start a workout: empty, suggested, recent, or from the template library | [templates.md](../features/templates.md) |
| **History** | `/(tabs)/history` | Reverse-chronological list of finished sessions with duration, volume, and every completed set | [history-analytics.md](../features/history-analytics.md) |
| **Profile** | `/(tabs)/profile` | Settings, biodata, then Account (subscription, data, deletion, legal) | [accounts-and-data.md](../features/accounts-and-data.md) |

### Pushed screens

| Screen | Route | Purpose | Tier | Spec |
|--------|-------|---------|------|------|
| Workout preview | `/workout-preview` | Review a template's exercises and last-session numbers before starting | — | [templates.md](../features/templates.md#workout-preview) |
| Active workout | `/active-workout` | The set-logging screen and rest timer | — | [workout-logging.md](../features/workout-logging.md) |
| Create / edit template | `/create-template` | Name a template and choose and order its exercises | **Pro** | [templates.md](../features/templates.md#creating-and-editing) |
| Create / edit exercise | `/create-exercise` | Define a custom exercise | **Pro** | [exercise-library.md](../features/exercise-library.md#custom-exercises) |
| Personal records | `/personal-records` | Best estimated 1RM per exercise, with strength level | **Pro** | [history-analytics.md](../features/history-analytics.md#personal-records) |
| Exercise progression | `/exercise-progression` | Estimated-1RM chart over time for one exercise | **Pro** | [history-analytics.md](../features/history-analytics.md#exercise-progression) |
| Monthly calendar | `/history-monthly` | Month grid of training days | **Pro** | [history-analytics.md](../features/history-analytics.md#monthly-calendar) |
| Subscription | `/subscription` | Paywall, plan selection, restore purchases | — | [subscriptions.md](../features/subscriptions.md) |
| Settings | `/settings` | Appearance, units, sounds | — | [accounts-and-data.md](../features/accounts-and-data.md#settings) |
| Data | `/data` | Sync, export, clear this device | — | [accounts-and-data.md](../features/accounts-and-data.md#settings) |
| Auth | `/auth`, `/auth-email`, `/auth-new-password` | Link an account via Apple, Google, or email. Recovery mail opens New password. | — | [accounts-and-data.md](../features/accounts-and-data.md#authentication) |

## Cross-cutting assumptions

These hold app-wide. Individual feature specs list their own on top of these.

**Weight is stored in kilograms.** `weightKg` is the canonical unit everywhere in storage,
sync, and every calculation. Pounds exist only as a display conversion at the UI edge
(`apps/mobile/src/utils/weightUnits.ts`), using the factor 2.20462. Height is stored in cm.

**Weight and reps are the only tracked metrics.** Every exercise is logged as weight × reps.
There is no duration, distance, or bodyweight-only logging mode — `Exercise.trackingType`
exists in the type but the logging UI ignores it.

**One workout at a time.** A single in-progress session is persisted; starting a second is
blocked while one is open. It survives app restarts and is resumable from a pill in the tab bar.

**Sessions drive derived training data.** Recovery, personal records, and home stats are
recomputed from the session list. "Previous" set values are different: they are a persisted,
synced snapshot of the most recent qualifying session and are rebuilt when a session is deleted.

**Only completed sets count.** A set with `completed: false` is saved with the session but is
excluded from volume, recovery, PRs, and the finish summary. Completed warm-up sets currently
count toward volume and recovery; see
[history-analytics.md](../features/history-analytics.md#volume).

**Days and weeks are local-timezone.** Streaks, calendar days, and "trained today" all use the
device's local calendar. Weeks start **Monday**.

**Time-based recovery.** A trained muscle is unavailable for a fixed number of hours, then
fully ready. There is no partial-recovery percentage and no input from load, sleep, or age.

**The catalog is additive.** Exercise ids are never deleted, only unpublished, so historical
sessions always resolve.

## Deliberately not built

Listed so they don't get re-proposed as bugs or half-specified in future work.

| Not built | Note |
|-----------|------|
| Plate calculator | Not implemented. Previously listed in monetization docs in error. |
| Session detail screen | History cards show full detail inline; there is no drill-down route. |
| Live PR detection during a workout | PRs are computed on read on the PR screen, not surfaced mid-session. |
| HealthKit / Google Fit | No integration. `healthStore` holds macro/BMR helpers with no UI. |
| Data import | Export is one-way JSON. |
| Program periodization, RPE, drop sets, supersets | No data model support. |
| Cardio, distance, or duration tracking | Out of scope. |
