import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { NotFound } from '@/components/layout/NotFound';
import { ActivityDetailView } from '@/features/activity/ActivityDetailView';
import { isDemoId } from '@/features/girl/demo';
import { DemoPlanScreen } from '@/features/girl/DemoScreens';
import { hasBackend } from '@/lib/supabase';
import { SpaceFlavor } from '@/theme/space';

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="activity" />;
}

/**
 * The page of a member activity or event, full screen
 * (features/activity/ActivityDetailView, also shown in a pane on wide screens).
 */
export default function ActivityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  // The demonstration build's IRLY Girl plans (example content, nothing saved).
  // The demo has no server: any other activity link is gone (never a sign-in wall that leads nowhere).
  return <SpaceFlavor>{isDemoId(id) ? <DemoPlanScreen id={id} /> : hasBackend ? <ActivityDetailView id={id} /> : <NotFound title="This activity is no longer available" />}</SpaceFlavor>;
}
