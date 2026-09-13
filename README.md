# MuscleOS

Strength-training log (Expo React Native) with a Next.js landing site. Monorepo managed with pnpm + Turborepo.

## Prerequisites

- Node.js ≥ 20
- pnpm 9.x

## Quick start

```bash
pnpm install
pnpm dev          # mobile + landing
pnpm dev:landing  # landing only (port 3001)
pnpm check        # biome + typecheck + tests (also runs in GitHub Actions)
```

Mobile app: `cd apps/mobile && pnpm dev`

CI (GitHub Actions on `main` and PRs) runs the same `pnpm check` pipeline: Biome, TypeScript, and Vitest via Turbo.

## Expo login

```bash
cd apps/mobile
pnpx expo login
```

Credentials: username `twaxter` (password in team vault).

## Expo MCP (optional)

```bash
cd apps/mobile
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

## Environment variables

| App | File | Docs |
|-----|------|------|
| Mobile | `apps/mobile/.env` | [Supabase setup](docs/supabase/setup.md), [RevenueCat setup](docs/monetization/revenuecat-setup.md) |
| Supabase CLI | `supabase/.env` | [Supabase setup](docs/supabase/setup.md) |

Copy from each directory's `.env.example` where present.

## Specs & docs

Product and engineering specs live in [`docs/`](docs/). That folder is the source of truth for what
the app does — not scattered READMEs in app directories. Start at
[`docs/README.md`](docs/README.md).

| Area | Path |
|------|------|
| **What the app is** — principles, screen map, assumptions | [`docs/product/overview.md`](docs/product/overview.md) |
| **Feature specs** — index and Basic/Pro tier matrix | [`docs/features/README.md`](docs/features/README.md) |
| Test coverage and gaps | [`docs/engineering/testing.md`](docs/engineering/testing.md) |
| Subscriptions — tiers and gates | [`docs/features/subscriptions.md`](docs/features/subscriptions.md) |
| Monetization — pricing, RevenueCat, launch | [`docs/monetization/`](docs/monetization/) |
| EAS builds | [`docs/mobile/eas-build.md`](docs/mobile/eas-build.md) |
| Supabase / sync | [`docs/supabase/setup.md`](docs/supabase/setup.md) |

Changing a feature? Update its spec in the same change — see
[keeping docs in sync](docs/README.md#keeping-docs-in-sync).

## Troubleshooting

### Sign-in times out on Android emulator

If email sign-in hangs ~15s then fails, the emulator often has broken DNS (IPs work but hostnames do not).

1. **Device Manager** → emulator dropdown → **Cold Boot Now**
2. Or wipe emulator data and restart
3. Or start the AVD with explicit DNS: `emulator -avd YOUR_AVD -dns-server 8.8.8.8,8.8.4.4`
4. Or test auth on **iOS simulator** or a **physical device** on the same Wi‑Fi

Verify: host machine can reach Supabase (`curl https://YOUR_PROJECT.supabase.co/auth/v1/health` should return quickly).

## Agent guide

Code conventions and monorepo patterns: [`AGENTS.md`](AGENTS.md)
