import { StyleSheet } from 'react-native';

/**
 * Shared tab screen title + subtitle (aligned with Workouts).
 * Use with theme colors: `style={[screenHeaderStyles.title, { color: colors.text }]}`.
 */
export const screenHeaderStyles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 20,
  },
  /** Header block inside a ScrollView that already has screen padding */
  headerInScroll: {
    marginBottom: 8,
  },
  /** Fixed header above main content (not inside ScrollView) */
  headerFixed: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  /** Default ScrollView content padding for tab root screens */
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
});
