import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { ConversationView } from '@/features/messages/ConversationView';
import { SpaceFlavor } from '@/theme/space';

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="thread" />;
}

/**
 * A conversation as a page (phones, links, notifications). On wide screens
 * Messages shows the same view in a pane next to the list.
 */
// Opened from IRLY Girl, the chat wears the Girl look (cosmetic only, see theme/space).
export default function ThreadRoute() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  return (
    <SpaceFlavor>
      <ConversationView id={id} draft={typeof draft === 'string' ? draft : undefined} />
    </SpaceFlavor>
  );
}
