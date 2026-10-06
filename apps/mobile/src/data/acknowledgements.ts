/**
 * Open-source notices shown on the Acknowledgements screen. MIT and the SIL OFL both require the
 * copyright notice and license to ship with the app. One entry per runtime dependency in
 * `apps/mobile/package.json` (enforced by acknowledgements.test.ts).
 * Spec: docs/features/accounts-and-data.md#acknowledgements
 */

export type LicenseId = 'MIT' | 'OFL-1.1';

export type Acknowledgement = {
  /** npm package (or font family) name. */
  name: string;
  license: LicenseId;
  copyright: string;
};

const EXPO = 'Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)';

/** Bundled fonts, under the SIL Open Font License. */
export const FONT_ACKNOWLEDGEMENTS: readonly Acknowledgement[] = [
  {
    name: 'DM Sans',
    license: 'OFL-1.1',
    copyright: 'Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)',
  },
  {
    name: 'DM Mono',
    license: 'OFL-1.1',
    copyright: 'Copyright 2020 The DM Mono Project Authors (https://www.github.com/googlefonts/dm-mono)',
  },
];

/** Runtime npm dependencies, all MIT. */
export const PACKAGE_ACKNOWLEDGEMENTS: readonly Acknowledgement[] = [
  { name: 'react-native-body-highlighter', license: 'MIT', copyright: 'Copyright (c) 2022 ELABBASSI Hicham' },
  { name: '@expo-google-fonts/dm-mono', license: 'MIT', copyright: 'Copyright (c) 2020 Expo' },
  { name: '@expo-google-fonts/dm-sans', license: 'MIT', copyright: 'Copyright (c) 2020 Expo' },
  { name: '@expo/metro-runtime', license: 'MIT', copyright: EXPO },
  { name: '@expo/vector-icons', license: 'MIT', copyright: 'Copyright (c) 2015 Joel Arvidsson' },
  {
    name: '@react-native-async-storage/async-storage',
    license: 'MIT',
    copyright: 'Copyright (c) 2015-present, Facebook, Inc.',
  },
  { name: '@react-native-google-signin/google-signin', license: 'MIT', copyright: 'Copyright (c) 2015 Apptailor' },
  {
    name: '@react-navigation/bottom-tabs',
    license: 'MIT',
    copyright: 'Copyright (c) 2017 React Navigation Contributors',
  },
  { name: '@supabase/supabase-js', license: 'MIT', copyright: 'Copyright (c) 2020 Supabase' },
  { name: 'expo', license: 'MIT', copyright: EXPO },
  { name: 'expo-apple-authentication', license: 'MIT', copyright: EXPO },
  { name: 'expo-audio', license: 'MIT', copyright: EXPO },
  { name: 'expo-auth-session', license: 'MIT', copyright: EXPO },
  { name: 'expo-constants', license: 'MIT', copyright: EXPO },
  { name: 'expo-document-picker', license: 'MIT', copyright: EXPO },
  { name: 'expo-file-system', license: 'MIT', copyright: EXPO },
  { name: 'expo-font', license: 'MIT', copyright: EXPO },
  { name: 'expo-linking', license: 'MIT', copyright: EXPO },
  { name: 'expo-notifications', license: 'MIT', copyright: EXPO },
  { name: 'expo-router', license: 'MIT', copyright: EXPO },
  { name: 'expo-secure-store', license: 'MIT', copyright: EXPO },
  { name: 'expo-sharing', license: 'MIT', copyright: EXPO },
  { name: 'expo-status-bar', license: 'MIT', copyright: EXPO },
  { name: 'expo-web-browser', license: 'MIT', copyright: EXPO },
  { name: 'react', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.' },
  { name: 'react-native', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.' },
  { name: 'react-native-draggable-flatlist', license: 'MIT', copyright: 'Copyright (c) 2019 computerjazz' },
  {
    name: 'react-native-gesture-handler',
    license: 'MIT',
    copyright: 'Copyright (c) 2016 Software Mansion <swmansion.com>',
  },
  { name: 'react-native-reanimated', license: 'MIT', copyright: 'Copyright (c) 2016 Software Mansion <swmansion.com>' },
  { name: 'react-native-safe-area-context', license: 'MIT', copyright: 'Copyright (c) 2019 Th3rd Wave' },
  { name: 'react-native-screens', license: 'MIT', copyright: 'Copyright (c) 2018 Software Mansion <swmansion.com>' },
  { name: 'react-native-svg', license: 'MIT', copyright: 'Copyright (c) 2015-2016 Horcrux' },
  { name: 'react-native-url-polyfill', license: 'MIT', copyright: 'Copyright (c) 2019 Nicolas Charpentier' },
  { name: 'react-native-worklets', license: 'MIT', copyright: 'Copyright (c) 2024 nobody' },
  { name: 'zustand', license: 'MIT', copyright: 'Copyright (c) 2019 Paul Henschel' },
];

/** Workspace packages are MuscleOS's own code and need no notice. */
export const OWN_PACKAGE_PREFIX = '@muscleos/';

/** Runtime dependencies with no entry in PACKAGE_ACKNOWLEDGEMENTS. */
export function missingAcknowledgements(dependencies: readonly string[]): string[] {
  const listed = new Set(PACKAGE_ACKNOWLEDGEMENTS.map((a) => a.name));
  return dependencies.filter((d) => !d.startsWith(OWN_PACKAGE_PREFIX) && !listed.has(d));
}
