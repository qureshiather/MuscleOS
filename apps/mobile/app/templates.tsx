import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Templates are now shown on the Workouts tab. Redirect so deep links to /templates
 * still land in the right place.
 */
export default function TemplatesScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return null;
}
