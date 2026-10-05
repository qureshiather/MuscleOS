# Pricing — Free Forever, Coaching Later

**MuscleOS is free.** Every feature in the app is available to everyone, with or without an
account, forever. There are no tiers, no paywall, no trial, no ads, and no in-app purchases.

| | |
|--|--|
| Tiers | None. There is no Basic / Pro distinction anywhere in code, copy or storage |
| Purchases | None. The app ships no billing SDK (RevenueCat was removed) and no store products |
| Account | Optional. Linking one adds backup and multi-device sync; it unlocks nothing else |

## What's included

Everything, for everyone:

- 9 built-in templates (PPL, Upper/Lower, Strong Lifts 5×5), and **custom templates and folders**
  — create, edit, run
- **Empty / ad-hoc workouts**
- Full set logging, warm-ups, rest timers, sounds, notifications
- **Mid-workout edits on any workout** — add, replace, remove and reorder exercises, built-in
  workouts included (built-in *templates* stay immutable; see below)
- **Save a finished workout as a template**, or overwrite the custom template it came from
- Exercise library, search, filters, notes, and **custom exercises**
- Recovery map
- History, **personal records and estimated 1RM**, **progression charts**, the **monthly
  calendar**, and PR badges on session cards
- Cloud backup and sync with an account; JSON export and import

## Built-in templates are still immutable

This was never a commercial rule. Built-in templates are shipped code shared by every user and
referenced by stable ids, so nobody can rename, edit, move or delete one (hide it instead). You can
change a built-in *workout* while it runs and save the result as a new custom template. See
[product/overview.md](../product/overview.md#the-central-assumption-built-in-vs-custom).

## Coaching — the future paid offering

MuscleOS will make money from **Coaching**, which is not built yet:

- **Personal trainers** give their clients programs to run in MuscleOS (a trainer portal).
- **The MuscleOS AI coach** builds a program around the user's goals and adapts it to what they log.

Nothing in the app today is held back for Coaching. When it ships it gets its own spec, including
how it's billed. Planned work lives in Linear (project **Coaching**).

## Upgrading from a build that had Pro

Older builds stored a cached tier (`muscleos_subscription`) and a dev "Grant Pro" override
(`muscleos_dev_pro_override`). `removeLegacyStorageKeys()` deletes both on every launch
(`LEGACY_STORAGE_KEYS` in `src/storage/keys.ts`). No user data depended on them. Export files from
older builds may carry a `subscription` field; import ignores it.

## Tests

- `src/storage/localStorage.settings.test.ts` — legacy subscription keys are removed on launch;
  export never includes `subscription`
- `src/test/ui/workout/deepLinks.test.tsx` — a guest can start any built-in, custom, empty or ad-hoc
  workout by deep link; Add Exercise works on a built-in workout with no alert
- `src/test/ui/templates/home.test.tsx` — custom templates show no lock, open the preview and
  appear in Suggested / Recent; nothing on the Workouts tab mentions Pro or upgrading
- `src/test/ui/accounts/account.test.tsx` — Account has no Subscription row and no Pro copy
- The former Pro screens (create template / exercise, PRs, progression, calendar) are tested
  without any tier setup in their own suites
