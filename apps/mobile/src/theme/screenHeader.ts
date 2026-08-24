import { StyleSheet } from 'react-native';
import { spacing } from './tokens';
import { typography } from './typography';

/**
 * Shared tab screen title + subtitle.
 * Use with theme colors: `style={[screenHeaderStyles.title, { color: colors.text }]}`.
 */
export const screenHeaderStyles = StyleSheet.create({
  title: {
    ...typography.screenTitle,
  },
  subtitle: {
    ...typography.screenSubtitle,
    marginTop: spacing.xs / 2,
  },
  headerInScroll: {
    marginBottom: spacing.sm,
  },
  headerFixed: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
