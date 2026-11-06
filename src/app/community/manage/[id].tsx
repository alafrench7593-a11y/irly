import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { ScreenColumn } from '@/components/layout/responsive';
import { ManageCommunityScreen } from '@/features/community/ManageCommunity';
import { SpaceFlavor } from '@/theme/space';

/** A crash here shows Try again and a way home, not a blank screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="community" />;
}

/** « Manage the community »: for its team only (features/community/ManageCommunity). */
export default function ManageCommunityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SpaceFlavor>
      <ScreenColumn>
        <ManageCommunityScreen id={id ?? ''} />
      </ScreenColumn>
    </SpaceFlavor>
  );
}
