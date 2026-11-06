import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { ScreenColumn } from '@/components/layout/responsive';
import { CommunitySearchScreen } from '@/features/community/CommunitySearch';
import { SpaceFlavor } from '@/theme/space';

/** A crash here shows Try again and a way home, not a blank screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="community" />;
}

/** Search inside a community (features/community/CommunitySearch). */
export default function CommunitySearchRoute() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <SpaceFlavor>
      <ScreenColumn>
        <CommunitySearchScreen id={id ?? ''} name={typeof name === 'string' && name ? name : undefined} />
      </ScreenColumn>
    </SpaceFlavor>
  );
}
