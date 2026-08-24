# Monetization Overview

## Goal

MuscleOS should feel **complete on Basic** and **worth upgrading on Pro** when a lifter outgrows built-in programs. Monetization sells customization, flexibility, and progress analytics—not core workout logging.

## Tiers

| Tier | Price | Audience |
|------|-------|----------|
| **Basic** | Free | Anyone starting out or running built-in programs |
| **Pro** | Subscription or lifetime | Lifters who want their own templates, custom exercises, flexible sessions, and analytics |
| **Lifetime** | One-time purchase | Same as Pro, forever |

There is **one Pro entitlement** (`MuscleOS Pro`). Monthly, annual, and lifetime all unlock the same features.

## Design principles

1. **Basic is a real gym log** — not a crippled demo. Built-in templates, full session logging, recovery, and history stay free.
2. **Pro = growth path** — custom programs, ad-hoc workouts, and progress tracking are the natural upgrade once someone has a routine.
3. **Generous free tier builds habit** — recovery visualization and export stay ungated to drive daily use and trust.
4. **Account before purchase** — subscriptions tie to Supabase identity so Pro restores across devices.
5. **RevenueCat is billing truth** — the app reads entitlements from RevenueCat; Supabase handles auth only (Phase 2 may add webhook audit/sync).

## User flows

### Basic user

1. Opens app (anonymous Supabase session).
2. Starts a built-in template (PPL, Upper/Lower, etc.).
3. Logs sets, uses rest timers, checks recovery.
4. Hits a Pro action (e.g. create template) → paywall with context.

### Pro subscriber

1. Links account (email / Apple / Google).
2. Chooses monthly, annual, or lifetime on Subscription screen.
3. RevenueCat grants `MuscleOS Pro`.
4. Custom templates, analytics, and flexible workouts unlock.

### Restore on new device

1. Sign in with linked account.
2. Tap **Restore purchases** (or automatic RC login on init).
3. Entitlement syncs via RevenueCat `appUserID = supabase user.id`.

## Phase 2 (not promised in marketing yet)

- Cloud backup / multi-device data sync (Supabase + RC webhooks)
- Apple Watch / widgets
- Advanced program builder (periodization, RPE)

See [pricing.md](pricing.md), [features.md](features.md), and [technical.md](technical.md) for details.
