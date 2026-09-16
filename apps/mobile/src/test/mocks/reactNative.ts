/**
 * Minimal react-native stand-in for Node-based Vitest, wired in via a Vitest alias
 * (see vitest.config.mts). Only the surface the app's non-UI modules touch at import time —
 * `AppState` (event subscription) and `Platform` — is implemented. UI primitives are not, on
 * purpose: components still require a renderer and are out of scope for unit tests.
 */
export const AppState = {
  currentState: 'active' as const,
  addEventListener: (_type: string, _handler: (state: string) => void) => ({
    remove() {
      /* no-op */
    },
  }),
};

export const Platform = {
  OS: 'ios' as const,
  select: <T,>(specifics: { ios?: T; android?: T; default?: T }): T | undefined =>
    specifics.ios ?? specifics.default,
};
