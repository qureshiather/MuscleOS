import { StyleSheet } from 'react-native';

export const fontFamily = {
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export const typography = StyleSheet.create({
  screenTitle: {
    fontFamily: fontFamily.sansBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  data: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    lineHeight: 20,
  },
  dataLarge: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  button: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
});
