# MuscleOS

Fitness/workout tracking app (Expo React Native) with a Next.js landing site. Monorepo managed with pnpm + Turborepo.

## Prerequisites

- Node.js ≥ 20
- pnpm 9.x

## Quick start

```bash
pnpm install
pnpm dev          # mobile + landing
pnpm dev:landing  # landing only (port 3001)
```

Mobile app: `cd apps/mobile && pnpm dev`

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

Product and engineering specs live in [`docs/`](docs/). That folder is the source of truth — not scattered READMEs in app directories.

| Area | Path |
|------|------|
| Monetization | [`docs/monetization/`](docs/monetization/) |
| EAS builds | [`docs/mobile/eas-build.md`](docs/mobile/eas-build.md) |
| Supabase / sync | [`docs/supabase/setup.md`](docs/supabase/setup.md) |

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
