import { useRouter } from 'expo-router';
import { memo, type ComponentProps } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';

/**
 * A member's avatar that opens their profile (/person/[id]) on tap, as in
 * posts and comments. The avatar itself is drawn as everywhere else.
 */
export const ProfileAvatar = memo(function ProfileAvatar(props: ComponentProps<typeof Avatar>) {
  const router = useRouter();
  const id = props.userId;
  if (!id) return <Avatar {...props} />;
  return (
    <PressableScale haptic="select" scaleTo={0.9} hitSlop={4} onPress={() => router.push(`/person/${id}`)} accessibilityRole="button" accessibilityLabel={tx('Open {name}’s profile', { name: props.name })}>
      <Avatar {...props} />
    </PressableScale>
  );
});
