import { Redirect } from 'expo-router';

/**
 * Templates are now shown on the Workouts tab. Redirect so deep links to /templates
 * still land in the right place. `<Redirect>` (not `router.replace` in an effect) so a cold-start
 * deep link doesn't navigate before the root navigator has mounted.
 */
export default function TemplatesScreen() {
  return <Redirect href="/(tabs)" />;
}
