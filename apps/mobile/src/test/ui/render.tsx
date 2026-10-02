/**
 * Screen-test harness. `renderApp` mounts real expo-router screens from `app/` inside the same
 * providers the root layout uses (safe area + theme), without the root layout's side effects
 * (auth init, sync, notifications). Seed state through the real stores before rendering.
 */
import type { ComponentType } from 'react';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '@/theme/ThemeContext';
import { useSubscriptionStore } from '@/store/subscriptionStore';

function TestRootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Stand-in for any route a test navigates to but doesn't render (e.g. the paywall). */
export function routeStub(name: string): ComponentType {
  return function RouteStub() {
    const { Text } = require('react-native');
    return <Text>{`route:${name}`}</Text>;
  };
}

export type Routes = Record<string, ComponentType>;

/** Mount `routes` (expo-router file paths without extension, e.g. `'(tabs)/index'`) at `initialUrl`. */
export function renderApp(routes: Routes, initialUrl = '/') {
  return renderRouter({ _layout: TestRootLayout, ...routes }, { initialUrl });
}

export function setPro(isPro: boolean): void {
  useSubscriptionStore.setState({
    state: isPro ? { tier: 'pro', plan: 'annual' } : { tier: 'basic' },
    isLoading: false,
  });
}

export async function resetAppState(): Promise<void> {
  await AsyncStorage.clear();
  setPro(false);
}
